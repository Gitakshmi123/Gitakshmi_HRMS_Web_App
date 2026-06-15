const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function verify() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');

        // Mocking the getModels result
        const Employee = db.model("Employee", require('./models/Employee'));
        const LeaveBalance = db.model("LeaveBalance", require('./models/LeaveBalance'));
        const LeavePolicy = db.model("LeavePolicy", require('./models/LeavePolicy'));
        const AttendanceSettings = db.model("AttendanceSettings", require('./models/AttendanceSettings'));

        const employeeId = '696b308d265b093e28c2430c';
        const tenantId = '696b2e33265b093e28c2419b';

        // --- START REPLICATING CONTROLLER LOGIC ---
        const settings = await AttendanceSettings.findOne({ tenant: tenantId });
        const startMonth = settings?.leaveCycleStartMonth || 0;

        const now = new Date();
        let year = now.getFullYear();
        if (now.getMonth() < startMonth) year--;

        let emp = await Employee.findById(employeeId).select('leavePolicy tenant');
        if (!emp) throw new Error("Employee not found");

        const effectiveTenantId = emp.tenant || tenantId;

        let balances = await LeaveBalance.find({
            employee: employeeId,
            tenant: effectiveTenantId,
            year
        }).lean();

        // Auto-heal logic
        if (emp.leavePolicy) {
            const policy = await LeavePolicy.findOne({ _id: emp.leavePolicy, tenant: effectiveTenantId });
            if (policy && policy.rules) {
                for (const rule of policy.rules) {
                    const exists = balances.find(b => b.leaveType === rule.leaveType);
                    if (!exists) {
                        // Create... (already done by my scripts)
                    }
                }
            }
        }
        // --- END REPLICATING CONTROLLER LOGIC ---

        fs.writeFileSync('api_response_simulation.json', JSON.stringify({
            requestContext: { employeeId, tenantId, year },
            response: balances
        }, null, 2));

        console.log(`Simulation complete. Found ${balances.length} balances for year ${year}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
