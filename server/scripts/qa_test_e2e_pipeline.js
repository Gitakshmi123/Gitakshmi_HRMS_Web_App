const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { applyAttendanceRules } = require('../services/attendanceRulesEngine');
const { calculateAttendance, buildAttendanceWindow } = require('../services/shiftPolicyEngine');

const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const ShiftMaster = require('../models/ShiftMaster');
const ShiftPolicy = require('../models/ShiftPolicy');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const LeavePolicy = require('../models/LeavePolicy');
const PayrollIntegrationController = require('../controllers/payrollIntegration.controller');

async function runE2EQATest() {
    console.log("Starting E2E QA Test: Shift -> Leave -> Attendance -> Payroll");
    
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    try {
        // 1. Get or Create a Test Tenant
        let tenant = await Tenant.findOne({ name: 'QA_TEST_TENANT' });
        if (!tenant) {
            tenant = new Tenant({
                name: 'QA_TEST_TENANT',
                code: 'QATEST',
                dbName: 'hrms_tenant_qatest',
                status: 'active',
                companyName: 'QA Test Corp',
                companyEmail: 'qatest@example.com',
                ownerName: 'QA Admin',
                password: 'password123',
                tenantId: 'QA_TENANT_001',
                apiKey: 'TEST_API_KEY_123',
                databaseName: 'hrms_tenant_qatest'
            });
            await tenant.save();
        }
        
        console.log(`Using Tenant: ${tenant.name} (${tenant._id})`);

        // Connect to tenant DB
        const tenantDbUri = `${process.env.MONGO_URI.split('/hrms')[0]}/${tenant.dbName}?authSource=admin`;
        const tenantConnection = await mongoose.createConnection(tenantDbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Register Models on Tenant Connection
        const EmployeeModel = tenantConnection.model('Employee', Employee);
        const ShiftMasterModel = tenantConnection.model('ShiftMaster', ShiftMaster);
        const ShiftPolicyModel = tenantConnection.model('ShiftPolicy', ShiftPolicy);
        const AttendanceModel = tenantConnection.model('Attendance', Attendance);
        const LeavePolicyModel = tenantConnection.model('LeavePolicy', LeavePolicy);
        const LeaveRequestModel = tenantConnection.model('LeaveRequest', LeaveRequest);
        const HolidayModel = tenantConnection.model('Holiday', new mongoose.Schema({ date: Date, title: String, status: String }));

        // Cleanup previous test data
        await EmployeeModel.deleteMany({ email: 'qa_test_employee@example.com' });
        await ShiftMasterModel.deleteMany({ code: 'QA_SHIFT_01' });
        await ShiftPolicyModel.deleteMany({ name: 'QA_SHIFT_POLICY' });
        await LeavePolicyModel.deleteMany({ code: 'QA_LEAVE_01' });
        await AttendanceModel.deleteMany({});
        await LeaveRequestModel.deleteMany({});
        
        // 2. Create Test Employee
        const employee = new EmployeeModel({
            firstName: 'QA',
            lastName: 'Tester',
            email: 'qa_test_employee@example.com',
            employeeId: 'EMP-QA-001',
            status: 'Active',
            tenant: tenant._id,
            tenantId: tenant._id,
            mainCompanyId: tenant._id
        });
        await employee.save();
        console.log(`Created Employee: ${employee.email}`);

        // 3. Create Shift Master and Policy
        const shiftMaster = new ShiftMasterModel({
            tenant: tenant._id,
            name: 'QA Shift',
            code: 'QA_SHIFT_01',
            type: 'Regular',
            coreTiming: {
                startTime: '09:00',
                endTime: '18:00',
                isNightShiftAcrossMidnight: false
            },
            workingHours: {
                minimumHoursForFullDay: 480, // 8 hours in minutes
                minimumHoursForHalfDay: 240  // 4 hours in minutes
            },
            status: 'Active',
            validFrom: new Date()
        });
        await shiftMaster.save();

        const shiftPolicy = new ShiftPolicyModel({
            tenant: tenant._id,
            name: 'QA_SHIFT_POLICY',
            shiftMasterId: shiftMaster._id,
            effectiveFrom: new Date(),
            attendanceRules: {
                absentThresholdMinutes: 240,
                punchWindow: {
                    maxAdvancePunchInMinutes: 120,
                    maxLatePunchOutMinutes: 120
                },
                lateMarks: [
                    { conditionType: 'GREATER_THAN', minutes: 15, action: 'LATE_MARK' }
                ],
                monthlyLateToHalfDayConversion: 4,
                monthlyLateAction: 'HALF_DAY'
            },
            status: 'Active'
        });
        await shiftPolicy.save();
        console.log(`Created Shift and Policy`);

        // 4. Create Leave Policy and Request
        const leavePolicy = new LeavePolicyModel({
            tenant: tenant._id,
            name: 'QA Casual Leave',
            code: 'QA_LEAVE_01',
            type: 'Paid',
            accrualRules: { totalDays: 12 },
            status: 'Active'
        });
        await leavePolicy.save();

        // Let's create an approved leave for the 5th of the month
        const now = new Date();
        const testYear = now.getFullYear();
        const testMonth = now.getMonth() + 1;
        const testDateLeave = new Date(testYear, testMonth - 1, 5);
        
        const leaveRequest = new LeaveRequestModel({
            tenant: tenant._id,
            employee: employee._id,
            leavePolicy: leavePolicy._id,
            leaveType: leavePolicy.name || 'Casual',
            startDate: testDateLeave,
            endDate: testDateLeave,
            status: 'Approved',
            daysCount: 1,
            paidLeaveDays: 1,
            unpaidLeaveDays: 0,
            appliedOn: new Date()
        });
        await leaveRequest.save();
        console.log(`Created Leave Request for ${testDateLeave.toDateString()}`);

        // 5. Generate Attendance Logs (Simulate Late marks)
        console.log("Simulating Punches...");
        
        const { translateShiftPolicyToLegacyConfig } = require('../utils/shiftRuntime');
        const legacyShiftConfig = translateShiftPolicyToLegacyConfig(shiftMaster, shiftPolicy);
        
        const generatePunch = async (day, inHour, inMin, outHour, outMin) => {
            const date = new Date(testYear, testMonth - 1, day);
            const shiftWindow = buildAttendanceWindow(legacyShiftConfig, date);
            
            const punchLogs = [
                { type: 'IN', time: new Date(testYear, testMonth - 1, day, inHour, inMin) },
                { type: 'OUT', time: new Date(testYear, testMonth - 1, day, outHour, outMin) }
            ];

            const monthStart = new Date(testYear, testMonth - 1, 1);
            const lateRecords = await AttendanceModel.find({
                employee: employee._id,
                date: { $gte: monthStart, $lt: date },
                isLate: true
            });
            const accumulatedLateCount = lateRecords.length;

            const shiftOutcome = calculateAttendance({
                shift: legacyShiftConfig,
                window: shiftWindow,
                date: date,
                punchLogs: punchLogs,
                accumulatedLateCount: accumulatedLateCount,
                accumulatedEarlyCount: 0
            });

            const { buildEffectiveAttendanceSettings } = require('../utils/shiftRuntime');
            const settings = buildEffectiveAttendanceSettings({}, legacyShiftConfig);

            // Rules Engine
            const rulesResult = applyAttendanceRules({
                date: date,
                employeeId: employee._id,
                logs: punchLogs,
                workingHours: shiftOutcome.workingHours,
                baseStatus: shiftOutcome.status,
                settings: settings, 
                accumulatedLateCount: accumulatedLateCount,
                shiftPolicy: shiftPolicy
            });

            const attendance = new AttendanceModel({
                tenant: tenant._id,
                employee: employee._id,
                date: date,
                status: rulesResult.status,
                isLate: rulesResult.isLate,
                lopDays: rulesResult.lopDays || shiftOutcome.lopDays || 0,
                lateMinutes: rulesResult.lateMinutes,
                earlyExitMinutes: rulesResult.earlyExitMinutes,
                workingHours: shiftOutcome.workingHours,
                punches: punchLogs
            });
            await attendance.save();
            return { finalStatus: rulesResult.status, lopDays: rulesResult.lopDays || shiftOutcome.lopDays };
        };

        // Day 1: Perfect
        await generatePunch(1, 8, 50, 18, 5);
        // Day 2: Late (1) (09:20 - Grace is 15m)
        await generatePunch(2, 9, 20, 18, 5);
        // Day 3: Late (2)
        await generatePunch(3, 9, 25, 18, 5);
        // Day 4: Late (3)
        await generatePunch(4, 9, 30, 18, 5);
        
        // Day 5 is Leave (handled by payroll engine automatically merging records usually, but let's leave attendance blank or mock it as 'leave')
        const leaveAttendance = new AttendanceModel({
            tenant: tenant._id,
            employee: employee._id,
            date: testDateLeave,
            status: 'leave', // Payroll skips or handles this
            lopDays: 0
        });
        await leaveAttendance.save();

        // Day 6: Late (4) - THIS SHOULD BE HALF DAY
        const day6Result = await generatePunch(6, 9, 20, 18, 5);
        console.log(`Day 6 Result (4th late mark): Status=${day6Result.finalStatus}, LOP=${day6Result.lopDays}`);

        // 6. Test Payroll Integration Calculation
        console.log("Running Payroll Integration (generating payroll inputs)...");
        const req = {
            tenantId: tenant._id.toString(),
            query: { month: testMonth, year: testYear },
            tenantDB: tenantConnection,
            user: { tenantId: tenant._id.toString() }
        };
        const res = {
            json: (data) => console.log(JSON.stringify(data, null, 2)),
            status: (code) => ({ json: (err) => console.error(`Error ${code}:`, err) })
        };

        await PayrollIntegrationController.generatePayrollInputs(req, res);

        console.log("E2E Test Completed successfully.");

        await tenantConnection.close();
        await mongoose.disconnect();
    } catch (err) {
        console.error("Test Failed:", err);
        process.exit(1);
    }
}

runE2EQATest();
