const mongoose = require('mongoose');

async function globalRepair() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                const db = mongoose.connection.useDb(dbInfo.name);
                const col = db.collection('attendances');
                const records = await col.find({}).toArray();
                
                let count = 0;
                for (const r of records) {
                    if (!r.date) continue;
                    const d = new Date(r.date);
                    
                    // SAFE NORMALIZATION: Add 12 hours, then force to UTC midnight
                    // This handles BOTH Dec 31 18:30 (Jan 1) AND Jan 1 00:00 (Jan 1) correctly.
                    const midDate = new Date(d.getTime() + (12 * 60 * 60 * 1000));
                    const corrected = new Date(Date.UTC(midDate.getUTCFullYear(), midDate.getUTCMonth(), midDate.getUTCDate(), 0, 0, 0, 0));
                    
                    if (d.toISOString() !== corrected.toISOString()) {
                        await col.updateOne({ _id: r._id }, { $set: { date: corrected } });
                        count++;
                    }
                }
                if (count > 0) console.log(`Fixed ${count} records in ${dbInfo.name}`);
            }
        }
        console.log('Global repair finished.');
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

globalRepair();
