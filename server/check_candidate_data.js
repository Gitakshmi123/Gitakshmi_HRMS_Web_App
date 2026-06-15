const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;
const candidateId = '695d0077ca871d4a579618fc';

async function check() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // We need to find which tenant this candidate belongs to.
        // Applicants are often in the main DB or tenant-specific DB depending on architecture.
        // Based on backend/index.js, Applicant model is registered in main DB too.

        const ApplicantSchema = new mongoose.Schema({ name: String, tenantId: String }, { strict: false });
        const Applicant = mongoose.models.Applicant || mongoose.model('Applicant', ApplicantSchema);

        const applicant = await Applicant.findById(candidateId);
        if (!applicant) {
            console.log('Applicant not found');
            return;
        }

        console.log('Applicant found:', JSON.stringify(applicant, null, 2));

        const tenantId = applicant.tenantId;
        console.log('Tenant ID:', tenantId);

        if (tenantId) {
            // Now check components in tenant DB
            const tenantDbName = `tenant_${tenantId}`;
            const tenantDb = mongoose.connection.useDb(tenantDbName);

            const EarningSchema = new mongoose.Schema({ name: String, isActive: Boolean }, { strict: false });
            const DeductionSchema = new mongoose.Schema({ name: String, isActive: Boolean }, { strict: false });

            const Earning = tenantDb.model('Earning', EarningSchema);
            const Deduction = tenantDb.model('Deduction', DeductionSchema);

            const earnings = await Earning.find({});
            const deductions = await Deduction.find({});

            console.log(`Earnings found in ${tenantDbName}:`, earnings.length);
            earnings.forEach(e => console.log(` - ${e.name} (Active: ${e.isActive})`));

            console.log(`Deductions found in ${tenantDbName}:`, deductions.length);
            deductions.forEach(d => console.log(` - ${d.name} (Active: ${d.isActive})`));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
