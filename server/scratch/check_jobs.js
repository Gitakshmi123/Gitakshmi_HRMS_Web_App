const mongoose = require('mongoose');
require('dotenv').config();

async function checkJobs() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
        console.log('Connected to Main DB');

        const tenantId = '69fcd718faa7e986dee243bf';
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false, collection: 'companies' }));
        const tenant = await Tenant.findById(tenantId);
        
        if (!tenant) {
            console.log('Tenant not found');
            process.exit(1);
        }

        console.log('Tenant found:', tenant.companyName);
        const dbName = tenant.databaseName || `company_${tenantId}`;
        const tenantDB = mongoose.connection.useDb(dbName);
        console.log('Connected to Tenant DB:', dbName);

        const Requirement = tenantDB.model('Requirement', new mongoose.Schema({}, { strict: false, collection: 'requirements' }));
        
        const filter = {
            $and: [
              {
                $or: [
                  { status: /^open$/i },
                  { hiringStatus: /^open$/i },
                  { 'jobDetails.status': /^open$/i },
                ],
              },
              {
                $or: [
                  { visibility: /^(external|both)$/i },
                  { 'jobDetails.visibility': /^(external|both)$/i },
                ],
              },
              { isDeleted: { $ne: true } },
              { deleted: { $ne: true } },
              {
                $or: [
                  { publishedAt: { $exists: true, $ne: null } },
                  { visibility: /^(external|both)$/i },
                  { 'jobDetails.visibility': /^(external|both)$/i },
                ],
              },
            ],
          };

        const jobs = await Requirement.find(filter);
        console.log(`Found ${jobs.length} jobs with filter`);

        jobs.forEach(j => {
            console.log(`- Match: ${j.jobTitle}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkJobs();
