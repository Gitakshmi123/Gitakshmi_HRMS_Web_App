const mongoose = require('mongoose');

async function getBackendResponse() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        if (!manisha) return;

        const records = await db.collection('attendances').find({ 
            employee: manisha._id,
            date: {
                $gte: new Date('2026-01-01T00:00:00.000Z'),
                $lt: new Date('2026-02-01T00:00:00.000Z')
            }
        }).toArray();

        console.log(`--- Records for Jan 2026 (Count: ${records.length}) ---`);
        records.forEach(r => {
            console.log(`Date: ${r.date.toISOString()} | Status: ${r.status} | WH: ${r.workingHours}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

getBackendResponse();
