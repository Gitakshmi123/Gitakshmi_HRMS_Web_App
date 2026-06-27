require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.client.db('company_demo');
    const emps = await db.collection('employees').find({
        _id: { $in: [new mongoose.Types.ObjectId('6a3b0c8faf5be7cfe9a525bb'), new mongoose.Types.ObjectId('6a3b94114f6f69dae48794b6')] }
    }).toArray();
    for (const emp of emps) {
        console.log('Emp:', emp.firstName, 'SnapId:', emp.currentSalarySnapshotId);
        const snap = await db.collection('salary_snapshots').findOne({ _id: emp.currentSalarySnapshotId });
        console.log('Snap exists in salary_snapshots?', !!snap);
        const snap2 = await db.collection('salarysnapshots').findOne({ _id: emp.currentSalarySnapshotId });
        console.log('Snap exists in salarysnapshots?', !!snap2);
    }
    process.exit(0);
});
