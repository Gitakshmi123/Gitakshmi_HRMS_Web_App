const mongoose = require('mongoose');
require('dotenv').config();

const dropOldBranchIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Check if there are other databases (tenants)
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        
        const tenantDbs = databases.filter(db => db.name.startsWith('gitakshmi-'));

        for (const dbInfo of tenantDbs) {
            console.log(`Checking database: ${dbInfo.name}`);
            const db = mongoose.connection.useDb(dbInfo.name);
            const collections = await db.listCollections({ name: 'branches' }).toArray();
            
            if (collections.length > 0) {
                const branches = db.collection('branches');
                const indexes = await branches.indexes();
                const hasOldIndex = indexes.some(idx => idx.name === 'companyId_1_name_1');
                
                if (hasOldIndex) {
                    console.log(`Dropping index companyId_1_name_1 from ${dbInfo.name}.branches`);
                    await branches.dropIndex('companyId_1_name_1');
                    console.log('Index dropped successfully');
                } else {
                    console.log(`Old index not found in ${dbInfo.name}.branches`);
                }
            }
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (err) {
        console.error('Error:', err);
    }
};

dropOldBranchIndex();
