const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth.jwt');
const getTenantDB = require('../utils/tenantDB');

const TMS_BASE_URL = process.env.TMS_URL || 'http://localhost:5002';
const INTEGRATION_KEY = process.env.HRMS_INTEGRATION_KEY || 'hrms_secret_key_999';

/**
 * GET /api/tasks
 * Proxies to TMS using the system integration key to fetch dashboard data by email.
 */
router.get('/', auth.authenticate, async (req, res) => {
    try {
        let userEmail = req.user?.email || null;

        // Fetch employee profile for richer TMS lookup (some TMS installs map by employeeId)
        let employeeId = null;
        let employeeName = null;
        try {
            const userId = req.user?.id || req.user?._id || req.user?.userId || null;
            if (req.tenantId && userId) {
                const db = await getTenantDB(req.tenantId);
                if (!db.models.Employee) {
                    db.model('Employee', require('../models/Employee'));
                }
                const Employee = db.model('Employee');
                const emp = await Employee.findById(userId).select('employeeId firstName lastName email').lean();
                employeeId = emp?.employeeId || null;
                employeeName = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || null;
                if (!userEmail && emp?.email) userEmail = emp.email;
            }
        } catch (_) { }

        // Final fallback: if email is still missing, try common JWT fields.
        if (!userEmail) {
            userEmail = req.user?.username || req.user?.login || req.user?.upn || null;
        }

        // TMS prefers email, but if we can't derive it, we still try with employeeId/name.
        if (!userEmail && !employeeId && !employeeName && !req.user?.name) {
            return res.status(400).json({ success: false, message: 'User identifier not found in session' });
        }

        const requestBody = {
            email: userEmail,
            employeeId,
            name: employeeName || req.user?.name || null,
            includeCompleted: true,
            limit: 50,
            // Best-effort flags: if TMS supports them, it can return all assigned workspaces/projects/tasks.
            // If not supported, TMS will safely ignore unknown fields.
            includeAllWorkspaces: true,
            includeAllProjects: true,
            includeUnassigned: true,
            companyId: req.user?.tenantId || req.user?.companyId || req.user?.tenant || req.user?.company || req.tenantId,
            companyCode: req.user?.companyCode || req.user?.tenantCode || req.user?.company_code || req.user?.tenant_code
        };

        console.log(`[TASK_PROXY] Fetching TMS dashboard for: ${userEmail} in company: ${req.tenantId}`);
        console.log('[TASK_PROXY] req.user:', JSON.stringify(req.user, null, 2));
        console.log('[TASK_PROXY] req.tenantId:', req.tenantId);
        console.log('[TASK_PROXY] TMS request body:', JSON.stringify(requestBody, null, 2));
        
        const postToTms = (body) =>
            axios.post(`${TMS_BASE_URL}/api/v1/integrations/hrms/dashboard`, body, {
                headers: {
                    'x-integration-key': INTEGRATION_KEY,
                    'Content-Type': 'application/json'
                }
            });

        // Use the system integration endpoint which doesn't rely on the user's JWT specific claims
        let response;
        try {
            response = await postToTms(requestBody);
        } catch (err) {
            const message =
                err?.response?.data?.error?.message ||
                err?.response?.data?.message ||
                err?.message ||
                '';

            // TMS can fail when it derives a Mongo DB name that exceeds Mongo's 38-byte limit.
            // Retrying without company context lets TMS resolve a default workspace DB (often shorter).
            const looksLikeDbNameTooLong =
                String(message).toLowerCase().includes('database name') &&
                String(message).toLowerCase().includes('too long');

            if (!looksLikeDbNameTooLong) throw err;

            console.warn('[TASK_PROXY] TMS rejected company context; retrying without companyId/companyCode');
            response = await postToTms({
                email: userEmail,
                includeCompleted: true,
                limit: 50,
                includeAllWorkspaces: true,
                includeAllProjects: true,
                includeUnassigned: true
            });
        }

        // Some deployments return { data: {...} } while others return the payload at root.
        const tmsData = response.data?.data || response.data || {};
        console.log(`[TASK_PROXY] TMS Response for ${userEmail}:`, JSON.stringify(tmsData, null, 2));
        
        const workspaces = tmsData.workspaces || [];
        
        // Accumulate projects and tasks across all workspaces
        const projectsMap = new Map();
        const seenTaskIds = new Set();

        const statusMap = {
            'new_task': 'new_task',
            'new': 'new_task',
            'scheduled': 'scheduled',
            'in_progress': 'in_progress',
            'in review': 'in_review',
            'in_review': 'in_review',
            'review': 'in_review',
            'done': 'completed',
            'completed': 'completed',
            'complete': 'completed',
            'closed': 'completed',
        };

        const upsertProject = (pLike, fallback = {}) => {
            const pidRaw = pLike?.id ?? pLike?._id ?? fallback?.id ?? 'unassigned';
            const pid = String(pidRaw);
            if (!projectsMap.has(pid)) {
                projectsMap.set(pid, {
                    id: pid,
                    name: pLike?.name || fallback?.name || 'Tasks',
                    color: pLike?.color || fallback?.color || '#64748b',
                    tasks: []
                });
            }
            return pid;
        };

        const pushTask = (pid, t) => {
            const tidRaw = t?.id ?? t?._id;
            const tid = tidRaw ? String(tidRaw) : null;
            if (tid && seenTaskIds.has(tid)) return;
            if (tid) seenTaskIds.add(tid);

            const rawStatus = String(t?.status || '').toLowerCase().replace(/-/g, '_');
            const mappedStatus = statusMap[rawStatus] || rawStatus || 'new_task';

            projectsMap.get(pid).tasks.push({
                id: tidRaw || `${pid}-${projectsMap.get(pid).tasks.length + 1}`,
                title: t?.title || t?.name || 'Task',
                status: mappedStatus,
                priority: t?.priority,
                dueDate: t?.dueDate || t?.due_date || t?.due || null
            });
        };

        workspaces.forEach(ws => {
            // Add all projects user is a member of
            (ws.projects || []).forEach(p => {
                upsertProject(p, { color: '#3B82F6' });
            });

            // 1) Distribute tasks from ws.tasks (some deployments return this)
            (ws.tasks || []).forEach(t => {
                const pid = upsertProject(t?.project, { name: t?.project?.name || 'Tasks', color: '#64748b' });
                pushTask(pid, t);
            });

            // 1.1) Some board payloads return columns/lists on workspace level
            (ws.columns || ws.lists || ws.boardColumns || []).forEach(col => {
                (col?.tasks || col?.items || []).forEach(t => {
                    const pid = upsertProject(t?.project, { name: t?.project?.name || 'Tasks', color: '#64748b' });
                    pushTask(pid, t);
                });
            });

            // 2) Distribute tasks from ws.projects[].tasks (common board-style payloads)
            (ws.projects || []).forEach(p => {
                const pid = upsertProject(p, { color: p?.color || '#3B82F6' });
                (p?.tasks || p?.items || []).forEach(t => {
                    // If task doesn't embed its project, attach implied project
                    const tWithProject = t?.project ? t : { ...t, project: { id: p?.id, name: p?.name } };
                    pushTask(pid, tWithProject);
                });

                // 2.1) Some payloads nest tasks under project columns
                (p?.columns || p?.lists || p?.boardColumns || []).forEach(col => {
                    (col?.tasks || col?.items || []).forEach(t => {
                        const tWithProject = t?.project ? t : { ...t, project: { id: p?.id, name: p?.name } };
                        pushTask(pid, tWithProject);
                    });
                });
            });
        });

        const projects = Array.from(projectsMap.values()).map(p => ({
            ...p,
            tasks: (p.tasks || []).sort((a, b) => {
                const ad = a?.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                const bd = b?.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                return ad - bd;
            })
        }));
        
        const totalTasks = projects.reduce((sum, p) => sum + p.tasks.length, 0);
        console.log(`[TASK_PROXY] Success. Projects: ${projects.length}, Total Tasks: ${totalTasks}`);
        if (projects.length > 0) {
            console.log(`[TASK_PROXY] First Project: ${projects[0].name}, Tasks: ${projects[0].tasks.length}`);
        }

        res.json({ success: true, projects });
    } catch (err) {
        console.error('[TASK_PROXY_ERR]', err.response?.status, err.message);
        if (err.response?.data) {
            console.log('[TASK_PROXY_ERR_BODY]', JSON.stringify(err.response.data, null, 2));
        } else {
            console.log('[TASK_PROXY_ERR_NO_BODY] error:', err.toString());
        }
        
        // Fallback for demo purposes if TMS is down or misconfigured
        res.json({ 
            success: true, 
            projects: [] 
        });
    }
});

module.exports = router;
