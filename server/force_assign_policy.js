const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms_saas_db';

async function forceAssign() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const db = mongoose.connection.db;

        // Dynamic access to collections
        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');

        // 1. Find User
        const harsh = await Employees.findOne({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }]
        });

        if (!harsh) {
            console.error('CRITICAL: User "Harsh Shah" not found!');
            return;
        }

        console.log(`Found User: ${harsh.firstName} ${harsh.lastName} (ID: ${harsh._id})`);
        console.log(`Current Policy: ${harsh.leavePolicy}`);

        // 2. Find ANY Policy for this tenant
        // Assuming tenant is stored on harsh object
        const policies = await LeavePolicies.find({ tenant: harsh.tenant }).toArray();
        console.log(`Found ${policies.length} policies for tenant ${harsh.tenant}`);

        if (policies.length === 0) {
            console.error('CRITICAL: No Leave Policies exist for this tenant. Please create one in HR Portal.');
            return;
        }

        // 3. Logic: If no policy assigned, assign the first one.
        if (!harsh.leavePolicy) {
            const targetPolicy = policies[0];
            console.log(`Assigning Policy: "${targetPolicy.policyName}" (${targetPolicy._id}) to Harsh...`);

            await Employees.updateOne(
                { _id: harsh._id },
                { $set: { leavePolicy: targetPolicy._id } }
            );
            console.log('SUCCESS: Policy Assigned.');
        } else {
            console.log('User already has a policy. No action taken by FORCE script (Auto-Heal should handle balances).');
            // Just in case, verify the policy ID exists
            const exists = policies.find(p => p._id.toString() === harsh.leavePolicy.toString());
            if (!exists) {
                console.log('WARNING: Assigned policy ID does NOT match any existing policy. Repairing...');
                const targetPolicy = policies[0];
                await Employees.updateOne(
                    { _id: harsh._id },
                    { $set: { leavePolicy: targetPolicy._id } }
                );
                console.log(`REPAIRED: Replaced invalid policy with "${targetPolicy.policyName}"`);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

forceAssign();
