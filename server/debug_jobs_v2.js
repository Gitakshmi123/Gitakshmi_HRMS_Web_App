const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const Tenant = require('./models/Tenant');
const RequirementSchema = require('./models/Requirement');
const getTenantDB = require('./utils/tenantDB');

async function debugJobs() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const tenants = await Tenant.find({ status: 'active' }).sort({ updatedAt: -1 }).lean();
        console.log('Active Tenants:', tenants.length);
        
        for (const t of tenants) {
            console.log(`\nChecking Tenant: ${t.companyName} (${t._id}) | Updated: ${t.updatedAt}`);
            try {
                const tenantDB = await getTenantDB(String(t._id));
                const Requirement = tenantDB.model('Requirement', RequirementSchema);
                const jobs = await Requirement.find({}).lean();
                console.log(`  Total jobs: ${jobs.length}`);
                jobs.forEach(j => {
                    console.log(`  - [${j._id}] ${j.jobTitle} | Status: ${j.status} | Visibility: ${j.visibility}`);
                });
            } catch (err) {
                console.log(`  Error accessing DB: ${err.message}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debugJobs();
