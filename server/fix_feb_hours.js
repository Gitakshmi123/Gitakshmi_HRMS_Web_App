const mongoose = require('mongoose');

async function fixFebHours() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        const records = await db.collection('attendances').find({ 
            employee: manisha._id,
            workingHours: { $gt: 10 }
        }).toArray();

        console.log(`Found ${records.length} records to fix for Manisha.`);
        for (const r of records) {
            // If it's roughly multiples of 7.03
            if (r.workingHours > 13.5 && r.workingHours < 15) {
                 const newVal = r.workingHours / 2;
                 await db.collection('attendances').updateOne({ _id: r._id }, { $set: { workingHours: newVal } });
                 console.log(`Fixed ${r.date.toISOString()} from ${r.workingHours} to ${newVal}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

fixFebHours();
