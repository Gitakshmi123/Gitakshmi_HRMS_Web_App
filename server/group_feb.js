const mongoose = require('mongoose');

async function groupFeb() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        const records = await db.collection('attendances').find({ employee: manisha._id }).toArray();
        
        const groups = {};
        records.forEach(r => {
            const d = r.date.toISOString();
            if (!groups[d]) groups[d] = [];
            groups[d].push(r);
        });

        console.log('--- MANISHA ATTENDANCE GROUPS ---');
        for (const date in groups) {
            console.log(`Date: ${date} | Count: ${groups[date].length}`);
            groups[date].forEach(r => {
                console.log(`  WH: ${r.workingHours} | ID: ${r._id}`);
            });
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

groupFeb();
