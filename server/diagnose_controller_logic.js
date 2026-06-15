const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function diagnose() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');

        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');
        const LeaveBalances = db.collection('leavebalances');
        const AttendanceSettings = db.collection('attendancesettings');

        // 1. Find Harsh
        const emp = await Employees.findOne({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }]
        });

        if (!emp) {
            console.log('User not found');
            return;
        }

        console.log(`\n--- User Info ---`);
        console.log(`User: ${emp.firstName} ${emp.lastName}`);
        console.log(`ID: ${emp._id}`);
        console.log(`Tenant: ${emp.tenant}`);
        console.log(`Leave Policy ID: ${emp.leavePolicy} (${typeof emp.leavePolicy})`);

        // 2. Settings & Year
        const settings = await AttendanceSettings.findOne({ tenant: emp.tenant });
        console.log(`\n--- Settings ---`);
        const startMonth = settings?.leaveCycleStartMonth || 0;
        console.log(`Leave Cycle Start Month: ${startMonth}`);

        const now = new Date();
        let year = now.getFullYear();
        if (now.getMonth() < startMonth) year--;
        console.log(`Calculated Leave Year: ${year}`);

        // 3. Check Policy
        let policy = null;
        if (emp.leavePolicy) {
            policy = await LeavePolicies.findOne({ _id: emp.leavePolicy });
            console.log(`\n--- Policy Info ---`);
            if (policy) {
                console.log(`Policy Found: ${policy.policyName}`);
                console.log(`Rules:`, policy.rules);
            } else {
                console.log('CRITICAL: Policy document NOT found for the ID in employee record.');
            }
        } else {
            console.log('\nCRITICAL: No Leave Policy ID in employee record.');
        }

        // 4. Check Balances
        const balances = await LeaveBalances.find({
            employee: emp._id,
            // tenant: emp.tenant, // The controller uses req.tenantId, let's assume it matches emp.tenant
            year: year
        }).toArray();

        console.log(`\n--- Existing Balances (Year ${year}) ---`);
        console.log(`Count: ${balances.length}`);
        balances.forEach(b => console.log(`- ${b.leaveType}: ${b.available}/${b.total}`));

        // 5. Simulate Auto-Heal decision
        if (balances.length === 0) {
            console.log(`\n[SIMULATION] Controller would trigger Auto-Heal...`);
            if (policy && policy.rules) {
                console.log(`[SIMULATION] Would create ${policy.rules.length} balances.`);
            } else {
                console.log(`[SIMULATION] Failed: No policy or rules to generate from.`);
            }
        } else {
            // My new logic checks for MISSING rules, not just if length === 0
            console.log(`\n[SIMULATION] Controller would check for missing rules...`);
            if (policy && policy.rules) {
                policy.rules.forEach(rule => {
                    const exists = balances.find(b => b.leaveType === rule.leaveType);
                    if (!exists) {
                        console.log(`[SIMULATION] Would create missing balance for: ${rule.leaveType}`);
                    } else {
                        console.log(`[SIMULATION] Balance exists for: ${rule.leaveType}`);
                    }
                });
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
