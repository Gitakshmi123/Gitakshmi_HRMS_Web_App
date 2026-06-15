const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('company_69ae76d0d0a86653c8f75c29');

        const Payslip = db.model('Payslip', new mongoose.Schema({}, { strict: false }));
        const slips = await Payslip.find({}).limit(1).lean();

        if (slips.length > 0) {
            const s = slips[0];
            console.log("PAYSLIP SAMPLE:");
            console.log(`  - _ID: ${s._id}`);
            console.log(`  - tenantId: ${s.tenantId} (${typeof s.tenantId})`);
            console.log(`  - employeeId: ${s.employeeId} (${typeof s.employeeId})`);
            console.log(`  - info.employeeId: ${s.employeeInfo?.employeeId}`);
        } else {
            console.log("No payslips found in this DB at all.");
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
