const mongoose = require('mongoose');
const getTenantDB = require('./server/utils/tenantDB');

async function check() {
    try {
        await mongoose.connect('mongodb://localhost:27017/gitakshmi_base');
        const tenantId = '69f8ce66319fbe2bc13704ca'; // From logs
        const db = await getTenantDB(tenantId);
        console.log('DB Name:', db.name);
        const collections = await db.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
