const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function listPolicies() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');
        const LeavePolicies = db.collection('leavepolicies');

        const tenantId = '696b2e33265b093e28c2419b'; // From debug_report
        const policies = await LeavePolicies.find({ tenant: tenantId }).toArray();

        console.log(`Found ${policies.length} policies:`);
        policies.forEach(p => {
            console.log(`- [${p._id}] Name: ${p.name || p.policyName} | Rules Count: ${p.rules?.length || 0}`);
            if (p.rules?.length > 0) {
                p.rules.forEach(r => console.log(`  * ${r.leaveType}: ${r.totalPerYear}`));
            }
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listPolicies();
