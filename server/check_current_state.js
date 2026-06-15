const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function checkCurrentState() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');

        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');
        const LeaveBalances = db.collection('leavebalances');
        const AttendanceSettings = db.collection('attendancesettings');

        const emp = await Employees.findOne({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }]
        });

        if (!emp) {
            console.log('User not found');
            return;
        }

        const settings = await AttendanceSettings.findOne({ tenant: emp.tenant });
        const startMonth = settings?.leaveCycleStartMonth || 0;
        const now = new Date();
        let year = now.getFullYear();
        if (now.getMonth() < startMonth) year--;

        const policy = await LeavePolicies.findOne({ _id: emp.leavePolicy });
        const balances = await LeaveBalances.find({ employee: emp._id, year: year }).toArray();

        const result = {
            employee: {
                name: `${emp.firstName} ${emp.lastName}`,
                leavePolicyId: emp.leavePolicy,
                tenant: emp.tenant
            },
            settings: {
                leaveCycleStartMonth: startMonth
            },
            calculatedYear: year,
            policy: {
                id: policy?._id,
                name: policy?.name,
                rulesCount: policy?.rules?.length || 0,
                rules: policy?.rules
            },
            balances: balances.map(b => ({
                leaveType: b.leaveType,
                year: b.year,
                available: b.available,
                total: b.total
            }))
        };

        fs.writeFileSync('current_state_report.json', JSON.stringify(result, null, 2));
        console.log('Report saved to current_state_report.json');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkCurrentState();
