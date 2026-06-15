const mongoose = require('mongoose');

async function checkFinalSum() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        const records = await db.collection('attendances').find({ 
            employee: manisha._id,
            date: { $gte: new Date('2026-02-01T00:00:00.000Z'), $lt: new Date('2026-03-01T00:00:00.000Z') }
        }).toArray();

        let totalWH = 0;
        records.forEach(r => totalWH += (r.workingHours || 0));
        console.log(`Final Feb Sum: ${totalWH.toFixed(2)} hrs for ${records.length} days.`);

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkFinalSum();
