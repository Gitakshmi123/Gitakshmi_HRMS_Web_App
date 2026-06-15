const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function listAll() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');
        const LeavePolicies = db.collection('leavepolicies');

        const all = await LeavePolicies.find({}).toArray();

        console.log(`Total Policies in DB: ${all.length}`);
        all.forEach(p => {
            console.log(`- [${p._id}] Name: ${p.name || p.policyName} | Rules: ${p.rules?.length || 0} | Tenant: ${p.tenant} (${typeof p.tenant})`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listAll();
