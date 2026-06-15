
const mongoose = require('mongoose');

const dbUrl = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
    console.log("Connecting...");
    await mongoose.connect(dbUrl);
    console.log("Connected.");

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();

    // Look for company_ and hrms_ (just in case)
    const hrmsDbs = dbs.databases.filter(db => db.name.startsWith('company_') || db.name.startsWith('hrms')).map(db => db.name);
    console.log("Relevant DBS:", hrmsDbs);

    for (const dbName of hrmsDbs) {
        console.log(`\n--- DB: ${dbName} ---`);
        const conn = mongoose.createConnection(`${dbUrl.split('/hrms')[0]}/${dbName}${dbUrl.split('/hrms')[1] || ''}`);

        try {
            const Employee = conn.model('Employee', new mongoose.Schema({}, { strict: false }));
            const Payslip = conn.model('Payslip', new mongoose.Schema({}, { strict: false }));

            const manishas = await Employee.find({
                $or: [
                    { firstName: /MANISHA/i },
                    { lastName: /JETHWANI/i },
                    { name: /MANISHA/i }
                ]
            }).lean();

            if (manishas.length > 0) {
                console.log(`  - Found ${manishas.length} matching employees in ${dbName}`);
                for (const m of manishas) {
                    console.log(`    [EMP] ${m.firstName} ${m.lastName} | ID: ${m._id} | EmpID: ${m.employeeId}`);
                    const slips = await Payslip.find({ employeeId: m._id }).lean();
                    console.log(`      Found ${slips.length} payslips.`);
                    slips.forEach(s => {
                        console.log(`      * ${s.month}/${s.year} - Net: ${s.netPay} | ID: ${s._id}`);
                    });
                }
            } else if (dbName === 'hrms') {
                const User = conn.model('User', new mongoose.Schema({}, { strict: false }));
                const users = await User.find({ name: /MANISHA/i }).lean();
                if (users.length > 0) {
                    console.log(`  - Found ${users.length} users in main DB:`);
                    users.forEach(u => console.log(`    * ${u.name} | Role: ${u.role} | Tenant: ${u.tenant}`));
                }
            }
        } catch (err) {
            console.error(`Error in ${dbName}: ${err.message}`);
        } finally {
            await conn.close();
        }
    }

    await mongoose.disconnect();
}

check().catch(console.error);
