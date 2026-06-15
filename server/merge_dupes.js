const mongoose = require('mongoose');

async function mergeDuplicates() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            if (dbInfo.name.startsWith('company_')) {
                const db = mongoose.connection.useDb(dbInfo.name);
                const col = db.collection('attendances');
                const records = await col.find({}).toArray();
                
                // Group by employee and "normalized" date (UTC Midnight IST-based)
                const groups = {};
                for (const r of records) {
                    if (!r.date) continue;
                    const d = new Date(r.date);
                    const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
                    const dateKey = `${r.employee}_${istDate.getUTCFullYear()}-${istDate.getUTCMonth() + 1}-${istDate.getUTCDate()}`;
                    
                    if (!groups[dateKey]) groups[dateKey] = [];
                    groups[dateKey].push(r);
                }

                for (const key in groups) {
                    if (groups[key].length > 1) {
                        console.log(`Merging ${groups[key].length} records for ${key} in ${dbInfo.name}`);
                        const sorted = groups[key].sort((a,b) => (b.workingHours || 0) - (a.workingHours || 0));
                        const winner = sorted[0];
                        
                        // Keep the one with most hours, or just take the first.
                        // Delete others
                        const toDelete = sorted.slice(1).map(x => x._id);
                        await col.deleteMany({ _id: { $in: toDelete } });
                        
                        // Ensure winner is at UTC midnight
                        const d = new Date(winner.date);
                        const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
                        const normalized = new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(), 0, 0, 0, 0));
                        await col.updateOne({ _id: winner._id }, { $set: { date: normalized } });
                    } else {
                        // Just normalize the single record
                        const r = groups[key][0];
                        const d = new Date(r.date);
                        const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
                        const normalized = new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(), 0, 0, 0, 0));
                        if (d.toISOString() !== normalized.toISOString()) {
                            await col.updateOne({ _id: r._id }, { $set: { date: normalized } });
                        }
                    }
                }
            }
        }
        console.log('Merge and Normalization finished.');
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

mergeDuplicates();
