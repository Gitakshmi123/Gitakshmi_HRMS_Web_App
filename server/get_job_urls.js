const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    console.log('\n📋 YOUR PUBLIC JOB LISTING URLS:\n');
    console.log('='.repeat(60));

    for (const tenant of tenants) {
        console.log(`\n🏢 Company: ${tenant.name}`);
        console.log(`   Tenant ID: ${tenant._id}`);

        if (tenant.companyCode) {
            console.log(`\n   ✅ Public URL (Company Code):`);
            console.log(`   http://localhost:5173/jobs/${tenant.companyCode}`);
        }

        console.log(`\n   ✅ Public URL (Tenant ID):`);
        console.log(`   http://localhost:5173/jobs?tenantId=${tenant._id}`);
        console.log('\n' + '-'.repeat(60));
    }

    console.log('\n💡 Share these URLs with candidates to view job openings!\n');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
