const dayjs = require('dayjs');
const mongoose = require('mongoose');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        Roster: db.model('Roster', require('../models/Roster')),
        RosterAssignment: db.model('RosterAssignment', require('../models/RosterAssignment')),
        RosterRotation: db.model('RosterRotation', require('../models/RosterRotation')),
        Employee: db.model('Employee', require('../models/Employee')),
        ShiftMaster: db.model('ShiftMaster', require('../models/ShiftMaster')),
        EmployeeRoster: db.model('EmployeeRoster', require('../models/EmployeeRoster')) // Legacy
    };
};

// Helper: Calculate weeks from startDate to endDate
const calculateWeeks = (startDateStr, endDateStr) => {
    const startOfRange = dayjs(startDateStr).startOf('day');
    const endOfRange = dayjs(endDateStr).endOf('day');
    const weeks = [];
    
    let currentStart = startOfRange;
    let weekNo = 1;

    while (currentStart.isBefore(endOfRange) || currentStart.isSame(endOfRange, 'day')) {
        let currentEnd = currentStart.endOf('week'); // Ends on Saturday
        if (currentEnd.isAfter(endOfRange)) {
            currentEnd = endOfRange;
        }
        weeks.push({
            weekNo,
            startDate: currentStart.toDate(),
            endDate: currentEnd.toDate()
        });
        currentStart = currentEnd.add(1, 'day').startOf('day');
        weekNo++;
    }
    return weeks;
};

// 1. Create a new Roster master config
exports.createRoster = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { Roster, RosterAssignment, RosterRotation } = getModels(req);
        
        const newRoster = new Roster({
            ...req.body,
            tenant: tenantId,
            createdBy: req.user?._id
        });
        
        await newRoster.save();

        // Auto-generation logic for Fixed Shift
        if (newRoster.rosterType === 'Fixed Shift' && req.body.fixedShiftId) {
            const weeks = calculateWeeks(newRoster.startDate, newRoster.endDate);
            let assignments = [];

            for (const empId of newRoster.employees) {
                for (const week of weeks) {
                    assignments.push({
                        tenant: tenantId,
                        rosterId: newRoster._id,
                        employeeId: empId,
                        shiftId: req.body.fixedShiftId,
                        weekNo: week.weekNo,
                        startDate: week.startDate,
                        endDate: week.endDate,
                        assignedBy: req.user?._id,
                        status: 'Draft'
                    });
                }
            }

            if (assignments.length > 0) {
                await RosterAssignment.insertMany(assignments);
            }
        }
        // Auto-generation logic for Rotations
        else if (req.body.rotationId && newRoster.rosterType !== 'Manual' && newRoster.rosterType !== 'Fixed Shift') {
            const rotation = await RosterRotation.findById(req.body.rotationId).lean();
            if (rotation && rotation.sequence && rotation.sequence.length > 0) {
                const weeks = calculateWeeks(newRoster.startDate, newRoster.endDate);
                let assignments = [];
                const sequence = rotation.sequence;

                for (const empId of newRoster.employees) {
                    let sequenceIndex = 0;
                    for (const week of weeks) {
                        const shiftId = sequence[sequenceIndex % sequence.length];
                        assignments.push({
                            tenant: tenantId,
                            rosterId: newRoster._id,
                            employeeId: empId,
                            shiftId: shiftId,
                            weekNo: week.weekNo,
                            startDate: week.startDate,
                            endDate: week.endDate,
                            assignedBy: req.user?._id,
                            status: 'Draft'
                        });
                        sequenceIndex++;
                    }
                }

                if (assignments.length > 0) {
                    await RosterAssignment.insertMany(assignments);
                }
            }
        }

        res.status(201).json({ success: true, data: newRoster });
    } catch (error) {
        console.error('[CREATE_ROSTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 2. Auto-Generate Roster Assignments
exports.generateRoster = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { Roster, RosterAssignment, RosterRotation, Employee } = getModels(req);
        const { rosterId, rotationId } = req.body;

        const roster = await Roster.findById(rosterId).lean();
        if (!roster) return res.status(404).json({ success: false, message: 'Roster not found' });

        const rotation = await RosterRotation.findById(rotationId).lean();
        if (!rotation) return res.status(404).json({ success: false, message: 'Rotation Pattern not found' });

        const weeks = calculateWeeks(roster.startDate, roster.endDate);
        let assignments = [];

        // Clear existing drafts for this roster
        await RosterAssignment.deleteMany({ rosterId: roster._id, status: 'Draft' });

        // Simple Weekly Rotation Logic (Pattern Cycling)
        // E.g., Week 1 -> pattern[0], Week 2 -> pattern[1], etc.
        const sequence = rotation.sequence; // Array of shiftMasterIds
        if (!sequence || sequence.length === 0) {
            return res.status(400).json({ success: false, message: 'Rotation sequence is empty' });
        }

        // Generate per employee
        for (const empId of roster.employees) {
            let sequenceIndex = 0; // We can introduce history lookup here for Fair Rotation later
            
            for (const week of weeks) {
                const shiftId = sequence[sequenceIndex % sequence.length];
                
                assignments.push({
                    tenant: tenantId,
                    rosterId: roster._id,
                    employeeId: empId,
                    shiftId: shiftId,
                    weekNo: week.weekNo,
                    startDate: week.startDate,
                    endDate: week.endDate,
                    assignedBy: req.user?._id,
                    status: 'Draft'
                });
                
                sequenceIndex++;
            }
        }

        if (assignments.length > 0) {
            await RosterAssignment.insertMany(assignments);
        }

        res.status(200).json({ success: true, message: `Generated ${assignments.length} assignments.`, count: assignments.length });

    } catch (error) {
        console.error('[GENERATE_ROSTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 3. Publish Roster and Sync Legacy
exports.publishRoster = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { Roster, RosterAssignment, EmployeeRoster } = getModels(req);
        const { rosterId } = req.body;

        const roster = await Roster.findById(rosterId);
        if (!roster) return res.status(404).json({ success: false, message: 'Roster not found' });

        roster.status = 'Published';
        roster.published = true;
        roster.approvedBy = req.user?._id;
        await roster.save();

        // Mark assignments as published
        await RosterAssignment.updateMany(
            { rosterId: roster._id },
            { $set: { status: 'Published' } }
        );

        // -- LEGACY SYNC SUPPORT --
        // To prevent breaking old reports, generate daily EmployeeRoster records.
        const assignments = await RosterAssignment.find({ rosterId: roster._id }).lean();
        
        let dailyRosters = [];
        for (const assign of assignments) {
            let current = dayjs(assign.startDate);
            const end = dayjs(assign.endDate);
            
            while (current.isBefore(end) || current.isSame(end, 'day')) {
                const dayOfWeek = current.day(); // 0 is Sunday, 6 is Saturday
                const currentFormatted = current.format('YYYY-MM-DD');
                let isWeeklyOff = false;
                let isHalfDay = false;
                
                if (roster.weeklyOffDays && roster.weeklyOffDays.includes(dayOfWeek)) {
                    isWeeklyOff = true;
                }
                
                if (roster.halfDayOfWeek && roster.halfDayOfWeek.includes(dayOfWeek)) {
                    isHalfDay = true;
                }
                
                if (roster.weekendDates && roster.weekendDates.some(d => dayjs(d).format('YYYY-MM-DD') === currentFormatted)) {
                    isWeeklyOff = true;
                }

                dailyRosters.push({
                    tenant: tenantId,
                    employeeId: assign.employeeId,
                    date: current.toDate(),
                    shiftMasterId: assign.shiftId,
                    isWeeklyOff: isWeeklyOff,
                    isHalfDay: isHalfDay,
                    generatedBy: 'Roster_Rotation',
                    status: 'Published'
                });
                current = current.add(1, 'day');
            }
        }

        if (dailyRosters.length > 0) {
            // Delete old generated entries for these employees and dates to avoid duplicates
            await EmployeeRoster.deleteMany({
                tenant: tenantId,
                employeeId: { $in: roster.employees },
                date: { $gte: roster.startDate, $lte: roster.endDate },
                generatedBy: 'Roster_Rotation'
            });
            await EmployeeRoster.insertMany(dailyRosters);
        }

        res.status(200).json({ success: true, message: 'Roster published and synchronized successfully.' });

    } catch (error) {
        console.error('[PUBLISH_ROSTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 4. Get Roster Details
exports.getRosterDetails = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { Roster, RosterAssignment } = getModels(req);
        
        const roster = await Roster.findById(req.params.id)
            .populate('employees', 'firstName lastName employeeId')
            .lean();
            
        if (!roster) return res.status(404).json({ success: false, message: 'Not found' });

        const assignments = await RosterAssignment.find({ rosterId: roster._id })
            .populate('shiftId', 'name code startTime endTime colorCode')
            .lean();
            
        res.status(200).json({ success: true, data: { ...roster, assignments } });
    } catch (error) {
        console.error('[GET_ROSTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 5. List Rosters
exports.listRosters = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { Roster } = getModels(req);
        const rosters = await Roster.find({ tenant: tenantId })
            .populate('departmentId', 'name')
            .populate('teamId', 'name')
            .populate('employees', 'firstName lastName employeeId')
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json({ success: true, data: rosters });
    } catch (error) {
        console.error('[LIST_ROSTERS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 6. List Rotation Patterns
exports.listRotations = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { RosterRotation } = getModels(req);
        const rotations = await RosterRotation.find({ tenant: tenantId, isActive: true })
            .populate('sequence', 'name code startTime endTime colorCode')
            .lean();
        res.status(200).json({ success: true, data: rotations });
    } catch (error) {
        console.error('[LIST_ROTATIONS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 7. Create Rotation Pattern
exports.createRotation = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { RosterRotation } = getModels(req);
        const newRotation = new RosterRotation({
            ...req.body,
            tenant: tenantId,
            createdBy: req.user?._id
        });
        await newRotation.save();
        res.status(201).json({ success: true, data: newRotation });
    } catch (error) {
        console.error('[CREATE_ROTATION_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 8. Save Manual/Bulk Assignments
exports.saveAssignments = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { RosterAssignment, Roster } = getModels(req);
        const { rosterId, assignments } = req.body; // Array of { employeeId, shiftId, weekNo, startDate, endDate }
        
        const roster = await Roster.findById(rosterId);
        if (!roster) return res.status(404).json({ success: false, message: 'Roster not found' });
        if (roster.status === 'Published') {
            return res.status(400).json({ success: false, message: 'Cannot edit a published roster.' });
        }
        
        // Delete existing assignments for these employees in this roster
        const employeeIds = [...new Set(assignments.map(a => a.employeeId))];
        await RosterAssignment.deleteMany({
            rosterId: roster._id,
            employeeId: { $in: employeeIds }
        });
        
        const docs = assignments.map(a => ({
            tenant: tenantId,
            rosterId: roster._id,
            employeeId: a.employeeId,
            shiftId: a.shiftId,
            weekNo: a.weekNo,
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            assignedBy: req.user?._id,
            status: 'Draft'
        }));
        
        if (docs.length > 0) {
            await RosterAssignment.insertMany(docs);
        }
        
        res.status(200).json({ success: true, message: 'Assignments saved successfully.' });
    } catch (error) {
        console.error('[SAVE_ASSIGNMENTS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 9. Validate Roster Conflicts
exports.validateRosterConflicts = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const { Roster, RosterAssignment } = getModels(req);
        const { rosterId } = req.body;
        
        const roster = await Roster.findById(rosterId).lean();
        if (!roster) return res.status(404).json({ success: false, message: 'Roster not found' });
        
        const assignments = await RosterAssignment.find({ rosterId: roster._id }).lean();
        if (!assignments.length) {
            return res.status(200).json({ success: true, conflicts: [], warnings: [] });
        }
        
        const { validateConflicts, validateFairRotation } = require('../services/rosterConflictValidator.service');
        const conflicts = await validateConflicts(req.tenantDB, assignments);
        const warnings = await validateFairRotation(req.tenantDB, assignments, roster.employees);
        
        res.status(200).json({ success: true, conflicts, warnings });
    } catch (error) {
        console.error('[VALIDATE_ROSTER_CONFLICTS_ERROR]', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
