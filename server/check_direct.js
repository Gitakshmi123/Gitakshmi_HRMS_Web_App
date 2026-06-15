
const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        // Use the correct DB name found from Tenant record
        const dbName = 'company_dharmik_tech_dha001_c13704ca';
        const db = mongoose.connection.useDb(dbName);
        console.log(`Using DB: ${dbName}`);
        
        const Applicant = db.model('Applicant', require('./models/Applicant'));
        const Requirement = db.model('Requirement', require('./models/Requirement'));

        const applicants = await Applicant.find({}).populate('requirementId').lean();
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
