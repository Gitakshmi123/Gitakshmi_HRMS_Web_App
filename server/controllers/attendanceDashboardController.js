const mongoose = require('mongoose');

exports.getDashboardKPIs = async (req, res) => {
  try {
    const db = req.tenantDB;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Tenant database connection not available' });
    }

    const Attendance = db.model('Attendance', require('../models/Attendance'));
    const Employee = db.model('Employee', require('../models/Employee'));

    const tenantId = req.user?.tenantId || req.tenantId; 
    const query = tenantId ? { tenant: tenantId } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total employees
    const totalEmployees = await Employee.countDocuments({ ...query, status: { $in: ['Active', 'ACTIVE', 'active'] } });

    // Get today's attendance records
    const todayRecords = await Attendance.find({ 
      ...query, 
      date: { $gte: today } 
    });

    let present = 0;
    let absent = 0;
    let onLeave = 0;
    let weeklyOff = 0;
    let holiday = 0;
    let missingPunch = 0;

    todayRecords.forEach(record => {
      if (record.status === 'present') present++;
      else if (record.status === 'absent') absent++;
      else if (record.status === 'leave') onLeave++;
      else if (record.status === 'weekly_off') weeklyOff++;
      else if (record.status === 'holiday') holiday++;
      else if (record.status === 'missed_punch') missingPunch++;
    });

    // If there are employees without attendance records today, count them as absent or pending
    const recordedCount = todayRecords.length;
    if (recordedCount < totalEmployees) {
      absent += (totalEmployees - recordedCount);
    }

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        presentToday: present,
        absentToday: absent,
        onLeave,
        weeklyOff,
        holiday,
        missingPunch
      }
    });
  } catch (error) {
    console.error('Error fetching Dashboard KPIs:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getDailyAttendance = async (req, res) => {
  try {
    const db = req.tenantDB;
    if (!db) return res.status(500).json({ success: false, message: 'DB not found' });
    const Attendance = db.model('Attendance', require('../models/Attendance'));
    const Employee = db.model('Employee', require('../models/Employee'));
    const tenantId = req.user?.tenantId || req.tenantId || req.headers?.['x-tenant-id']; 
    const query = tenantId ? { tenant: tenantId } : {};

    const dateStr = req.query.date;
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const employees = await Employee.find({ ...query, status: { $in: ['Active', 'ACTIVE', 'active'] } }).lean();
    const attendances = await Attendance.find({ ...query, date: targetDate }).lean();

    const result = employees.map((emp, index) => {
      const att = attendances.find(a => a.employee.toString() === emp._id.toString());
      let inTime = '--:--';
      let outTime = '--:--';
      let totalHrs = '00:00';
      
      if (att && att.logs && att.logs.length > 0) {
        const inLog = att.logs.find(l => l.type === 'IN');
        const outLog = att.logs.slice().reverse().find(l => l.type === 'OUT');
        if (inLog && inLog.time) {
           inTime = new Date(inLog.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        }
        if (outLog && outLog.time) {
           outTime = new Date(outLog.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        }
        if (inTime !== '--:--' && outTime !== '--:--') {
            const inMins = parseInt(inTime.split(':')[0])*60 + parseInt(inTime.split(':')[1]);
            const outMins = parseInt(outTime.split(':')[0])*60 + parseInt(outTime.split(':')[1]);
            const diff = outMins - inMins;
            if(diff > 0) {
                totalHrs = `${Math.floor(diff/60).toString().padStart(2, '0')}:${(diff%60).toString().padStart(2, '0')}`;
            }
        }
      }

      let statusStr = 'Absent';
      if(att) {
         if(att.status === 'present') statusStr = 'Present';
         else if(att.status === 'leave') statusStr = 'Leave';
         else if(att.status === 'half_day') statusStr = 'Half Day';
         else statusStr = 'Present';
      }

      return {
        key: emp._id,
        srNo: index + 1,
        empCode: emp.employeeCode || `E00${index+1}`,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        shift: emp.shiftId ? 'Assigned' : 'General',
        shiftIn: '09:00',
        shiftOut: '18:00',
        actualIn: inTime,
        actualOut: outTime,
        totalHrs: totalHrs,
        otHrs: '-',
        status: statusStr,
        workType: 'Office',
        remarks: '-'
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in Daily:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getMusterRoll = async (req, res) => {
  try {
    const db = req.tenantDB;
    if (!db) return res.status(500).json({ success: false, message: 'DB not found' });
    const Attendance = db.model('Attendance', require('../models/Attendance'));
    const Employee = db.model('Employee', require('../models/Employee'));
    const EmployeeRoster = db.model('EmployeeRoster', require('../models/EmployeeRoster'));
    const tenantId = req.user?.tenantId || req.tenantId || req.headers?.['x-tenant-id']; 
    const query = tenantId ? { tenant: tenantId } : {};
    
    // Allow month and year from query, else default to current
    const targetMonth = req.query.month !== undefined ? parseInt(req.query.month) : new Date().getMonth();
    const targetYear = req.query.year !== undefined ? parseInt(req.query.year) : new Date().getFullYear();
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const employees = await Employee.find({ ...query, status: { $in: ['Active', 'ACTIVE', 'active'] } })
      .populate('departmentId')
      .populate('shiftId')
      .populate('rosterId')
      .lean();
      
    const attendances = await Attendance.find({ 
      ...query, 
      date: { $gte: startDate, $lte: endDate } 
    }).lean();

    const rosters = await EmployeeRoster.find({
      ...query,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    const result = employees.map((emp, index) => {
      const row = {
        key: emp._id,
        srNo: index + 1,
        empCode: emp.employeeCode || `E00${index+1}`,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        designation: emp.designation || 'Employee',
        department: emp.departmentId?.name || emp.department || 'General',
        branch: emp.branchId ? 'Branch' : 'HQ',
        shift: emp.shiftId?.name || 'G1',
        roster: emp.rosterId?.rosterName || 'No Roster',
        totalHrs: '00:00',
        otHrs: '00:00',
        leave: 0, od: 0, wo: 0, holiday: 0, shortHrs: '00:00', remarks: '0'
      };

      const empRosters = rosters.filter(r => r.employeeId.toString() === emp._id.toString());
      const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();

      // Fill up days based on Roster or default to A
      for(let i=1; i<=31; i++) {
        if (i <= maxDays) {
          const dDate = new Date(targetYear, targetMonth, i);
          const rosterForDay = empRosters.find(r => new Date(r.date).getDate() === dDate.getDate());
          
          if (rosterForDay) {
            if (rosterForDay.isWeeklyOff) row[`day${i}`] = 'WO';
            else if (rosterForDay.isHoliday) row[`day${i}`] = 'H';
            else row[`day${i}`] = 'A'; // Scheduled to work but no attendance yet
          } else {
            // Fallback if no roster
            const dayOfWeek = dDate.getDay();
            if (dayOfWeek === 0) row[`day${i}`] = 'WO'; // Default Sunday as WO
            else row[`day${i}`] = 'A';
          }
        } else {
           row[`day${i}`] = '-'; // Past end of month
        }
        row[`in${i}`] = '--:--';
        row[`out${i}`] = '--:--';
      }

      // Populate actual attendance records
      let presentCount = 0;
      const empAttendances = attendances.filter(a => a.employee.toString() === emp._id.toString());
      
      empAttendances.forEach(att => {
        const d = new Date(att.date).getDate();
        if (att.status === 'present') {
           row[`day${d}`] = 'P';
           presentCount++;
           
           if (att.logs && att.logs.length > 0) {
             const firstLog = att.logs.find(l => l.type === 'IN');
             const lastLog = [...att.logs].reverse().find(l => l.type === 'OUT');
             
             if (firstLog && firstLog.timestamp) {
               row[`in${d}`] = new Date(firstLog.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
             }
             if (lastLog && lastLog.timestamp) {
               row[`out${d}`] = new Date(lastLog.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
             }
           }
        } else if (att.status === 'leave') {
           row[`day${d}`] = 'L';
        } else if (att.status === 'weekly_off') {
           row[`day${d}`] = 'WO';
        } else if (att.status === 'holiday') {
           row[`day${d}`] = 'H';
        }
      });

      row.totalHrs = `${presentCount * 9}:00`;
      
      return row;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in Muster:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.saveMusterRoll = async (req, res) => {
  try {
    const db = req.tenantDB;
    if (!db) return res.status(500).json({ success: false, message: 'DB not found' });
    const Attendance = db.model('Attendance', require('../models/Attendance'));
    const tenantId = req.user?.tenantId || req.tenantId || req.headers?.['x-tenant-id']; 
    const query = tenantId ? { tenant: tenantId } : {};
    
    const { updates } = req.body; // Expecting { updates: [{ employeeId: '...', day1: 'P', in1: '09:00', ... }, ...] }
    if (!Array.isArray(updates)) return res.status(400).json({ success: false, message: 'Invalid updates payload' });

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    for (const record of updates) {
      if (!record.key) continue; // key is the employee _id

      for (let i = 1; i <= 31; i++) {
        const dayVal = record[`day${i}`];
        if (!dayVal || dayVal === '-') continue;

        let status = 'absent';
        let leaveType = '';
        let isWFH = false;
        let isOnDuty = false;
        
        const presents = ['P', 'WFH', 'OD', 'BT'];
        const halfDays = ['HD', 'AHD', 'LWPHD', 'ELHD', 'SLHD', 'CLHD'];
        const leaves = ['L', 'LWP', 'CO', 'EL', 'SL', 'CL', 'PL', 'ML', 'MARL', 'STL', 'OH'];
        
        if (presents.includes(dayVal)) {
          status = 'present';
          if (dayVal === 'WFH') isWFH = true;
          if (dayVal === 'OD' || dayVal === 'BT') isOnDuty = true;
        } else if (halfDays.includes(dayVal)) {
          status = 'half_day';
          if (dayVal !== 'HD' && dayVal !== 'AHD') leaveType = dayVal;
        } else if (leaves.includes(dayVal)) {
          status = 'leave';
          leaveType = dayVal;
        } else if (dayVal === 'WO') {
          status = 'weekly_off';
        } else if (dayVal === 'H') {
          status = 'holiday';
        }

        const existingAtt = await Attendance.findOne({
          ...query,
          employee: record.key,
          date: { 
            $gte: new Date(year, month, i, 0, 0, 0), 
            $lte: new Date(year, month, i, 23, 59, 59) 
          }
        });

        const inTimeStr = record[`in${i}`] || '09:00';
        const outTimeStr = record[`out${i}`] || '18:00';
        const logs = [];

        if (status === 'present' || status === 'half_day') {
           const [inH, inM] = inTimeStr !== '--:--' ? inTimeStr.split(':') : ['09', '00'];
           const [outH, outM] = outTimeStr !== '--:--' ? outTimeStr.split(':') : (status === 'half_day' ? ['13', '30'] : ['18', '00']);
           
           logs.push({
             type: 'IN',
             timestamp: new Date(year, month, i, parseInt(inH), parseInt(inM), 0),
             location: { coordinates: [0,0] }
           });
           logs.push({
             type: 'OUT',
             timestamp: new Date(year, month, i, parseInt(outH), parseInt(outM), 0),
             location: { coordinates: [0,0] }
           });
        }

        if (existingAtt) {
          existingAtt.status = status;
          if (status === 'present' || status === 'half_day') {
             existingAtt.logs = logs;
          } else {
             existingAtt.logs = [];
          }
          existingAtt.leaveType = leaveType;
          existingAtt.isWFH = isWFH;
          existingAtt.isOnDuty = isOnDuty;
          await existingAtt.save();
        } else {
          // If absent and we are saving 'A', we might just skip inserting to save space
          // But to be explicit:
          if (status !== 'absent') {
            await Attendance.create({
              tenant: tenantId,
              employee: record.key,
              date: new Date(year, month, i, 12, 0, 0), // Use noon explicitly
              status: status,
              leaveType: leaveType,
              isWFH: isWFH,
              isOnDuty: isOnDuty,
              logs: (status === 'present' || status === 'half_day') ? logs : []
            });
          }
        }
      }
    }
    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (error) {
    console.error('Error saving muster roll:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
