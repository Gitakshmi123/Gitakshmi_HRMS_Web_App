const mongoose = require('mongoose');
require('dotenv').config();

async function checkSpecific() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const empId = '698b2b86eaaf4b1b306890d5';
        const appId = '698c12197fa704783edf7692';

        const Applicant = db.model('Applicant', new mongoose.Schema({}, { strict: false }));
        const app = await Applicant.findById(appId);
        console.log('Applicant details:', JSON.stringify(app, null, 2));

        const SalaryStructure = mongoose.model('SalaryStructure', new mongoose.Schema({}, { strict: false }));
        const structure = await SalaryStructure.findOne({ candidateId: new mongoose.Types.ObjectId(appId) });
        console.log('SalaryStructure for Applicant:', structure ? JSON.stringify(structure, null, 2) : 'NOT FOUND');

        const structureForEmp = await SalaryStructure.findOne({ candidateId: new mongoose.Types.ObjectId(empId) });
        console.log('SalaryStructure for Employee:', structureForEmp ? 'FOUND' : 'NOT FOUND');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSpecific();
