const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server', '.env') });

const Tenant = require('./server/models/Tenant');
const RequirementSchema = require('./server/models/Requirement');
const getTenantDB = require('./server/utils/tenantDB');

async function debugJobs() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // Logic from controller
        let tenant = await Tenant.findOne({ status: 'active' }).sort({ updatedAt: -1 }).lean();
        if (!tenant) {
            tenant = await Tenant.findOne({}).sort({ updatedAt: -1 }).lean();
        }

        if (!tenant) {
            console.log('No tenant found');
            return;
        }

        console.log('Resolved Tenant:', tenant.companyName, '(', tenant._id, ')');

        const tenantDB = await getTenantDB(String(tenant._id));
        const Requirement = tenantDB.model('Requirement', RequirementSchema);

        const allJobs = await Requirement.find({}).lean();
        console.log('Total jobs in this tenant:', allJobs.length);

        allJobs.forEach(j => {
            console.log(`- Job: ${j.jobTitle} | Status: ${j.status || j.hiringStatus} | Visibility: ${j.visibility} | Deleted: ${j.isDeleted}`);
        });

        // Current filter logic
        const filter = {
            $and: [
                {
                    $or: [
                        { status: /open/i },
                        { hiringStatus: /open/i },
                        { 'jobDetails.status': /open/i },
                    ],
                },
                {
                    $or: [
                        { visibility: /external|both/i },
                        { 'jobDetails.visibility': /external|both/i },
                        { visibility: { $exists: false } },
                        { 'jobDetails.visibility': { $exists: false } },
                    ],
                },
                { isDeleted: { $ne: true } },
                { deleted: { $ne: true } },
            ],
        };

        const filteredJobs = await Requirement.find(filter).lean();
        console.log('Jobs after filter:', filteredJobs.length);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debugJobs();
