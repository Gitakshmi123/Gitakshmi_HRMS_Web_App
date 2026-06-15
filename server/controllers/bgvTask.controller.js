/**
 * BGV Task Assignment Controller
 * Manages task assignment, maker-checker workflow, and task completion
 */

const { getBGVModels } = require('../utils/bgvModels');

/**
 * Assign task to a user
 * POST /api/bgv/check/:checkId/assign-task
 */
exports.assignTask = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const {
            taskType,
            assignToUserId,
            userType,
            priority,
            instructions,
            slaDays
        } = req.body;

        const { BGVCheck, BGVTaskAssignment, BGVTimeline } = await getBGVModels(req);

        // Get check
        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({
                success: false,
                message: "Check not found"
            });
        }

        // Calculate SLA deadline
        const expectedCompletionDate = new Date();
        expectedCompletionDate.setDate(expectedCompletionDate.getDate() + (slaDays || 3));

        // Create task assignment
        const task = new BGVTaskAssignment({
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId,
            taskType: taskType || 'VERIFICATION',
            taskStatus: 'ASSIGNED',
            priority: priority || 'MEDIUM',
            assignedTo: {
                userId: assignToUserId,
                userType: userType || 'VERIFIER',
                assignedAt: new Date(),
                assignedBy: req.user?._id || req.user?.id
            },
            sla: {
                expectedCompletionDate,
                isOverdue: false
            },
            instructions: instructions || `Verify ${check.type} check for this candidate`,
            timeline: [{
                action: 'TASK_ASSIGNED',
                performedBy: req.user?._id || req.user?.id,
                timestamp: new Date(),
                remarks: `Task assigned to ${userType}`
            }]
        });

        await task.save();

        // Update check status
        if (check.status === 'NOT_STARTED') {
            check.status = 'ASSIGNED';
            check.assignedTo = assignToUserId;
            await check.save();
        }

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId,
            eventType: 'TASK_ASSIGNED',
            title: `Task Assigned: ${taskType}`,
            description: `Task assigned to ${userType}`,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['ALL'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: { taskId: task._id }
        });

        res.json({
            success: true,
            message: "Task assigned successfully",
            data: task
        });

    } catch (err) {
        console.error('[BGV_ASSIGN_TASK_ERROR]', err);
        next(err);
    }
};

/**
 * Get my assigned tasks
 * GET /api/bgv/tasks/my-tasks
 */
exports.getMyTasks = async (req, res, next) => {
    try {
        const { status } = req.query;
        const { BGVTaskAssignment } = await getBGVModels(req);

        const userId = req.user?._id || req.user?.id;

        const query = {
            tenant: req.tenantId,
            'assignedTo.userId': userId
        };

        if (status) {
            query.taskStatus = status;
        }

        const tasks = await BGVTaskAssignment.find(query)
            .populate('caseId', 'caseId overallStatus')
            .populate('checkId', 'type status')
            .sort({ 'sla.expectedCompletionDate': 1 })
            .lean();

        // Check for overdue tasks
        tasks.forEach(task => {
            if (task.sla?.expectedCompletionDate) {
                const now = new Date();
                if (now > task.sla.expectedCompletionDate && task.taskStatus !== 'COMPLETED') {
                    task.sla.isOverdue = true;
                    const diffMs = now - task.sla.expectedCompletionDate;
                    task.sla.overdueBy = Math.floor(diffMs / (1000 * 60 * 60));
                }
            }
        });

        res.json({
            success: true,
            data: {
                tasks,
                totalTasks: tasks.length,
                overdueTasks: tasks.filter(t => t.sla?.isOverdue).length
            }
        });

    } catch (err) {
        console.error('[BGV_GET_MY_TASKS_ERROR]', err);
        next(err);
    }
};

/**
 * Complete task (Maker)
 * POST /api/bgv/task/:taskId/complete
 */
exports.completeTask = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const { remarks, checklistItems } = req.body;

        const { BGVTaskAssignment, BGVTimeline } = await getBGVModels(req);

        const task = await BGVTaskAssignment.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Verify user is assigned to this task
        const userId = req.user?._id?.toString() || req.user?.id?.toString();
        const assignedUserId = task.assignedTo?.userId?.toString();

        if (userId !== assignedUserId) {
            return res.status(403).json({
                success: false,
                message: "You are not assigned to this task"
            });
        }

        // Update task
        task.taskStatus = 'COMPLETED';
        task.maker = {
            userId: req.user?._id || req.user?.id,
            completedAt: new Date(),
            remarks: remarks || 'Task completed'
        };

        if (checklistItems) {
            task.checklistItems = checklistItems;
        }

        task.sla.actualCompletionDate = new Date();

        task.addTimelineEntry('TASK_COMPLETED', req.user?._id || req.user?.id, remarks);

        await task.save();

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: task.caseId,
            checkId: task.checkId,
            eventType: 'TASK_COMPLETED',
            title: `Task Completed: ${task.taskType}`,
            description: remarks || 'Task completed by verifier',
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['ALL'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: "Task completed successfully. Awaiting approval from checker.",
            data: task
        });

    } catch (err) {
        console.error('[BGV_COMPLETE_TASK_ERROR]', err);
        next(err);
    }
};

/**
 * Approve task (Checker)
 * POST /api/bgv/task/:taskId/approve
 */
exports.approveTask = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const { decision, remarks } = req.body; // decision: APPROVED, REJECTED, SENT_BACK

        const { BGVTaskAssignment, BGVCheck, BGVTimeline } = await getBGVModels(req);

        const task = await BGVTaskAssignment.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Verify task is completed
        if (task.taskStatus !== 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: "Task must be completed before approval"
            });
        }

        // Prevent self-approval
        const checkerId = req.user?._id?.toString() || req.user?.id?.toString();
        const makerId = task.maker?.userId?.toString();

        if (checkerId === makerId) {
            return res.status(403).json({
                success: false,
                message: "Self-approval is not allowed. Maker and Checker must be different users."
            });
        }

        // Update task with checker decision
        task.checker = {
            userId: req.user?._id || req.user?.id,
            reviewedAt: new Date(),
            decision,
            remarks: remarks || `Task ${decision.toLowerCase()}`
        };

        task.addTimelineEntry(`TASK_${decision}`, req.user?._id || req.user?.id, remarks);

        await task.save();

        // If approved, update check status
        if (decision === 'APPROVED') {
            const check = await BGVCheck.findById(task.checkId);
            if (check && check.status === 'UNDER_REVIEW') {
                check.status = 'VERIFIED';
                check.verificationDetails = {
                    verifiedBy: makerId,
                    approvedBy: checkerId,
                    verifiedAt: task.maker.completedAt,
                    approvedAt: new Date(),
                    verificationMethod: 'MAKER_CHECKER'
                };
                await check.save();
            }
        }

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: task.caseId,
            checkId: task.checkId,
            eventType: `TASK_${decision}`,
            title: `Task ${decision}: ${task.taskType}`,
            description: remarks || `Task ${decision.toLowerCase()} by checker`,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['ALL'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: `Task ${decision.toLowerCase()} successfully`,
            data: task
        });

    } catch (err) {
        console.error('[BGV_APPROVE_TASK_ERROR]', err);
        next(err);
    }
};

/**
 * Escalate task
 * POST /api/bgv/task/:taskId/escalate
 */
exports.escalateTask = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const { escalationReason, escalateTo } = req.body;

        const { BGVTaskAssignment, BGVTimeline } = await getBGVModels(req);

        const task = await BGVTaskAssignment.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Update escalation
        task.taskStatus = 'ESCALATED';
        task.escalation = {
            isEscalated: true,
            escalatedAt: new Date(),
            escalatedTo: escalateTo,
            escalationReason: escalationReason || 'Task escalated',
            escalationLevel: (task.escalation?.escalationLevel || 0) + 1
        };

        task.addTimelineEntry('TASK_ESCALATED', req.user?._id || req.user?.id, escalationReason);

        await task.save();

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: task.caseId,
            checkId: task.checkId,
            eventType: 'TASK_ESCALATED',
            title: `Task Escalated: ${task.taskType}`,
            description: escalationReason,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: "Task escalated successfully",
            data: task
        });

    } catch (err) {
        console.error('[BGV_ESCALATE_TASK_ERROR]', err);
        next(err);
    }
};

/**
 * Get all tasks for a case
 * GET /api/bgv/case/:caseId/tasks
 */
exports.getCaseTasks = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVTaskAssignment } = await getBGVModels(req);

        const tasks = await BGVTaskAssignment.find({ caseId })
            .populate('assignedTo.userId', 'name email')
            .populate('maker.userId', 'name email')
            .populate('checker.userId', 'name email')
            .populate('checkId', 'type status')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: tasks
        });

    } catch (err) {
        console.error('[BGV_GET_CASE_TASKS_ERROR]', err);
        next(err);
    }
};
