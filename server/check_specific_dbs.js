const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const checkDb = async (dbName) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected to MongoDB, checking ${dbName}`);

        const db = mongoose.connection.useDb(dbName);
        const collections = await db.db.listCollections().toArray();
        console.log(`Collections in ${dbName}:`, collections.map(c => c.name));
        
        if (collections.map(c => c.name).includes('employees')) {
            const count = await db.db.collection('employees').countDocuments({});
            console.log(`'employees' collection has ${count} docs`);
            if (count > 0) {
                const emps = await db.db.collection('employees').find({}).limit(10).toArray();
                console.log('Sample names:', emps.map(e => `${e.firstName} ${e.lastName}`));
                
                const dhiren = await db.db.collection('employees').findOne({ $or: [ { firstName: /Dhiren/i }, { lastName: /Makwana/i } ] });
                if (dhiren) {
                    console.log('FOUND DHIREN:');
                    console.log(JSON.stringify(dhiren, null, 2));
                }
            }
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

const run = async () => {
    const dbs = ['git001', 'gitakshmi-one', 'jay001', 'hel001', 'abh001'];
    for (const d of dbs) {
        await checkDb(d);
        console.log('-------------------');
    }
    process.exit(0);
};

run();
