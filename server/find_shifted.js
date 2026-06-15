const mongoose = require('mongoose');

async function findShifted() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        if (!manisha) return;

        const records = await db.collection('attendances').find({ 
            employee: manisha._id
        }).toArray();

        let shiftedCount = 0;
        records.forEach(r => {
            const h = r.date.getUTCHours();
            const m = r.date.getUTCMinutes();
            if (h !== 0 || m !== 0) {
                console.log(`SHIFTED: ${r.date.toISOString()} (Hours: ${h}, Mins: ${m})`);
                shiftedCount++;
            }
        });
        console.log(`Total shifted records: ${shiftedCount}`);

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

findShifted();
