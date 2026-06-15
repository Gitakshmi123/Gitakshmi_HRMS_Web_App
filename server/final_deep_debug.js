const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function deepDebug() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');

        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');
        const LeaveBalances = db.collection('leavebalances');
        const AttendanceSettings = db.collection('attendancesettings');
        const LeaveRequests = db.collection('leaverequests');

        // 1. Find User
        const emp = await Employees.findOne({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }]
        });

        if (!emp) {
            console.log('❌ User not found');
            return;
        }

        console.log(`\n--- [USER INFO] ---`);
        console.log(`Name: ${emp.firstName} ${emp.lastName}`);
        console.log(`ID: ${emp._id}`);
        console.log(`Tenant: ${emp.tenant}`);
        console.log(`LeavePolicy Ref: ${emp.leavePolicy}`);

        // 2. Settings
        const settings = await AttendanceSettings.findOne({ tenant: emp.tenant });
        console.log(`\n--- [SETTINGS] ---`);
        if (settings) {
            console.log(`Leave Cycle Start Month: ${settings.leaveCycleStartMonth}`);
        } else {
            console.log('⚠️ No AttendanceSettings found for this tenant.');
        }

        const startMonth = settings?.leaveCycleStartMonth || 0;
        const now = new Date();
        let year = now.getFullYear();
        if (now.getMonth() < startMonth) year--;
        console.log(`Current Calculated Leave Year: ${year}`);

        // 3. Policy
        if (emp.leavePolicy) {
            const policy = await LeavePolicies.findOne({ _id: emp.leavePolicy });
            console.log(`\n--- [POLICY] ---`);
            if (policy) {
                console.log(`Name: ${policy.policyName}`);
                console.log(`Rules: ${JSON.stringify(policy.rules)}`);
            } else {
                console.log(`❌ Policy ID ${emp.leavePolicy} NOT found in leavepolicies collection!`);
            }
        }

        // 4. Balances
        const allBalances = await LeaveBalances.find({ employee: emp._id }).toArray();
        console.log(`\n--- [ALL BALANCES] ---`);
        console.log(`Total Count: ${allBalances.length}`);
        allBalances.forEach(b => {
            console.log(`- Year: ${b.year} | Type: ${b.leaveType} | Available: ${b.available}/${b.total}`);
        });

        // 5. Requests
        const requests = await LeaveRequests.find({ employee: emp._id }).toArray();
        console.log(`\n--- [LEAVE REQUESTS] ---`);
        console.log(`Total Count: ${requests.length}`);
        requests.forEach(r => {
            console.log(`- Start: ${r.startDate.toISOString().split('T')[0]} | Type: ${r.leaveType} | Status: ${r.status}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

deepDebug();
