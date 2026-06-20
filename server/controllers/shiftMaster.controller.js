const ShiftMasterSchema = require('../models/ShiftMaster');
const ShiftPolicySchema = require('../models/ShiftPolicy');
const AuditLogSchema = require('../models/AuditLog');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        ShiftMaster: db.model('ShiftMaster', ShiftMasterSchema),
        ShiftPolicy: db.model('ShiftPolicy', ShiftPolicySchema),
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

/**
 * Enterprise Shift Master Controller
 * Handles CRUD for Shift Master Records
 */

// 1. GET ALL SHIFTS
exports.getShifts = async (req, res) => {
    try {
        const { ShiftMaster } = getModels(req);
        const { status } = req.query;
        let query = { tenant: req.tenantId };
        
        if (status) query.status = status;

        const shifts = await ShiftMaster.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: shifts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. GET SINGLE SHIFT & CURRENT POLICY
exports.getShiftById = async (req, res) => {
    try {
        const { ShiftMaster, ShiftPolicy } = getModels(req);
        const { id } = req.params;

        const shift = await ShiftMaster.findOne({ _id: id, tenant: req.tenantId });
        if (!shift) {
            return res.status(404).json({ success: false, error: "Shift Master not found" });
        }

        // Fetch the current active policy for this shift
        const policy = await ShiftPolicy.findOne({ 
            shiftMasterId: id, 
            tenant: req.tenantId, 
            isCurrent: true 
        });

        res.json({ success: true, data: { shift, currentPolicy: policy } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. CREATE SHIFT & INITIAL POLICY
exports.createShift = async (req, res) => {
    try {
        const { ShiftMaster, ShiftPolicy, AuditLog } = getModels(req);
        const { shiftMaster, policyRules } = req.body;

        if (!shiftMaster || !shiftMaster.name || !shiftMaster.code) {
            return res.status(400).json({ success: false, error: "Missing required core fields" });
        }

        // 1. Create Shift Master
        const newShift = new ShiftMaster({
            ...shiftMaster,
            tenant: req.tenantId || req.user?.tenantId || req.user?.companyId || '60c72b2f9b1d8b0015a5a123',
            createdBy: req.user ? req.user.id : null
        });

        await newShift.save();

        // 2. Create Initial Policy Version
        let newPolicy = null;
        if (policyRules) {
            newPolicy = new ShiftPolicy({
                ...policyRules,
                tenant: req.tenantId,
                shiftMasterId: newShift._id,
                version: 1,
                isCurrent: true,
                effectiveFrom: shiftMaster.validFrom || new Date(),
                createdBy: req.user ? req.user.id : null
            });
            await newPolicy.save();
        }

        // 3. Audit Log
        if (req.user) {
            const auditLog = new AuditLog({
                tenant: req.tenantId || req.user?.tenantId || req.user?.companyId || '60c72b2f9b1d8b0015a5a123',
                entity: 'ShiftMaster',
                entityId: newShift._id,
                action: 'SHIFT_CREATED',
                performedBy: req.user.id,
                changes: { before: null, after: newShift.toObject() },
                meta: { shiftName: newShift.name }
            });
            await auditLog.save();
        }

        res.status(201).json({ 
            success: true, 
            message: "Shift and initial policy created successfully", 
            data: { shift: newShift, policy: newPolicy } 
        });
    } catch (error) {
        console.error("CREATE SHIFT ERROR:", error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: "A shift with this code already exists" });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. BULK CREATE SHIFTS (From Excel)
exports.bulkCreateShifts = async (req, res) => {
    try {
        const { ShiftMaster, ShiftPolicy, AuditLog } = getModels(req);
        const { shifts } = req.body;

        if (!Array.isArray(shifts) || shifts.length === 0) {
            return res.status(400).json({ success: false, error: "No shifts provided for bulk creation" });
        }

        const tenantId = req.tenantId || req.user?.tenantId || req.user?.companyId || '60c72b2f9b1d8b0015a5a123';
        const createdBy = req.user ? req.user.id : null;

        const createdShifts = [];

        for (const shiftData of shifts) {
            // 1. Create Shift Master
            const newShift = new ShiftMaster({
                ...shiftData,
                tenant: tenantId,
                createdBy
            });
            await newShift.save();

            // 2. Auto-generate Policy based on Shift Type
            const shiftType = newShift.type;
            let defaultLateMarks = [{ conditionType: 'GREATER_THAN', minutes: 15, action: 'LATE_MARK' }];
            let absentThreshold = 240; 
            let isOtEligible = false;

            if (shiftType === 'Support' || shiftType === '24x7 Support') {
                defaultLateMarks = [{ conditionType: 'GREATER_THAN', minutes: 5, action: 'HALF_DAY' }];
                isOtEligible = true;
            } else if (shiftType === 'Short Shift') {
                absentThreshold = 120;
            } else if (shiftType === 'Flexible' || shiftType === 'Project Based') {
                defaultLateMarks = [];
            }

            const newPolicy = new ShiftPolicy({
                tenant: tenantId,
                shiftMasterId: newShift._id,
                version: 1,
                isCurrent: true,
                effectiveFrom: new Date(),
                createdBy,
                attendanceRules: {
                    lateMarks: defaultLateMarks,
                    earlyExit: [{ conditionType: 'GREATER_THAN', minutes: 10, action: 'LATE_MARK' }],
                    absentThresholdMinutes: absentThreshold,
                    punchWindow: {
                        maxAdvancePunchInMinutes: parseInt(shift.maxAdvancePunchIn) || 120,
                        maxLatePunchOutMinutes: parseInt(shift.maxLatePunchOut) || 120
                    }
                },
                permissionEngine: { 
                    allowedDurations: [15, 30, 60], 
                    monthlyLimitCount: parseInt(shift.maxPermissions) || 2, 
                    monthlyLimitMinutes: 120, 
                    yearlyLimitCount: 24, 
                    requiresApproval: true 
                },
                overtimeEngine: { 
                    isEligible: shift.otEnabled !== undefined ? shift.otEnabled : isOtEligible, 
                    minimumMinutesToQualify: 60, 
                    maximumMinutesPerDay: 240, 
                    normalMultiplier: 1.0, 
                    holidayMultiplier: 2.0, 
                    weeklyOffMultiplier: 2.0, 
                    nightShiftMultiplier: 1.5, 
                    requiresApproval: true 
                }
            });
            await newPolicy.save();

            createdShifts.push(newShift);
        }

        // 3. Audit Log for Bulk Action
        if (req.user) {
            const auditLog = new AuditLog({
                tenant: tenantId,
                entity: 'ShiftMaster',
                entityId: createdShifts[0]._id, // Tagging first shift just for reference
                action: 'BULK_SHIFTS_CREATED',
                performedBy: req.user.id,
                details: `Bulk created ${createdShifts.length} shifts via Excel`
            });
            await auditLog.save();
        }

        res.status(201).json({ success: true, count: createdShifts.length, message: `Successfully created ${createdShifts.length} shifts` });
    } catch (error) {
        console.error("Bulk create shifts error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. UPDATE SHIFT MASTER
exports.updateShift = async (req, res) => {
    try {
        const { ShiftMaster, AuditLog } = getModels(req);
        const { id } = req.params;
        const updates = req.body;

        const shift = await ShiftMaster.findOne({ _id: id, tenant: req.tenantId });
        if (!shift) {
            return res.status(404).json({ success: false, error: "Shift Master not found" });
        }

        const before = shift.toObject();

        delete updates.tenant;
        delete updates._id;

        Object.keys(updates).forEach(key => {
            shift[key] = updates[key];
        });

        await shift.save();

        if (req.user) {
            const auditLog = new AuditLog({
                tenant: req.tenantId,
                entity: 'ShiftMaster',
                entityId: shift._id,
                action: 'SHIFT_UPDATED',
                performedBy: req.user.id,
                changes: { before, after: shift.toObject() },
                meta: { shiftName: shift.name }
            });
            await auditLog.save();
        }

        res.json({ success: true, message: "Shift Master updated successfully", data: shift });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. DELETE (SOFT DELETE) SHIFT MASTER
exports.deleteShift = async (req, res) => {
    try {
        const { ShiftMaster, AuditLog } = getModels(req);
        const { id } = req.params;

        const shift = await ShiftMaster.findOne({ _id: id, tenant: req.tenantId });
        if (!shift) {
            return res.status(404).json({ success: false, error: "Shift Master not found" });
        }

        const before = shift.toObject();
        await ShiftMaster.deleteOne({ _id: id });

        if (req.user) {
            const auditLog = new AuditLog({
                tenant: req.tenantId,
                entity: 'ShiftMaster',
                entityId: shift._id,
                action: 'SHIFT_DELETED',
                performedBy: req.user.id,
                changes: { before, after: shift.toObject() },
                meta: { shiftName: shift.name }
            });
            await auditLog.save();
        }

        res.json({ success: true, message: "Shift policy deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 6. CREATE NEW POLICY VERSION
exports.savePolicy = async (req, res) => {
    try {
        const { ShiftMaster, ShiftPolicy, AuditLog } = getModels(req);
        const { shiftId } = req.params;
        const payload = req.body;

        console.log(`[savePolicy] Searching for shift with ID: ${shiftId}, tenant: ${req.tenantId}`);

        let shift;
        try {
            shift = await ShiftMaster.findById(shiftId);
        } catch (e) {
            return res.status(400).json({ success: false, error: `Invalid Shift ID format: ${shiftId}` });
        }

        if (!shift) {
            console.log(`[savePolicy] Shift not found!`);
            return res.status(404).json({ success: false, error: `Shift Master not found for ID: ${shiftId}` });
        }

        if (String(shift.tenant) !== String(req.tenantId)) {
            return res.status(403).json({ success: false, error: `Tenant mismatch. Shift tenant: ${shift.tenant}, req tenant: ${req.tenantId}` });
        }

        // Get the current version to determine the next version number
        const currentPolicy = await ShiftPolicy.findOne({ shiftMasterId: shiftId, tenant: req.tenantId, isCurrent: true });
        const nextVersion = currentPolicy ? currentPolicy.version + 1 : 1;

        // If replacing immediately (Phase 1 logic), mark old as not current
        if (currentPolicy) {
            currentPolicy.isCurrent = false;
            await currentPolicy.save();
        }

        const newPolicy = new ShiftPolicy({
            ...payload,
            tenant: req.tenantId,
            shiftMasterId: shiftId,
            version: nextVersion,
            isCurrent: true,
            createdBy: req.user ? req.user.id : null
        });

        await newPolicy.save();

        if (req.user) {
            const auditLog = new AuditLog({
                tenant: req.tenantId,
                entity: 'ShiftPolicy',
                entityId: newPolicy._id,
                action: 'POLICY_VERSION_CREATED',
                performedBy: req.user.id,
                changes: { before: currentPolicy ? currentPolicy.toObject() : null, after: newPolicy.toObject() },
                meta: { shiftId, version: nextVersion }
            });
            await auditLog.save();
        }

        res.status(201).json({ success: true, message: "New Policy Version created", data: newPolicy });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 7. GET POLICY HISTORY
exports.getPolicyHistory = async (req, res) => {
    try {
        const { ShiftPolicy } = getModels(req);
        const { shiftId } = req.params;

        const policies = await ShiftPolicy.find({ shiftMasterId: shiftId, tenant: req.tenantId }).sort({ version: -1 });
        
        res.json({ success: true, data: policies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 8. SIMULATE SHIFT RULES (Phase 3 Integration)
exports.simulateShiftRule = async (req, res) => {
    try {
        const { ShiftMaster, ShiftPolicy } = getModels(req);
        const { policyConfig, punches, shiftId } = req.body; // policyConfig is the JSON rule payload from frontend
        
        const AttendanceEngine = require('../services/attendanceEngine.service');
        const engine = new AttendanceEngine(getModels(req));

        // Mock an employee and roster entry for simulation
        const mockEmployee = { _id: '000000000000000000000000' };
        const mockDate = new Date();

        // 1. Fetch the shift to get core timings
        const shift = await ShiftMaster.findById(shiftId || policyConfig.shiftMasterId);
        if (!shift) return res.status(404).json({ success: false, error: "Shift not found for simulation" });

        // 2. We mock the `EmployeeRoster` and `ShiftPolicy` queries inside the engine by passing a custom mocked model context,
        // OR we can just extract the pure logic from the engine.
        // For accurate Phase 3 simulation, we can just run the raw logic here:

        const sortedPunches = punches.sort((a, b) => new Date(a.time) - new Date(b.time));
        const firstPunch = sortedPunches.length > 0 ? sortedPunches[0].time : null;
        const lastPunch = sortedPunches.length > 0 ? sortedPunches[sortedPunches.length - 1].time : null;

        const dayjs = require('dayjs');
        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let totalWorkingMinutes = 0;
        let status = 'Absent';

        if (firstPunch && lastPunch) {
            totalWorkingMinutes = dayjs(lastPunch).diff(dayjs(firstPunch), 'minute');
            const shiftStartTime = dayjs(firstPunch).format('YYYY-MM-DD') + 'T' + shift.coreTiming.startTime;
            const lateDiff = dayjs(firstPunch).diff(dayjs(shiftStartTime), 'minute');
            if (lateDiff > 0) lateMinutes = lateDiff;

            const shiftEndTime = dayjs(lastPunch).format('YYYY-MM-DD') + 'T' + shift.coreTiming.endTime;
            const earlyDiff = dayjs(shiftEndTime).diff(dayjs(lastPunch), 'minute');
            if (earlyDiff > 0) earlyExitMinutes = earlyDiff;

            status = 'Present';
        }

        const { attendanceRules, overtimeEngine } = policyConfig;

        if (status === 'Present') {
            if (attendanceRules?.absentThresholdMinutes > 0 && totalWorkingMinutes < attendanceRules.absentThresholdMinutes) {
                status = 'Absent';
            } else {
                if (attendanceRules?.lateMarks) {
                    for (const rule of attendanceRules.lateMarks) {
                        if (rule.conditionType === 'GREATER_THAN' && lateMinutes > rule.minutes) {
                            if (rule.action === 'LATE_MARK') status = 'Late';
                            if (rule.action === 'HALF_DAY') status = 'Half Day';
                            if (rule.action === 'ABSENT') status = 'Absent';
                        }
                    }
                }
            }
        }

        let otMinutes = 0;
        if (overtimeEngine?.isEligible && totalWorkingMinutes > 0) {
            const shiftStartTime = dayjs(firstPunch).format('YYYY-MM-DD') + 'T' + shift.coreTiming.startTime;
            const shiftEndTime = dayjs(lastPunch).format('YYYY-MM-DD') + 'T' + shift.coreTiming.endTime;
            const requiredMinutes = dayjs(shiftEndTime).diff(dayjs(shiftStartTime), 'minute');
            const excessMinutes = totalWorkingMinutes - requiredMinutes;

            if (excessMinutes >= overtimeEngine.minimumMinutesToQualify) {
                otMinutes = Math.min(excessMinutes, overtimeEngine.maximumMinutesPerDay || 9999);
            }
        }

        res.json({
            success: true,
            data: {
                firstPunch,
                lastPunch,
                totalWorkingMinutes,
                lateMinutes,
                earlyExitMinutes,
                status,
                otMinutes,
                otMultiplierApplied: overtimeEngine?.normalMultiplier || 1.0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
