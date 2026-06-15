const mongoose = require('mongoose');
const fs = require('fs');

async function scanForManisha() {
    let output = "";
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                output += `CHECKING_DB: ${dbInfo.name}\n`;
                const db = mongoose.connection.useDb(dbInfo.name);
                const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
                if (manisha) {
                    output += `FOUND_MANISHA_IN: ${dbInfo.name}\n`;
                    const atts = await db.collection('attendances').find({ employee: manisha._id }).toArray();
                    atts.forEach(a => {
                        output += `  DATE: ${a.date ? a.date.toISOString() : 'NULL'} STATUS: ${a.status} WH: ${a.workingHours}\n`;
                    });
                }
            }
        }
    } catch (err) {
        output += `ERROR: ${err.message}\n`;
    } finally {
        fs.writeFileSync('scan_manisha.log', output);
        mongoose.disconnect();
    }
}

scanForManisha();
