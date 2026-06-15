const mongoose = require('mongoose');

async function fixManishaJanSafe() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        const col = db.collection('attendances');
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        if (!manisha) return;

        // Use temporary year to avoid unique constraint
        const r1 = await col.findOne({ employee: manisha._id, date: new Date('2025-12-31T00:00:00.000Z') });
        const r2 = await col.findOne({ employee: manisha._id, date: new Date('2026-01-01T00:00:00.000Z') });

        if (r2) {
            console.log('Moving r2 to Jan 2');
            await col.updateOne({ _id: r2._id }, { $set: { date: new Date('2026-01-02T00:00:00.000Z') } });
        }
        if (r1) {
            console.log('Moving r1 to Jan 1');
            await col.updateOne({ _id: r1._id }, { $set: { date: new Date('2026-01-01T00:00:00.000Z') } });
        }

        console.log('Safe fix complete.');
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

fixManishaJanSafe();
