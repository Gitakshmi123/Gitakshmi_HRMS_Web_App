const mongoose = require('mongoose');

// URI from .env
const uri = "mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        console.log('Connected to DB');
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log('Collections found:', collections.map(c => c.name));

            const collectionName = 'requirementdrafts'; // Default mongoose collection name
            // Check if collection exists
            if (collections.find(c => c.name === collectionName)) {
                const drafts = mongoose.connection.db.collection(collectionName);
                const indexes = await drafts.indexes();
                console.log(`\nIndexes for ${collectionName}:`);
                console.log(JSON.stringify(indexes, null, 2));
            } else {
                console.log(`\nCollection ${collectionName} NOT found.`);
            }

            const reqCollection = 'requirements';
            if (collections.find(c => c.name === reqCollection)) {
                const reqs = mongoose.connection.db.collection(reqCollection);
                const indexes = await reqs.indexes();
                console.log(`\nIndexes for ${reqCollection}:`);
                console.log(JSON.stringify(indexes, null, 2));
            }

        } catch (e) {
            console.error('Error listing indexes:', e);
        } finally {
            await mongoose.disconnect();
            console.log('Disconnected');
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
