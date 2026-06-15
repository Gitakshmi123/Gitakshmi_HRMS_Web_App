const ShiftSchema = require('../models/Shift');
const ShiftAssignmentSchema = require('../models/ShiftAssignment');

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Get tenant-scoped Shift model */
const getShiftModel = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error('Tenant database connection not available');
    return db.model('Shift', ShiftSchema);
};

/** Get tenant-scoped ShiftAssignment model */
const getAssignmentModel = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error('Tenant database connection not available');
    return db.model('ShiftAssignment', ShiftAssignmentSchema);
};

/**
 * Auto-generate sequential shift code based on shift type: DAY, DAY2, DAY3…
 * Uses highest existing numeric suffix per tenant (ignores soft-deleted).
 */
const generateShiftCode = async (Shift, tenantId, shiftType) => {
    let basePrefix = 'GEN';
    if (shiftType === 'Day Shift') basePrefix = 'DAY';
    else if (shiftType === 'Night Shift') basePrefix = 'NIGHT';
    else if (shiftType === 'Rotational Shift') basePrefix = 'ROT';
    else if (shiftType === 'Custom Shift') basePrefix = 'CUST';

    // Find codes starting with the exact base prefix followed by digits or end of string
    const regex = new RegExp(`^${basePrefix}(\\d*)$`, 'i');
    const all = await Shift.find({ tenant: tenantId, isDeleted: false, code: regex })
        .select('code')
        .lean();

    let maxNum = 0;
    let hasBase = false;

    all.forEach(s => {
        const m = (s.code || '').match(regex);
        if (m) {
            if (m[1] === '') {
                hasBase = true; // e.g., "DAY" exists
            } else {
                maxNum = Math.max(maxNum, parseInt(m[1], 10)); // e.g., "DAY2" -> 2
            }
        }
    });

    if (!hasBase && maxNum === 0) {
        return basePrefix; // First of its kind -> DAY
    }

    // If DAY exists and maxNum is 0, next is DAY2
    // If DAY2 exists, next is DAY3
    return `${basePrefix}${Math.max(maxNum, 1) + 1}`;
};

/** Detect night shift: end time numerically less than start time (crosses midnight) */
const detectNightShift = (startTime, endTime) => {
    if (!startTime || !endTime) return false;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) < (sh * 60 + sm);
};

const normalizeShiftPayload = (body = {}, existingShift = null) => {
    const normalized = { ...body };
    const isNight = detectNightShift(body.startTime ?? existingShift?.startTime, body.endTime ?? existingShift?.endTime);

    const locationCfg = {
        ...(existingShift?.locationCfg?.toObject ? existingShift.locationCfg.toObject() : existingShift?.locationCfg || {}),
        ...(body.locationCfg || {}),
    };
    if (typeof locationCfg.allowedIPs === 'string') {
        locationCfg.allowedIPs = locationCfg.allowedIPs.split(',').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(locationCfg.allowedIPs)) {
        locationCfg.allowedIPs = [];
    }

    normalized.locationCfg = locationCfg;
    normalized.punchMode = {
        ...(existingShift?.punchMode?.toObject ? existingShift.punchMode.toObject() : existingShift?.punchMode || {}),
        ...(body.punchMode || {}),
        mode: body.punchMode?.mode || existingShift?.punchMode?.mode || 'single',
    };
    normalized.overtimeCfg = {
        ...(existingShift?.overtimeCfg?.toObject ? existingShift.overtimeCfg.toObject() : existingShift?.overtimeCfg || {}),
        ...(body.overtimeCfg || {}),
    };
    normalized.absentCfg = {
        ...(existingShift?.absentCfg?.toObject ? existingShift.absentCfg.toObject() : existingShift?.absentCfg || {}),
        ...(body.absentCfg || {}),
    };
    normalized.weeklyOffCfg = {
        ...(existingShift?.weeklyOffCfg?.toObject ? existingShift.weeklyOffCfg.toObject() : existingShift?.weeklyOffCfg || {}),
        ...(body.weeklyOffCfg || {}),
        days: Array.isArray(body.weeklyOffCfg?.days)
            ? body.weeklyOffCfg.days
            : (existingShift?.weeklyOffCfg?.days || body.weeklyOffs || existingShift?.weeklyOffs || [0]),
    };
    normalized.nightShiftRules = {
        ...(existingShift?.nightShiftRules?.toObject ? existingShift.nightShiftRules.toObject() : existingShift?.nightShiftRules || {}),
        ...(body.nightShiftRules || {}),
        shiftSpansMidnight: isNight,
    };
    normalized.workingHoursCfg = {
        ...(existingShift?.workingHoursCfg?.toObject ? existingShift.workingHoursCfg.toObject() : existingShift?.workingHoursCfg || {}),
        ...(body.workingHoursCfg || {}),
    };

    normalized.weeklyOffs = normalized.weeklyOffCfg.days;
    normalized.isNightShift = isNight;
    normalized.status = body.status ?? existingShift?.status ?? 'Active';
    normalized.isActive = normalized.status === 'Active';

    return normalized;
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/attendance/shifts
//  Returns all non-deleted shifts for this tenant.
// ─────────────────────────────────────────────────────────────────────────────
exports.getShifts = async (req, res) => {
    try {
        const Shift = getShiftModel(req);
        const filter = { tenant: req.tenantId, isDeleted: false };

        const shifts = await Shift.find(filter)
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: shifts });
    } catch (err) {
        console.error('[ShiftCtrl] getShifts error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/attendance/shifts/:id
//  Returns a single non-deleted shift by ID.
// ─────────────────────────────────────────────────────────────────────────────
exports.getShiftById = async (req, res) => {
    try {
        const Shift = getShiftModel(req);
        const shift = await Shift.findOne({
            _id: req.params.id,
            tenant: req.tenantId,
            isDeleted: false,
        }).lean();

        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
        return res.json({ success: true, data: shift });
    } catch (err) {
        console.error('[ShiftCtrl] getShiftById error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/attendance/shifts
//  Create a new shift with all 13 enterprise sections.
// ─────────────────────────────────────────────────────────────────────────────
exports.createShift = async (req, res) => {
    try {
        const Shift = getShiftModel(req);
        const tenantId = req.tenantId;
        const body = normalizeShiftPayload(req.body);

        // Validate required fields
        if (!body.name || !body.name.trim() || !body.startTime || !body.endTime || !body.effectiveFrom) {
            return res.status(400).json({ success: false, message: 'name, startTime, endTime and effectiveFrom are required' });
        }

        // Validate time format (HH:mm)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(body.startTime) || !timeRegex.test(body.endTime)) {
            return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:mm (00:00 - 23:59)' });
        }

        const effectiveFromDate = body.effectiveFrom instanceof Date ? body.effectiveFrom : new Date(body.effectiveFrom);
        if (isNaN(effectiveFromDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Effective From must be a valid date' });
        }

        // Auto-generate code if not supplied
        const code = body.code && body.code.trim()
            ? body.code.trim().toUpperCase()
            : await generateShiftCode(Shift, tenantId, body.shiftType || 'General Shift');

        // Check code uniqueness within tenant
        const existing = await Shift.findOne({ code, tenant: tenantId, isDeleted: false });
        if (existing) {
            return res.status(400).json({ success: false, message: `Shift code "${code}" already exists` });
        }

        const shift = await Shift.create({
            // 1) Basic
            name: body.name.trim(),
            code,
            shiftType: body.shiftType || 'General Shift',
            description: body.description || '',

            // Core timing
            startTime: body.startTime,
            endTime: body.endTime,
            isNightShift: body.isNightShift,
            breakMinutes: body.breakMinutes ?? 30,
            graceMinutes: body.graceMinutes ?? body.workingHoursCfg?.graceLateMinutes ?? 15,
            graceEarly: body.graceEarly ?? body.workingHoursCfg?.graceEarlyMinutes ?? 15,
            lateThreshold: body.lateThreshold ?? 30,
            weeklyOffs: body.weeklyOffs ?? body.weeklyOffCfg?.days ?? [0],

            // 2) Punch Mode
            punchMode: body.punchMode || {},

            // 3) Overtime
            overtimeCfg: body.overtimeCfg || {},

            // 4) Location
            locationCfg: body.locationCfg || {},

            // 5) Working Hours
            workingHoursCfg: body.workingHoursCfg || {},

            // 6) Absent & Sandwich
            absentCfg: body.absentCfg || {},

            // 7) Weekly Off
            weeklyOffCfg: body.weeklyOffCfg || {},

            // 8) Late Mark Rules
            lateMarkRules: body.lateMarkRules || {},

            // 9) Early Exit Rules
            earlyExitRules: body.earlyExitRules || {},

            // 10) Half Day Rules
            halfDayRules: body.halfDayRules || {},

            // 11) Leave / WFH / OD / CompOff
            leaveIntegration: body.leaveIntegration || {},
            wfhSettings: body.wfhSettings || {},
            odSettings: body.odSettings || {},
            compOffSettings: body.compOffSettings || {},

            // 12) Night Shift & Correction
            nightShiftRules: body.nightShiftRules || {},
            correctionWorkflow: body.correctionWorkflow || {},

            // 13) Validity
            effectiveFrom: effectiveFromDate,
            effectiveTo: body.effectiveTo ? (body.effectiveTo instanceof Date ? body.effectiveTo : new Date(body.effectiveTo)) : null,
            status: body.status || 'Active',

            // Legacy compat
            attendanceRules: body.attendanceRules || {},
            alternateSaturday: body.alternateSaturday ?? false,
            allowWeeklyOffOverride: body.allowWeeklyOffOverride ?? false,
            isActive: body.isActive,

            // Meta
            tenant: tenantId,
            createdBy: req.user?.email || req.user?.id || null,
        });

        return res.status(201).json({ success: true, data: shift });
    } catch (err) {
        console.error('[ShiftCtrl] createShift error:', err.message);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Shift code already exists for this company' });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/attendance/shifts/:id
//  Update all fields of an existing shift.
// ─────────────────────────────────────────────────────────────────────────────
exports.updateShift = async (req, res) => {
    try {
        const Shift = getShiftModel(req);

        const shift = await Shift.findOne({
            _id: req.params.id,
            tenant: req.tenantId,
            isDeleted: false,
        });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
        const body = normalizeShiftPayload(req.body, shift);

        // Detect night shift if timing changed
        const startTime = body.startTime ?? shift.startTime;
        const endTime = body.endTime ?? shift.endTime;

        // Build update object – merge all 13 sections
        const update = {
            name: body.name?.trim() ?? shift.name,
            shiftType: body.shiftType ?? shift.shiftType,
            description: body.description ?? shift.description,

            startTime,
            endTime,
            isNightShift: body.isNightShift,
            breakMinutes: body.breakMinutes ?? shift.breakMinutes,
            graceMinutes: body.graceMinutes ?? shift.graceMinutes,
            graceEarly: body.graceEarly ?? shift.graceEarly,
            lateThreshold: body.lateThreshold ?? shift.lateThreshold,

            punchMode: body.punchMode ?? shift.punchMode,
            overtimeCfg: body.overtimeCfg ?? shift.overtimeCfg,
            locationCfg: body.locationCfg ?? shift.locationCfg,
            workingHoursCfg: body.workingHoursCfg ?? shift.workingHoursCfg,
            absentCfg: body.absentCfg ?? shift.absentCfg,
            weeklyOffCfg: body.weeklyOffCfg ?? shift.weeklyOffCfg,
            lateMarkRules: body.lateMarkRules ?? shift.lateMarkRules,
            earlyExitRules: body.earlyExitRules ?? shift.earlyExitRules,
            halfDayRules: body.halfDayRules ?? shift.halfDayRules,
            leaveIntegration: body.leaveIntegration ?? shift.leaveIntegration,
            wfhSettings: body.wfhSettings ?? shift.wfhSettings,
            odSettings: body.odSettings ?? shift.odSettings,
            compOffSettings: body.compOffSettings ?? shift.compOffSettings,
            nightShiftRules: body.nightShiftRules ?? shift.nightShiftRules,
            correctionWorkflow: body.correctionWorkflow ?? shift.correctionWorkflow,

            effectiveFrom: body.effectiveFrom ?? shift.effectiveFrom,
            effectiveTo: body.effectiveTo !== undefined ? body.effectiveTo : shift.effectiveTo,
            status: body.status ?? shift.status,
            isActive: body.isActive ?? shift.isActive,

            weeklyOffs: body.weeklyOffs ?? body.weeklyOffCfg?.days ?? shift.weeklyOffs,
            alternateSaturday: body.alternateSaturday ?? shift.alternateSaturday,
            allowWeeklyOffOverride: body.allowWeeklyOffOverride ?? shift.allowWeeklyOffOverride,

            attendanceRules: body.attendanceRules ?? shift.attendanceRules,
        };

        Object.assign(shift, update);
        await shift.save();

        return res.json({ success: true, data: shift });
    } catch (err) {
        console.error('[ShiftCtrl] updateShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/attendance/shifts/:id/status
//  Toggle Active ↔ Inactive
// ─────────────────────────────────────────────────────────────────────────────
exports.patchStatus = async (req, res) => {
    try {
        const Shift = getShiftModel(req);
        const shift = await Shift.findOne({
            _id: req.params.id,
            tenant: req.tenantId,
            isDeleted: false,
        });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

        shift.status = shift.status === 'Active' ? 'Inactive' : 'Active';
        shift.isActive = shift.status === 'Active';
        await shift.save();

        return res.json({ success: true, data: { status: shift.status } });
    } catch (err) {
        console.error('[ShiftCtrl] patchStatus error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/attendance/shifts/:id  (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteShift = async (req, res) => {
    try {
        const Shift = getShiftModel(req);
        const shift = await Shift.findOne({
            _id: req.params.id,
            tenant: req.tenantId,
            isDeleted: false,
        });
        const Assignment = getAssignmentModel(req);
        const activeAssignments = await Assignment.countDocuments({
            shift: req.params.id,
            tenant: req.tenantId,
            isActive: true
        });

        if (activeAssignments > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete shift. it is currently assigned to ${activeAssignments} employees. Please reassign them first.`
            });
        }

        shift.isDeleted = true;
        shift.isActive = false;
        shift.status = 'Inactive';
        // Append timestamp to avoid unique constraint error if a new shift uses this code again
        shift.code = `${shift.code}_del_${Date.now()}`;
        await shift.save();

        return res.json({ success: true, message: 'Shift deleted' });
    } catch (err) {
        console.error('[ShiftCtrl] deleteShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/attendance/shifts/assign
//  Assign one shift to one employee (creates/replaces the active assignment)
// ─────────────────────────────────────────────────────────────────────────────
exports.assignShift = async (req, res) => {
    try {
        const Assignment = getAssignmentModel(req);
        const Shift = getShiftModel(req);
        const { employeeId, shiftId, effectiveFrom, effectiveTo, isOverride, overrideReason } = req.body;

        if (!employeeId || !shiftId || !effectiveFrom) {
            return res.status(400).json({ success: false, message: 'employeeId, shiftId and effectiveFrom are required' });
        }

        const { Employee } = require('../models/Employee');
        const employee = await Employee.findOne({ _id: employeeId, tenant: req.tenantId, status: 'Active' });
        if (!employee) return res.status(404).json({ success: false, message: 'Active employee not found' });

        // Validate shift exists
        const shift = await Shift.findOne({ _id: shiftId, tenant: req.tenantId, isDeleted: false });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

        // Deactivate previous active assignments for this employee to prevent overlaps
        // If assigning a standard shift, end the previous standard one.
        // If assigning an override, we keep the standard one active but the engine prioritizes overrides.
        if (!isOverride) {
            await Assignment.updateMany(
                { employee: employeeId, tenant: req.tenantId, isActive: true, isOverride: false },
                { $set: { isActive: false, effectiveTo: new Date(effectiveFrom) } }
            );
        } else {
            // If assigning a new override, deactivate any existing overlapping overrides
            await Assignment.updateMany(
                { employee: employeeId, tenant: req.tenantId, isActive: true, isOverride: true },
                { $set: { isActive: false, effectiveTo: new Date(effectiveFrom) } }
            );
        }

        const assignment = await Assignment.create({
            employee: employeeId,
            shift: shiftId,
            effectiveFrom: new Date(effectiveFrom),
            effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
            isOverride: !!isOverride,
            overrideReason: overrideReason || '',
            isActive: true,
            tenant: req.tenantId,
            assignedBy: req.user?.email || req.user?.id || null,
        });

        return res.status(201).json({ success: true, data: assignment });
    } catch (err) {
        console.error('[ShiftCtrl] assignShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/attendance/shifts/bulk-assign
//  Assign one shift to multiple employees
// ─────────────────────────────────────────────────────────────────────────────
exports.bulkAssignShift = async (req, res) => {
    try {
        const Assignment = getAssignmentModel(req);
        const Shift = getShiftModel(req);
        const { employeeIds, shiftId, effectiveFrom, effectiveTo } = req.body;

        if (!Array.isArray(employeeIds) || !employeeIds.length || !shiftId || !effectiveFrom) {
            return res.status(400).json({ success: false, message: 'employeeIds (array), shiftId and effectiveFrom are required' });
        }

        const shift = await Shift.findOne({ _id: shiftId, tenant: req.tenantId, isDeleted: false });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

        // Deactivate prior assignments for all these employees
        await Assignment.updateMany(
            { employee: { $in: employeeIds }, tenant: req.tenantId, isActive: true, isOverride: false },
            { $set: { isActive: false, effectiveTo: new Date(effectiveFrom) } }
        );

        const docs = employeeIds.map(empId => ({
            employee: empId,
            shift: shiftId,
            effectiveFrom: new Date(effectiveFrom),
            effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
            isOverride: false,
            isActive: true,
            tenant: req.tenantId,
            assignedBy: req.user?.email || req.user?.id || null,
        }));

        const created = await Assignment.insertMany(docs);
        return res.status(201).json({
            success: true,
            message: `Successfully assigned shift to ${created.length} employees`,
            count: created.length
        });
    } catch (err) {
        console.error('[ShiftCtrl] bulkAssignShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/attendance/shifts/override
//  Temporary date-range shift override for an employee
// ─────────────────────────────────────────────────────────────────────────────
exports.overrideShift = async (req, res) => {
    try {
        const { employeeId, shiftId, effectiveFrom, effectiveTo, reason } = req.body;
        if (!employeeId || !shiftId || !effectiveFrom || !effectiveTo) {
            return res.status(400).json({ success: false, message: 'employeeId, shiftId, effectiveFrom and effectiveTo are required for override' });
        }

        const Assignment = getAssignmentModel(req);
        const Shift = getShiftModel(req);

        const shift = await Shift.findOne({ _id: shiftId, tenant: req.tenantId, isDeleted: false });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

        const override = await Assignment.create({
            employee: employeeId,
            shift: shiftId,
            effectiveFrom: new Date(effectiveFrom),
            effectiveTo: new Date(effectiveTo),
            isOverride: true,
            overrideReason: reason || '',
            isActive: true,
            tenant: req.tenantId,
            assignedBy: req.user?.email || req.user?.id || null,
        });

        return res.status(201).json({ success: true, data: override });
    } catch (err) {
        console.error('[ShiftCtrl] overrideShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/attendance/shifts/bulk-override
//  Temporary date-range shift override for multiple employees
// ─────────────────────────────────────────────────────────────────────────────
exports.bulkOverrideShift = async (req, res) => {
    try {
        const { employeeIds, shiftId, effectiveFrom, effectiveTo, reason } = req.body;
        if (!Array.isArray(employeeIds) || !employeeIds.length || !shiftId || !effectiveFrom || !effectiveTo) {
            return res.status(400).json({ success: false, message: 'employeeIds (array), shiftId, effectiveFrom and effectiveTo are required' });
        }

        const Assignment = getAssignmentModel(req);
        const Shift = getShiftModel(req);

        const shift = await Shift.findOne({ _id: shiftId, tenant: req.tenantId, isDeleted: false });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

        // Deactivate existing active overrides for these employees in this date range (simplified as ending them today)
        await Assignment.updateMany(
            { employee: { $in: employeeIds }, tenant: req.tenantId, isActive: true, isOverride: true },
            { $set: { isActive: false, effectiveTo: new Date(effectiveFrom) } }
        );

        const docs = employeeIds.map(empId => ({
            employee: empId,
            shift: shiftId,
            effectiveFrom: new Date(effectiveFrom),
            effectiveTo: new Date(effectiveTo),
            isOverride: true,
            overrideReason: reason || '',
            isActive: true,
            tenant: req.tenantId,
            assignedBy: req.user?.email || req.user?.id || null,
        }));

        const created = await Assignment.insertMany(docs);
        return res.status(201).json({
            success: true,
            message: `Successfully overridden shifts for ${created.length} employees`,
            count: created.length
        });
    } catch (err) {
        console.error('[ShiftCtrl] bulkOverrideShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/attendance/shifts/effective/:employeeId/:date
//  Returns the effective shift for an employee on a given date.
//  Priority: active override > active standard assignment > null (use default)
// ─────────────────────────────────────────────────────────────────────────────
exports.fetchEffectiveShift = async (req, res) => {
    try {
        const { employeeId, date } = req.params;
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        const Assignment = getAssignmentModel(req);
        const Shift = getShiftModel(req);

        // Helper: build query to find assignment active on targetDate
        const dateFilter = {
            employee: employeeId,
            tenant: req.tenantId,
            isActive: true,
            effectiveFrom: { $lte: targetDate },
            $or: [{ effectiveTo: null }, { effectiveTo: { $gte: targetDate } }],
        };

        // 1) Check override first
        const override = await Assignment.findOne({ ...dateFilter, isOverride: true })
            .sort({ effectiveFrom: -1 })
            .lean();

        if (override) {
            const shift = await Shift.findOne({ _id: override.shift, tenant: req.tenantId, isDeleted: false }).lean();
            return res.json({ success: true, source: 'override', assignment: override, data: shift });
        }

        // 2) Standard assignment
        const standard = await Assignment.findOne({ ...dateFilter, isOverride: false })
            .sort({ effectiveFrom: -1 })
            .lean();

        if (standard) {
            const shift = await Shift.findOne({ _id: standard.shift, tenant: req.tenantId, isDeleted: false }).lean();
            return res.json({ success: true, source: 'assignment', assignment: standard, data: shift });
        }

        // 3) No assignment – caller should fall back to global attendance settings
        return res.json({ success: true, source: 'none', assignment: null, data: null });
    } catch (err) {
        console.error('[ShiftCtrl] fetchEffectiveShift error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};
