const mongoose = require('mongoose');

async function findManishaAll() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae75c9d3c82ee065cf34c3?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        const manisha = await db.collection('employees').findOne({ firstName: /Manisha/i });
        if (manisha) {
            console.log(`Manisha: ${manisha._id}`);
            const atts = await db.collection('attendances').find({ employee: manisha._id }).toArray();
            console.log(`Total records: ${atts.length}`);
            atts.forEach(a => {
                console.log(`Date: ${a.date ? a.date.toISOString() : 'NULL'} | Status: ${a.status} | WH: ${a.workingHours}`);
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

findManishaAll();
