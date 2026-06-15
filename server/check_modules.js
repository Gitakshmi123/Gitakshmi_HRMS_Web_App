const modules = [
    './models/SalaryStructure',
    './middleware/tenant.middleware',
    './controllers/payroll.controller',
    './controllers/benefit.controller',
    './controllers/payrollRun.controller',
    './controllers/payslip.controller',
    './controllers/payrollProcess.controller',
    './controllers/payrollDashboard.controller',
    './middleware/auth.jwt'
];

modules.forEach(m => {
    try {
        require(m);
        console.log(`✅ ${m} OK`);
    } catch (e) {
        console.error(`❌ ${m} FAILED:`, e.message);
    }
});
