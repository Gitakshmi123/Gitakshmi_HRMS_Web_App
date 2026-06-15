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

        const emps = await Employee.find({ firstName: /harmik/i });
        console.log(`Found ${emps.length} Dharmiks`);
        emps.forEach(e => console.log(`- ID: ${e._id}, Name: ${e.firstName} ${e.lastName}, Status: ${e.status}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
