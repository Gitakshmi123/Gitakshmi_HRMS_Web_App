const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const dbsToDelete = ['blogdb', 'demoDB', 'serchApi', 'taskDB'];
        for (const dbName of dbsToDelete) {
            console.log(`Deleting ${dbName}...`);
            await mongoose.connection.client.db(dbName).dropDatabase();
            console.log(`Deleted ${dbName}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
