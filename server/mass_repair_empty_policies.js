const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function massRepair() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');
        const LeavePolicies = db.collection('leavepolicies');

        const tenantId = '696b2e33265b093e28c2419b';
        const emptyPolicies = await LeavePolicies.find({
            tenant: new mongoose.Types.ObjectId(tenantId),
            $or: [
                { rules: { $exists: false } },
                { rules: { $size: 0 } }
            ]
        }).toArray();

        console.log(`Found ${emptyPolicies.length} empty policies for tenant ${tenantId}`);

        const defaultRules = [
            {
                leaveType: 'CL',
                totalPerYear: 12,
                monthlyAccrual: false,
                requiresApproval: true,
                color: '#10b981'
            },
            {
                leaveType: 'SL',
                totalPerYear: 10,
                monthlyAccrual: false,
                requiresApproval: true,
                color: '#ef4444'
            }
        ];

        for (const p of emptyPolicies) {
            console.log(`Repairing Policy: ${p.name || p.policyName} [${p._id}]`);
            await LeavePolicies.updateOne(
                { _id: p._id },
                { $set: { rules: defaultRules } }
            );
        }

        console.log('✅ SUCCESS: All empty policies repaired.');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

massRepair();
