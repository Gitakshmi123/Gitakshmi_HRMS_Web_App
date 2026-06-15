const mongoose = require('mongoose');

async function scanAllForManisha() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                const db = mongoose.connection.useDb(dbInfo.name);
                const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
                if (manisha) {
                    const attCount = await db.collection('attendances').countDocuments({ employee: manisha._id });
                    process.stdout.write(`Found Manisha in ${dbInfo.name} | ID: ${manisha._id} | Records: ${attCount}\n`);
                    if (attCount > 0) {
                        const janRecords = await db.collection('attendances').find({ 
                            employee: manisha._id,
                            date: { $gte: new Date('2026-01-01T00:00:00.000Z'), $lt: new Date('2026-02-01T00:00:00.000Z') }
                        }).toArray();
                        process.stdout.write(`  Jan 2026 records: ${janRecords.length}\n`);
                        janRecords.forEach(r => {
                            process.stdout.write(`    ${r.date.toISOString()} | WH: ${r.workingHours}\n`);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

scanAllForManisha();
