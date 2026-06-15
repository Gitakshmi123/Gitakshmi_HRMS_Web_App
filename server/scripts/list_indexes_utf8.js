const mongoose = require('mongoose');
const fs = require('fs');

// URI from .env
const uri = "mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        console.log('Connected to DB');
        const result = {};
        try {
            // Find a tenant
            const tenant = await mongoose.connection.db.collection('tenants').findOne({});
            if (!tenant) throw new Error("No tenant found");
            console.log('Using Tenant:', tenant._id);

            const dbName = `company_${tenant._id}`;
            const tenantDb = mongoose.connection.useDb(dbName);
            console.log('Switched to DB:', dbName);

            const collections = await tenantDb.db.listCollections().toArray();
            result.collections = collections.map(c => c.name);

            const checkCollection = async (name) => {
                if (collections.find(c => c.name === name)) {
                    const coll = tenantDb.db.collection(name);
                    const indexes = await coll.indexes();
                    result[name] = indexes;
                } else {
                    result[name] = 'NOT_FOUND';
                }
            };

            await checkCollection('requirementdrafts');
            await checkCollection('requirements');
            await checkCollection('positions');

            fs.writeFileSync('indexes_utf8.json', JSON.stringify(result, null, 2), 'utf8');
            console.log('Wrote indexes_utf8.json');

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
