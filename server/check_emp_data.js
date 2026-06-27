require('dotenv').config();
const mongoose = require('mongoose');
const payrollService = require('./services/payroll.service');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.client.db('company_demo');
    const tenantId = new mongoose.Types.ObjectId('6a3ac6d5e82947dfe3b970d2');
    
    // Instead of passing `db` to payrollService directly (which fails because of mongoose models),
    // we should just fetch the DB data or mock the request if it relies on req.tenantDB
    // Wait, payrollService expects req.tenantDB which is a connection object with models.
    
    // Let's just fetch the employees and check what could be wrong.
    const emps = await db.collection('employees').find({
        _id: { $in: [
            new mongoose.Types.ObjectId('6a3b0c8faf5be7cfe9a525bb'), 
            new mongoose.Types.ObjectId('6a3b94114f6f69dae48794b6')
        ]}
    }).toArray();
    
    console.log('Employees found:', emps.length);
    for (const emp of emps) {
        console.log('---', emp.firstName);
        console.log('currentSalarySnapshotId:', emp.currentSalarySnapshotId);
        if (emp.currentSalarySnapshotId) {
            const snap = await db.collection('salarysnapshots').findOne({ _id: emp.currentSalarySnapshotId });
            console.log('Snapshot found:', !!snap);
        }
        const profile = await db.collection('employee_payroll_profiles').findOne({ employeeId: emp._id });
        console.log('Profile found:', !!profile);
    }
    
    process.exit(0);
});
