const AIService = require('../services/AIService');

exports.generateJobDescription = async (req, res) => {
    try {
        const { jobTitle, department, context } = req.body;

        if (!jobTitle) {
            return res.status(400).json({ message: 'Job Title is required for AI generation.' });
        }

        const data = await AIService.generateJobContent(jobTitle, department || 'General', context || {});
        res.json({ success: true, data });
    } catch (error) {
        console.error('[AIController] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const UNAUTHORIZED_MSG = 'You are not authorized to access this information.';

const ADMIN_ROLES = new Set(['admin', 'psa', 'company_admin', 'company_super_admin']);
const HR_ROLES = new Set(['hr']);
const EMPLOYEE_ROLES = new Set(['employee', 'manager']);

const SPELL_FIXES = {
    salery: 'salary',
    sallary: 'salary',
    comeing: 'coming',
    attandance: 'attendance',
    attandence: 'attendance',
    attendence: 'attendance',
    profie: 'profile',
    leav: 'leave',
    lev: 'leave',
    pagaer: 'pagar'
};

const GUJ_ROMAN_MARKERS = [' che ', ' chhe ', ' aaje ', ' aavyo ', ' hajri ', ' raja ', ' pagar ', ' mara ', ' mari ', ' hu '];
const HINDI_MARKERS = [' kya ', ' kaun ', ' mera ', ' meri ', ' kitna ', ' aaj ', ' chhutti ', ' vetan ', ' salary kitni '];
const NAME_STOPWORDS = new Set([
    'is', 'are', 'the', 'of', 'for', 'employee', 'salary', 'attendance', 'leave', 'balance', 'profile', 'details',
    'today', 'coming', 'present', 'absent', 'on', 'show', 'check', 'status', 'my', 'me', 'mine',
    'shu', 'che', 'chhe', 'aaje', 'aavyo', 'aavi', 'office', 'hajri', 'pagar', 'raja',
    'kya', 'kaun', 'aaj', 'mera', 'meri', 'hai', 'kitna', 'kitni'
]);

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
}

function normalizeQuery(raw) {
    let q = ` ${String(raw || '').toLowerCase().trim()} `;
    Object.entries(SPELL_FIXES).forEach(([from, to]) => {
        q = q.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
    });
    return q.replace(/\s+/g, ' ').trim();
}

function detectLanguage(rawQuery) {
    const raw = ` ${String(rawQuery || '').toLowerCase()} `;
    if (GUJ_ROMAN_MARKERS.some((w) => raw.includes(w))) return 'gu';
    if (HINDI_MARKERS.some((w) => raw.includes(w))) return 'hi';
    return 'en';
}

function msg(lang, key, vars = {}) {
    const m = {
        en: {
            clarify_intent: 'I can help with attendance, salary, leave balance, or profile. Which one do you want?',
            clarify_name: `I couldn't find an exact match.${vars.suggestion ? ` Did you mean ${vars.suggestion}?` : ' Please share employee full name.'}`,
            no_self: "I couldn't find your employee record. Please contact HR.",
            profile: `${vars.name} profile: ${vars.email || '-'} | ${vars.role || '-'}.`,
            salary: `${vars.name} salary (CTC): ${vars.ctc}.`,
            salary_missing: `I couldn't find salary data for ${vars.name}. Do you want profile details instead?`,
            leave_empty: `${vars.name} has no leave-balance record for this year. Do you want leave history?`,
            attendance_empty: `I couldn't find attendance records for ${vars.name}. Do you want a date-wise check?`,
            present_today: `Yes, ${vars.name} is present today.`,
            absent_today: `No, ${vars.name} is absent today.`,
            latest_attendance: `Latest attendance for ${vars.name}: ${vars.status} on ${vars.date}.`,
            leaves_today_none: 'No one is on leave today.',
            leaves_today_self_no: 'You are not on leave today.',
            leaves_today_self_yes: `You are on ${vars.leaveType} leave today.`,
            total_employees: `Total employees: ${vars.count}.`,
            present_count: `Present today: ${vars.count}.`,
            absent_count: `Absent today: ${vars.count}.`,
            on_leave_count: `On leave today: ${vars.count}.`
        },
        hi: {
            clarify_intent: 'Main attendance, salary, leave balance ya profile mein help kar sakta hoon. Aapko kya chahiye?',
            clarify_name: `Mujhe exact match nahi mila.${vars.suggestion ? ` Kya aapka matlab ${vars.suggestion} hai?` : ' Kripya employee ka poora naam batayein.'}`,
            no_self: 'Aapka employee record nahi mila. Kripya HR se contact karein.',
            profile: `${vars.name} profile: ${vars.email || '-'} | ${vars.role || '-'}.`,
            salary: `${vars.name} ki salary (CTC): ${vars.ctc}.`,
            salary_missing: `${vars.name} ke liye salary data nahi mila. Kya profile details chahiye?`,
            leave_empty: `${vars.name} ka is saal leave balance record nahi mila. Kya leave history chahiye?`,
            attendance_empty: `${vars.name} ka attendance record nahi mila. Kya date-wise check karun?`,
            present_today: `Haan, ${vars.name} aaj present hai.`,
            absent_today: `Nahi, ${vars.name} aaj absent hai.`,
            latest_attendance: `${vars.name} ka latest attendance: ${vars.status} (${vars.date}).`,
            leaves_today_none: 'Aaj koi leave par nahi hai.',
            leaves_today_self_no: 'Aaj aap leave par nahi hain.',
            leaves_today_self_yes: `Aaj aap ${vars.leaveType} leave par hain.`,
            total_employees: `Total employees: ${vars.count}.`,
            present_count: `Aaj present: ${vars.count}.`,
            absent_count: `Aaj absent: ${vars.count}.`,
            on_leave_count: `Aaj leave par: ${vars.count}.`
        },
        gu: {
            clarify_intent: 'Hu attendance, salary, leave balance ane profile ma help kari saku. Tame kayu joiye chhe?',
            clarify_name: `Mane exact employee match malyo nathi.${vars.suggestion ? ` Shu tame ${vars.suggestion} kehva mango cho?` : ' Krupaya employee nu full name moklo.'}`,
            no_self: 'Tamaro employee record malyo nathi. Krupaya HR sathe contact karo.',
            profile: `${vars.name} profile: ${vars.email || '-'} | ${vars.role || '-'}.`,
            salary: `${vars.name} nu salary (CTC): ${vars.ctc}.`,
            salary_missing: `${vars.name} mate salary data malyo nathi. Profile details joiye?`,
            leave_empty: `${vars.name} nu aa varsh nu leave balance record malyu nathi. Leave history joiye?`,
            attendance_empty: `${vars.name} mate attendance record malyo nathi. Date-wise check karu?`,
            present_today: `Ha, ${vars.name} aaje present chhe.`,
            absent_today: `Na, ${vars.name} aaje absent chhe.`,
            latest_attendance: `${vars.name} nu latest attendance: ${vars.status} (${vars.date}).`,
            leaves_today_none: 'Aaje koi leave par nathi.',
            leaves_today_self_no: 'Tame aaje leave par nathi.',
            leaves_today_self_yes: `Tame aaje ${vars.leaveType} leave par cho.`,
            total_employees: `Total employees: ${vars.count}.`,
            present_count: `Aaje present: ${vars.count}.`,
            absent_count: `Aaje absent: ${vars.count}.`,
            on_leave_count: `Aaje leave par: ${vars.count}.`
        }
    };
    return (m[lang] || m.en)[key] || m.en[key];
}

function detectIntent(query) {
    const q = normalizeQuery(query);
    if (!q) return 'unknown';

    if ((q.includes('who') || q.includes('which') || q.includes('kon') || q.includes('kaun')) && q.includes('leave') && q.includes('today')) return 'on_leave_today';
    if ((q.includes('aaje') || q.includes('aaj') || q.includes('today')) && (q.includes('leave') || q.includes('raja') || q.includes('chhutti'))) return 'on_leave_today';

    if (['salary', 'ctc', 'pay', 'income', 'pagar', 'vetan'].some((k) => q.includes(k))) return 'salary';
    if (['attendance', 'present', 'absent', 'coming', 'aavyo', 'aavi', 'hajri'].some((k) => q.includes(k))) return 'attendance';
    if ((q.includes('employee') || q.includes('employees') || q.includes('staff')) && (q.includes('count') || q.includes('total') || q.includes('ketla') || q.includes('kitne'))) return 'count';
    if (q.includes('ketla employees') || q.includes('kitne employees')) return 'count';
    if ((q.includes('leave') || q.includes('holiday') || q.includes('raja') || q.includes('chhutti')) && (q.includes('balance') || q.includes('ketli') || q.includes('kitni'))) return 'leave_balance';
    if (['profile', 'details', 'detail', 'employee details'].some((k) => q.includes(k))) return 'profile';
    return 'unknown';
}

function detectSystemMetric(query) {
    const q = normalizeQuery(query);
    if ((q.includes('total') || q.includes('count') || q.includes('ketla') || q.includes('kitne')) && (q.includes('employee') || q.includes('employees') || q.includes('staff'))) return 'total_employees';
    if ((q.includes('present') || q.includes('aavyo') || q.includes('coming')) && (q.includes('today') || q.includes('aaje') || q.includes('aaj'))) return 'present_count';
    if (q.includes('absent') && (q.includes('today') || q.includes('aaje') || q.includes('aaj'))) return 'absent_count';
    if ((q.includes('on leave') || q.includes('leave today') || q.includes('raja')) && (q.includes('today') || q.includes('aaje') || q.includes('aaj'))) return 'on_leave_count';
    return null;
}

function isSelfQuery(query) {
    const q = ` ${normalizeQuery(query)} `;
    return [' my ', ' me ', ' mera ', ' meri ', ' hu ', ' maro ', ' mari ', ' mujhe '].some((w) => q.includes(w));
}

function extractTargetName(query) {
    const q = normalizeQuery(query);
    const patterns = [
        /(?:salary|attendance|profile|details|leave balance)\s+(?:of|for)\s+(.+)$/i,
        /(?:salary|attendance|profile)\s+(?:ka|ki|ke)\s+(.+)$/i,
        /(?:pagar|hajri|profile|details)\s+(?:no|ni|nu)\s+(.+)$/i,
        /(?:is|are|che|chhe)\s+(.+)\s+(?:present|absent|coming|aavyo|aavi)(?:\s+today|\s+aaje|\s+aaj)?$/i,
        /^(.+)\s+(?:present|absent|coming|aavyo|aavi)(?:\s+today|\s+aaje|\s+aaj)?$/i
    ];

    for (const p of patterns) {
        const m = q.match(p);
        if (m && m[1]) return m[1].trim();
    }

    const tokens = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const candidates = tokens.filter((t) => t.length > 1 && !NAME_STOPWORDS.has(t));
    return candidates.length ? candidates.join(' ') : null;
}

function levenshtein(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    const m = s.length;
    const n = t.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

function formatEmpName(emp) {
    return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || 'Employee';
}

function prettyDate(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toISOString().slice(0, 10);
}

function normalizeAttendanceStatus(s) {
    const status = String(s || '').toLowerCase();
    if (status === 'present') return 'Present';
    if (status === 'half_day') return 'Half Day';
    if (status === 'absent') return 'Absent';
    return status || 'Unknown';
}

async function getEmployeeModels(db) {
    const names = ['Employee', 'EmployeeCompensation', 'LeaveBalance', 'Attendance', 'LeaveRequest'];
    names.forEach((m) => {
        if (!db.models[m]) db.model(m, require(`../models/${m}`));
    });
    return {
        Employee: db.model('Employee'),
        EmployeeCompensation: db.model('EmployeeCompensation'),
        LeaveBalance: db.model('LeaveBalance'),
        Attendance: db.model('Attendance'),
        LeaveRequest: db.model('LeaveRequest')
    };
}

async function findEmployeeBySelf(models, user, tenantId) {
    const { Employee } = models;
    const byId = await Employee.findOne({ _id: user.id, tenant: tenantId })
        .select('firstName lastName email role salary')
        .lean()
        .catch(() => null);
    if (byId) return byId;

    if (!user.email) return null;
    return Employee.findOne({ email: user.email, tenant: tenantId })
        .select('firstName lastName email role salary')
        .lean();
}

async function findEmployeeByNameSmart(models, tenantId, rawName) {
    const { Employee } = models;
    const needle = String(rawName || '').trim().toLowerCase();
    if (!needle) return { best: null, suggestions: [] };

    const all = await Employee.find({ tenant: tenantId })
        .select('firstName lastName email role salary employeeId')
        .lean();

    const scored = all.map((emp) => {
        const name = formatEmpName(emp).toLowerCase();
        const first = String(emp.firstName || '').toLowerCase();
        const last = String(emp.lastName || '').toLowerCase();
        const tokens = name.split(/\s+/).filter(Boolean);
        let score = 0;

        if (name === needle) score = 100;
        else if (name.startsWith(needle) || first.startsWith(needle) || last.startsWith(needle)) score = 90;
        else if (name.includes(needle) || needle.includes(first) || needle.includes(last)) score = 78;
        else if (tokens.includes(needle)) score = 74;
        else {
            const dist = levenshtein(needle, name);
            const maxLen = Math.max(needle.length, name.length) || 1;
            const similarity = 1 - dist / maxLen;
            if (similarity >= 0.62) score = Math.round(similarity * 70);
        }

        return { emp, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

    return {
        best: scored[0]?.emp || null,
        suggestions: scored.slice(0, 3).map((x) => formatEmpName(x.emp))
    };
}

function employeeProfilePayload(emp) {
    return {
        name: formatEmpName(emp),
        email: emp.email || null,
        role: emp.role || null
    };
}

function heuristicParseQuery(query) {
    const originalQuery = String(query || '').trim();
    const intentDetected = detectIntent(originalQuery);
    const systemMetric = detectSystemMetric(originalQuery);
    const employeeName = extractTargetName(originalQuery);

    let type = 'employee';
    let intent = intentDetected;

    if (systemMetric || intentDetected === 'count') {
        type = 'system';
        intent = 'count';
    }

    if (intent === 'leave_balance' || intent === 'on_leave_today') {
        intent = 'leave';
    } else if (!['attendance', 'salary', 'leave', 'profile', 'count'].includes(intent)) {
        intent = 'attendance';
    }

    return {
        type,
        intent,
        employeeName: employeeName || null,
        originalQuery
    };
}

exports.hrmsAssistantQuery = async (req, res) => {
    try {
        const tokenRole = normalizeRole(req.user?.role);
        const tokenUserId = req.user?.id ? String(req.user.id) : null;
        const bodyRole = normalizeRole(req.body?.userRole);
        const bodyUserId = req.body?.userId ? String(req.body.userId) : null;
        const role = tokenRole || bodyRole;
        const userId = tokenUserId || bodyUserId;
        const funMode = Boolean(req.body?.funMode);
        const tenantId = req.tenantId || req.user?.tenantId;
        const query = String(req.body?.query || '').trim();
        const language = detectLanguage(query);

        if (!tenantId) {
            return res.status(400).json({ success: false, message: msg(language, 'clarify_intent') });
        }
        if (!role || !userId) {
            return res.status(400).json({ success: false, message: 'userRole and userId are required.' });
        }
        if (!query) {
            return res.status(400).json({ success: false, message: 'Query is required.' });
        }

        const db = req.tenantDB;
        if (!db) {
            return res.status(500).json({ success: false, message: 'Tenant DB connection missing.' });
        }

        const models = await getEmployeeModels(db);
        const aiParsed = await AIService.parseHRMSIntent(query);
        const intent = aiParsed?.intent || detectIntent(query);
        const targetName = aiParsed?.employeeName ?? extractTargetName(query);
        const parsedType = aiParsed?.type || null;
        const systemMetric = detectSystemMetric(query);
        const asksSelf = isSelfQuery(query) || !targetName;
        const isEmployee = EMPLOYEE_ROLES.has(role);
        const isHrOrAdmin = HR_ROLES.has(role) || ADMIN_ROLES.has(role);
        const unauthorizedText = funMode ? 'Access denied - please contact HR.' : UNAUTHORIZED_MSG;

        if (!isEmployee && !isHrOrAdmin) {
            return res.status(403).json({ success: false, message: unauthorizedText });
        }

        // System-wide queries: totals, present/absent counts, on-leave counts.
        const isSystemQuery = parsedType === 'system' || intent === 'count' || Boolean(systemMetric);
        if (isSystemQuery) {
            if (!isHrOrAdmin) {
                return res.status(403).json({ success: false, message: unauthorizedText });
            }

            const { Employee, Attendance, LeaveRequest } = models;
            const now = new Date();
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            const metric = systemMetric || 'total_employees';

            if (metric === 'total_employees') {
                const count = await Employee.countDocuments({ tenant: tenantId });
                return res.json({ success: true, message: msg(language, 'total_employees', { count }), data: { totalEmployees: count } });
            }

            if (metric === 'present_count') {
                const count = await Attendance.countDocuments({
                    tenant: tenantId,
                    date: { $gte: dayStart, $lte: dayEnd },
                    status: { $in: ['present', 'half_day'] }
                });
                return res.json({ success: true, message: msg(language, 'present_count', { count }), data: { presentToday: count } });
            }

            if (metric === 'absent_count') {
                const count = await Attendance.countDocuments({
                    tenant: tenantId,
                    date: { $gte: dayStart, $lte: dayEnd },
                    status: 'absent'
                });
                return res.json({ success: true, message: msg(language, 'absent_count', { count }), data: { absentToday: count } });
            }

            if (metric === 'on_leave_count') {
                const count = await LeaveRequest.countDocuments({
                    tenant: tenantId,
                    status: 'Approved',
                    startDate: { $lte: dayEnd },
                    endDate: { $gte: dayStart }
                });
                return res.json({ success: true, message: msg(language, 'on_leave_count', { count }), data: { onLeaveToday: count } });
            }
        }

        if (intent === 'on_leave_today') {
            const { LeaveRequest } = models;
            const now = new Date();
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            if (isEmployee) {
                const selfEmp = await findEmployeeBySelf(models, { id: userId, email: req.user?.email }, tenantId);
                if (!selfEmp) return res.json({ success: true, message: msg(language, 'no_self') });

                const leave = await LeaveRequest.findOne({
                    tenant: tenantId,
                    employee: selfEmp._id,
                    status: 'Approved',
                    startDate: { $lte: dayEnd },
                    endDate: { $gte: dayStart }
                }).select('leaveType startDate endDate status').lean();

                if (!leave) return res.json({ success: true, message: msg(language, 'leaves_today_self_no') });

                return res.json({
                    success: true,
                    message: msg(language, 'leaves_today_self_yes', { leaveType: leave.leaveType || 'Approved' }),
                    data: leave
                });
            }

            const leaves = await LeaveRequest.find({
                tenant: tenantId,
                status: 'Approved',
                startDate: { $lte: dayEnd },
                endDate: { $gte: dayStart }
            }).populate('employee', 'firstName lastName employeeId email').select('employee leaveType startDate endDate').lean();

            if (!leaves || leaves.length === 0) {
                return res.json({ success: true, message: msg(language, 'leaves_today_none') });
            }

            const data = leaves.map((l) => ({
                employee: l.employee ? `${l.employee.firstName || ''} ${l.employee.lastName || ''}`.trim() : null,
                employeeId: l.employee?.employeeId || null,
                leaveType: l.leaveType,
                startDate: l.startDate,
                endDate: l.endDate
            }));

            return res.json({
                success: true,
                message: data.slice(0, 5).map((x) => x.employee).filter(Boolean).join(', '),
                data
            });
        }

        let targetEmployee = null;
        let suggestions = [];

        if (asksSelf) {
            targetEmployee = await findEmployeeBySelf(models, { id: userId, email: req.user?.email }, tenantId);
        } else {
            if (isEmployee) return res.status(403).json({ success: false, message: unauthorizedText });
            const matched = await findEmployeeByNameSmart(models, tenantId, targetName);
            targetEmployee = matched.best;
            suggestions = matched.suggestions;
        }

        if (!targetEmployee) {
            if (asksSelf) return res.json({ success: true, message: msg(language, 'no_self') });
            return res.json({
                success: true,
                message: msg(language, 'clarify_name', { suggestion: suggestions[0] || null }),
                suggestions
            });
        }

        if (intent === 'profile') {
            const data = employeeProfilePayload(targetEmployee);
            return res.json({ success: true, message: msg(language, 'profile', data), data });
        }

        if (intent === 'salary') {
            const { EmployeeCompensation } = models;
            const comp = await EmployeeCompensation.findOne({
                employeeId: targetEmployee._id,
                companyId: tenantId,
                isActive: true,
                status: 'ACTIVE'
            }).sort({ effectiveFrom: -1 }).lean();

            const salaryData = {
                totalCTC: comp?.totalCTC ?? targetEmployee.salary ?? null,
                grossA: comp?.grossA ?? null,
                grossB: comp?.grossB ?? null,
                grossC: comp?.grossC ?? null
            };

            if (salaryData.totalCTC == null && salaryData.grossA == null && salaryData.grossB == null && salaryData.grossC == null) {
                return res.json({ success: true, message: msg(language, 'salary_missing', { name: formatEmpName(targetEmployee) }) });
            }

            return res.json({
                success: true,
                message: msg(language, 'salary', { name: formatEmpName(targetEmployee), ctc: salaryData.totalCTC ?? '-' }),
                data: salaryData
            });
        }

        if (intent === 'leave_balance') {
            const { LeaveBalance } = models;
            const year = new Date().getFullYear();
            const balances = await LeaveBalance.find({
                tenant: tenantId,
                employee: targetEmployee._id,
                year
            }).select('leaveType total used pending available').lean();

            if (!balances || balances.length === 0) {
                return res.json({ success: true, message: msg(language, 'leave_empty', { name: formatEmpName(targetEmployee) }) });
            }

            return res.json({
                success: true,
                message: balances.slice(0, 4).map((b) => `${b.leaveType}: ${b.available ?? 0}`).join(', '),
                data: balances
            });
        }

        if (intent === 'attendance') {
            const { Attendance } = models;
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const [latestRecord, presentDays, totalRecords] = await Promise.all([
                Attendance.findOne({ tenant: tenantId, employee: targetEmployee._id })
                    .sort({ date: -1 })
                    .select('date status checkIn checkOut workingHours isLate')
                    .lean(),
                Attendance.countDocuments({
                    tenant: tenantId,
                    employee: targetEmployee._id,
                    date: { $gte: monthStart },
                    status: { $in: ['present', 'half_day'] }
                }),
                Attendance.countDocuments({
                    tenant: tenantId,
                    employee: targetEmployee._id,
                    date: { $gte: monthStart }
                })
            ]);

            if (!latestRecord && totalRecords === 0) {
                return res.json({ success: true, message: msg(language, 'attendance_empty', { name: formatEmpName(targetEmployee) }) });
            }

            const name = formatEmpName(targetEmployee);
            const statusText = normalizeAttendanceStatus(latestRecord?.status);
            const latestDate = latestRecord?.date ? new Date(latestRecord.date) : null;
            const isToday = latestDate
                && latestDate.getFullYear() === now.getFullYear()
                && latestDate.getMonth() === now.getMonth()
                && latestDate.getDate() === now.getDate();

            let attendanceMessage;
            if (isToday && statusText === 'Present') attendanceMessage = msg(language, 'present_today', { name });
            else if (isToday && statusText === 'Absent') attendanceMessage = msg(language, 'absent_today', { name });
            else attendanceMessage = msg(language, 'latest_attendance', { name, status: statusText, date: prettyDate(latestRecord?.date) });

            return res.json({
                success: true,
                message: attendanceMessage,
                data: {
                    monthPresentDays: presentDays,
                    monthRecords: totalRecords,
                    latest: latestRecord || null
                }
            });
        }

        return res.json({ success: true, message: msg(language, 'clarify_intent') });
    } catch (error) {
        console.error('[hrmsAssistantQuery] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.hrmsAssistantParse = async (req, res) => {
    try {
        const query = String(req.body?.query || '').trim();
        if (!query) {
            return res.status(400).json({ success: false, message: 'Query is required.' });
        }

        const aiParsed = await AIService.parseHRMSQuery(query);
        const parsed = aiParsed || heuristicParseQuery(query);
        return res.json(parsed);
    } catch (error) {
        console.error('[hrmsAssistantParse] Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.hrmsAssistantRespond = async (req, res) => {
    try {
        const backendData = req.body?.backend_data;
        const query = String(req.body?.query || '').trim();
        const fallback = backendData == null ? 'No data.' : JSON.stringify(backendData);
        const rendered = await AIService.formatHRMSResponse({ backendData, userQuery: query });
        return res.json({ success: true, message: rendered || fallback });
    } catch (error) {
        console.error('[hrmsAssistantRespond] Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
