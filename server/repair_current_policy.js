const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function repairCurrentPolicy() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');
        const LeavePolicies = db.collection('leavepolicies');

        const policyId = '696dd420cab29ac7a1309837'; // From current_state_report
        const targetPolicy = await LeavePolicies.findOne({ _id: new mongoose.Types.ObjectId(policyId) });

        if (!targetPolicy) {
            console.error(`❌ Policy ID "${policyId}" not found!`);
            return;
        }

        console.log(`Found Policy: ${targetPolicy.name} [${targetPolicy._id}]`);

        const defaultRules = [
            {
                leaveType: 'CL',
                totalPerYear: 12,
                monthlyAccrual: false,
                carryForwardAllowed: true,
                maxCarryForward: 5,
                requiresApproval: true,
                allowDuringProbation: false,
                color: '#10b981' // Green
            },
            {
                leaveType: 'SL',
                totalPerYear: 10,
                monthlyAccrual: false,
                carryForwardAllowed: false,
                maxCarryForward: 0,
                requiresApproval: true,
                allowDuringProbation: true,
                color: '#ef4444' // Red
            }
        ];

        console.log(`Adding ${defaultRules.length} rules to policy...`);

        await LeavePolicies.updateOne(
            { _id: targetPolicy._id },
            { $set: { rules: defaultRules } }
        );

        console.log('✅ SUCCESS: Current Policy Rules updated.');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

repairCurrentPolicy();
