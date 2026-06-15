const mongoose = require('mongoose');

async function listAllDbsInfo() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to Admin DB');

        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                const db = mongoose.connection.useDb(dbInfo.name);
                const empCount = await db.collection('employees').countDocuments();
                const attCount = await db.collection('attendances').countDocuments();
                console.log(`DB: ${dbInfo.name} | Employees: ${empCount} | Attendance: ${attCount}`);
                
                if (attCount > 0) {
                    const sampleAtt = await db.collection('attendances').findOne({});
                    console.log(`  Sample Attendance Date: ${sampleAtt.date}`);
                    const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
                    if (manisha) {
                        console.log(`  ✅ Manisha found in this DB! ID: ${manisha._id} ${manisha.firstName} ${manisha.lastName}`);
                        const manishaAtt = await db.collection('attendances').find({ employee: manisha._id }).toArray();
                        console.log(`  Manisha has ${manishaAtt.length} records total.`);
                        manishaAtt.forEach(a => {
                            console.log(`    Date: ${a.date ? a.date.toISOString() : 'NULL'}, Status: ${a.status}`);
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

listAllDbsInfo();
