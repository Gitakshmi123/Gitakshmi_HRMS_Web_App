const mongoose = require('mongoose');
const { getTenantDB, ensureLeavePolicy } = require('./config/dbManager');

async function run() {
    try {
        const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const Tenant = require('./models/Tenant');
        const allTenants = await Tenant.find();

        for (const t of allTenants) {
            console.log(`\nProcessing Tenant: ${t.companyName} (${t._id})`);
            const db = getTenantDB(t._id.toString());
            const Employee = db.model('Employee');
            const LeavePolicy = db.model('LeavePolicy');
            const LeaveBalance = db.model('LeaveBalance');

            const employees = await Employee.find({ tenant: t._id });
            console.log(`Found ${employees.length} employees`);

            for (const emp of employees) {
                // Force a re-assignment using the new logic (only policies with rules)
                // We'll unset it first to trigger the 'missing policy' logic
                emp.leavePolicy = null;
                const fixedEmp = await ensureLeavePolicy(emp, db);

                if (fixedEmp && fixedEmp.leavePolicy) {
                    console.log(`✓ Fixed ${emp.firstName} ${emp.lastName} -> Assigned policy: ${fixedEmp.leavePolicy.name || fixedEmp.leavePolicy}`);

                    // Trigger balance sync
                    const year = 2026;
                    const policy = await LeavePolicy.findById(fixedEmp.leavePolicy._id || fixedEmp.leavePolicy);
                    if (policy && policy.rules) {
                        for (const rule of policy.rules) {
                            const existing = await LeaveBalance.findOne({ employee: emp._id, leaveType: rule.leaveType, year });
                            if (!existing) {
                                await new LeaveBalance({
                                    tenant: t._id,
                                    employee: emp._id,
                                    policy: policy._id,
                                    leaveType: rule.leaveType,
                                    year,
                                    total: rule.totalPerYear,
                                    available: rule.totalPerYear
                                }).save();
                                console.log(`   - Created ${rule.leaveType} balance`);
                            }
                        }
                    }
                } else {
                    console.log(`! No suitable global policy for ${emp.firstName}`);
                }
            }
        }

        console.log('\n--- Healing Finished ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
