const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');

async function flushGarbage() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');

        // Find valid tenant IDs
        const validTenants = await Tenant.find({}).lean();
        const validIds = validTenants.map(t => t._id.toString());
        console.log(`Found ${validIds.length} valid tenant records.`);

        // Find all databases
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();

        let dropped = 0;
        for (const dbInfo of dbs.databases) {
            const name = dbInfo.name;
            if (name.startsWith('company_')) {
                const dbTenantId = name.replace('company_', '');
                if (!validIds.includes(dbTenantId)) {
                    console.log(`Dropping orphaned database: ${name}`);
                    const db = mongoose.connection.useDb(name);
                    await db.dropDatabase();
                    dropped++;
                } else {
                    console.log(`Keeping active database: ${name}`);
                }
            }
        }
        console.log(`Flushed ${dropped} orphaned databases out of cluster to fix Free Tier limit!`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
flushGarbage();
