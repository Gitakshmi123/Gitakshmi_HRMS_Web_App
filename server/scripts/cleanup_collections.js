/**
 * cleanup_collections.js
 * Drops all company_* databases NOT linked to active tenants.
 * Keeps the hrms, admin, and local databases intact.
 * Run with: node scripts/cleanup_collections.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function cleanup() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();

    // 1. Get active tenant IDs from hrms DB
    const hrmsDb = mongoose.connection.useDb('hrms');
    const tenants = await hrmsDb.db.collection('tenants').find({}).toArray();
    const activeTenantIds = new Set(tenants.map(t => t._id.toString()));
    console.log(`\n📋 Active tenants (${tenants.length}):`, [...activeTenantIds]);

    // 2. Build set of expected company DB names
    const expectedDbs = new Set(tenants.map(t => `company_${t._id.toString()}`));
    console.log('\n📦 Expected company databases:', [...expectedDbs]);

    // 3. List all company_* DBs
    const companyDbs = databases.filter(d => d.name.startsWith('company_'));
    console.log(`\n🗃️  Found ${companyDbs.length} company_* databases in Atlas`);

    // 4. Identify orphaned
    const orphaned = companyDbs.filter(d => !expectedDbs.has(d.name));
    console.log(`\n🗑️  Orphaned databases to drop (${orphaned.length}):`, orphaned.map(d => d.name));

    // 5. Count total collections before cleanup
    let totalBefore = 0;
    for (const d of databases) {
        const db = mongoose.connection.useDb(d.name);
        const cols = await db.db.listCollections().toArray();
        totalBefore += cols.length;
    }
    console.log(`\n📊 Total collections BEFORE cleanup: ${totalBefore}`);

    // 6. Drop orphaned databases
    for (const d of orphaned) {
        const db = mongoose.connection.useDb(d.name);
        const cols = await db.db.listCollections().toArray();
        console.log(`  Dropping ${d.name} (${cols.length} collections)...`);
        await db.db.dropDatabase();
        console.log(`  ✅ Dropped ${d.name}`);
    }

    // 7. Also clean up stale collections from hrms that don't belong
    const EXPECTED_HRMS_COLS = [
        'tenants', 'users', 'activities', 'counters', 'notifications'
    ];
    const hrmsAllCols = await hrmsDb.db.listCollections().toArray();
    const staleHrmsCols = hrmsAllCols.filter(c => !EXPECTED_HRMS_COLS.includes(c.name));
    if (staleHrmsCols.length) {
        console.log(`\n🧹 Stale hrms collections to clean (${staleHrmsCols.length}):`, staleHrmsCols.map(c=>c.name));
        for (const c of staleHrmsCols) {
            await hrmsDb.db.dropCollection(c.name);
            console.log(`  ✅ Dropped hrms.${c.name}`);
        }
    }

    // 8. Count after
    const { databases: dbsAfter } = await admin.listDatabases();
    let totalAfter = 0;
    for (const d of dbsAfter) {
        const db = mongoose.connection.useDb(d.name);
        const cols = await db.db.listCollections().toArray();
        totalAfter += cols.length;
        if (cols.length > 0) console.log(`  ${d.name}: ${cols.length} cols`);
    }
    console.log(`\n📊 Total collections AFTER cleanup: ${totalAfter}`);
    console.log(`✅ Freed up ${totalBefore - totalAfter} collections`);

    await mongoose.disconnect();
    process.exit(0);
}

cleanup().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
