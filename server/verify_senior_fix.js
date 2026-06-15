const mongoose = require('mongoose');
require('dotenv').config();
const { getTenantDB } = require('./config/dbManager');
const Tenant = require('./models/Tenant');
const BenefitSchema = require('./models/Benefit.model.js');

async function verify() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected');

        // Register Benefit model on main connection for findOne test
        const BenefitMain = mongoose.models.Benefit || mongoose.model('Benefit', BenefitSchema);

        const tenant = await Tenant.findOne();
        if (!tenant) {
            console.error('No tenant found in DB to test with');
            process.exit(1);
        }
        const tenantId = tenant._id.toString();
        console.log(`Testing with tenant: ${tenant.name} (${tenantId})`);

        // Get tenant DB
        console.log('Requesting tenant DB...');
        const tenantDB = await getTenantDB(tenantId);

        const Benefit = tenantDB.model('Benefit');
        console.log('✅ Benefit model found on tenantDB');

        // Mock a save of Employer PF
        const testBenefit = new Benefit({
            tenantId,
            name: "Employer PF " + Date.now(),
            code: "MANDATORY_PF_" + Date.now(),
            benefitType: "EMPLOYER_PF",
            payType: "FIXED",
            calculationType: "PERCENT_OF_BASIC",
            value: 12,
            isActive: true
        });

        await testBenefit.save();
        console.log('✅ Successfully saved Employer PF benefit document');

        // Cleanup
        await Benefit.deleteOne({ _id: testBenefit._id });
        console.log('✅ Cleanup successful');

        await mongoose.disconnect();
        console.log('\nFinal Verification Complete');
    } catch (err) {
        console.error('❌ Verification failed:', err);
        process.exit(1);
    }
}

verify();
