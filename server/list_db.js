const mongoose = require('mongoose');

async function listCollections() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to DB');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        // Check if there are any employees in ANY collection that looks like employees
        for (const col of collections) {
            if (col.name.toLowerCase().includes('employee')) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`Collection ${col.name} has ${count} documents`);
                if (count > 0) {
                    const sample = await db.collection(col.name).findOne({});
                    console.log(`Sample from ${col.name}:`, JSON.stringify(sample, null, 2));
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

listCollections();
