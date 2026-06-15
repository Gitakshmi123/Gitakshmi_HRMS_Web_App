const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const listCollections = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String }, { collection: 'companies' }));
        const tenants = await Tenant.find({});
        
        if (tenants.length > 0) {
            const firstTenant = tenants[0];
            const dbName = `company_${firstTenant._id}`;
            console.log(`Listing collections for ${dbName}:`);
            const db = mongoose.connection.useDb(dbName);
            const admin = db.db.admin();
            const collections = await db.db.listCollections().toArray();
            console.log(collections.map(c => c.name));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listCollections();
