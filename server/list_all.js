const mongoose = require('mongoose');
require('dotenv').config();

async function listAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const Employee = db.model('Employee', new mongoose.Schema({}, { strict: false }));
        const employees = await Employee.find({});
        console.log(`Employees in company_${tenantId}:`, employees.length);
        employees.forEach(e => console.log(` - ${e._id} | ${e.firstName} ${e.lastName} | ${e.employeeId}`));

        const Applicant = db.model('Applicant', new mongoose.Schema({}, { strict: false }));
        const applicants = await Applicant.find({});
        console.log(`\nApplicants in company_${tenantId}:`, applicants.length);
        applicants.forEach(a => console.log(` - ${a._id} | ${a.name} | ${a.email}`));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listAll();
