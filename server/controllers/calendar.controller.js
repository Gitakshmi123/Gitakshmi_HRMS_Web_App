const mongoose = require('mongoose');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        Attendance: db.model('Attendance', require('../models/Attendance')),
        AttendanceSettings: db.model('AttendanceSettings', require('../models/AttendanceSettings')),
        Employee: db.model('Employee', require('../models/Employee')),
        Holiday: db.model('Holiday', require('../models/Holiday')),
        LeaveRequest: db.model('LeaveRequest', require('../models/LeaveRequest'))
    };
};

// Helper: Convert date to YYYY-MM-DD
const toDateStr = (d) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = (dt.getMonth() + 1).toString().padStart(2, '0');
    const day = dt.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// GET /api/hr/calendar?month=&year=
exports.getCalendar = async (req, res) => {
    try {
        const { Attendance, AttendanceSettings, Holiday, LeaveRequest, Employee } = getModels(req);
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

        const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
        const month = req.query.month ? parseInt(req.query.month) - 1 : new Date().getMonth(); // 0-indexed

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        // Fetch settings for weekly off
        let settings = await AttendanceSettings.findOne({ tenant: tenantId }).lean();
        if (!settings) settings = { weeklyOffDays: [0] };

        // Fetch holidays in range
        const holidays = await Holiday.find({ tenant: tenantId, date: { $gte: startDate, $lte: endDate } }).lean();
        const holidayMap = {};
        holidays.forEach(h => holidayMap[toDateStr(h.date)] = h);

        // Fetch attendances for range and group by date
        const attendanceAgg = await Attendance.aggregate([
            { $match: { tenant: new mongoose.Types.ObjectId(tenantId), date: { $gte: startDate, $lte: endDate } } },
            { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, status: "$status", leaveType: "$leaveType", employee: "$employee", isHalfDay: "$isHalfDay" } },
            { $group: { _id: "$dateStr", records: { $push: { status: "$status", leaveType: "$leaveType", employee: "$employee", isHalfDay: "$isHalfDay" } }, count: { $sum: 1 } } }
        ]);

        const attendanceMap = {};
        attendanceAgg.forEach(a => attendanceMap[a._id] = a);

        // Fetch approved leave requests overlapping the month
        const leaves = await LeaveRequest.find({ tenant: tenantId, status: 'Approved', $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }] }).lean();

        // Build per-date leave map (dateStr -> array of leaves)
        const leaveMap = {};
        leaves.forEach(l => {
            const s = new Date(l.startDate);
            s.setHours(0, 0, 0, 0);
            const e = new Date(l.endDate);
            e.setHours(0, 0, 0, 0);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                if (d < startDate || d > endDate) continue;
                const ds = toDateStr(d);
                leaveMap[ds] = leaveMap[ds] || [];
                leaveMap[ds].push({ employee: l.employee, leaveType: l.leaveType, isHalfDay: !!l.isHalfDay, requestId: l._id, status: l.status });
            }
        });

        // Employee count (active)
        const employeeCount = await Employee.countDocuments({ tenant: tenantId, isActive: { $ne: false } });

        const days = [];
        const lastDate = endDate.getDate();

        for (let day = 1; day <= lastDate; day++) {
            const d = new Date(year, month, day);
            const ds = toDateStr(d);
            const dayOfWeek = d.getDay();
            // Always treat Saturday(6) and Sunday(0) as weekly off (override tenant settings)
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const isWeeklyOff = isWeekend;
            const isHoliday = !!holidayMap[ds];

            // counts from attendance
            const att = attendanceMap[ds] || { records: [], count: 0 };
            let presentCount = 0, onDutyCount = 0, absentCount = 0, leaveCount = 0, halfDayCount = 0;
            att.records.forEach(r => {
                const st = (r.status || '').toLowerCase();
                if (st === 'present') presentCount++;
                else if (st === 'on_duty' || st === 'on-duty' || st === 'onduty') onDutyCount++;
                else if (st === 'half_day' || st === 'halfday') halfDayCount++;
                else if (st === 'leave') leaveCount++;
                else absentCount++;
            });

            // include leaves derived from LeaveRequest
            const leavesForDay = leaveMap[ds] || [];
            leaveCount = Math.max(leaveCount, leavesForDay.length);
            halfDayCount += leavesForDay.filter(l => l.isHalfDay).length;

            // Determine if any attendance records exist for this date
            const attendanceExists = (att && att.count && att.count > 0) || false;

            // Apply priority logic
            // HOLIDAY > WEEKLY_OFF > HALF_DAY > LEAVE > ON_DUTY > PRESENT > ABSENT > DEFAULT
            let status = 'DEFAULT';
            if (isHoliday) status = 'HOLIDAY';
            else if (isWeeklyOff) status = 'WEEKLY_OFF';
            else if (halfDayCount > 0) status = 'HALF_DAY';
            else if (leaveCount > 0) status = 'LEAVE';
            else if (onDutyCount > 0) status = 'ON_DUTY';
            else if (presentCount > 0) status = 'PRESENT';
            else if (attendanceExists) status = 'ABSENT';
            else status = 'DEFAULT';

            // Determine attendance status if attendance exists
            let attendanceStatus = null;
            if (attendanceExists) {
                if (onDutyCount > 0) attendanceStatus = 'ON_DUTY';
                else if (presentCount > 0) attendanceStatus = 'PRESENT';
                else attendanceStatus = 'ABSENT';
            }

            days.push({
                date: ds,
                dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
                isHoliday,
                isWeeklyOff,
                approvedLeave: {
                    exists: leavesForDay.length > 0,
                    leaveType: leavesForDay.length ? leavesForDay[0].leaveType : null,
                    isHalfDay: leavesForDay.length ? !!leavesForDay[0].isHalfDay : false
                },
                attendance: {
                    exists: attendanceExists,
                    status: attendanceStatus
                },
                isHalfDay: halfDayCount > 0,
                employeeCount,
                presentCount,
                onDutyCount,
                onLeaveCount: leaveCount,
                halfDayCount,
                finalStatus: status
            });
        }

        res.json({ year: year, month: month + 1, days });
    } catch (err) {
        console.error('Calendar error', err);
        res.status(500).json({ error: err.message });
    }
};

// ----- New endpoints: Production-grade attendance calendar -----
// GET /api/hr/attendance-calendar?month=&year=&tenantId=
exports.getAttendanceCalendar = async (req, res) => {
    try {
        const { Attendance, AttendanceSettings, Holiday, LeaveRequest, Employee } = getModels(req);
        const queryTenant = req.query.tenantId || req.tenantId;
        if (!queryTenant) return res.status(400).json({ error: 'tenantId is required' });

        const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
        const month = req.query.month ? parseInt(req.query.month) - 1 : new Date().getMonth(); // 0-indexed

        const startDate = new Date(year, month, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, month + 1, 0);
        endDate.setHours(23, 59, 59, 999);

        // weekly off settings
        let settings = await AttendanceSettings.findOne({ tenant: queryTenant }).lean();
        if (!settings) settings = { weeklyOffDays: [0] };

        // Holidays map
        const holidays = await Holiday.find({ tenant: queryTenant, date: { $gte: startDate, $lte: endDate } }).lean();
        const holidayMap = {};
        holidays.forEach(h => holidayMap[h.date.toISOString().split('T')[0]] = h);

        // Attendance aggregation per date
        const attendanceAgg = await Attendance.aggregate([
            { $match: { tenant: new mongoose.Types.ObjectId(queryTenant), date: { $gte: startDate, $lte: endDate } } },
            { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, status: "$status", employee: "$employee", leaveType: "$leaveType", isHalfDay: "$isHalfDay" } },
            { $group: { _id: "$dateStr", records: { $push: { status: "$status", employee: "$employee", leaveType: "$leaveType", isHalfDay: "$isHalfDay" } }, count: { $sum: 1 } } }
        ]);

        const attendanceMap = {};
        attendanceAgg.forEach(a => attendanceMap[a._id] = a.records);

        // LeaveRequest aggregation: Expand each approved leave to per-date entries within the month
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const leaveAgg = await LeaveRequest.aggregate([
            { $match: { tenant: new mongoose.Types.ObjectId(queryTenant), status: 'Approved', startDate: { $lte: endDate }, endDate: { $gte: startDate } } },
            { $addFields: { daysCount: { $add: [{ $dateDiff: { startDate: '$startDate', endDate: '$endDate', unit: 'day' } }, 1] } } },
            { $project: { employee: 1, leaveType: 1, isHalfDay: 1, dates: { $map: { input: { $range: [0, '$daysCount'] }, as: 'i', in: { $dateToString: { format: '%Y-%m-%d', date: { $dateAdd: { startDate: '$startDate', unit: 'day', amount: '$$i' } } } } } } } },
            { $unwind: '$dates' },
            { $match: { dates: { $gte: startStr, $lte: endStr } } },
            { $group: { _id: '$dates', leaves: { $push: { employee: '$employee', leaveType: '$leaveType', isHalfDay: '$isHalfDay' } }, count: { $sum: 1 } } }
        ]);

        const leaveMap = {};
        leaveAgg.forEach(l => leaveMap[l._id] = l.leaves);

        // Employee lookup for all involved employee ids in month (attendance + leaves)
        const employeeIds = new Set();
        Object.values(attendanceMap).forEach(records => records.forEach(r => r.employee && employeeIds.add(String(r.employee))));
        Object.values(leaveMap).forEach(arr => arr.forEach(r => r.employee && employeeIds.add(String(r.employee))));

        const empDocs = await Employee.find({ tenant: queryTenant, _id: { $in: Array.from(employeeIds).map(id => new mongoose.Types.ObjectId(id)) } }).lean();
        const empMap = {};
        empDocs.forEach(e => empMap[String(e._id)] = e);

        // Employee total count
        const employeeCount = await Employee.countDocuments({ tenant: queryTenant, isActive: { $ne: false } });

        // Assemble days
        const days = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const ds = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay();
            // Always treat Saturday(6) and Sunday(0) as weekly off (override tenant settings)
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const isWeeklyOff = isWeekend;
            const isHoliday = !!holidayMap[ds];

            const leavesForDay = leaveMap[ds] || [];
            const attendanceForDay = attendanceMap[ds] || [];

            // Build employees list: merge attendance and leaves
            const empListMap = {};
            attendanceForDay.forEach(r => {
                const id = String(r.employee);
                empListMap[id] = empListMap[id] || { employeeId: id, status: (r.status || '').toString().toUpperCase(), leaveType: r.leaveType || null };
            });
            leavesForDay.forEach(l => {
                const id = String(l.employee);
                // Leave overrides attendance for display
                empListMap[id] = empListMap[id] || { employeeId: id, status: 'ON_LEAVE', leaveType: l.leaveType || null, isHalfDay: !!l.isHalfDay };
                empListMap[id].status = 'ON_LEAVE';
                empListMap[id].leaveType = l.leaveType || empListMap[id].leaveType;
                empListMap[id].isHalfDay = !!l.isHalfDay;
            });

            const employees = Object.values(empListMap).map(e => {
                const doc = empMap[e.employeeId];
                return {
                    employeeId: e.employeeId,
                    name: doc ? `${doc.firstName || ''} ${doc.lastName || ''}`.trim() : null,
                    status: e.status,
                    leaveType: e.leaveType || null,
                    isHalfDay: !!e.isHalfDay
                };
            });

            // Determine attendance existence and status for the date
            const attendanceExists = attendanceForDay.length > 0;
            let attendanceStatus = null;
            if (attendanceExists) {
                const statuses = attendanceForDay.map(r => (r.status || '').toString().toUpperCase());
                if (statuses.some(s => s === 'ON_DUTY' || s === 'ON-DUTY' || s === 'ONDUTY')) attendanceStatus = 'ON_DUTY';
                else if (statuses.some(s => s === 'PRESENT')) attendanceStatus = 'PRESENT';
                else attendanceStatus = 'ABSENT';
            }

            // Approved leave info
            const approvedLeaveExists = leavesForDay.length > 0;
            const firstLeave = leavesForDay[0] || null;

            // Final status logic: HOLIDAY > WEEKLY_OFF > HALF_DAY > LEAVE > ON_DUTY > PRESENT > ABSENT > DEFAULT
            let finalStatus = 'DEFAULT';
            if (isHoliday) finalStatus = 'HOLIDAY';
            else if (isWeeklyOff) finalStatus = 'WEEKLY_OFF';
            else if (approvedLeaveExists && firstLeave.isHalfDay) finalStatus = 'HALF_DAY';
            else if (approvedLeaveExists) finalStatus = 'LEAVE';
            else if (attendanceExists && attendanceStatus === 'ON_DUTY') finalStatus = 'ON_DUTY';
            else if (attendanceExists && attendanceStatus === 'PRESENT') finalStatus = 'PRESENT';
            else if (attendanceExists && attendanceStatus === 'ABSENT') finalStatus = 'ABSENT';
            else finalStatus = 'DEFAULT';

            days.push({
                date: ds,
                dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
                isHoliday,
                isWeeklyOff,
                approvedLeave: {
                    exists: approvedLeaveExists,
                    leaveType: firstLeave ? firstLeave.leaveType : null,
                    isHalfDay: firstLeave ? !!firstLeave.isHalfDay : false
                },
                attendance: {
                    exists: attendanceExists,
                    status: attendanceStatus
                },
                employees,
                employeeCount,
                finalStatus
            });
        }

        res.json({ year: year, month: month + 1, days });

    } catch (err) {
        console.error('attendance-calendar error', err);
        res.status(500).json({ error: err.message });
    }
};

// Detail for a single date
exports.getAttendanceCalendarDetail = async (req, res) => {
    try {
        const { Attendance, LeaveRequest, Employee, Holiday } = getModels(req);
        const queryTenant = req.query.tenantId || req.tenantId;
        if (!queryTenant) return res.status(400).json({ error: 'tenantId is required' });

        const dateStr = req.query.date;
        if (!dateStr) return res.status(400).json({ error: 'date is required' });
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        const next = new Date(date);
        next.setDate(next.getDate() + 1);

        const totalEmployees = await Employee.countDocuments({ tenant: queryTenant, isActive: { $ne: false } });

        // Attendances
        const atts = await Attendance.find({ tenant: queryTenant, date: date }).populate('employee', 'firstName lastName employeeId profilePic').lean();

        // Approved leaves covering date
        const leaves = await LeaveRequest.find({ tenant: queryTenant, status: 'Approved', startDate: { $lte: date }, endDate: { $gte: date } }).populate('employee', 'firstName lastName employeeId profilePic').lean();

        const present = atts.filter(a => (a.status || '').toString().toUpperCase() === 'PRESENT');
        const onDuty = atts.filter(a => ['ON_DUTY', 'ONDUTY', 'ON-DUTY'].includes((a.status || '').toString().toUpperCase()));

        const employees = [];
        present.forEach(p => employees.push({ employeeId: p.employee._id, name: `${p.employee.firstName || ''} ${p.employee.lastName || ''}`.trim(), status: 'Present' }));
        onDuty.forEach(o => employees.push({ employeeId: o.employee._id, name: `${o.employee.firstName || ''} ${o.employee.lastName || ''}`.trim(), status: 'On Duty' }));
        leaves.forEach(l => employees.push({ employeeId: l.employee._id, name: `${l.employee.firstName || ''} ${l.employee.lastName || ''}`.trim(), status: 'On Leave', leaveType: l.leaveType, isHalfDay: !!l.isHalfDay }));

        const holiday = await Holiday.findOne({ tenant: queryTenant, date: date }).lean();

        res.json({ date: dateStr, totalEmployees, present: present.length, onDuty: onDuty.length, onLeave: leaves.length, holiday: holiday || null, employees });

    } catch (err) {
        console.error('attendance-calendar detail error', err);
        res.status(500).json({ error: err.message });
    }
};
