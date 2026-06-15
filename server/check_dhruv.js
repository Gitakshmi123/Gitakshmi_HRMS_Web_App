const mongoose = require('mongoose');
require('dotenv').config();

async function checkDhruv() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const empId = '698c2c03bed8aecaa1de441e';
        const Employee = db.model('Employee', new mongoose.Schema({}, { strict: false }));
        const emp = await Employee.findById(empId);
        console.log('Employee Dhruv Email:', emp.email);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkDhruv();
