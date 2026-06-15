const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({});

        for (const tenant of tenants) {
            const dbName = `company_${tenant._id}`;
            const tenantDb = mongoose.connection.useDb(dbName);

            try {
                const PayrollRunSchema = require('./models/PayrollRun');
                const PayslipSchema = require('./models/Payslip');

                // We need to check if collection exists or just try to find
                const PayrollRun = tenantDb.model('PayrollRun', PayrollRunSchema);
                const Payslip = tenantDb.model('Payslip', PayslipSchema);

                const runCount = await PayrollRun.countDocuments({});
                const payslipCount = await Payslip.countDocuments({});

                if (runCount > 0 || payslipCount > 0) {
                    console.log(`Tenant Code: ${tenant.code}, ID: ${tenant._id}`);
                    console.log(`  - Payroll Runs: ${runCount}`);
                    console.log(`  - Payslips: ${payslipCount}`);

                    if (runCount > 0) {
                        const runs = await PayrollRun.find({});
                        runs.forEach(r => console.log(`    Run: ${r.month}/${r.year}, Status: ${r.status}, ID: ${r._id}`));
                    }
                    if (payslipCount > 0) {
                        const slips = await Payslip.find({}).limit(1);
                        slips.forEach(s => console.log(`    Sample Payslip: ${s.month}/${s.year}, Net: ${s.netPay}, Employee: ${s.employeeId}`));
                    }
                }
            } catch (e) {
                // Skip if error (models already registered etc)
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
