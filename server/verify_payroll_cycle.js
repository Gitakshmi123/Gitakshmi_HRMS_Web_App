const mongoose = require('mongoose');
const dns = require('dns');

// DNS FIX for Atlas SRV
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (e) {
    console.warn('DNS override failed:', e.message);
}

require('dotenv').config();

const payrollProcessController = require('./controllers/payrollProcess.controller');
const getTenantDB = require('./utils/tenantDB');
const Tenant = require('./models/Tenant');

// Helper to construct request and response mocks
function makeReqRes(tenantDB, body, params = {}, query = {}, user = {}) {
    const req = {
        body,
        params,
        query,
        user: {
            id: '600000000000000000000001',
            _id: '600000000000000000000001',
            name: 'HR Admin',
            email: 'hr@gitakshmi.com',
            role: 'hr',
            tenantId: '6a1eb73c056191af5f4cf27c',
            ...user
        },
        tenantId: '6a1eb73c056191af5f4cf27c',
        tenantDB: tenantDB,
        db: tenantDB,
        ip: '127.0.0.1',
        get: (header) => 'Mozilla/5.0'
    };
    let statusVal = 200;
    let jsonVal = null;
    const res = {
        status: (code) => {
            statusVal = code;
            return res;
        },
        json: (data) => {
            jsonVal = data;
            return res;
        },
        send: (data) => {
            jsonVal = data;
            return res;
        },
        _status: () => statusVal,
        _json: () => jsonVal
    };
    return { req, res };
}

async function runE2EPayroll() {
    console.log('🚀 Starting Programmatic E2E Payroll Cycle Test...');
    try {
        const MONGO_URI = process.env.MONGO_URI;
        if (!MONGO_URI) {
            throw new Error('MONGO_URI is missing in environment variables');
        }

        console.log('Connecting to database...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Database connected');

        // Resolve Tenant
        const tenantId = '6a1eb73c056191af5f4cf27c';
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            throw new Error(`Tenant ${tenantId} not found. Please run verify_hiring_cycle.js first.`);
        }
        console.log(`✅ Tenant resolved: ${tenant.companyName || tenant.name} (Code: ${tenant.code})`);

        // Connect to Tenant DB
        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            throw new Error('Failed to resolve tenant database connection');
        }

        // 0. Migrate Canonical Payroll Data to ensure employees have Salary Versions
        console.log('\nMigrating canonical payroll data to ensure readiness...');
        const canonicalPayroll = require('./services/canonicalPayroll.service');
        const migrationResult = await canonicalPayroll.migrateCanonicalPayrollData(tenantDB, tenantId, { force: true });
        console.log(`✅ Migration complete. Salary Versions created: ${migrationResult.salaryVersionsCreated}`);

        // 1. Fetch Process Employees
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        console.log(`\nFetching eligible employees for payroll: ${currentMonth}`);
        
        const { req: reqList, res: resList } = makeReqRes(tenantDB, {}, {}, { month: currentMonth });
        await payrollProcessController.getProcessEmployees(reqList, resList);
        
        if (resList._status() !== 200) {
            throw new Error('getProcessEmployees failed: ' + JSON.stringify(resList._json()));
        }
        
        const employeesResponse = resList._json();
        console.log(`📊 Found ${employeesResponse.count} active employees.`);
        
        const validEmployees = employeesResponse.data.filter(emp => emp.canProcessPayroll);
        if (validEmployees.length === 0) {
            console.log('❌ No employees ready for payroll. Here is the status of the first few:');
            employeesResponse.data.slice(0, 3).forEach(emp => {
                console.log(`  - ${emp.name} (${emp.employeeId}): readiness=${emp.payrollReadiness}, issues:`, 
                    emp.validation?.issues?.map(i => i.message) || 'None');
            });
            throw new Error('Cannot proceed: No valid employees found for payroll.');
        }

        console.log(`✅ ${validEmployees.length} employees are READY for payroll calculation.`);
        
        // 2. Preview Payroll
        const targetEmployeeId = validEmployees[0].employeeId; // using logical ID for logging
        const targetDbId = validEmployees[0]._id;
        console.log(`\nRunning Payroll Preview for employee: ${validEmployees[0].name} (${targetEmployeeId})`);
        
        const previewPayload = {
            month: currentMonth,
            items: [{ employeeId: targetDbId }],
            attendancePolicy: 'ALLOW_FALLBACK'
        };
        
        const { req: reqPreview, res: resPreview } = makeReqRes(tenantDB, previewPayload);
        await payrollProcessController.previewPreview(reqPreview, resPreview);
        
        if (resPreview._status() !== 200) {
            throw new Error('previewPreview failed: ' + JSON.stringify(resPreview._json()));
        }
        
        const previewResult = resPreview._json().data[0];
        if (previewResult.error) {
            throw new Error(`Preview failed for employee: ${previewResult.error}`);
        }
        
        console.log(`✅ Preview successful. Gross: ₹${previewResult.gross}, Net: ₹${previewResult.net}`);
        
        // 3. Run Payroll
        console.log(`\nExecuting Final Payroll Run...`);
        const runPayload = {
            month: currentMonth,
            items: [{ employeeId: targetDbId }],
            attendancePolicy: 'ALLOW_FALLBACK',
            payDate: new Date()
        };
        
        const { req: reqRun, res: resRun } = makeReqRes(tenantDB, runPayload);
        await payrollProcessController.runPayroll(reqRun, resRun);
        
        if (resRun._status() !== 200) {
            throw new Error('runPayroll failed: ' + JSON.stringify(resRun._json()));
        }
        
        const runResult = resRun._json();
        console.log('✅ Payroll Run Completed successfully!');
        console.log('Run Summary:');
        console.log(`  - Run Code: ${runResult.data.runCode}`);
        console.log(`  - Status: ${runResult.data.status}`);
        console.log(`  - Processed Employees: ${runResult.data.processedEmployees}`);
        console.log(`  - Total Net Pay: ₹${runResult.data.totalNetPay}`);
        
        // 4. Verify Payslip Created
        const Payslip = tenantDB.model('Payslip') || tenantDB.models.Payslip;
        const payslip = await Payslip.findOne({ payrollRunId: runResult.data.payrollRunId, employeeId: targetDbId });
        
        if (!payslip) {
            throw new Error('Payslip was not generated!');
        }
        console.log(`\n✅ Payslip Generated!`);
        console.log(`  - Payslip No: ${payslip.payslipNumber}`);
        console.log(`  - Gross: ₹${payslip.grossPay}`);
        console.log(`  - Deductions: ₹${payslip.totalDeductions}`);
        console.log(`  - Net: ₹${payslip.netPay}`);
        
        console.log('\n==================================================');
        console.log('🎉 SUCCESS: Entire E2E Payroll Cycle Verification Passed!');
        console.log('==================================================\n');

    } catch (err) {
        console.error('❌ E2E Payroll Test Failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
    }
}

runE2EPayroll();
