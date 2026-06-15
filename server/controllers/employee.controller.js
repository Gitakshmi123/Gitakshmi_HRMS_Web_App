const mongoose = require('mongoose');
const XLSX = require('@sheetjs/xlsx');
const { sanitizeEmployee, sanitizeData } = require('../utils/apiSanitizer');

/* ----------------------------------------------------
   HELPER → Get models from tenant database
   Models are already registered by dbManager, just retrieve them
---------------------------------------------------- */
function getModels(req) {
  if (!req.tenantDB) {
    throw new Error("Tenant database connection not available");
  }
  const db = req.tenantDB;
  try {
    if (!db.models.Grade) {
      try { db.model('Grade', require('../models/Grade')); } catch (e) { }
    }
    // Models are already registered by dbManager, just retrieve them
    // Do NOT pass schema - use connection.model(name) only
    return {
      Employee: db.model("Employee"),
      Attendance: db.model("Attendance"),
      LeaveRequest: db.model("LeaveRequest"),
      Department: db.model("Department"),
      LeavePolicy: db.model("LeavePolicy"),
      Grade: db.model("Grade"),
      AuditLog: db.model("AuditLog"),
      Comment: db.model("Comment"),
      Requirement: db.model("Requirement"),
      Applicant: db.model("Applicant")
    };
  } catch (err) {
    console.error("[employee.controller] Error retrieving models:", err.message);
    throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
  }
}

/* ----------------------------------------------------
   GET PROFILE (Self)
---------------------------------------------------- */
exports.getProfile = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user ? req.user.id : null;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch from single source of truth (Employee Master)
    // Support both 'mainCompanyId' and legacy 'tenant' field names
    let emp = await Employee.findOne({ 
      _id: userId, 
      $or: [
        { mainCompanyId: tenantId },
        { mainCompanyId: tenantId }
      ] 
    })
      .populate('subCompanyId', 'companyName')
      .populate('branchId', 'name')
      .populate('divisionId', 'name')
      .populate('departmentId', 'name')
      .populate('designationId', 'name')
      .populate('manager', 'firstName lastName email profilePic employeeId')
      .populate('gradeId', 'name code level benefits attendanceRules leaveRules isActive')
      .populate('leavePolicy', 'name rules')
      .populate('shiftId', 'name startTime endTime shiftCode shiftType isNightShift overtimeCfg attendanceRules breakMinutes')
      .select('-password');

    // SSO Fallback: If not found by ID, try by Email
    if (!emp && req.user?.email) {
      emp = await Employee.findOne({ 
        email: { $regex: new RegExp(`^${req.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
        $or: [
          { mainCompanyId: tenantId },
          { mainCompanyId: tenantId }
        ]
      })
        .populate('subCompanyId', 'companyName')
        .populate('branchId', 'name')
        .populate('divisionId', 'name')
        .populate('departmentId', 'name')
        .populate('designationId', 'name')
        .populate('manager', 'firstName lastName email profilePic employeeId')
        .populate('gradeId', 'name code level benefits attendanceRules leaveRules isActive')
        .populate('leavePolicy', 'name rules')
        .populate('shiftId', 'name startTime endTime shiftCode shiftType isNightShift overtimeCfg attendanceRules breakMinutes')
        .select('-password');
    }

    if (!emp) {
      // Return a basic profile from user data instead of 404
      return res.json({
        success: true,
        data: {
          _id: userId,
          firstName: req.user?.firstName || (req.user?.name || req.user?.fullName || '').split(' ')[0] || 'Employee',
          lastName: req.user?.lastName || (req.user?.name || req.user?.fullName || '').split(' ').slice(1).join(' ') || '',
          email: req.user?.email || '',
          role: req.user?.role || 'employee',
          // Note: tenantId is not exposed to the client
        },
        message: 'Profile partially loaded - full employee record not found. Please contact HR.'
      });
    }

    // MANDATORY POLICY ENFORCEMENT
    const { ensureLeavePolicy } = require('../config/dbManager');
    emp = await ensureLeavePolicy(emp, req.tenantDB, req.tenantId);
    // Security: strip password and sensitive fields before responding
    res.json({ success: true, data: sanitizeEmployee(emp) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// Allow employee to request auto-assignment of default policy (self-heal)
exports.ensureMyPolicy = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    let emp = await Employee.findOne({ _id: req.user.id, mainCompanyId: req.tenantId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const { ensureLeavePolicy } = require('../config/dbManager');
    emp = await ensureLeavePolicy(emp, req.tenantDB, req.tenantId);

    // Return fresh profile and structured response
    const updated = await Employee.findById(emp._id)
      .populate('leavePolicy', 'name rules description status')
      .populate('gradeId', 'name code level benefits attendanceRules leaveRules isActive');
    // // console.log('[ENSURE_MY_POLICY] Result for employee', emp._id.toString(), 'leavePolicy:', updated.leavePolicy ? updated.leavePolicy._id.toString() : 'NONE');

    // Also fetch current year balances so UI can rely on this response directly
    try {
      const LeaveBalance = req.tenantDB.model('LeaveBalance');
      const AttendanceSettings = req.tenantDB.model('AttendanceSettings');
      const settings = await AttendanceSettings.findOne({ mainCompanyId: req.tenantId }).catch(() => null);
      const startMonth = settings?.leaveCycleStartMonth || 0;
      const now = new Date();
      let year = now.getFullYear();
      if (now.getMonth() < startMonth) year--;

      const balances = await LeaveBalance.find({ mainCompanyId: req.tenantId, employee: updated._id, year });
      return res.json({ success: true, assigned: Boolean(updated.leavePolicy), leavePolicy: updated.leavePolicy, profile: updated, balances, hasLeavePolicy: Boolean(updated.leavePolicy) });
    } catch (e) {
      console.error('[ENSURE_MY_POLICY] Failed to fetch balances:', e);
      return res.json({ success: true, assigned: Boolean(updated.leavePolicy), leavePolicy: updated.leavePolicy, profile: updated });
    }
  } catch (err) {
    console.error('[ENSURE_MY_POLICY] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to ensure policy' });
  }
};

/* ----------------------------------------------------
   TOGGLE ATTENDANCE (Check-in / Check-out)
---------------------------------------------------- */
exports.toggleAttendance = async (req, res) => {
  try {
    const { Attendance } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user.id; // Employee ID

    // Normalize today to start of day or use direct date comparison
    // Simple approach: find attendance for current date (ignoring time)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    let attendance = await Attendance.findOne({
      employee: userId,
      mainCompanyId: tenantId,
      date: { $gte: startOfDay, $lt: endOfDay }
    });

    let action = '';

    if (!attendance) {
      // Clock In
      attendance = new Attendance({
        mainCompanyId: tenantId,
        employee: userId,
        date: now,
        status: 'present',
        checkIn: now
      });
      await attendance.save();
      action = 'Checked In';
    } else if (!attendance.checkOut) {
      // Clock Out
      attendance.checkOut = now;
      await attendance.save();
      action = 'Checked Out';
    } else {
      // Already checked out
      return res.status(400).json({ error: "Already checked out for today" });
    }

    res.json({ success: true, message: action, data: attendance });

  } catch (err) {
    console.error("Toggle attendance error:", err);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
};

/* ----------------------------------------------------
   GET ATTENDANCE HISTORY
---------------------------------------------------- */
exports.getAttendance = async (req, res) => {
  try {
    const { Attendance } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user.id;

    // Optional: filter by month/year via query params
    // For now, return recent 30 days
    const attendance = await Attendance.find({
      mainCompanyId: tenantId,
      employee: userId
    }).sort({ date: -1 }).limit(30);

    res.json({ success: true, data: sanitizeData(attendance) });

  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
};

/* ----------------------------------------------------
   APPLY LEAVE
---------------------------------------------------- */
exports.applyLeave = async (req, res) => {
  try {
    const { LeaveRequest } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user.id;

    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const leave = new LeaveRequest({
      mainCompanyId: tenantId,
      employee: userId,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'Pending'
    });

    await leave.save();
    res.status(201).json({ success: true, message: "Leave requested", data: leave });

  } catch (err) {
    console.error("Apply leave error:", err);
    res.status(500).json({ error: "Failed to apply for leave" });
  }
};

/* ----------------------------------------------------
   GET LEAVES
---------------------------------------------------- */
exports.getLeaves = async (req, res) => {
  try {
    const { LeaveRequest } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user.id;

    const leaves = await LeaveRequest.find({
      mainCompanyId: tenantId,
      employee: userId
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: sanitizeData(leaves) });

  } catch (err) {
    console.error("Get leaves error:", err);
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
};

/* ----------------------------------------------------
   GET PAYSLIPS (Mock)
---------------------------------------------------- */
exports.getPayslips = async (req, res) => {
  try {
    // Return empty array or mock data
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch payslips" });
  }
};
/* ----------------------------------------------------
   GET REPORTING TREE (2-level upward)
---------------------------------------------------- */
exports.getReportingTree = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const userId = req.user.id;

    const self = await Employee.findById(userId)
      .populate({
        path: 'manager',
        select: 'firstName lastName role profilePic employeeId manager departmentId',
        populate: {
          path: 'manager',
          select: 'firstName lastName role profilePic employeeId'
        }
      });

    if (!self) {
      const role = (req.user?.role || '').toLowerCase();
      if (['hr', 'admin', 'company_admin', 'company_super_admin', 'psa'].includes(role)) {
        return res.json({
          level0: { name: req.user.name || "System Admin", designation: "Administrator" },
          level1: null,
          level2: null
        });
      }
      return res.status(404).json({ error: "Employee not found" });
    }

    const tree = {
      level0: {
        id: self._id,
        name: `${self.firstName} ${self.lastName}`,
        designation: self.role || 'Employee',
        profilePic: self.profilePic,
        isSelf: true
      },
      level1: self.manager ? {
        id: self.manager._id,
        name: `${self.manager.firstName} ${self.manager.lastName}`,
        designation: self.manager.role || 'Manager',
        profilePic: self.manager.profilePic
      } : null,
      level2: (self.manager && self.manager.manager) ? {
        id: self.manager.manager._id,
        name: `${self.manager.manager.firstName} ${self.manager.manager.lastName}`,
        designation: self.manager.manager.role || 'Group Manager',
        profilePic: self.manager.manager.profilePic
      } : null
    };

    res.json(tree);
  } catch (err) {
    console.error("Get reporting tree error:", err);
    res.status(500).json({ error: "Failed to fetch reporting tree" });
  }
};

/* ----------------------------------------------------
   GET BIRTHDAYS TODAY
---------------------------------------------------- */
exports.getBirthdaysToday = async (req, res) => {
  try {
    const { Employee } = getModels(req);
    const tenantId = req.tenantId;
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    const birthdays = await Employee.find({
      mainCompanyId: tenantId,
      status: { $in: ['ACTIVE', 'Active', 'active'] },
      $expr: {
        $and: [
          { $eq: [{ $dayOfMonth: "$dob" }, day] },
          { $eq: [{ $month: "$dob" }, month] }
        ]
      }
    }).select('firstName lastName dob profilePic departmentId employeeId').populate('departmentId', 'name');

    res.json({ success: true, data: birthdays });
  } catch (err) {
    console.error("Get birthdays today error:", err);
    res.status(500).json({ error: "Failed to fetch birthdays" });
  }
};

/* ----------------------------------------------------
   GET BIRTHDAY WISHES
---------------------------------------------------- */
exports.getBirthdayWishes = async (req, res) => {
  try {
    const { Comment } = getModels(req);
    const { id } = req.params; // Target Employee ID
    const tenantId = req.tenantId;

    const wishes = await Comment.find({
      mainCompanyId: tenantId,
      entityType: 'Birthday',
      entityId: id
    })
    .sort({ createdAt: 1 })
    .limit(100);

    res.json({ success: true, data: wishes });
  } catch (err) {
    console.error("Get birthday wishes error:", err);
    res.status(500).json({ error: "Failed to fetch wishes" });
  }
};

/* ----------------------------------------------------
   ADD BIRTHDAY WISH
---------------------------------------------------- */
exports.addBirthdayWish = async (req, res) => {
  try {
    const { Comment, Employee } = getModels(req);
    const { id } = req.params; // Target Employee ID
    const { message } = req.body;
    const tenantId = req.tenantId;
    const senderId = req.employee._id; // Current user's employee ID

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: "Message is required" });
    }

    // Fetch sender info for denormalization
    const sender = await Employee.findById(senderId).select('firstName lastName profilePic role');

    const newWish = new Comment({
      mainCompanyId: tenantId,
      entityType: 'Birthday',
      entityId: id,
      message,
      commentedBy: senderId,
      commentedByModel: 'Employee',
      commentedByRole: sender.role || 'employee',
      commenterName: `${sender.firstName} ${sender.lastName}`,
      commenterPhoto: sender.profilePic,
      createdAt: new Date()
    });

    await newWish.save();

    res.json({ success: true, data: newWish });
  } catch (err) {
    console.error("Add birthday wish error:", err);
    res.status(500).json({ error: "Failed to save wish" });
  }
};
/* ========================================
   BULK EMPLOYEE UPLOAD - Template Download
======================================== */
exports.downloadEmployeeTemplate = async (req, res) => {
  try {
    const { Department, LeavePolicy } = getModels(req);
    const tenantId = req.tenantId;

    // Fetch departments and leave policies for reference
    const departments = await Department.find({ mainCompanyId: tenantId }).select('_id name').lean();
    const leavePolicies = await LeavePolicy.find({ mainCompanyId: tenantId }).select('_id name').lean();

    // Create template workbook
    const workbook = XLSX.utils.book_new();

    // Main sheet with sample data
    const templateData = [
      {
        'Employee ID': 'EMP001',
        'First Name': 'John',
        'Middle Name': '',
        'Last Name': 'Doe',
        'Email': 'john.doe@example.com',
        'Contact No': '+91-9876543210',
        'Gender': 'Male',
        'Date of Birth': '1990-01-15',
        'Joining Date': '2023-01-01',
        'Department': departments.length > 0 ? departments[0].name : 'Tech',
        'Role': 'Developer',
        'Job Type': 'Full-Time',
        'Marital Status': 'Single',
        'Nationality': 'Indian',
        'Blood Group': 'O+',
        'Father Name': 'Robert Doe',
        'Mother Name': 'Jane Doe',
        'Emergency Contact Name': 'Mary Doe',
        'Emergency Contact Number': '+91-9876543211',
        'Bank Name': 'HDFC Bank',
        'Account Number': '1234567890',
        'IFSC Code': 'HDFC0001234',
        'Leave Policy': leavePolicies.length > 0 ? leavePolicies[0].name : 'Standard Policy',
        'Temp Address Line 1': '123 Street Name',
        'Temp Address Line 2': 'Apartment/Suite',
        'Temp City': 'Ahmedabad',
        'Temp State': 'Gujarat',
        'Temp Pin Code': '380001',
        'Temp Country': 'India',
        'Perm Address Line 1': '456 Home Street',
        'Perm Address Line 2': 'House Number',
        'Perm City': 'Surat',
        'Perm State': 'Gujarat',
        'Perm Pin Code': '395001',
        'Perm Country': 'India'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData, { header: 1 });

    // Set column widths for better readability
    const colWidths = [
      { wch: 12 }, // Employee ID
      { wch: 12 }, // First Name
      { wch: 12 }, // Middle Name
      { wch: 12 }, // Last Name
      { wch: 20 }, // Email
      { wch: 15 }, // Contact No
      { wch: 10 }, // Gender
      { wch: 15 }, // Date of Birth
      { wch: 15 }, // Joining Date
      { wch: 12 }, // Department
      { wch: 12 }, // Role
      { wch: 12 }, // Job Type
      { wch: 15 }, // Marital Status
      { wch: 12 }, // Nationality
      { wch: 12 }, // Blood Group
      { wch: 15 }, // Father Name
      { wch: 15 }, // Mother Name
      { wch: 20 }, // Emergency Contact Name
      { wch: 20 }, // Emergency Contact Number
      { wch: 15 }, // Bank Name
      { wch: 18 }, // Account Number
      { wch: 12 }, // IFSC Code
      { wch: 15 }, // Leave Policy
      { wch: 20 }, // Temp Address Line 1
      { wch: 20 }, // Temp Address Line 2
      { wch: 12 }, // Temp City
      { wch: 12 }, // Temp State
      { wch: 12 }, // Temp Pin Code
      { wch: 12 }, // Temp Country
      { wch: 20 }, // Perm Address Line 1
      { wch: 20 }, // Perm Address Line 2
      { wch: 12 }, // Perm City
      { wch: 12 }, // Perm State
      { wch: 12 }, // Perm Pin Code
      { wch: 12 }  // Perm Country
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Template');

    // Reference sheet for departments
    if (departments.length > 0) {
      const deptData = departments.map((d, idx) => ({ 'ID': idx + 1, 'Department Name': d.name }));
      const deptSheet = XLSX.utils.json_to_sheet(deptData);
      deptSheet['!cols'] = [{ wch: 5 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, deptSheet, 'Departments');
    }

    // Reference sheet for leave policies
    if (leavePolicies.length > 0) {
      const policyData = leavePolicies.map((p, idx) => ({ 'ID': idx + 1, 'Leave Policy': p.name }));
      const policySheet = XLSX.utils.json_to_sheet(policyData);
      policySheet['!cols'] = [{ wch: 5 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, policySheet, 'Leave Policies');
    }

    // Instructions sheet
    const instructions = [
      ['Employee Bulk Upload - Instructions'],
      [''],
      ['REQUIRED FIELDS:'],
      ['✓ Employee ID - Unique identifier for each employee'],
      ['✓ First Name - Employee first name'],
      ['✓ Last Name - Employee last name'],
      ['✓ Email - Valid email address'],
      ['✓ Joining Date - Format: YYYY-MM-DD'],
      [''],
      ['OPTIONAL FIELDS:'],
      ['• Middle Name'],
      ['• Contact No - Phone number with country code'],
      ['• Gender - Male, Female, Other'],
      ['• Date of Birth - Format: YYYY-MM-DD'],
      ['• Department - Use names from Departments sheet'],
      ['• Role - Job title/designation'],
      ['• Job Type - Full-Time, Part-Time, Internship'],
      ['• Leave Policy - Use names from Leave Policies sheet'],
      ['• Address fields (Temp/Perm)'],
      ['• Bank details'],
      ['• Emergency contact information'],
      [''],
      ['DATE FORMAT:'],
      ['All dates must be in YYYY-MM-DD format (e.g., 2023-12-25)'],
      [''],
      ['LIMITATIONS:'],
      ['• Maximum 1000 records per upload'],
      ['• Duplicate Employee IDs will be skipped'],
      ['• Invalid emails will be rejected'],
      [''],
      ['NOTES:'],
      ['• Status will be set to "Active" by default'],
      ['• You can assign managers and salary after bulk upload'],
      ['• All records are subject to validation'],
      ['• Check the error report for any failed rows'],
    ];

    const instructSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructSheet['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, instructSheet, 'Instructions');

    // Generate file
    const fileName = `Employee_Template_${new Date().getTime()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);

  } catch (err) {
    console.error("Template download error:", err);
    res.status(500).json({ error: "Failed to generate template", details: err.message });
  }
};

/* ========================================
   BULK EMPLOYEE UPLOAD - Main Upload Handler
======================================== */

exports.downloadBulkUploadTemp = async (req, res) => {
  try {
    const XLSX = require('@sheetjs/xlsx');

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Sample data with all possible columns
    const sampleData = [
      {
        'Employee ID': 'EMP001',
        'First Name': 'John',
        'Middle Name': 'M',
        'Last Name': 'Doe',
        'Email': 'john.doe@company.com',
        'Contact No': '9876543210',
        'Gender': 'Male',
        'Date of Birth': '1990-01-15',
        'Marital Status': 'Single',
        'Blood Group': 'O+',
        'Nationality': 'Indian',
        'Father Name': 'James Doe',
        'Mother Name': 'Jane Doe',
        'Emergency Contact Name': 'Jane Doe',
        'Emergency Contact Number': '9876543211',
        'Temp Address Line 1': '123 Main St',
        'Temp Address Line 2': 'Apt 4B',
        'Temp City': 'New York',
        'Temp State': 'NY',
        'Temp Pin Code': '10001',
        'Temp Country': 'USA',
        'Perm Address Line 1': '456 Oak Ave',
        'Perm Address Line 2': 'House 5',
        'Perm City': 'Boston',
        'Perm State': 'MA',
        'Perm Pin Code': '02101',
        'Perm Country': 'USA',
        'Joining Date': '2024-01-01',
        'Department': 'Tech',
        'Role': 'Developer',
        'Job Type': 'Full-Time',
        'Bank Name': 'State Bank',
        'Account Number': '123456789',
        'IFSC Code': 'SBIN0001234',
        'Branch Name': 'Main Branch',
        'Bank Location': 'New York'
      }
    ];

    // Add headers with description
    const headers = [
      'Employee ID (Required)',
      'First Name (Required)',
      'Middle Name',
      'Last Name (Required)',
      'Email (Required)',
      'Contact No',
      'Gender (M/F/Other)',
      'Date of Birth (YYYY-MM-DD)',
      'Marital Status',
      'Blood Group',
      'Nationality',
      'Father Name',
      'Mother Name',
      'Emergency Contact Name',
      'Emergency Contact Number',
      'Temp Address Line 1',
      'Temp Address Line 2',
      'Temp City',
      'Temp State',
      'Temp Pin Code',
      'Temp Country',
      'Perm Address Line 1',
      'Perm Address Line 2',
      'Perm City',
      'Perm State',
      'Perm Pin Code',
      'Perm Country',
      'Joining Date (YYYY-MM-DD, Required)',
      'Department',
      'Role',
      'Job Type',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Branch Name',
      'Bank Location'
    ];

    // Create worksheet with sample data
    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: 1 });

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 }
    ];

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Template');

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Send file as response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Employee_Bulk_Upload_Template_${Date.now()}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({
      success: false,
      error: 'template_generation_failed',
      message: err.message || 'Failed to generate template'
    });
  }
};
exports.bulkUploadEmployees = async (req, res) => {
  let session = null;

  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: "Records must be an array",
        uploadedCount: 0,
        failedCount: 0,
        errors: ["Invalid request format - records must be an array"]
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No records provided",
        uploadedCount: 0,
        failedCount: 0,
        errors: ["No employee records to upload"]
      });
    }

    if (records.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Maximum 1000 records allowed per upload",
        uploadedCount: 0,
        failedCount: records.length,
        errors: ["Exceeded maximum record limit of 1000 records"]
      });
    }

    const { Employee, Department, LeavePolicy, AuditLog } = getModels(req);
    const tenantId = req.tenantId;
    const userId = req.user.id;

    const results = {
      uploadedCount: 0,
      failedCount: 0,
      errors: [],
      warnings: [],
      processedIds: []
    };

    // Helper: Normalize column names
    const normalize = (s) => s ? s.toString().toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '') : '';

    // Helper: Validate email
    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    // Helper: Validate date
    const validateDate = (dateVal) => {
      if (!dateVal) return null;
      let dateObj;

      if (dateVal instanceof Date) {
        dateObj = dateVal;
      } else {
        const dateStr = dateVal.toString().trim();
        // Try parsing YYYY-MM-DD format
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          dateObj = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
        } else {
          dateObj = new Date(dateStr);
        }
      }

      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date format: ${dateVal}`);
      }
      return dateObj;
    };

    // Cache for lookups
    const deptCache = {};
    const policyCache = {};
    const processedEmails = new Set();
    const processedEmpIds = new Set();

    // Pre-cache departments
    const allDepts = await Department.find({ mainCompanyId: tenantId }).select('_id name').lean();
    allDepts.forEach(d => {
      deptCache[d.name.toLowerCase().trim()] = d._id;
    });

    // Pre-cache leave policies
    const allPolicies = await LeavePolicy.find({ mainCompanyId: tenantId }).select('_id name').lean();
    allPolicies.forEach(p => {
      policyCache[p.name.toLowerCase().trim()] = p._id;
    });

    // Get default leave policy if needed
    const defaultPolicy = allPolicies.length > 0 ? allPolicies[0]._id : null;

    // Pre-fetch existing employees for bulk checking
    const existingEmps = await Employee.find({ mainCompanyId: tenantId }).select('employeeId email').lean();
    const existingEmpIds = new Set(existingEmps.map(e => e.employeeId.toLowerCase()));
    const existingEmails = new Set(existingEmps.map(e => e.email.toLowerCase()));

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowIdx = i + 2; // 1-indexed + header row

      try {
        // Extract fields with flexible column name detection
        let empId = '';
        let firstName = '';
        let middleName = '';
        let lastName = '';
        let email = '';
        let contactNo = '';
        let gender = '';
        let dob = null;
        let joiningDate = null;
        let departmentName = '';
        let role = '';
        let jobType = '';
        let maritalStatus = '';
        let nationality = '';
        let bloodGroup = '';
        let fatherName = '';
        let motherName = '';
        let emergencyContactName = '';
        let emergencyContactNumber = '';
        let bankName = '';
        let accountNumber = '';
        let ifscCode = '';
        let policyName = '';
        let tempAddr = {};
        let permAddr = {};

        // Parse row data
        for (const key of Object.keys(row)) {
          const normKey = normalize(key);
          const val = row[key];

          if (normKey.includes('employeeid') || normKey.includes('empid')) {
            empId = val ? val.toString().trim() : '';
          } else if (normKey === 'firstname' || normKey === 'first') {
            firstName = val ? val.toString().trim() : '';
          } else if (normKey === 'middlename' || normKey === 'middle') {
            middleName = val ? val.toString().trim() : '';
          } else if (normKey === 'lastname' || normKey === 'last') {
            lastName = val ? val.toString().trim() : '';
          } else if (normKey === 'email' || normKey.includes('emailaddress')) {
            email = val ? val.toString().trim().toLowerCase() : '';
          } else if (normKey === 'contactno' || normKey.includes('phone') || normKey.includes('mobile')) {
            contactNo = val ? val.toString().trim() : '';
          } else if (normKey === 'gender') {
            gender = val ? val.toString().trim() : '';
          } else if (normKey === 'dob' || normKey === 'dateofbirth') {
            dob = val;
          } else if (normKey === 'joiningdate' || normKey === 'doj') {
            joiningDate = val;
          } else if (normKey === 'department') {
            departmentName = val ? val.toString().trim() : '';
          } else if (normKey === 'role' || normKey === 'designation') {
            role = val ? val.toString().trim() : '';
          } else if (normKey === 'jobtype') {
            jobType = val ? val.toString().trim() : '';
          } else if (normKey === 'maritalstatus') {
            maritalStatus = val ? val.toString().trim() : '';
          } else if (normKey === 'nationality') {
            nationality = val ? val.toString().trim() : '';
          } else if (normKey === 'bloodgroup') {
            bloodGroup = val ? val.toString().trim() : '';
          } else if (normKey === 'fathername') {
            fatherName = val ? val.toString().trim() : '';
          } else if (normKey === 'mothername') {
            motherName = val ? val.toString().trim() : '';
          } else if (normKey === 'emergencycontactname') {
            emergencyContactName = val ? val.toString().trim() : '';
          } else if (normKey === 'emergencycontactnumber') {
            emergencyContactNumber = val ? val.toString().trim() : '';
          } else if (normKey === 'bankname') {
            bankName = val ? val.toString().trim() : '';
          } else if (normKey === 'accountnumber') {
            accountNumber = val ? val.toString().trim() : '';
          } else if (normKey === 'ifscode' || normKey === 'ifsc') {
            ifscCode = val ? val.toString().trim() : '';
          } else if (normKey === 'leavepolicy') {
            policyName = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempaddressline1')) {
            tempAddr.line1 = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempaddressline2')) {
            tempAddr.line2 = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempcity')) {
            tempAddr.city = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempstate')) {
            tempAddr.state = val ? val.toString().trim() : '';
          } else if (normKey.includes('temppincode')) {
            tempAddr.pinCode = val ? val.toString().trim() : '';
          } else if (normKey.includes('tempcountry')) {
            tempAddr.country = val ? val.toString().trim() : '';
          } else if (normKey.includes('permaddressline1')) {
            permAddr.line1 = val ? val.toString().trim() : '';
          } else if (normKey.includes('permaddressline2')) {
            permAddr.line2 = val ? val.toString().trim() : '';
          } else if (normKey.includes('permcity')) {
            permAddr.city = val ? val.toString().trim() : '';
          } else if (normKey.includes('permstate')) {
            permAddr.state = val ? val.toString().trim() : '';
          } else if (normKey.includes('permpincode')) {
            permAddr.pinCode = val ? val.toString().trim() : '';
          } else if (normKey.includes('permcountry')) {
            permAddr.country = val ? val.toString().trim() : '';
          }
        }

        // ====== VALIDATION ======
        // Required fields validation
        if (!empId) throw new Error('Employee ID is required');
        if (!firstName) throw new Error('First Name is required');
        if (!lastName) throw new Error('Last Name is required');
        if (!email) throw new Error('Email is required');
        if (!joiningDate) throw new Error('Joining Date is required');

        // Employee ID validation
        const empIdLower = empId.toLowerCase();
        if (!/^[a-zA-Z0-9\-_]{1,50}$/.test(empId)) {
          throw new Error(`Invalid Employee ID format: ${empId}`);
        }

        // Check for duplicate Employee ID (within current batch or existing)
        if (processedEmpIds.has(empIdLower)) {
          throw new Error(`Duplicate Employee ID in current batch: ${empId}`);
        }
        if (existingEmpIds.has(empIdLower)) {
          throw new Error(`Employee ID "${empId}" already exists in system`);
        }

        // Email validation
        if (!validateEmail(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }

        // Check for duplicate Email (within current batch or existing)
        const emailLower = email.toLowerCase();
        if (processedEmails.has(emailLower)) {
          throw new Error(`Duplicate email in current batch: ${email}`);
        }
        if (existingEmails.has(emailLower)) {
          throw new Error(`Email "${email}" already exists in system`);
        }

        // First/Last Name length validation
        if (firstName.length < 2) throw new Error('First Name must be at least 2 characters');
        if (lastName.length < 2) throw new Error('Last Name must be at least 2 characters');

        // Parse and validate dates
        let dobDate = null;
        let joiningDateObj = null;

        if (dob) {
          try {
            dobDate = validateDate(dob);
            const age = (new Date() - dobDate) / (365.25 * 24 * 60 * 60 * 1000);
            if (age < 18) {
              results.warnings.push(`Row ${rowIdx}: Employee appears to be under 18 years old`);
            }
            if (dobDate > new Date()) {
              throw new Error('Date of Birth cannot be in the future');
            }
          } catch (err) {
            results.warnings.push(`Row ${rowIdx}: ${err.message} - will skip DOB`);
            dobDate = null;
          }
        }

        try {
          joiningDateObj = validateDate(joiningDate);
          if (joiningDateObj > new Date()) {
            results.warnings.push(`Row ${rowIdx}: Joining Date is in the future`);
          }
        } catch (err) {
          throw new Error(`Invalid Joining Date: ${err.message}`);
        }

        // Validate Gender
        let validGender = null;
        if (gender) {
          const normalizedGender = gender.toLowerCase();
          if (['male', 'm'].includes(normalizedGender)) {
            validGender = 'Male';
          } else if (['female', 'f'].includes(normalizedGender)) {
            validGender = 'Female';
          } else if (['other', 'o'].includes(normalizedGender)) {
            validGender = 'Other';
          } else {
            results.warnings.push(`Row ${rowIdx}: Invalid gender value "${gender}" - will skip`);
          }
        }

        // Validate Job Type
        let validJobType = null;
        if (jobType) {
          const normalizedJobType = jobType.toLowerCase().replace(/\s/g, '');
          if (['fulltime', 'ft'].includes(normalizedJobType)) {
            validJobType = 'Full-Time';
          } else if (['parttime', 'pt'].includes(normalizedJobType)) {
            validJobType = 'Part-Time';
          } else if (['internship'].includes(normalizedJobType)) {
            validJobType = 'Internship';
          } else {
            results.warnings.push(`Row ${rowIdx}: Invalid job type "${jobType}" - will use Full-Time`);
            validJobType = 'Full-Time';
          }
        } else {
          validJobType = 'Full-Time';
        }

        // Validate Contact Number (if provided)
        if (contactNo && !/^[+]?[\d\s\-()]{7,}$/.test(contactNo)) {
          results.warnings.push(`Row ${rowIdx}: Contact number format may be invalid - will include as-is`);
        }

        // Resolve Department
        let departmentId = null;
        if (departmentName) {
          const deptLower = departmentName.toLowerCase().trim();
          departmentId = deptCache[deptLower];
          if (!departmentId) {
            results.warnings.push(`Row ${rowIdx}: Department "${departmentName}" not found - will be left blank`);
          }
        }

        // Resolve Leave Policy
        let policyId = null;
        if (policyName) {
          const policyLower = policyName.toLowerCase().trim();
          policyId = policyCache[policyLower];
          if (!policyId) {
            results.warnings.push(`Row ${rowIdx}: Leave Policy "${policyName}" not found - will use default`);
            if (defaultPolicy) policyId = defaultPolicy;
          }
        } else if (defaultPolicy) {
          policyId = defaultPolicy;
        }

        // Create Employee Document
        const newEmployee = new Employee({
          mainCompanyId: tenantId,
          subCompanyId: req.user.subCompanyId || row.subCompanyId || null,
          branchId: req.user.branchId || row.branchId || null,
          divisionId: req.user.divisionId || row.divisionId || null,
          departmentId: departmentId || req.user.departmentId || null,
          designationId: row.designationId || req.user.designationId || null,
          employeeId: empId,
          firstName,
          middleName: middleName || undefined,
          lastName,
          email,
          contactNo: contactNo || undefined,
          gender: validGender || undefined,
          dob: dobDate,
          joiningDate: joiningDateObj,
          department: departmentName || undefined,
          role: role || undefined,
          jobType: validJobType,
          maritalStatus: maritalStatus || undefined,
          nationality: nationality || undefined,
          bloodGroup: bloodGroup || undefined,
          fatherName: fatherName || undefined,
          motherName: motherName || undefined,
          emergencyContactName: emergencyContactName || undefined,
          emergencyContactNumber: emergencyContactNumber || undefined,
          leavePolicy: policyId,
          bankDetails: (bankName || accountNumber || ifscCode) ? {
            bankName: bankName || undefined,
            accountNumber: accountNumber || undefined,
            ifsc: ifscCode || undefined
          } : undefined,
          tempAddress: Object.keys(tempAddr).length > 0 ? tempAddr : undefined,
          permAddress: Object.keys(permAddr).length > 0 ? permAddr : undefined,
          status: 'Active',
          lastStep: 6 // Mark as completed
        });

        await newEmployee.save();
        results.uploadedCount++;
        results.processedIds.push(empId);
        processedEmpIds.add(empIdLower);
        processedEmails.add(emailLower);

      } catch (error) {
        results.failedCount++;
        results.errors.push(`Row ${rowIdx}: ${error.message}`);
      }
    }

    // Log the bulk upload action
    try {
      const AuditLog_Model = AuditLog;
      const auditLog = new AuditLog_Model({
        mainCompanyId: tenantId,
        entity: 'Employee',
        entityId: 'bulk_upload',
        action: 'BULK_UPLOAD_EMPLOYEES',
        performedBy: userId,
        changes: {
          uploadedCount: results.uploadedCount,
          failedCount: results.failedCount,
          totalRecords: records.length
        },
        meta: {
          recordsProcessed: records.length,
          successRate: records.length > 0 ? ((results.uploadedCount / records.length) * 100).toFixed(2) + '%' : '0%',
          processedIds: results.processedIds
        }
      });
      await auditLog.save();
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    res.json({
      success: true,
      uploadedCount: results.uploadedCount,
      failedCount: results.failedCount,
      errors: results.errors,
      warnings: results.warnings,
      message: `Uploaded ${results.uploadedCount} employees successfully${results.failedCount > 0 ? ` (${results.failedCount} failed)` : ''}`
    });

  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: err.message,
      uploadedCount: 0,
      failedCount: 0,
      errors: [err.message || 'An unexpected error occurred']
    });
  }
};
