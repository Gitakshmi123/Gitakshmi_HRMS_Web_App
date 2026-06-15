const mongoose = require('mongoose');

async function finalRepair() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                const db = mongoose.connection.useDb(dbInfo.name);
                const col = db.collection('attendances');
                const records = await col.find({}).toArray();
                
                for (const r of records) {
                    if (!r.date) continue;
                    const d = new Date(r.date);
                    
                    // Force to UTC Midnight
                    // Use IST offset to find the real day
                    // IST is UTC + 5.5
                    const istTime = d.getTime() + (5.5 * 60 * 60 * 1000);
                    const istDate = new Date(istTime);
                    const corrected = new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(), 0, 0, 0, 0));
                    
                    if (d.toISOString() !== corrected.toISOString()) {
                        await col.updateOne({ _id: r._id }, { $set: { date: corrected } });
                    }
                }
            }
        }
        console.log('Final alignment finished.');
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

finalRepair();
