const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Migration Script: Update Existing Salary Snapshots
 * 
 * This script updates all existing applicants with salary structures
 * to include the new complete snapshot format with totals.
 * 
 * Safe to run multiple times (idempotent).
 */

async function migrateSalarySnapshots() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔄 SALARY SNAPSHOT MIGRATION\n');
        console.log('='.repeat(60));

        const db = mongoose.connection.useDb('company_695c98181a01d447895992ff');

        const Applicant = db.model('Applicant', require('./models/Applicant'));
        const SalaryStructure = db.model('SalaryStructure', require('./models/SalaryStructure'));

        // Find all salary structures
        const structures = await SalaryStructure.find({});
        console.log(`\nFound ${structures.length} salary structures to process\n`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const struct of structures) {
            try {
                const applicant = await Applicant.findById(struct.candidateId);

                if (!applicant) {
                    console.log(`⚠️  Skipped: No applicant found for structure ${struct._id}`);
                    skipped++;
                    continue;
                }

                // Check if already has new format
                if (applicant.salarySnapshot?.totals?.annualCTC) {
                    console.log(`✓ Skipped: ${applicant.name} - already has new format`);
                    skipped++;
                    continue;
                }

                // Build new snapshot
                const snapshot = {
                    earnings: struct.earnings.map(e => ({
                        name: e.label,
                        monthlyAmount: e.monthly,
                        annualAmount: e.yearly
                    })),
                    employeeDeductions: struct.deductions.map(d => ({
                        name: d.label,
                        monthlyAmount: d.monthly,
                        annualAmount: d.yearly
                    })),
                    employerContributions: struct.employerBenefits.map(b => ({
                        name: b.label,
                        monthlyAmount: b.monthly,
                        annualAmount: b.yearly
                    })),
                    grossA: {
                        monthly: struct.totals.grossEarnings,
                        yearly: struct.totals.grossEarnings * 12
                    },
                    takeHome: {
                        monthly: struct.totals.netSalary,
                        yearly: struct.totals.netSalary * 12
                    },
                    ctc: {
                        monthly: struct.totals.monthlyCTC,
                        yearly: struct.totals.annualCTC
                    },
                    totals: {
                        grossEarnings: struct.totals.grossEarnings,
                        totalDeductions: struct.totals.totalDeductions,
                        netSalary: struct.totals.netSalary,
                        employerBenefits: struct.totals.employerBenefits,
                        monthlyCTC: struct.totals.monthlyCTC,
                        annualCTC: struct.totals.annualCTC
                    },
                    calculatedAt: new Date()
                };

                // Update applicant
                await Applicant.findByIdAndUpdate(struct.candidateId, {
                    $set: {
                        salarySnapshot: snapshot,
                        salaryStructureId: struct._id,
                        ctc: struct.totals.annualCTC
                    }
                });

                console.log(`✅ Updated: ${applicant.name} - CTC: ₹${struct.totals.annualCTC.toLocaleString()}`);
                updated++;

            } catch (error) {
                console.error(`❌ Error processing structure ${struct._id}:`, error.message);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n📊 MIGRATION SUMMARY:');
        console.log(`  ✅ Updated: ${updated}`);
        console.log(`  ⏭️  Skipped: ${skipped}`);
        console.log(`  ❌ Errors: ${errors}`);
        console.log(`  📝 Total: ${structures.length}`);

        if (errors === 0) {
            console.log('\n🎉 Migration completed successfully!');
        } else {
            console.log('\n⚠️  Migration completed with some errors. Please review above.');
        }

        console.log('\n💡 Next steps:');
        console.log('  1. Run verify_salary_fix.js to confirm all data is correct');
        console.log('  2. Test joining letter generation for a few applicants');
        console.log('  3. If all looks good, you\'re ready for production!\n');

        process.exit(errors > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n❌ MIGRATION FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration
console.log('⚠️  WARNING: This will update salary snapshots for all applicants.');
console.log('This is safe to run and will not delete any data.\n');

setTimeout(() => {
    migrateSalarySnapshots();
}, 2000);
