const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();

        console.log(`Found ${databases.length} databases.`);

        for (const dbInfo of databases) {
            const dbName = dbInfo.name;
            if (!dbName.startsWith('company_')) continue;

            console.log(`Checking ${dbName}...`);
            const db = mongoose.connection.useDb(dbName);

            // Temporary schemas to avoid model re-registration errors
            const EmployeeSchema = new mongoose.Schema({
                firstName: String,
                lastName: String,
                name: String,
                employeeId: String
            }, { strict: false });

            const PayslipSchema = new mongoose.Schema({
                employeeId: mongoose.Schema.Types.Mixed,
                employeeInfo: Object,
                month: Number,
                year: Number,
                netPay: Number
            }, { strict: false });

            const Employee = db.model('TempEmployee', EmployeeSchema, 'employees');
            const Payslip = db.model('TempPayslip', PayslipSchema, 'payslips');

            const emps = await Employee.find({
                $or: [
                    { firstName: /Manisha/i },
                    { lastName: /Jethwani/i }
                ]
            }).lean();

            if (emps.length > 0) {
                console.log(`MATCHES IN ${dbName}:`);
                for (const emp of emps) {
                    console.log(`  - NAME: ${emp.firstName} ${emp.lastName} | ID: ${emp._id} | CODE: ${emp.employeeId}`);

                    // Search for payslips matching this employee
                    const userId = emp._id;
                    const empCode = emp.employeeId;

                    const filter = {
                        $or: [
                            { employeeId: userId },
                            { employeeId: userId.toString() },
                            { 'employeeInfo.employeeId': empCode }
                        ]
                    };

                    if (mongoose.Types.ObjectId.isValid(userId)) {
                        filter.$or.push({ employeeId: new mongoose.Types.ObjectId(userId) });
                    }

                    const slips = await Payslip.find(filter).lean();
                    console.log(`    FOUND ${slips.length} PAYSLIPS:`);
                    slips.forEach(s => {
                        console.log(`      * ${s.month}/${s.year} | NET: ${s.netPay} | ID: ${s._id}`);
                    });
                }
            }

            // Close properly or cleanup models if needed? No, useDb doesn't create new connections usually.
            // But we can't redefine model with same name on same connection.
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
