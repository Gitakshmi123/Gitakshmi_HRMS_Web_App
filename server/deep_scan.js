const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();

        console.log(`Checking ${databases.length} databases...`);

        for (const dbInfo of databases) {
            const dbName = dbInfo.name;
            if (!dbName.startsWith('company_') && dbName !== 'hrms') continue;

            console.log(`\n--- DB: ${dbName} ---`);
            const db = mongoose.connection.useDb(dbName);

            // Employee Check
            try {
                const Employee = db.model('TempEmp_' + dbName, new mongoose.Schema({}, { strict: false }), 'employees');
                const emps = await Employee.find({
                    $or: [
                        { firstName: /Manisha/i },
                        { lastName: /Jethwani/i },
                        { name: /Manisha/i }
                    ]
                }).lean();

                if (emps.length > 0) {
                    console.log(`  MATCHING EMPLOYEES (${emps.length}):`);
                    for (const e of emps) {
                        const fullName = `${e.firstName || ''} ${e.lastName || ''} ${e.name || ''}`.trim();
                        console.log(`    - [${fullName}] ID: ${e._id} | CODE: ${e.employeeId} | Role: ${e.role}`);

                        // Check for payslips for this employee
                        const Payslip = db.model('TempSlip_' + dbName + '_' + e._id, new mongoose.Schema({}, { strict: false }), 'payslips');
                        // Use the combined or criteria as in my controller
                        const slips = await Payslip.find({
                            $or: [
                                { employeeId: e._id },
                                { employeeId: e._id.toString() },
                                { 'employeeInfo.employeeId': e.employeeId }
                            ]
                        }).lean();
                        console.log(`      Found ${slips.length} payslips in this DB.`);
                        slips.forEach(s => {
                            console.log(`      * ${s.month}/${s.year} | NET: ${s.netPay} | ID: ${s._id} | filterMatch: [By ID/Code]`);
                        });
                    }
                }
            } catch (e) {
                console.log(`  Failed to check Employee/Payslip in ${dbName}: ${e.message}`);
            }

            // Global check for ANY payslips in this DB
            try {
                const Payslip = db.model('AllSlip_' + dbName, new mongoose.Schema({}, { strict: false }), 'payslips');
                const totalSlips = await Payslip.countDocuments();
                if (totalSlips > 0) {
                    console.log(`  TOTAL PAYSLIPS IN DB: ${totalSlips}`);
                    // If no specific match was found, sample some to see what IDs look like
                    if (totalSlips > 0) {
                        const samples = await Payslip.find().limit(5).lean();
                        console.log(`  SAMPLES:`);
                        samples.forEach(s => {
                            console.log(`    * EMP_ID: ${s.employeeId} | INFO_EMP_ID: ${s.employeeInfo?.employeeId} | Period: ${s.month}/${s.year}`);
                        });
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
