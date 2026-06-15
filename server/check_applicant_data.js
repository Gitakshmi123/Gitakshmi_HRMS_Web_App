const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ApplicantSchema = require('./models/Applicant');
const RequirementSchema = require('./models/Requirement');

const Applicant = mongoose.model('Applicant', ApplicantSchema);
// Register Requirement model just in case populate needs it
const Requirement = mongoose.model('Requirement', RequirementSchema);

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Main DB');

        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({});
        console.log(`Checking ${tenants.length} tenants...`);

        const applicantId = '694bb198e25e7d152fa0a959';
        let found = false;

        for (const tenant of tenants) {
            const dbName = `company_${tenant._id}`;
            const tenantDb = mongoose.connection.useDb(dbName);
            const TenantApplicant = tenantDb.model('Applicant', ApplicantSchema);

            const applicant = await TenantApplicant.findById(applicantId);
            if (applicant) {
                console.log(`✅ FOUND in Tenant: ${tenant.companyName || tenant.code} (${tenant._id})`);
                console.log('--- DATA ---');
                console.log('Name:', applicant.name);
                console.log('Father Name:', applicant.fatherName);
                console.log('Address:', applicant.address);
                console.log('Full Object:', JSON.stringify(applicant.toObject(), null, 2));
                found = true;
                break;
            }
        }

        if (!found) console.log('❌ Applicant NOT found in any tenant.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkData();
