const mongoose = require('mongoose');
require('dotenv').config();

async function checkAppEmpId() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const appId = '698c12197fa704783edf7692';

        const Applicant = db.model('Applicant', new mongoose.Schema({}, { strict: false }));
        const app = await Applicant.findById(appId);
        console.log('Applicant employeeId:', app.employeeId);
        console.log('Applicant name:', app.name);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkAppEmpId();
