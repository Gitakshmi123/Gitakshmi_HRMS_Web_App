/**
 * Migration: Create EmployeeCompensation from SalarySnapshots
 * 
 * This script creates EmployeeCompensation records for employees
 * who have salarySnapshots but no EmployeeCompensation
 */

const mongoose = require('mongoose');
require('dotenv').config();

const EmployeeSchema = require('./models/Employee');
const EmployeeSalarySnapshotSchema = require('./models/EmployeeSalarySnapshot');
const EmployeeCompensationSchema = require('./models/EmployeeCompensation');

async function migrateSnapshotsToCompensation() {
    try {
        console.log(`🔗 Connecting to MongoDB...`);
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected\n`);

        const adminDb = mongoose.connection.getClient().db('admin');
        const dbList = await adminDb.admin().listDatabases();

        const tenantDbs = dbList.databases
            .filter(db => db.name.startsWith('company_'))
            .map(db => db.name);

        let totalCreated = 0;
        let totalSkipped = 0;

        for (const dbName of tenantDbs) {
            const tenantDb = mongoose.connection.useDb(dbName, { useCache: false });
            const Employee = tenantDb.model('Employee', EmployeeSchema);
            const SalarySnapshot = tenantDb.model('EmployeeSalarySnapshot', EmployeeSalarySnapshotSchema);
            const EmployeeCompensation = tenantDb.model('EmployeeCompensation', EmployeeCompensationSchema);

            const employees = await Employee.find({ status: 'Active' })
                .populate('salarySnapshotId')
                .lean();

            if (employees.length === 0) continue;

            console.log(`\n🏢 ${dbName}`);
            console.log(`👥 ${employees.length} active employees\n`);

            for (const emp of employees) {
                // Check if EmployeeCompensation already exists
                const existing = await EmployeeCompensation.findOne({
                    employeeId: emp._id,
                    isActive: true
                });

                if (existing) {
                    console.log(`   ⏭️  ${emp.firstName} ${emp.lastName}: Already has compensation`);
                    totalSkipped++;
                    continue;
                }

                // Check if employee has salarySnapshot
                if (!emp.salarySnapshotId || !emp.salarySnapshotId.earnings || emp.salarySnapshotId.earnings.length === 0) {
                    console.log(`   ⚠️  ${emp.firstName} ${emp.lastName}: No valid salarySnapshot`);
                    totalSkipped++;
                    continue;
                }

                const snapshot = emp.salarySnapshotId;

                // Convert snapshot to EmployeeCompensation format
                const components = [];

                // Add earnings
                if (snapshot.earnings) {
                    snapshot.earnings.forEach(earning => {
                        components.push({
                            name: earning.name || 'Unknown Earning',
                            code: earning.code || earning.name?.toLowerCase().replace(/\s+/g, '_'),
                            monthlyAmount: earning.monthlyAmount || 0,
                            annualAmount: earning.annualAmount || (earning.monthlyAmount * 12) || 0,
                            type: 'EARNING',
                            isTaxable: earning.taxable !== false,
                            isProRata: earning.proRata !== false
                        });
                    });
                }

                // Add employer deductions as benefits
                if (snapshot.employerDeductions) {
                    snapshot.employerDeductions.forEach(deduction => {
                        components.push({
                            name: deduction.name || 'Unknown Benefit',
                            code: deduction.code || deduction.name?.toLowerCase().replace(/\s+/g, '_'),
                            monthlyAmount: deduction.monthlyAmount || 0,
                            annualAmount: deduction.annualAmount || (deduction.monthlyAmount * 12) || 0,
                            type: 'BENEFIT',
                            isTaxable: false,
                            isProRata: false
                        });
                    });
                }

                // Calculate totals
                const totalEarnings = components
                    .filter(c => c.type === 'EARNING')
                    .reduce((sum, c) => sum + (c.annualAmount || 0), 0);

                const totalBenefits = components
                    .filter(c => c.type === 'BENEFIT')
                    .reduce((sum, c) => sum + (c.annualAmount || 0), 0);

                const totalCTC = snapshot.annualCTC || totalEarnings + totalBenefits;

                // Create EmployeeCompensation
                const compensation = await EmployeeCompensation.create({
                    companyId: emp.tenant,
                    employeeId: emp._id,
                    grossA: snapshot.grossA || 0,
                    grossB: snapshot.grossB || totalEarnings,
                    grossC: snapshot.grossC || totalBenefits,
                    totalCTC: totalCTC,
                    components: components,
                    isActive: true,
                    status: 'ACTIVE',
                    effectiveFrom: snapshot.effectiveFrom || emp.joiningDate || new Date()
                });

                console.log(`   ✅ ${emp.firstName} ${emp.lastName}: Created compensation (CTC: ₹${totalCTC}, ${components.length} components)`);
                totalCreated++;
            }
        }

        console.log(`\n═══════════════════════════════════════════════════════`);
        console.log(`📊 MIGRATION SUMMARY`);
        console.log(`═══════════════════════════════════════════════════════`);
        console.log(`✅ Created: ${totalCreated} EmployeeCompensation records`);
        console.log(`⏭️  Skipped: ${totalSkipped}`);
        console.log(`═══════════════════════════════════════════════════════\n`);

        console.log(`🎉 Migration complete!\n`);
        console.log(`NEXT STEPS:`);
        console.log(`  1. Run: node diagnose_compensation.js (to verify)`);
        console.log(`  2. Try running payroll again`);
        console.log(`  3. Check console logs for earnings data\n`);

        process.exit(0);

    } catch (error) {
        console.error(`❌ Error:`, error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

migrateSnapshotsToCompensation();
