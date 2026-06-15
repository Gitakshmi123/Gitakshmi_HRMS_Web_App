
const mongoose = require('mongoose');
const getTenantDB = require('./utils/tenantDB');

async function check() {
    try {
        const tenantId = '69f8ce66319fbe2bc13704ca';
        const db = await getTenantDB(tenantId);
        
        const Applicant = db.model('Applicant', require('./models/Applicant'));
        const Requirement = db.model('Requirement', require('./models/Requirement'));

        const applicants = await Applicant.find({}).lean();
        console.log('--- APPLICANTS ---');
        console.log(JSON.stringify(applicants, null, 2));

        const requirements = await Requirement.find({}).lean();
        console.log('--- REQUIREMENTS ---');
        console.log(JSON.stringify(requirements, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
