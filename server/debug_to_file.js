const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function debugToFile() {
    const report = {
        timestamp: new Date().toISOString(),
        errors: [],
        data: {}
    };

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
            report.errors.push('User not found');
        } else {
            report.data.employee = {
                id: emp._id,
                name: `${emp.firstName} ${emp.lastName}`,
                tenant: emp.tenant,
                leavePolicy: emp.leavePolicy
            };

            // 2. Settings
            const settings = await AttendanceSettings.findOne({ tenant: emp.tenant });
            report.data.settings = settings;

            const startMonth = settings?.leaveCycleStartMonth || 0;
            const now = new Date();
            let year = now.getFullYear();
            if (now.getMonth() < startMonth) year--;
            report.data.calculatedYear = year;

            // 3. Policy
            if (emp.leavePolicy) {
                const policy = await LeavePolicies.findOne({ _id: emp.leavePolicy });
                report.data.policy = policy;
            }

            // 4. Balances
            const balances = await LeaveBalances.find({ employee: emp._id }).toArray();
            report.data.balances = balances;

            // 5. Requests
            const requests = await LeaveRequests.find({ employee: emp._id }).toArray();
            report.data.requests = requests;
        }

    } catch (err) {
        report.errors.push(err.message);
    } finally {
        fs.writeFileSync('debug_report.json', JSON.stringify(report, null, 2));
        await mongoose.disconnect();
    }
}

debugToFile();
