/**
 * ============================================
 * MIGRATION SCRIPT: Salary Snapshot to CTC Versions
 * ============================================
 * 
 * This script migrates existing salary data from salarySnapshotId
 * to EmployeeCtcVersion records, creating version 1 for each employee.
 * 
 * Run this ONCE to initialize the salary versioning system.
 * 
 * Usage:
 * node server/scripts/migrate-salary-to-ctc-versions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function migrateSalaryData() {
    try {
        console.log('🚀 Starting salary migration...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB\n');

        // Get list of tenant databases
        const adminDb = mongoose.connection.db.admin();
        const { databases } = await adminDb.listDatabases();

        const tenantDbs = databases.filter(db =>
            db.name.startsWith('tenant_') || db.name.includes('hrms')
        );

        console.log(`Found ${tenantDbs.length} tenant databases\n`);

        for (const dbInfo of tenantDbs) {
            const dbName = dbInfo.name;
            console.log(`\n📦 Processing database: ${dbName}`);

            const tenantDB = mongoose.connection.useDb(dbName);

            // Get models
            const Applicant = tenantDB.model('Applicant', require('../models/Applicant'));
            const EmployeeCtcVersion = tenantDB.model('EmployeeCtcVersion', require('../models/EmployeeCtcVersion'));
            const EmployeeSalarySnapshot = tenantDB.model('EmployeeSalarySnapshot', require('../models/EmployeeSalarySnapshot'));

            // Find all applicants with salary snapshots
            const applicants = await Applicant.find({
                salarySnapshotId: { $exists: true, $ne: null }
            }).populate('salarySnapshotId');

            console.log(`   Found ${applicants.length} applicants with salary data`);

            let migrated = 0;
            let skipped = 0;
            let errors = 0;

            for (const applicant of applicants) {
                try {
                    // Check if already has CTC version
                    const existingVersion = await EmployeeCtcVersion.findOne({
                        employeeId: applicant._id
                    });

                    if (existingVersion) {
                        console.log(`   ⏭️  Skipped ${applicant.firstName} ${applicant.lastName} - already has CTC version`);
                        skipped++;
                        continue;
                    }

                    const snapshot = applicant.salarySnapshotId;
                    if (!snapshot) {
                        console.log(`   ⚠️  Skipped ${applicant.firstName} ${applicant.lastName} - no salary snapshot`);
                        skipped++;
                        continue;
                    }

                    // Extract salary data from snapshot
                    const totalCTC = snapshot.ctc || 0;
                    const monthlyCTC = snapshot.monthlyCTC || 0;

                    // Calculate Gross A, B, C from snapshot
                    // Gross A = Monthly earnings
                    // Gross B = Annual benefits (bonus, insurance, etc.)
                    // Gross C = Annual retention (gratuity, PF, etc.)

                    const grossA = monthlyCTC || Math.round(totalCTC / 12 * 0.7);
                    const grossB = Math.round(totalCTC * 0.2);
                    const grossC = Math.round(totalCTC * 0.1);

                    // Create initial CTC version
                    const ctcVersion = new EmployeeCtcVersion({
                        companyId: applicant.tenant,
                        employeeId: applicant._id,
                        version: 1,
                        effectiveFrom: applicant.joiningDate || new Date(),
                        grossA,
                        grossB,
                        grossC,
                        totalCTC,
                        components: snapshot.breakdown?.components || [],
                        isActive: true,
                        status: 'ACTIVE',
                        createdBy: applicant.tenant // Use tenant ID as creator
                    });

                    await ctcVersion.save();

                    console.log(`   ✅ Migrated ${applicant.firstName} ${applicant.lastName} - CTC: ₹${totalCTC.toLocaleString('en-IN')}`);
                    migrated++;

                } catch (error) {
                    console.error(`   ❌ Error migrating ${applicant.firstName} ${applicant.lastName}:`, error.message);
                    errors++;
                }
            }

            console.log(`\n   Summary for ${dbName}:`);
            console.log(`   ✅ Migrated: ${migrated}`);
            console.log(`   ⏭️  Skipped: ${skipped}`);
            console.log(`   ❌ Errors: ${errors}`);
        }

        console.log('\n\n🎉 Migration completed!');
        console.log('\nYou can now use the salary increment feature.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run migration
migrateSalaryData();
