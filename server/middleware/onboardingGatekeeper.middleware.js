const getTenantDB = require('../utils/tenantDB');
const EmployeeSchema = require('../models/Employee');

/**
 * Gatekeeper middleware to block access to modules (Attendance/Payroll)
 * if the employee's onboarding is not yet APPROVED/ACTIVE.
 */
module.exports = async (req, res, next) => {
  try {
    // Skip for non-employees (HR/Admin/PSA have bypass)
    const role = (req.user?.roleName || req.user?.role || '').toLowerCase();
    const bypassRoles = ['hr', 'admin', 'company_admin', 'psa', 'super_admin'];
    
    if (bypassRoles.includes(role)) {
      return next();
    }

    // Identify current employee
    const db = req.tenantDB || await getTenantDB(req.tenantId);
    const Employee = db.model('Employee', EmployeeSchema);
    
    const employee = await Employee.findById(req.user.id).select('status isActive attendanceLocked payrollLocked');
    
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    // Determine lock based on current route
    const isAttendanceRoute = req.originalUrl.includes('/attendance');
    const isPayrollRoute = req.originalUrl.includes('/payroll') || req.originalUrl.includes('/salary');

    if (employee.status !== 'ACTIVE' || !employee.isActive) {
       return res.status(403).json({ 
         success: false, 
         message: "ACCESS_LOCKED", 
         reason: "Onboarding Incomplete",
         onboardingStatus: employee.status 
       });
    }

    // Double check specific locks
    if (isAttendanceRoute && employee.attendanceLocked) {
      return res.status(403).json({ success: false, message: "Attendance system is locked until HR approval." });
    }

    if (isPayrollRoute && employee.payrollLocked) {
      return res.status(403).json({ success: false, message: "Payroll system is locked until HR approval." });
    }

    next();
  } catch (error) {
    console.error("Gatekeeper Error:", error);
    next(); // Fail open for safety, or next(error) to fail closed. Better next() here but log it.
  }
};
