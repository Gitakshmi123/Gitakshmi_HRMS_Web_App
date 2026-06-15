/**
 * Diagnostic Script: Check Employee Compensation Data
 * 
 * Checks if EmployeeCompensation exists for a specific employee
 * and displays the components to help debug payroll issues
 */

const mongoose = require('mongoose');
require('dotenv').config();

const EmployeeCompensationSchema = require('./models/EmployeeCompensation');
const EmployeeSchema = require('./models/Employee');

async function checkEmployeeCompensation() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI environment variable is not set');
        }

        console.log(`🔗 Connecting to MongoDB...`);
        await mongoose.connect(mongoUri);
        console.log(`✅ Connected to MongoDB\n`);

        // Get tenant database (assuming first tenant for now)
        const adminDb = mongoose.connection.getClient().db('admin');
        const dbList = await adminDb.admin().listDatabases();

        const tenantDatabases = dbList.databases
            .filter(db => db.name.startsWith('company_'))
            .map(db => db.name);

        if (tenantDatabases.length === 0) {
            console.log('❌ No tenant databases found');
            process.exit(1);
        }

        console.log(`📊 Found ${tenantDatabases.length} tenant database(s)\n`);

        // Check all tenant databases
        for (const tenantDbName of tenantDatabases) {
            console.log(`\n🏢 Checking tenant database: ${tenantDbName}`);

            const tenantDb = mongoose.connection.useDb(tenantDbName, { useCache: false });

            // Register models
            const Employee = tenantDb.model('Employee', EmployeeSchema);
            const EmployeeCompensation = tenantDb.model('EmployeeCompensation', EmployeeCompensationSchema);

            // Get all employees
            const employees = await Employee.find({ status: 'Active' })
                .select('firstName lastName employeeId email')
                .lean();

            console.log(`👥 Found ${employees.length} active employee(s)\n`);

            // Check each employee
            for (const emp of employees) {
                console.log(`═══════════════════════════════════════════════════════`);
                console.log(`👤 Employee: ${emp.firstName} ${emp.lastName}`);
                console.log(`   ID: ${emp._id}`);
                console.log(`   Employee Code: ${emp.employeeId || 'N/A'}`);
                console.log(`═══════════════════════════════════════════════════════`);

                // Check for EmployeeCompensation
                const compensation = await EmployeeCompensation.findOne({
                    employeeId: emp._id,
                    isActive: true,
                    status: 'ACTIVE'
                }).lean();

                if (!compensation) {
                    console.log(`❌ NO EmployeeCompensation found\n`);
                    continue;
                }

                console.log(`✅ EmployeeCompensation found:`);
                console.log(`   Total CTC: ₹${compensation.totalCTC || 0}`);
                console.log(`   Gross A: ₹${compensation.grossA || 0}`);
                console.log(`   Gross B: ₹${compensation.grossB || 0}`);
                console.log(`   Gross C: ₹${compensation.grossC || 0}`);
                console.log(`   Components: ${compensation.components?.length || 0}\n`);

                if (compensation.components && compensation.components.length > 0) {
                    console.log(`   📊 Components Breakdown:`);
                    compensation.components.forEach((comp, idx) => {
                        console.log(`      ${idx + 1}. ${comp.name || 'Unnamed'}`);
                        console.log(`         Type: ${comp.type || 'N/A'}`);
                        console.log(`         Monthly: ₹${comp.monthlyAmount || 0}`);
                        console.log(`         Annual: ₹${comp.annualAmount || 0}`);
                        console.log(`         Taxable: ${comp.isTaxable !== false ? 'Yes' : 'No'}`);
                        console.log(`         Pro-rata: ${comp.isProRata !== false ? 'Yes' : 'No'}`);
                    });
                } else {
                    console.log(`   ⚠️  WARNING: No components defined in compensation!`);
                }

                console.log(``);
            }
        }

        console.log(`\n✅ Diagnostic complete`);
        process.exit(0);

    } catch (error) {
        console.error(`❌ Error:`, error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run diagnostic
checkEmployeeCompensation();
