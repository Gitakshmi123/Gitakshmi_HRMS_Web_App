const mongoose = require('mongoose');

async function checkDuplicates() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        if (!manisha) return;

        const summary = await db.collection('attendances').aggregate([
            { $match: { employee: manisha._id } },
            { $group: {
                _id: "$date",
                count: { $sum: 1 },
                records: { $push: "$$ROOT" }
            }},
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (summary.length > 0) {
            console.log('--- DUPLICATE RECORDS FOUND ---');
            summary.forEach(s => {
                console.log(`Date: ${s._id.toISOString()} | Count: ${s.count}`);
            });
        } else {
            console.log('No duplicate records found for Manisha.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkDuplicates();
