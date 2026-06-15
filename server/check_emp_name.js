const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findOne({ code: 'abc002' });

        const dbName = `company_${tenant._id}`;
        const db = mongoose.connection.useDb(dbName);
        const Employee = db.model('Employee', require('./models/Employee'));

        const e = await Employee.findById('694141cbd86805bb36ba3d52');
        console.log(`Emp ID: 694141cbd86805bb36ba3d52`);
        console.log(`Name: ${e?.firstName} ${e?.lastName}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
