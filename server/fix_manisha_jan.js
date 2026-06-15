const mongoose = require('mongoose');

async function shiftManishaJan() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        // Find Manisha
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        if (!manisha) {
            console.log('Manisha not found');
            return;
        }

        // Find the records that are Dec 31, 2025 and Jan 1, 2026
        // These were likely meant to be Jan 1 and Jan 2
        const r1 = await db.collection('attendances').findOne({ 
            employee: manisha._id, 
            date: new Date('2025-12-31T00:00:00.000Z') 
        });
        const r2 = await db.collection('attendances').findOne({ 
            employee: manisha._id, 
            date: new Date('2026-01-01T00:00:00.000Z') 
        });

        if (r1) {
            console.log('Shifting r1 (Dec 31) -> Jan 1');
            await db.collection('attendances').updateOne({ _id: r1._id }, { $set: { date: new Date('2026-01-01T00:00:00.000Z') } });
        }
        if (r2) {
            console.log('Shifting r2 (Jan 1) -> Jan 2');
            await db.collection('attendances').updateOne({ _id: r2._id }, { $set: { date: new Date('2026-01-02T00:00:00.000Z') } });
        }

        console.log('Done.');

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

shiftManishaJan();
