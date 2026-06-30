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
            // 1. Ensure EmployeePayrollProfile
            const hasProfile = await db.collection('employee_payroll_profiles').findOne({ employeeId: emp._id });
            if (!hasProfile) {
                await db.collection('employee_payroll_profiles').insertOne({
                    tenantId: emp.companyId || emp.tenantId || new ObjectId(),
                    employeeId: emp._id,
                    legalEntityId: emp.companyId || emp.tenantId || new ObjectId(),
                    effectiveFrom: new Date('2026-06-01T00:00:00Z'),
                    status: 'ACTIVE',
                    source: 'SYSTEM',
                    workCity: 'Ahmedabad',
                    workState: 'Gujarat',
                    country: 'India',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                console.log('Created profile for', emp.firstName);
            }

            // 2. Ensure Attendance for June 2026
            const count = await db.collection('attendances').countDocuments({ employee: emp._id });
            if (count < 20) {
                const attendances = [];
                for (let i = 1; i <= 30; i++) {
                    const isWeekend = (new Date(2026, 5, i).getDay() === 0 || new Date(2026, 5, i).getDay() === 6);
                    attendances.push({
                        tenant: emp.companyId || emp.tenantId || new ObjectId(),
                        employee: emp._id,
                        employeeId: emp.employeeId || '',
                        date: new Date(Date.UTC(2026, 5, i, 10, 0, 0)),
                        status: isWeekend ? 'holiday' : 'present',
                        workingHours: isWeekend ? 0 : 8,
                        checkInTime: isWeekend ? null : new Date(Date.UTC(2026, 5, i, 9, 0, 0)),
                        checkOutTime: isWeekend ? null : new Date(Date.UTC(2026, 5, i, 18, 0, 0)),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
                await db.collection('attendances').insertMany(attendances);
                console.log('Created 30 days attendance for', emp.firstName);
            }
        }
    }
    console.log('Done all DBs!');
    process.exit(0);
}

fix().catch(console.error);
