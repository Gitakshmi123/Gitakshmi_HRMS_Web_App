const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

// [DNS-FIX]: Force Google DNS and IPv4 for Atlas SRV resolution issues
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (e) {
    console.warn('⚠️ DNS override failed:', e.message);
}

// Configure environment / database
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms'; // fallback

async function run() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const EmployeeSchema = new mongoose.Schema({}, { strict: false });
        const LeavePolicySchema = new mongoose.Schema({}, { strict: false });
        const GradeSchema = new mongoose.Schema({}, { strict: false });

        const conn = mongoose.createConnection(`${mongoUri.split('?')[0].replace(/\/([^\/]*)$/, '')}/company_gitakshmi_te_git002_f5c2a410`);
        await conn.asPromise();

        const Employee = conn.model('Employee', EmployeeSchema);
        const LeavePolicy = conn.model('LeavePolicy', LeavePolicySchema);
        const Grade = conn.model('Grade', GradeSchema);

        const leaveManagementService = require('./services/leaveManagement.service');
        const gradeLeavePolicyService = require('./services/gradeLeavePolicy.service');

        const emp = await Employee.findOne({ employeeId: 'EMP-26-27-1000' });
        const policies = await LeavePolicy.find({}).lean();
        const tenantId = new mongoose.Types.ObjectId('6a0c43ab3245aa33f5c2a410');

        const resolvedGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
            employee: emp,
            Grade,
            tenantId,
            date: new Date()
        });

        console.log('Employee designation:', emp.designation, 'role:', emp.role, 'grade:', resolvedGrade?.code, 'tenant:', tenantId);

        console.log('\n--- Policies List ---');
        policies.forEach(p => {
            console.log(`- ${p.name} (ID: ${p._id}, Tenant: ${p.tenant}, Status: ${p.status}, Active: ${p.isActive})`);
        });

        const activePolicies = await leaveManagementService.getActiveLeavePolicies({ LeavePolicy, tenantId });
        console.log('\n--- Active Policies found in getActiveLeavePolicies ---');
        activePolicies.forEach(p => {
            console.log(`- ${p.name} (ID: ${p._id}, Tenant: ${p.tenant}, Status: ${p.status})`);
        });

        const sorted = leaveManagementService.sortPoliciesForEmployee(activePolicies);
        console.log('\n--- Active Policies sorted ---');
        sorted.forEach(p => {
            console.log(`- ${p.name} (Priority: ${leaveManagementService.getPolicyPriority(p)}, Updated: ${p.updatedAt})`);
        });

        const best = leaveManagementService.selectBestPolicyForEmployee({
            policies: activePolicies,
            employee: emp,
            grade: resolvedGrade
        });
        console.log('\nBest selected policy by service:', best?.name);

        conn.close();
    } catch (err) {
        console.error('Error running diagnostic:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
