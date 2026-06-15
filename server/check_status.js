const mongoose = require('mongoose');
require('dotenv').config();

async function checkEmpStatus() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const Employee = db.model('Employee', new mongoose.Schema({}, { strict: false }));
        const employees = await Employee.find({});

        console.log(`Employees status for ${tenantId}:`);
        employees.forEach(e => {
            console.log(` - ${e.firstName} ${e.lastName} | Status: ${e.status} | Tenant: ${e.tenant}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkEmpStatus();
