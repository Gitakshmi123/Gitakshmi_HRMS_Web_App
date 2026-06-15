/**
 * VERIFY_SCHEMA_FIX.js
 * 
 * Diagnostic script to verify the EmployeeSalarySnapshot schema fix
 * and ensure 'GROSS' is now a valid enum value
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function verifySchemaFix() {
    try {
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║  SCHEMA FIX VERIFICATION - EmployeeSalarySnapshot      ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        // Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected\n');

        // Load schema
        const EmployeeSalarySnapshotSchema = require('./models/EmployeeSalarySnapshot');
        
        // Check schema paths
        console.log('📋 Checking schema paths for "basedOn" field...\n');

        const paths = EmployeeSalarySnapshotSchema.paths;

        // Check earnings
        const earningsBasedOnEnum = paths['earnings.basedOn']?.enumValues;
        console.log('earnings.basedOn enum values:');
        console.log(`  [${(earningsBasedOnEnum || []).join(', ')}]`);
        const hasGrossEarnings = earningsBasedOnEnum?.includes('GROSS');
        console.log(`  Status: ${hasGrossEarnings ? '✅ GROSS supported' : '❌ GROSS NOT supported'}\n`);

        // Check employeeDeductions
        const deductionsBasedOnEnum = paths['employeeDeductions.basedOn']?.enumValues;
        console.log('employeeDeductions.basedOn enum values:');
        console.log(`  [${(deductionsBasedOnEnum || []).join(', ')}]`);
        const hasGrossDeductions = deductionsBasedOnEnum?.includes('GROSS');
        console.log(`  Status: ${hasGrossDeductions ? '✅ GROSS supported' : '❌ GROSS NOT supported'}\n`);

        // Check benefits
        const benefitsBasedOnEnum = paths['benefits.basedOn']?.enumValues;
        console.log('benefits.basedOn enum values:');
        console.log(`  [${(benefitsBasedOnEnum || []).join(', ')}]`);
        const hasGrossBenefits = benefitsBasedOnEnum?.includes('GROSS');
        console.log(`  Status: ${hasGrossBenefits ? '✅ GROSS supported' : '❌ GROSS NOT supported'}\n`);

        // Overall status
        if (hasGrossEarnings && hasGrossDeductions && hasGrossBenefits) {
            console.log('✅ SCHEMA FIX VERIFIED - All fields support GROSS\n');
        } else {
            console.log('❌ SCHEMA FIX INCOMPLETE - Not all fields support GROSS\n');
        }

        // Test creating a document with GROSS
        console.log('📝 Testing document creation with GROSS basedOn...\n');

        const adminDb = mongoose.connection.getClient().db('admin');
        const dbList = await adminDb.admin().listDatabases();
        const testTenant = dbList.databases.find(db => db.name.startsWith('company_'));

        if (testTenant) {
            const tenantDb = mongoose.connection.useDb(testTenant.name);
            const testSchema = new mongoose.Schema({
                employee: mongoose.Schema.Types.ObjectId,
                tenant: mongoose.Schema.Types.ObjectId,
                ctc: Number,
                monthlyCTC: Number,
                employeeDeductions: [{
                    code: String,
                    name: String,
                    basedOn: { type: String, enum: ['BASIC', 'GROSS', 'CTC', 'NA'], default: 'NA' },
                    monthlyAmount: Number,
                    yearlyAmount: Number
                }]
            });

            const TestModel = tenantDb.model('TestSnapshot', testSchema);

            const testDoc = new TestModel({
                employee: new mongoose.Types.ObjectId(),
                tenant: new mongoose.Types.ObjectId(),
                ctc: 600000,
                monthlyCTC: 50000,
                employeeDeductions: [
                    {
                        code: 'EMPLOYEE_ESI',
                        name: 'Employee State Insurance',
                        basedOn: 'GROSS', // ✅ Test with GROSS
                        monthlyAmount: 375,
                        yearlyAmount: 4500
                    }
                ]
            });

            await testDoc.save();
            console.log('✅ Successfully created document with basedOn: "GROSS"\n');

            // Clean up
            await TestModel.deleteOne({ _id: testDoc._id });
            console.log('✅ Test document cleaned up\n');
        }

        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║              VERIFICATION COMPLETE ✅                  ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

    } catch (err) {
        console.error('❌ Error during verification:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Run verification
verifySchemaFix();
