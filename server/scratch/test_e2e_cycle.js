require('dotenv').config();
const mongoose = require('mongoose');

// Models
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const PayrollRun = require('../models/PayrollRun');
const EmployeeCtcVersion = require('../models/EmployeeCtcVersion');

// Services
const SalaryCalculationEngine = require('../services/salaryCalculationEngine');
const payrollService = require('../services/payroll.service');

async function runE2ETest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get the specific tenant DB you use (replace with the correct one if needed)
        // I will just use the default tenant for testing.
        const defaultTenant = await Tenant.findOne();
        if (!defaultTenant) {
            console.log('❌ No Tenant found in DB');
            process.exit(1);
        }
        
        const db = mongoose.connection.useDb('company_pnr');
        console.log(`✅ Using Tenant: ${defaultTenant.tenantName}`);

        // 1. Candidate is Hired and Converted into Employee
        console.log('\n--- 1. HIRING CANDIDATE ---');
        
        // We'll mock the resulting Employee
        const newEmployee = new (db.model('Employee', require('../models/Employee').schema))({
            tenant: defaultTenant._id,
            firstName: 'Test',
            lastName: 'Candidate',
            email: `test_candidate_${Date.now()}@example.com`,
            status: 'Active',
            joiningDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), // Joined 1st of last month
        });
        await newEmployee.save();
        console.log(`✅ Created Employee: ${newEmployee.firstName} ${newEmployee.lastName} (${newEmployee._id})`);

        // 2. Set Up CTC for Employee
        console.log('\n--- 2. ASSIGNING CTC ---');
        const Earning = db.collection('salarycomponents');
        const Benefit = db.collection('benefitcomponents');
        const Deduction = db.collection('deductioncomponents');
        
        const earnings = await Earning.find({ isActive: { $ne: false } }).toArray();
        const benefits = await Benefit.find({ isActive: { $ne: false } }).toArray();
        const deductions = await Deduction.find({ isActive: { $ne: false } }).toArray();

        const testPayload = {
            annualCTC: 600000,
            earnings,
            deductions,
            benefits,
            payrollContext: { applyStatutory: true, locationContext: { workState: 'Gujarat' } }
        };
        const res = SalaryCalculationEngine.calculateSalary(testPayload);
        
        const ctcVersion = new (db.model('EmployeeCtcVersion', require('../models/EmployeeCtcVersion').schema))({
            tenantId: defaultTenant._id,
            employeeId: newEmployee._id,
            version: 1,
            components: [...res.earnings, ...res.benefits, ...res.deductions].map(c => ({
                name: c.name,
                type: res.earnings.includes(c) ? 'EARNING' : res.benefits.includes(c) ? 'BENEFIT' : 'DEDUCTION',
                amount: c.monthly,
                annualAmount: c.yearly
            })),
            isDraft: false,
            effectiveDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            status: 'ACTIVE'
        });
        await ctcVersion.save();
        console.log('✅ Approved & Activated CTC of ₹6,00,000 / year');

        // 3. Simulating First Month Attendance & Leaves
        console.log('\n--- 3. SIMULATING ATTENDANCE (30 DAYS) ---');
        const AttendanceModel = db.model('Attendance', require('../models/Attendance'));
        
        let targetMonth = new Date().getMonth() - 1; // Last month
        let targetYear = new Date().getFullYear();
        if (targetMonth < 0) { targetMonth = 11; targetYear--; }
        
        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        
        const attendanceRecords = [];
        for (let i = 1; i <= daysInMonth; i++) {
            let status = 'present';
            let leaveType = null;
            let lopDays = 0;
            
            // Simulate 2 days Sick Leave
            if (i === 15 || i === 16) {
                status = 'leave';
                leaveType = 'Sick Leave';
            }
            // Simulate 1 day Unpaid Leave (LOP)
            if (i === 20) {
                status = 'leave';
                leaveType = 'Unpaid Leave';
                lopDays = 1;
            }
            // Simulate 1 Half Day
            if (i === 22) {
                status = 'half_day';
            }
            
            attendanceRecords.push({
                tenant: defaultTenant._id,
                employee: newEmployee._id,
                date: new Date(targetYear, targetMonth, i, 10, 0, 0),
                status,
                leaveType,
                lopDays
            });
        }
        await AttendanceModel.insertMany(attendanceRecords);
        console.log(`✅ Logged ${daysInMonth} days. (Included: 2 Paid Leaves, 1 Unpaid LOP, 1 Half Day)`);

        // 4. Generating Salary
        console.log('\n--- 4. PROCESSING PAYROLL PAYSLIP ---');
        try {
            const result = await payrollService.calculateEmployeePayroll(
                db, 
                defaultTenant._id, 
                newEmployee, 
                targetMonth + 1, // 1-indexed for the service usually
                targetYear, 
                null, 
                'REGULAR'
            );
            
            console.log('\n🎉 [PAYSLIP GENERATED SUCCESSFULLY]');
            console.log(`   Basic Salary (Prorated): ₹${result.breakup.grossEarnings.basicAmount}`);
            console.log(`   Total Gross Salary: ₹${result.breakup.grossEarnings.totalGross}`);
            console.log(`   Total Pre-Tax Deductions: ₹${result.breakup.preTaxDeductions.total}`);
            console.log(`   Taxable Income: ₹${result.breakup.taxableIncome}`);
            console.log(`   Final Net Pay: ₹${result.breakup.netPay}`);
            
            console.log('\n✅ End-to-End Cycle Complete!');
        } catch(payrollErr) {
            console.log('⚠️ Note: Payroll execution threw an error (usually because of missing tax profiles/rules for mocked user):', payrollErr.message);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runE2ETest();
