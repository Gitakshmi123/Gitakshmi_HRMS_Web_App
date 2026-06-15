/**
 * Check if employees have salary snapshots that can be migrated to EmployeeCompensation
 */

const mongoose = require('mongoose');
require('dotenv').config();

const EmployeeSchema = require('./models/Employee');
const EmployeeSalarySnapshotSchema = require('./models/EmployeeSalarySnapshot');

async function checkSalarySnapshots() {
    try {
        console.log(`🔗 Connecting to MongoDB...`);
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected\n`);

        const adminDb = mongoose.connection.getClient().db('admin');
        const dbList = await adminDb.admin().listDatabases();

        const tenantDbs = dbList.databases
            .filter(db => db.name.startsWith('company_'))
            .map(db => db.name);

        for (const dbName of tenantDbs) {
            const tenantDb = mongoose.connection.useDb(dbName, { useCache: false });
            const Employee = tenantDb.model('Employee', EmployeeSchema);
            const SalarySnapshot = tenantDb.model('EmployeeSalarySnapshot', EmployeeSalarySnapshotSchema);

            const employees = await Employee.find({ status: 'Active' })
                .populate('salarySnapshotId')
                .lean();

            if (employees.length === 0) continue;

            console.log(`\n🏢 ${dbName}`);
            console.log(`👥 ${employees.length} active employees\n`);

            for (const emp of employees) {
                console.log(`   ${emp.firstName} ${emp.lastName}:`);
                if (emp.salarySnapshotId) {
                    console.log(`      ✅ Has salarySnapshot (CTC: ₹${emp.salarySnapshotId.annualCTC || 0})`);
                    console.log(`         Earnings: ${emp.salarySnapshotId.earnings?.length || 0} components`);
                } else {
                    console.log(`      ❌ No salarySnapshot`);
                }
            }
        }

        console.log(`\n✅ Done`);
        process.exit(0);

    } catch (error) {
        console.error(`❌ Error:`, error.message);
        process.exit(1);
    }
}

checkSalarySnapshots();
