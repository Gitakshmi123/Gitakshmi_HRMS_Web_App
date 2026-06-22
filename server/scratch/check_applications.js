const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_master';
        console.log('Connecting to:', mongoUri);
        await mongoose.connect(mongoUri);
        
        const tenantId = '6a01acaceb46bc6d43b11de3';
        const getTenantDB = require('../utils/tenantDB');
        const tDb = await getTenantDB(tenantId);
        
        const Candidate = tDb.model('Candidate', require('../models/Candidate'));
        const Applicant = tDb.model('Applicant', require('../models/Applicant'));
        const Application = tDb.model('Application', require('../models/Application'));
        const Job = tDb.model('Requirement', require('../models/Requirement'));

        console.log('\n=== CANDIDATES ===');
        const candidates = await Candidate.find().lean();
        console.log(JSON.stringify(candidates, null, 2));

        console.log('\n=== APPLICANTS (Legacy) ===');
        const applicants = await Applicant.find().populate('requirementId').lean();
        console.log(JSON.stringify(applicants, null, 2));

        console.log('\n=== APPLICATIONS (V2) ===');
        const applications = await Application.find().populate('jobId').lean();
        console.log(JSON.stringify(applications, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
