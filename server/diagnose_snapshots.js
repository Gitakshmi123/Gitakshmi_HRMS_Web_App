const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    try {
        console.log('Connecting to MongoDB...', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // Since it's multi-tenant, we need to know the tenant ID.
        // Let's find all tenants first.
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ name: String }));
        const tenants = await Tenant.find();
        console.log('Tenants:', tenants.map(t => ({ id: t._id, name: t.name })));

        for (const tenant of tenants) {
            console.log(`\n--- Checking Tenant: ${tenant.name} (${tenant._id}) ---`);
            const dbName = `tenant_${tenant._id}`;
            const tenantDB = mongoose.connection.useDb(dbName);

            const EmployeeSchema = require('../models/Employee');
            const Employee = tenantDB.model('Employee', EmployeeSchema);

            const SnapshotSchema = require('../models/EmployeeSalarySnapshot');
            const Snapshot = tenantDB.model('EmployeeSalarySnapshot', SnapshotSchema);

            const employees = await Employee.find({ $or: [{ firstName: /Dhruv/i }, { lastName: /Raval/i }] });
            console.log(`Found ${employees.length} employees like 'Dhruv Raval':`);

            for (const emp of employees) {
                console.log(`Employee: ${emp.firstName} ${emp.lastName} (${emp._id})`);
                console.log(`- currentSalarySnapshotId: ${emp.currentSalarySnapshotId}`);
                console.log(`- salarySnapshotId: ${emp.salarySnapshotId}`);
                console.log(`- salarySnapshots count: ${emp.salarySnapshots?.length}`);

                const snaps = await Snapshot.find({ employee: emp._id });
                console.log(`- Direct snapshots found: ${snaps.length}`);
                snaps.forEach(s => console.log(`  - Snapshot: ${s._id}, CTC: ${s.ctc}, Created: ${s.createdAt}`));
            }

            const ApplicantSchema = require('../models/Applicant');
            const Applicant = tenantDB.model('Applicant', ApplicantSchema);
            const applicants = await Applicant.find({ name: /Dhruv/i });
            console.log(`Found ${applicants.length} applicants like 'Dhruv':`);
            for (const app of applicants) {
                console.log(`Applicant: ${app.name} (${app._id})`);
                console.log(`- status: ${app.status}`);
                console.log(`- salarySnapshotId: ${app.salarySnapshotId}`);
                const snaps = await Snapshot.find({ applicant: app._id });
                console.log(`- Direct snapshots found: ${snaps.length}`);
            }
        }

    } catch (err) {
        console.error('Diagnostic error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
