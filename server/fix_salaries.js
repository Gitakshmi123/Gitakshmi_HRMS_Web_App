require('dotenv').config();
const mongoose = require('mongoose');

async function fixSalaries() {
    await mongoose.connect(process.env.MONGO_URI);
    const client = mongoose.connection.client;
    
    // We only need to fix company_demo for this test
    const db = client.db('company_demo');
    
    const employees = await db.collection('employees').find({ 
        _id: { $in: [new mongoose.Types.ObjectId('6a3b0c8faf5be7cfe9a525bb'), new mongoose.Types.ObjectId('6a3b94114f6f69dae48794b6')] }
    }).toArray();

    for (const emp of employees) {
        if (!emp.currentSalarySnapshotId) {
            console.log('Creating salary for:', emp.firstName);
            
            const snapshotId = new mongoose.Types.ObjectId();
            
            await db.collection('salarysnapshots').insertOne({
                _id: snapshotId,
                tenantId: emp.tenant || emp.companyId || new mongoose.Types.ObjectId(),
                employeeId: emp._id,
                effectiveFrom: new Date('2026-06-01T00:00:00Z'),
                grossSalary: 50000,
                baseSalary: 25000,
                hra: 10000,
                conveyance: 5000,
                medical: 5000,
                specialAllowance: 5000,
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            });
            
            await db.collection('employees').updateOne(
                { _id: emp._id },
                { $set: { currentSalarySnapshotId: snapshotId, salarySnapshotId: snapshotId } }
            );
            
            console.log('Created salary for', emp.firstName);
        }
    }
    console.log('Done!');
    process.exit(0);
}

fixSalaries().catch(console.error);
