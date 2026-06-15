const mongoose = require('mongoose');
require('dotenv').config();
const payrollService = require('./services/payroll.service');

async function debugRun() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        // Register models manually if needed for the test
        // Usually payrollService.runPayroll handles model retrieval from db object

        console.log('Running payroll for Feb 2026...');
        const result = await payrollService.runPayroll(
            db,
            tenantId,
            2, // Feb
            2026,
            new mongoose.Types.ObjectId() // Dummy user
        );

        console.log('Result Processed:', result.processedEmployees);
        console.log('Result Errors:', result.failedEmployees);
        if (result.executionErrors) {
            console.log('Execution Errors Count:', result.executionErrors.length);
            result.executionErrors.forEach(e => console.error(' - Error:', e.message));
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await mongoose.disconnect();
    }
}

debugRun();
