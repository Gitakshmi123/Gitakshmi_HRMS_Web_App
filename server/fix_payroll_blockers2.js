const mongoose = require('mongoose');
require('dotenv').config();
const { ObjectId } = mongoose.Types;

async function fix() {
    await mongoose.connect(process.env.MONGO_URI);
    const client = mongoose.connection.client;
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    for (const dbInfo of dbs.databases) {
        if (!dbInfo.name.startsWith('company_') && dbInfo.name !== 'test' && dbInfo.name !== 'gitakshmi_hrms') continue;
        
        console.log('\n--- Processing Database:', dbInfo.name, '---');
        const db = client.db(dbInfo.name);
        
        const employees = await db.collection('employees').find().toArray();
        console.log('Found employees:', employees.length);

        for (const emp of employees) {
            const actualTenantId = emp.tenant || emp.companyId || emp.tenantId || new ObjectId('60c72b2f9b1d8b0015a6b0c2');
            
            // Delete previously incorrectly created profile
            await db.collection('employee_payroll_profiles').deleteMany({ employeeId: emp._id });

            // 1. Ensure EmployeePayrollProfile with correct tenant
            await db.collection('employee_payroll_profiles').insertOne({
                tenantId: actualTenantId,
                employeeId: emp._id,
                legalEntityId: actualTenantId,
                effectiveFrom: new Date('2026-06-01T00:00:00Z'),
                status: 'ACTIVE',
                source: 'SYSTEM',
                workCity: 'Ahmedabad',
                workState: 'Gujarat',
                country: 'India',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('Fixed profile for', emp.firstName || emp.employeeId);
        }
    }
    console.log('Done all DBs!');
    process.exit(0);
}

fix().catch(console.error);
