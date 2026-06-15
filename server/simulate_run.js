const mongoose = require('mongoose');
require('dotenv').config();

async function simulate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findOne({ code: 'abc002' });

        const dbName = `company_${tenant._id}`;
        const db = mongoose.connection.useDb(dbName);

        // Manual registration if needed, or just let Mongoose handle it
        const EmployeeSchema = require('./models/Employee');
        const SalaryTemplateSchema = require('./models/SalaryTemplate');
        const AttendanceSchema = require('./models/Attendance');
        const PayrollRunSchema = require('./models/PayrollRun');
        const PayrollRunItemSchema = require('./models/PayrollRunItem');
        const SalaryAssignmentSchema = require('./models/SalaryAssignment');
        const PayslipSchema = require('./models/Payslip');
        const EmployeeDeductionSchema = require('./models/EmployeeDeduction');
        const DeductionMasterSchema = require('./models/DeductionMaster');

        db.model('Employee', EmployeeSchema);
        db.model('SalaryTemplate', SalaryTemplateSchema);
        db.model('Attendance', AttendanceSchema);
        db.model('PayrollRun', PayrollRunSchema);
        db.model('PayrollRunItem', PayrollRunItemSchema);
        db.model('SalaryAssignment', SalaryAssignmentSchema);
        db.model('Payslip', PayslipSchema);
        db.model('EmployeeDeduction', EmployeeDeductionSchema);
        db.model('DeductionMaster', DeductionMasterSchema);

        const payrollProcessController = require('./controllers/payrollProcess.controller');

        const req = {
            tenantDB: db,
            user: { tenantId: tenant._id, id: tenant._id },
            body: {
                month: '2026-01',
                items: [
                    { employeeId: '694141cbd86805bb36ba3d52', salaryTemplateId: '6960c17b154fd5ecb7c20a1e' }
                ]
            }
        };

        const res = {
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { this.data = data; console.log("Response:", JSON.stringify(data, null, 2)); }
        };

        console.log("Starting Simulated Payroll Run...");
        await payrollProcessController.runPayroll(req, res);

        process.exit(0);
    } catch (err) {
        console.error("Simulation failed:", err);
        process.exit(1);
    }
}
simulate();
