const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findOne({ code: 'abc002' });

        const dbName = `company_${tenant._id}`;
        const db = mongoose.connection.useDb(dbName);
        const Payslip = db.model('Payslip', require('./models/Payslip'));

        const count = await Payslip.countDocuments({});
        console.log(`Total Payslips: ${count}`);

        const jan = await Payslip.find({ month: 1, year: 2026 });
        console.log(`Jan 2026 Payslips: ${jan.length}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
