
const mongoose = require('mongoose');

const dbUrl = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
    await mongoose.connect(dbUrl);

    // Specifically target company_69ae76d0d0a86653c8f75c29
    const dbName = 'company_69ae76d0d0a86653c8f75c29';
    console.log(`\n--- DB: ${dbName} ---`);
    const conn = mongoose.createConnection(`${dbUrl.split('/hrms')[0]}/${dbName}${dbUrl.split('/hrms')[1] || ''}`);

    try {
        const Payslip = conn.model('Payslip', new mongoose.Schema({}, { strict: false }));
        const Employee = conn.model('Employee', new mongoose.Schema({}, { strict: false }));

        const employee = await Employee.findOne({ firstName: /MANISHA/i }).lean();
        console.log("Manisha ID:", employee._id, typeof employee._id);

        const slip = await Payslip.findOne({ _id: new mongoose.Types.ObjectId('69af00eb842d2bdfa86e1328') }).lean();
        console.log("Slip found:", !!slip);
        if (slip) {
            console.log("Slip Details:");
            console.log("- month/year:", slip.month, slip.year);
            console.log("- employeeId in slip:", slip.employeeId, typeof slip.employeeId);
            console.log("- tenantId in slip:", slip.tenantId, typeof slip.tenantId);

            // Try to match like the controller does
            const matchCount = await Payslip.countDocuments({ employeeId: new mongoose.Types.ObjectId(employee._id) });
            console.log("Count with ObjectId match:", matchCount);

            const matchCountStr = await Payslip.countDocuments({ employeeId: String(employee._id) });
            console.log("Count with String match:", matchCountStr);
        }

    } catch (err) {
        console.error(err.message);
    } finally {
        await conn.close();
    }

    await mongoose.disconnect();
}

check().catch(console.error);
