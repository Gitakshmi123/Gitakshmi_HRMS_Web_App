require('dotenv').config();
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log("📡 [DNS] DNS override configured successfully");
} catch (dnsErr) {
    console.error("❌ [DNS] DNS override failed:", dnsErr.message);
}
const mongoose = require('mongoose');

async function seed() {
    try {
        console.log("Connecting to:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI, {
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
            w: 'majority'
        });
        console.log("Connected successfully!");

        const Tenant = require('./models/Tenant');
        const allTenants = await Tenant.find({});
        console.log("All tenants found in DB:", allTenants.map(t => ({ name: t.companyName, id: t._id, status: t.status, db: t.databaseName })));

        let correctTenant = null;
        let employees = [];
        let Employee;

        for (const t of allTenants) {
            const dbName = t.databaseName || `tenant_${t._id}`;
            const tempDB = mongoose.connection.useDb(dbName, { useCache: true });
            const TempEmployee = tempDB.model('Employee', require('./models/Employee'));
            const count = await TempEmployee.countDocuments({});
            console.log(`Tenant ${t.companyName} (${t._id}) has ${count} employees.`);
            if (count > 0) {
                correctTenant = t;
                employees = await TempEmployee.find({});
                Employee = TempEmployee;
                break;
            }
        }

        if (!correctTenant) {
            console.log("No tenant database has any employees. Using first tenant as fallback.");
            correctTenant = allTenants[0];
            if (!correctTenant) {
                console.log("No tenants at all in database!");
                process.exit(1);
            }
        }

        const tenantId = correctTenant._id;
        console.log("Selected tenant for seeding:", correctTenant.companyName, "ID:", tenantId);

        // Resolve tenant database connection
        const dbName = correctTenant.databaseName || `tenant_${tenantId}`;
        const tenantDB = mongoose.connection.useDb(dbName, { useCache: true });

        // Resolve Models
        if (!Employee) {
            Employee = tenantDB.model('Employee', require('./models/Employee'));
        }

        const DeductionMaster = tenantDB.model('DeductionMaster', require('./models/DeductionMaster'));
        const EmployeeDeduction = tenantDB.model('EmployeeDeduction', require('./models/EmployeeDeduction'));
        const PayrollAdjustment = tenantDB.model('PayrollAdjustment', require('./models/PayrollAdjustment'));
        const EmployeeTaxProfile = tenantDB.model('EmployeeTaxProfile', require('./models/EmployeeTaxProfile'));
        const PayrollInputBatch = tenantDB.model('PayrollInputBatch', require('./models/PayrollInputBatch'));

        const allEmployees = await Employee.find({});
        console.log(`Total employees in DB: ${allEmployees.length}`);
        if (allEmployees.length > 0) {
            console.log("Sample employee status:", allEmployees.map(e => ({ name: e.firstName, status: e.status })));
        }

        employees = await Employee.find({ status: { $regex: /^active$/i } });
        console.log(`Found ${employees.length} active employees`);

        if (employees.length === 0 && allEmployees.length > 0) {
            console.log('No active employees found to seed against, using all employees.');
            var seedEmployees = allEmployees;
        } else {
            var seedEmployees = employees;
        }

        if (seedEmployees.length === 0) {
            console.log('No employees found to seed against.');
            process.exit(0);
        }

        const emp1 = seedEmployees[0];
        const emp2 = seedEmployees[1] || seedEmployees[0];

        // 1. Seed DeductionMaster
        console.log("Seeding DeductionMaster...");
        await DeductionMaster.deleteMany({ tenantId });
        const ptDeduction = await DeductionMaster.create({
            tenantId,
            name: 'Professional Tax',
            category: 'POST_TAX',
            deductionType: 'STATUTORY',
            statutoryCategory: 'PROFESSIONAL_TAX',
            amountType: 'FIXED',
            amountValue: 200,
            isActive: true
        });

        const uniformDeduction = await DeductionMaster.create({
            tenantId,
            name: 'Uniform Deduction',
            category: 'POST_TAX',
            deductionType: 'RECURRING',
            amountType: 'FIXED',
            amountValue: 500,
            isActive: true
        });

        const carLoanDeduction = await DeductionMaster.create({
            tenantId,
            name: 'Car Loan Recovery',
            category: 'POST_TAX',
            deductionType: 'LOAN',
            amountType: 'FIXED',
            amountValue: 8500,
            isActive: true
        });

        const homeLoanDeduction = await DeductionMaster.create({
            tenantId,
            name: 'Home Loan Recovery',
            category: 'POST_TAX',
            deductionType: 'LOAN',
            amountType: 'FIXED',
            amountValue: 12500,
            isActive: true
        });

        // 2. Seed EmployeeDeductions
        console.log("Seeding EmployeeDeductions...");
        await EmployeeDeduction.deleteMany({ tenantId });
        await EmployeeDeduction.create([
            {
                tenantId,
                employeeId: emp1._id,
                deductionId: ptDeduction._id,
                startDate: new Date('2026-01-01'),
                deductionType: 'STATUTORY',
                nameSnapshot: 'Professional Tax',
                status: 'ACTIVE'
            },
            {
                tenantId,
                employeeId: emp2._id,
                deductionId: uniformDeduction._id,
                startDate: new Date('2026-01-01'),
                deductionType: 'RECURRING',
                nameSnapshot: 'Uniform Deduction',
                status: 'ACTIVE'
            },
            {
                tenantId,
                employeeId: emp1._id,
                deductionId: carLoanDeduction._id,
                startDate: new Date('2026-01-01'),
                deductionType: 'LOAN',
                nameSnapshot: 'Car Loan',
                status: 'ACTIVE',
                installmentAmount: 8500,
                remainingInstallments: 18,
                metadata: { totalOutstanding: 150000, loanType: 'Car Loan' }
            },
            {
                tenantId,
                employeeId: emp2._id,
                deductionId: homeLoanDeduction._id,
                startDate: new Date('2026-01-01'),
                deductionType: 'LOAN',
                nameSnapshot: 'Home Loan',
                status: 'ACTIVE',
                installmentAmount: 12500,
                remainingInstallments: 26,
                metadata: { totalOutstanding: 325000, loanType: 'Home Loan' }
            }
        ]);

        // 3. Seed PayrollAdjustments
        console.log("Seeding PayrollAdjustments...");
        await PayrollAdjustment.deleteMany({ companyId: tenantId });
        await PayrollAdjustment.create([
            {
                companyId: tenantId,
                employeeId: emp1._id,
                adjustmentMonth: '2026-06',
                adjustmentType: 'MANUAL_ADJUSTMENT',
                adjustmentAmount: 25000,
                reason: 'Advance Salary Recovery',
                status: 'APPROVED',
                createdBy: emp1._id
            },
            {
                companyId: tenantId,
                employeeId: emp2._id,
                adjustmentMonth: '2026-06',
                adjustmentType: 'ALLOWANCE_MISSED',
                adjustmentAmount: 15000,
                reason: 'Missed Arrears for March',
                status: 'APPROVED',
                createdBy: emp1._id
            }
        ]);

        // 4. Seed EmployeeTaxProfiles
        console.log("Seeding EmployeeTaxProfiles...");
        await EmployeeTaxProfile.deleteMany({ tenantId });
        await EmployeeTaxProfile.create([
            {
                tenantId,
                employeeId: emp1._id,
                effectiveFrom: new Date('2026-04-01'),
                regime: 'OLD',
                financialYearLabel: '2026-2027',
                status: 'ACTIVE',
                declarations: {
                    section80C: 150000,
                    section80D: 25000,
                    homeLoanInterest: 0,
                    hraExemption: 20000
                },
                overrides: { monthlyTDS: 8400 }
            },
            {
                tenantId,
                employeeId: emp2._id,
                effectiveFrom: new Date('2026-04-01'),
                regime: 'NEW',
                financialYearLabel: '2026-2027',
                status: 'ACTIVE',
                declarations: {
                    section80C: 0,
                    section80D: 0,
                    homeLoanInterest: 0,
                    hraExemption: 0
                },
                overrides: { monthlyTDS: 12500 }
            }
        ]);

        // 5. Seed PayrollInputBatches
        console.log("Seeding PayrollInputBatches...");
        await PayrollInputBatch.deleteMany({ tenantId });
        await PayrollInputBatch.create([
            {
                tenantId,
                name: 'Performance & Night Shift Allowances',
                batchCode: 'EARN-202606',
                source: 'MANUAL',
                month: 6,
                year: 2026,
                status: 'APPROVED',
                periodStart: new Date('2026-06-01'),
                periodEnd: new Date('2026-06-30'),
                items: [
                    {
                        employeeId: emp1._id,
                        inputType: 'BONUS',
                        classification: 'EARNING',
                        name: 'Performance Bonus',
                        amount: 15000,
                        rate: 15000,
                        quantity: 1
                    },
                    {
                        employeeId: emp2._id,
                        inputType: 'NIGHT_SHIFT_ALLOWANCE',
                        classification: 'EARNING',
                        name: 'Night Shift Allowance',
                        amount: 5000,
                        rate: 5000,
                        quantity: 1
                    }
                ]
            }
        ]);

        console.log("Dashboard seeding completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Dashboard seeding error:", e);
        process.exit(1);
    }
}

seed();
