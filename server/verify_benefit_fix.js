const mongoose = require('mongoose');
require('dotenv').config();
const { getTenantDB } = require('./config/dbManager');
const Tenant = require('./models/Tenant');

async function verify() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected');

        // Get a tenant ID
        const tenant = await Tenant.findOne();
        if (!tenant) {
            console.error('No tenant found in DB to test with');
            process.exit(1);
        }
        const tenantId = tenant._id.toString();
        console.log(`Testing with tenant: ${tenant.name} (${tenantId})`);

        // Get tenant DB - this should trigger registerModels
        console.log('Requesting tenant DB...');
        const tenantDB = await getTenantDB(tenantId);

        console.log('Models registered on tenantDB:', Object.keys(tenantDB.models).join(', '));

        if (tenantDB.models.BenefitComponent) {
            console.log('✅ BenefitComponent model found on tenantDB');
        } else {
            console.error('❌ BenefitComponent model MISSING on tenantDB');
        }

        // Simulate a second call where connection is cached
        console.log('\nRequesting tenant DB again (cached)...');
        const tenantDB2 = await getTenantDB(tenantId);

        if (tenantDB2.models.BenefitComponent) {
            console.log('✅ BenefitComponent model found on cached tenantDB');
        } else {
            console.error('❌ BenefitComponent model MISSING on cached tenantDB');
        }

        await mongoose.disconnect();
        console.log('\nVerification complete');
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verify();
