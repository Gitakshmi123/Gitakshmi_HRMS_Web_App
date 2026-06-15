const mongoose = require('mongoose');
require('dotenv').config();

async function checkSnapshot() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const snapshotId = '698d7d5c08a3c8b1f3779834';

        // Register EmployeeSalarySnapshot
        const EmployeeSalarySnapshot = db.model('EmployeeSalarySnapshot', new mongoose.Schema({}, { strict: false }));
        const snap = await EmployeeSalarySnapshot.findById(snapshotId);
        console.log('EmployeeSalarySnapshot:', snap ? JSON.stringify(snap, null, 2) : 'NOT FOUND');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSnapshot();
