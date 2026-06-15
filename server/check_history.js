const mongoose = require('mongoose');
require('dotenv').config();

async function checkHistory() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const PayrollRun = db.model('PayrollRun', new mongoose.Schema({}, { strict: false }));
        const runs = await PayrollRun.find({}).sort({ year: -1, month: -1 });

        console.log(`Runs for ${tenantId}:`, runs.length);
        runs.forEach(r => {
            console.log(`\nMonth: ${r.month}, Year: ${r.year}, Status: ${r.status}`);
            console.log(` - Processed/Total: ${r.processedEmployees} / ${r.totalEmployees}`);
            console.log(` - Net Pay: ${r.totalNetPay}`);
            console.log(` - Tenant Employees: ${r.totalTenantEmployees}`);
        });

        const Employee = db.model('Employee', new mongoose.Schema({}, { strict: false }));
        const activeEmpCount = await Employee.countDocuments({ status: 'Active' });
        console.log(`\nActive Employee Count:`, activeEmpCount);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkHistory();
