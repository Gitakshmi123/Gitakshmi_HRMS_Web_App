const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getTenantDB = require('./utils/tenantDB');

async function checkDharmik() {
    try {
        const MONGO_URI = process.env.MONGO_URI;
        await mongoose.connect(MONGO_URI);
        console.log('Connected to global DB');

        const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', new mongoose.Schema({ code: String }));
        const tenant = await Tenant.findOne({ code: 'tes001' });

        if (!tenant) {
            console.log('Tenant tes001 not found.');
            return;
        }

        console.log('Found Tenant:', tenant.name, tenant._id);

        const tenantDB = await getTenantDB(tenant._id);
        const Applicant = tenantDB.model('Applicant');
        const TrackerCandidate = tenantDB.model('TrackerCandidate');

        const applicant = await Applicant.findOne({ name: /Dharmik/i });
        const tracker = await TrackerCandidate.findOne({ email: applicant?.email || 'NOT_FOUND_EMAIL' });

        console.log('Applicant Data:', applicant ? {
            name: applicant.name,
            email: applicant.email,
            resume: applicant.resume,
            status: applicant.status
        } : 'Applicant NOT Found');

        console.log('Tracker Data:', tracker ? {
            name: tracker.name,
            email: tracker.email,
            resume: tracker.resume,
            currentStatus: tracker.currentStatus
        } : 'Tracker NOT Found');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkDharmik();
