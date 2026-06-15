const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function nukeFix() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');

        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');
        const LeaveBalances = db.collection('leavebalances');

        // 1. Find the exact employee
        const harsh = await Employees.findOne({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }]
        });

        if (!harsh) {
            console.error('❌ Harsh Shah not found');
            return;
        }

        console.log(`Found Employee: ${harsh.firstName} ${harsh.lastName} [${harsh._id}]`);
        console.log(`Tenant: ${harsh.tenant}`);
        console.log(`Policy: ${harsh.leavePolicy}`);

        // 2. Get the policy rules
        if (!harsh.leavePolicy) {
            console.error('❌ No leavePolicy assigned to Harsh! Please assign one in HR portal.');
            return;
        }

        const policy = await LeavePolicies.findOne({ _id: harsh.leavePolicy });
        if (!policy || !policy.rules || policy.rules.length === 0) {
            console.error('❌ Policy found but has NO rules. Reparing policy first...');
            const defaultRules = [
                { leaveType: 'CL', totalPerYear: 12, monthlyAccrual: false, requiresApproval: true, color: '#10b981' },
                { leaveType: 'SL', totalPerYear: 10, monthlyAccrual: false, requiresApproval: true, color: '#ef4444' }
            ];
            await LeavePolicies.updateOne({ _id: harsh.leavePolicy }, { $set: { rules: defaultRules } });
            console.log('✅ Policy rules repaired.');
            // Refresh policy object
            policy.rules = defaultRules;
        }

        // 3. Force create balances for 2025 AND 2026
        const years = [2025, 2026];

        for (const year of years) {
            console.log(`--- Processing Year ${year} ---`);
            for (const rule of policy.rules) {
                // Check if already exists
                const existing = await LeaveBalances.findOne({
                    employee: harsh._id,
                    leaveType: rule.leaveType,
                    year: year
                });

                if (existing) {
                    console.log(`Balance for ${rule.leaveType} already exists for ${year}. Updating...`);
                    await LeaveBalances.updateOne(
                        { _id: existing._id },
                        {
                            $set: {
                                total: rule.totalPerYear,
                                tenant: harsh.tenant // Ensure tenant is correct
                            }
                        }
                    );
                } else {
                    console.log(`Creating NEW balance for ${rule.leaveType} (${year})`);
                    await LeaveBalances.insertOne({
                        tenant: harsh.tenant,
                        employee: harsh._id,
                        policy: harsh.leavePolicy,
                        leaveType: rule.leaveType,
                        year: year,
                        total: rule.totalPerYear,
                        used: 0,
                        pending: 0,
                        available: rule.totalPerYear,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            }
        }

        console.log('✅ SUCCESS: All balances for Harsh Shah have been forcefully created/updated.');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

nukeFix();
