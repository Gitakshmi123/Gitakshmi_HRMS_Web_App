const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('company_69ae76d0d0a86653c8f75c29');

        const Payslip = db.model('Payslip', new mongoose.Schema({
            tenantId: mongoose.Schema.Types.ObjectId,
            employeeId: mongoose.Schema.Types.ObjectId,
            year: Number,
            month: Number,
            employeeInfo: Object
        }), 'payslips');

        const userId = '69aeda4da57d0b928c0a20fd';
        const empCode = 'EMP-2026-1000';
        const tenantIdStr = '69ae76d0d0a86653c8f75c29';

        // Final Robust Filter from Controller
        const filter = {
            tenantId: new mongoose.Types.ObjectId(tenantIdStr),
            $or: [
                { employeeId: userId },
                { employeeId: String(userId) },
                { 'employeeInfo.employeeId': empCode }
            ]
        };

        if (mongoose.Types.ObjectId.isValid(String(userId))) {
            filter.$or.push({ employeeId: new mongoose.Types.ObjectId(String(userId)) });
        }

        console.log(`QUERY FILTER: ${JSON.stringify(filter)}`);

        const results = await Payslip.find(filter).lean();
        console.log(`FOUND COUNT: ${results.length}`);
        results.forEach(p => console.log(`  - Match: ${p.month}/${p.year} | Net: ${p.netPay}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
