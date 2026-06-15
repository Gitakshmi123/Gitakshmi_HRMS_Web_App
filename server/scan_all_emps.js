const mongoose = require('mongoose');

async function scanAllEmployees() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                const db = mongoose.connection.useDb(dbInfo.name);
                const emps = await db.collection('employees').find({}).toArray();
                if (emps.length > 0) {
                    process.stdout.write(`DB: ${dbInfo.name} | Count: ${emps.length}\n`);
                    emps.forEach(e => {
                        process.stdout.write(`  - ${e.firstName} ${e.lastName} (${e.employeeId})\n`);
                    });
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

scanAllEmployees();
