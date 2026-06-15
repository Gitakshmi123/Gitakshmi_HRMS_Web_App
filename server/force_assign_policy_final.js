const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms'; // The base URI might be hrms, but we switch DB.

async function forceAssignFinal() {
    try {
        console.log('Connecting to:', MONGO_URI);
        await mongoose.connect(MONGO_URI);

        // SWITCH TO THE CORRECT DB
        const db = mongoose.connection.useDb('hrms_tenants_data');
        console.log('Switched to DB: hrms_tenants_data');

        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');

        // 1. Find User
        const harsh = await Employees.findOne({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }]
        });

        if (!harsh) {
            console.error('CRITICAL: User "Harsh Shah" NOT found in hrms_tenants_data.');
            // Fallback: list top 5 users to see who is there
            const all = await Employees.find({}).limit(5).toArray();
            console.log('Sample Users found:', all.map(u => `${u.firstName} ${u.lastName}`));
            return;
        }

        console.log(`Found User: ${harsh.firstName} ${harsh.lastName} (ID: ${harsh._id})`);
        console.log(`Tenant: ${harsh.tenant}`);
        console.log(`Current Policy: ${harsh.leavePolicy}`);

        // 2. Find ANY Policy for this tenant
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
            console.log('User already has a policy assigned.');
            // Verify validity
            const exists = policies.find(p => p._id.toString() === harsh.leavePolicy.toString());
            if (!exists) {
                console.log('WARNING: Assigned policy ID does NOT match any existing policy for this tenant. Repairing...');
                const targetPolicy = policies[0];
                await Employees.updateOne(
                    { _id: harsh._id },
                    { $set: { leavePolicy: targetPolicy._id } }
                );
                console.log(`REPAIRED: Replaced invalid policy with "${targetPolicy.policyName}"`);
            } else {
                console.log('Policy ID is valid.');
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

forceAssignFinal();
