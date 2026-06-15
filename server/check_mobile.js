const mongoose = require('mongoose');
require('dotenv').config();

async function checkMobile() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const empId = '698b2b86eaaf4b1b306890d5';
        const Employee = db.model('Employee', new mongoose.Schema({}, { strict: false }));
        const emp = await Employee.findById(empId);
        console.log('Employee Mobile:', emp.contactNo);
        console.log('Employee documents:', emp.documents);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkMobile();
