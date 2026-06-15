const mongoose = require('mongoose');
const notificationController = require('../controllers/notification.controller');

const getModels = (req) => {
  if (req.tenantDB) {
    try {
      return {
        Regularization: req.tenantDB.model('Regularization'),
        Attendance: req.tenantDB.model('Attendance'),
        LeaveRequest: req.tenantDB.model('LeaveRequest'),
        LeaveBalance: req.tenantDB.model('LeaveBalance'),
        Employee: req.tenantDB.model('Employee'),
        AuditLog: req.tenantDB.model('AuditLog')
      };
    } catch (error) {
      // Models not registered, register them
      // console.log(`[REGULARIZATION_CONTROLLER] Registering models in tenant DB`);
      const RegularizationSchema = require('../models/Regularization');
      const AttendanceSchema = require('../models/Attendance');
      const LeaveRequestSchema = require('../models/LeaveRequest');
      const LeaveBalanceSchema = require('../models/LeaveBalance');
      const EmployeeSchema = require('../models/Employee');
      const AuditLogSchema = require('../models/AuditLog');
      return {
        Regularization: req.tenantDB.model('Regularization', RegularizationSchema),
        Attendance: req.tenantDB.model('Attendance', AttendanceSchema),
        LeaveRequest: req.tenantDB.model('LeaveRequest', LeaveRequestSchema),
        LeaveBalance: req.tenantDB.model('LeaveBalance', LeaveBalanceSchema),
        Employee: req.tenantDB.model('Employee', EmployeeSchema),
        AuditLog: req.tenantDB.model('AuditLog', AuditLogSchema)
      };
    }
  } else {
    // For super admin or testing, use main connection
    return {
      Regularization: mongoose.model('Regularization'),
      Attendance: mongoose.model('Attendance'),
      LeaveRequest: mongoose.model('LeaveRequest'),
      LeaveBalance: mongoose.model('LeaveBalance'),
      Employee: mongoose.model('Employee'),
      AuditLog: mongoose.model('AuditLog')
    };
  }
};

// Helper: Calculate Duration in Hours
const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;
    return (new Date(checkOut) - new Date(checkIn)) / 3600000;
};

// Helper: Check if Payroll is locked for a date
// Enterprise logic: Locked if date is in a previous month and today is past the cutoff (e.g., 5th of current month)
const checkPayrollLock = (date) => {
    const target = new Date(date);
    const today = new Date();

    // Simplification: Lock everything older than 30 days or in previous month
    if (target.getMonth() < today.getMonth() || target.getFullYear() < today.getFullYear()) {
        // If we are past the 5th of current month, lock previous month
        if (today.getDate() > 25) return true; // Cutoff for previous cycle
    }
    return false;
};

// Helper: Determine Status based on Duration (Configurable rules logic placeholder)
const determineStatus = (duration) => {
    if (duration >= 8) return 'present'; // Lowercase to match Schema enum
    if (duration >= 4) return 'present'; // Schema only supports 'present','absent','leave'. 
    // 'Half Day' is not in schema enum, so mapping to 'present' or we need to update schema.
    // Given existing schema, let's map to 'present' but perhaps we can update schema later.
    return 'absent';
};

// Create Request
exports.createRequest = async (req, res) => {

    try {
        const { Regularization, Employee, Attendance, LeaveRequest } = getModels(req);
        const { category, startDate, endDate, issueType, requestedData, reason } = req.body;
        const employeeId = req.user.id;

        // 1. Snapshot Original Data & Detect Overlapping Leave
        let originalData = {};
        const targetDate = new Date(startDate);
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        // Fetch Attendance Snapshot
        const existingAtt = await Attendance.findOne({
            employee: employeeId, tenant: req.tenantId,
            date: { $gte: startOfDay, $lt: endOfDay }
        });

        originalData.attendance = existingAtt ? {
            checkIn: existingAtt.checkIn,
            checkOut: existingAtt.checkOut,
            status: existingAtt.status
        } : { status: 'absent' };

        // DETECT OVERLAPPING APPROVED LEAVE
        // Enterprise Rule: Regularization for Approved Leave correction
        const overlappingLeave = await LeaveRequest.findOne({
            employee: employeeId, tenant: req.tenantId, status: 'Approved',
            startDate: { $lte: endOfDay }, endDate: { $gte: startOfDay }
        });

        if (overlappingLeave) {
            originalData.overlappingLeave = {
                leaveId: overlappingLeave._id,
                leaveType: overlappingLeave.leaveType,
                daysCount: overlappingLeave.daysCount
            };
        }

        // 2. Validation: Payroll Lock Check
        if (checkPayrollLock(startDate)) {
            return res.status(400).json({ error: "Attendance for this period is locked (Payroll Processed/Closed)." });
        }

        const reg = new Regularization({
            tenant: req.tenantId,
            employee: employeeId,
            category,
            startDate: startOfDay,
            endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : endOfDay,
            issueType,
            originalData,
            requestedData,
            reason
        });
        await reg.save();

        const emp = await Employee.findOne({ _id: employeeId, tenant: req.tenantId });
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee';

        // Notify HR
        await notificationController.createNotification(req, {
            receiverId: req.tenantId,
            receiverRole: 'hr',
            entityType: 'Regularization',
            entityId: reg._id,
            title: `Regularization: ${empName}`,
            message: `${empName} requested ${category} correction.`
        });

        // Notify Manager
        if (emp && emp.manager) {
            await notificationController.createNotification(req, {
                receiverId: emp.manager,
                receiverRole: 'manager',
                entityType: 'Regularization',
                entityId: reg._id,
                title: `Team Regularization: ${empName}`,
                message: `${empName} requested ${category} correction.`
            });
        }


        res.status(201).json(reg);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Get My Requests
exports.getMyRequests = async (req, res) => {
    /* ... Existing Implementation ... */
    try {
        const { Regularization } = getModels(req);
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const total = await Regularization.countDocuments({ tenant: req.tenantId, employee: req.user.id });
        const data = await Regularization.find({ tenant: req.tenantId, employee: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            data,
            meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Team List (For Managers)
exports.getTeamRequests = async (req, res) => {
    try {
        const { Regularization, Employee } = getModels(req);
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Find employees who report to this user
        const reports = await Employee.find({ manager: req.user.id, tenant: req.tenantId }).select('_id');
        const reportIds = reports.map(r => r._id);

        const total = await Regularization.countDocuments({
            tenant: req.tenantId,
            employee: { $in: reportIds }
        });

        const data = await Regularization.find({
            tenant: req.tenantId,
            employee: { $in: reportIds }
        })
            .populate('employee', 'firstName lastName email employeeId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            data,
            meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin List (Full Company)
exports.getAllRequests = async (req, res) => {
    try {
        const { Regularization } = getModels(req);
        const { page = 1, limit = 10, category } = req.query;
        const skip = (page - 1) * limit;

        const query = { tenant: req.tenantId };
        if (category) query.category = category;

        const total = await Regularization.countDocuments(query);
        const data = await Regularization.find(query)
            .populate('employee', 'firstName lastName employeeId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            data,
            meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Approve - THE CORE LOGIC
exports.approveRequest = async (req, res) => {
    // Start Transaction (Simulated via careful sequencing, real transaction requires Replica Set)
    try {
        const { Regularization, Attendance, LeaveBalance, LeaveRequest, AuditLog } = getModels(req);
        const { id } = req.params;
        const { remark } = req.body;

        const reg = await Regularization.findOne({ _id: id, tenant: req.tenantId });
        if (!reg) return res.status(404).json({ error: "Request not found" });
        if (reg.status !== 'Pending') return res.status(400).json({ error: "Request is not Pending" });
        if (!remark) return res.status(400).json({ error: "Approval remark is mandatory for HR/Manager audit." });

        // --- NEW: Authorization Check ---
        const emp = await Employee.findOne({ _id: reg.employee, tenant: req.tenantId });
        const canAccess = req.user.role === 'psa' ||
            req.user.role === 'hr' ||
            (emp && emp.manager && emp.manager.toString() === req.user.id.toString());

        if (!canAccess) {
            console.warn(`[Regularization] Unauthorized approve attempt by ${req.user.id} (${req.user.role}) on reg ${id}`);
            return res.status(403).json({ error: "Unauthorized. You are not the manager, HR, or Super Admin." });
        }


        // 1. ATTENDANCE REGULARIZATION (Punches & Status Only)
        if (reg.category === 'Attendance') {
            const targetDate = new Date(reg.startDate);
            const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

            // Fetch/Create Attendance Record
            let attendance = await Attendance.findOne({
                tenant: req.tenantId, employee: reg.employee, date: { $gte: startOfDay, $lt: endOfDay }
            });

            const beforeSnapshot = attendance ? attendance.toObject() : null;
            if (!attendance) {
                attendance = new Attendance({ tenant: req.tenantId, employee: reg.employee, date: targetDate });
            }

            // Apply Punches
            if (reg.requestedData.checkIn) attendance.checkIn = new Date(reg.requestedData.checkIn);
            if (reg.requestedData.checkOut) attendance.checkOut = new Date(reg.requestedData.checkOut);

            // Strictly update status to present (Regularized)
            attendance.status = 'present';
            attendance.isRegularized = true;
            await attendance.save();

            // Create Audit Log
            await new AuditLog({
                tenant: req.tenantId, entity: 'Attendance', entityId: attendance._id, action: 'ATTENDANCE_REGULARIZATION_APPROVED', performedBy: req.user.id,
                changes: { before: beforeSnapshot, after: attendance.toObject() }, meta: { regularizationId: reg._id, issueType: reg.issueType }
            }).save();
        }

        // 2. LEAVE CORRECTION
        else if (reg.category === 'Leave') {
            const { requestedLeaveType, originalLeaveType } = reg.requestedData || {};
            const year = new Date(reg.startDate).getFullYear();
            const daysCount = 1; // Simplification (need loop for range in advanced version)

            // A. Deduct New Balance (if applicable)
            // e.g. User wants to mark this as "CL"
            if (requestedLeaveType && requestedLeaveType !== 'Present') {
                const newBal = await LeaveBalance.findOne({
                    tenant: req.tenantId,
                    employee: reg.employee,
                    leaveType: requestedLeaveType,
                    year
                });

                if (newBal) {
                    const beforeBal = newBal.toObject();
                    newBal.used += daysCount;
                    // Mongoose middleware updates available automatically on save
                    await newBal.save();

                    // Audit Log
                    await new AuditLog({
                        tenant: req.tenantId,
                        entity: 'LeaveBalance',
                        entityId: newBal._id,
                        action: 'REGULARIZATION_DEDUCT',
                        performedBy: req.user.id,
                        changes: { before: beforeBal, after: newBal.toObject() },
                        meta: { regularizationId: reg._id }
                    }).save();
                }
            }

            // B. Refund Old Balance (if applicable)
            // e.g. User had wrongly applied "PL"
            const oldType = reg.originalData?.leaveType || originalLeaveType;
            if (oldType && oldType !== 'Absent' && oldType !== 'None' && oldType !== requestedLeaveType) {
                const oldBal = await LeaveBalance.findOne({
                    tenant: req.tenantId,
                    employee: reg.employee,
                    leaveType: oldType,
                    year
                });

                if (oldBal) {
                    const beforeBal = oldBal.toObject();
                    oldBal.used = Math.max(0, oldBal.used - daysCount); // Safety
                    await oldBal.save();

                    // Audit Log
                    await new AuditLog({
                        tenant: req.tenantId,
                        entity: 'LeaveBalance',
                        entityId: oldBal._id,
                        action: 'REGULARIZATION_REFUND',
                        performedBy: req.user.id,
                        changes: { before: beforeBal, after: oldBal.toObject() },
                        meta: { regularizationId: reg._id }
                    }).save();
                }
            }

            // C. Update Calendar Status (Without touching physical punches)
            const targetDate = new Date(reg.startDate);
            const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

            if (requestedLeaveType === 'Present') {
                await Attendance.findOneAndUpdate(
                    { tenant: req.tenantId, employee: reg.employee, date: { $gte: startOfDay, $lt: endOfDay } },
                    { status: 'present' },
                    { upsert: true }
                );
            } else {
                // Generate Approved Leave Request for record
                const leaveReq = new LeaveRequest({
                    tenant: req.tenantId,
                    employee: reg.employee,
                    leaveType: requestedLeaveType,
                    startDate: reg.startDate,
                    endDate: reg.endDate || reg.startDate,
                    reason: `Regularization Adjustment: ${reg.reason}`,
                    daysCount: daysCount,
                    status: 'Approved',
                    approver: req.user.id,
                    approvedAt: new Date(),
                    meta: { regularizationId: reg._id }
                });
                await leaveReq.save();

                // Update Attendance Status to Leave (Keep punches intact if any)
                await Attendance.findOneAndUpdate(
                    { tenant: req.tenantId, employee: reg.employee, date: { $gte: startOfDay, $lt: endOfDay } },
                    { status: 'leave', leaveType: requestedLeaveType },
                    { upsert: true }
                );
            }
        }

        // 3. Finalize Regularization Status
        reg.status = 'Approved';
        reg.adminRemark = remark;
        reg.approver = req.user.id;
        reg.actionDate = new Date();
        await reg.save();

        // 4. Notify Employee
        await notificationController.createNotification(req, {
            receiverId: reg.employee,
            receiverRole: 'employee',
            entityType: 'Regularization',
            entityId: reg._id,
            title: 'Regularization Approved',
            message: `Your request has been approved. Remark: ${remark}`
        });


        res.json(reg);

    } catch (error) {
        console.error("Regularization Approval Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Reject
exports.rejectRequest = async (req, res) => {
    try {
        const { Regularization } = getModels(req);
        const { id } = req.params;
        const { remark } = req.body;

        const reg = await Regularization.findOne({ _id: id, tenant: req.tenantId });
        if (!reg) return res.status(404).json({ error: "Request not found" });

        // --- NEW: Authorization Check ---
        const emp = await Employee.findOne({ _id: reg.employee, tenant: req.tenantId });
        const canAccess = req.user.role === 'psa' ||
            req.user.role === 'hr' ||
            (emp && emp.manager && emp.manager.toString() === req.user.id.toString());

        if (!canAccess) {
            return res.status(403).json({ error: "Unauthorized. You are not the manager, HR, or Super Admin." });
        }


        reg.status = 'Rejected';
        reg.adminRemark = remark;
        reg.approver = req.user.id;
        reg.actionDate = new Date();
        await reg.save();

        await notificationController.createNotification(req, {
            receiverId: reg.employee,
            receiverRole: 'employee',
            entityType: 'Regularization',
            entityId: reg._id,
            title: 'Regularization Rejected',
            message: `Your request was rejected. Remark: ${remark}`
        });


        res.json(reg);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
