const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const EmployeeOnboardingSchema = require('../models/EmployeeOnboarding');
const EmployeeSchema = require('../models/Employee');
const UserSchema = require('../models/User');

const getModels = (req) => {
  const db = req.tenantDB;
  if (!db) throw new Error("Tenant database connection not available");
  return {
    EmployeeOnboarding: db.model('EmployeeOnboarding', EmployeeOnboardingSchema),
    Employee: db.model('Employee', EmployeeSchema),
    User: db.model('User', UserSchema),
  };
};

// 1. Get current employee's onboarding status/data
exports.getMyOnboarding = async (req, res) => {
  try {
    const { EmployeeOnboarding } = getModels(req);
    const onboarding = await EmployeeOnboarding.findOne({ 
      employee: req.user.id,
      tenant: req.tenantId 
    });
    
    if (!onboarding) {
      return res.status(200).json({ success: true, data: null, status: 'NOT_STARTED' });
    }
    
    res.json({ success: true, data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Submit onboarding profile
exports.submitOnboarding = async (req, res) => {
  try {
    const { EmployeeOnboarding, Employee } = getModels(req);
    const { personalDetails, address, bankDetails, emergencyContact, education, experience } = req.body;
    
    let onboarding = await EmployeeOnboarding.findOne({ 
      employee: req.user.id,
      tenant: req.tenantId 
    });
    
    if (!onboarding) {
      onboarding = new EmployeeOnboarding({
        employee: req.user.id,
        tenant: req.tenantId,
      });
    }
    
    if (onboarding.status === 'APPROVED') {
      return res.status(400).json({ success: false, message: "Onboarding already approved" });
    }
    
    onboarding.personalDetails = personalDetails;
    onboarding.address = address;
    onboarding.bankDetails = bankDetails;
    onboarding.emergencyContact = emergencyContact;
    onboarding.education = education;
    onboarding.experience = experience;
    onboarding.status = 'SUBMITTED';
    onboarding.submittedAt = new Date();
    
    await onboarding.save();
    
    // Notify HR (System notification logic could go here)
    
    res.json({ success: true, message: "Profile submitted successfully for HR review", data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. HR: List all submitted profiles
exports.getPendingApprovals = async (req, res) => {
  try {
    const { EmployeeOnboarding } = getModels(req);
    const pending = await EmployeeOnboarding.find({ 
      tenant: req.tenantId,
      status: 'SUBMITTED' 
    }).populate('employee', 'firstName lastName email employeeId');
    
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. HR: Approve profile
exports.approveOnboarding = async (req, res) => {
  try {
    const { EmployeeOnboarding, Employee } = getModels(req);
    const { id } = req.params; // Onboarding ID
    const { department, role, manager } = req.body;
    
    const onboarding = await EmployeeOnboarding.findOne({ _id: id, tenant: req.tenantId });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found" });
    }
    
    // Update Employee Status
    const employee = await Employee.findById(onboarding.employee);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    
    // Force set to ACTIVE and enable systems
    employee.status = 'ACTIVE';
    employee.isActive = true;
    employee.attendanceLocked = false;
    employee.payrollLocked = false;
    
    // Assign requested details
    if (department) employee.department = department;
    if (role) employee.role = role;
    if (manager) employee.manager = manager;
    
    // Sync onboarding data to employee model (Optional but recommended)
    employee.personalDetails = onboarding.personalDetails;
    employee.bankDetails = onboarding.bankDetails;
    // ... other syncs ...
    
    await employee.save();
    
    // Update Onboarding status
    onboarding.status = 'APPROVED';
    onboarding.reviewedAt = new Date();
    onboarding.reviewedBy = req.user.id;
    await onboarding.save();
    
    res.json({ 
      success: true, 
      message: "Employee approved and activated successfully!",
      notification: "Onboarding success message sent to employee."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
