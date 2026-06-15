const mongoose = require('mongoose');

async function scanForManisha() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                console.log(`CHECKING_DB: ${dbInfo.name}`);
                const db = mongoose.connection.useDb(dbInfo.name);
                const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
                if (manisha) {
                    console.log(`FOUND_MANISHA_IN: ${dbInfo.name}`);
                    const atts = await db.collection('attendances').find({ employee: manisha._id }).toArray();
                    atts.forEach(a => {
                        console.log(`DATE: ${a.date ? a.date.toISOString() : 'NULL'} STATUS: ${a.status}`);
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

scanForManisha();
