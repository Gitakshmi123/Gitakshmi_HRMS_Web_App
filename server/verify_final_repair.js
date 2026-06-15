const mongoose = require('mongoose');

// Define Schemas manually to avoid dbManager conflicts in script
const LeavePolicySchema = new mongoose.Schema({
    tenant: mongoose.Schema.Types.ObjectId,
    name: String,
    applicableTo: String,
    isActive: Boolean,
    rules: Array
});

const EmployeeSchema = new mongoose.Schema({
    tenant: mongoose.Schema.Types.ObjectId,
    firstName: String,
    lastName: String,
    leavePolicy: { type: mongoose.Schema.Types.ObjectId, ref: 'LeavePolicy' },
    employeeId: String
});

const AttendanceSettingsSchema = new mongoose.Schema({
    tenant: mongoose.Schema.Types.ObjectId,
    leaveCycleStartMonth: { type: Number, default: 0 }
});

const LeaveBalanceSchema = new mongoose.Schema({
    tenant: mongoose.Schema.Types.ObjectId,
    employee: mongoose.Schema.Types.ObjectId,
    leaveType: String,
    year: Number,
    total: Number,
    available: Number
});

async function run() {
    try {
        const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);

        const db = mongoose.connection.useDb('hrms_tenants_data');
        const Employee = db.model('Employee', EmployeeSchema);
        const LeavePolicy = db.model('LeavePolicy', LeavePolicySchema);
        const LeaveBalance = db.model('LeaveBalance', LeaveBalanceSchema);
        const AttendanceSettings = db.model('AttendanceSettings', AttendanceSettingsSchema);

        const harsh = await Employee.findOne({ firstName: 'Harsh' });
        if (!harsh) {
            console.log(JSON.stringify({ error: 'Harsh Shah not found' }));
            process.exit(0);
        }

        const settings = await AttendanceSettings.findOne({ tenant: harsh.tenant });
        const startMonth = settings?.leaveCycleStartMonth || 0;

        const now = new Date();
        let year = now.getFullYear();
        if (now.getMonth() < startMonth) year--;

        const policies = await LeavePolicy.find({ tenant: harsh.tenant });
        const globalPolicy = await LeavePolicy.findOne({
            tenant: harsh.tenant,
            applicableTo: 'All',
            isActive: true
        }).sort({ createdAt: -1 });

        const balances = await LeaveBalance.find({ employee: harsh._id, year });
        const allBalances = await LeaveBalance.find({ employee: harsh._id });

        const result = {
            serverTime: now.toISOString(),
            calculatedYear: year,
            attendanceSettings: {
                startMonth
            },
            employee: {
                id: harsh._id,
                name: `${harsh.firstName} ${harsh.lastName}`,
                tenant: harsh.tenant,
                leavePolicy: harsh.leavePolicy
            },
            policies: policies.map(p => ({
                id: p._id,
                name: p.name,
                applicableTo: p.applicableTo,
                isActive: p.isActive,
                rulesCount: p.rules?.length || 0,
                rules: p.rules
            })),
            globalPolicy: globalPolicy ? {
                id: globalPolicy._id,
                name: globalPolicy.name
            } : null,
            balancesForCalculatedYear: balances.map(b => ({
                type: b.leaveType,
                total: b.total,
                available: b.available
            })),
            allBalancesCount: allBalances.length,
            allBalances: allBalances.map(b => ({
                year: b.year,
                type: b.leaveType
            }))
        };

        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (err) {
        console.log(JSON.stringify({ error: err.message }));
        process.exit(1);
    }
}

run();
