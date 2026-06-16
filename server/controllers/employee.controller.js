const mongoose = require('mongoose');
const XLSX = require('@sheetjs/xlsx');
const { sanitizeEmployee, sanitizeData } = require('../utils/apiSanitizer');
const employeeHierarchyService = require('../services/employeeHierarchy.service');

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
  const hrEmployeeController = require('./hr.employee.controller');
  return hrEmployeeController.bulkUploadEmployees(req, res);
};;
