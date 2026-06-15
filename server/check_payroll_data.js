const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findOne({ code: 'abc' }); // Assuming 'abc' from screenshot
        if (!tenant) return console.log('Tenant abc not found');

        const dbName = `company_${tenant._id}`;
        const tenantDb = mongoose.connection.useDb(dbName);

        const PayslipSchema = require('./models/Payslip');
        const Payslip = tenantDb.model('Payslip', PayslipSchema);

        const count = await Payslip.countDocuments({});
        console.log(`Total Payslips for tenant abc: ${count}`);

        const latest = await Payslip.find({}).sort({ createdAt: -1 }).limit(5);
        latest.forEach(p => {
            console.log(`Payslip: ${p.employeeInfo.name}, ${p.month}/${p.year}, Net: ${p.netPay}`);
        });

        const PayrollRunSchema = require('./models/PayrollRun');
        const PayrollRun = tenantDb.model('PayrollRun', PayrollRunSchema);
        const runs = await PayrollRun.find({}).sort({ createdAt: -1 }).limit(5);
        runs.forEach(r => {
            console.log(`Run: ${r.month}/${r.year}, Status: ${r.status}, Processed: ${r.processedEmployees}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
