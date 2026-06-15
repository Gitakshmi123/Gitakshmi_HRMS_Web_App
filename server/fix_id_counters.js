/**
 * Fix ID Counter Script
 * - Removes stale Counter docs from old idGenerator system
 * - Resets/sets DocumentCounter for EMP based on company configured startFrom
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function fixCounters() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected.');

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    const tenantDbs = dbs.databases.filter(d =>
        d.name.startsWith('company_') || d.name.startsWith('tenant_')
    );

    console.log(`Found ${tenantDbs.length} tenant databases.`);

    for (const dbInfo of tenantDbs) {
        console.log(`\n=== Processing: ${dbInfo.name} ===`);
        const db = mongoose.connection.useDb(dbInfo.name);

        // 1. Delete stale counters from old idGenerator system (entity-based)
        const delResult = await db.collection('counters').deleteMany({
            entity: { $exists: true }
        });
        console.log(`  Deleted ${delResult.deletedCount} stale entity-based counters`);

        // 2. List employees with new ID format to find highest used number
        const employees = await db.collection('employees').find({
            employeeId: /^EMP-\d{4}-\d+$/
        }).project({ employeeId: 1 }).toArray();

        console.log(`  Employees with new format IDs:`, employees.map(e => e.employeeId));

        // 3. Find the highest counter number used
        let highestSeq = 0;
        employees.forEach(emp => {
            const parts = emp.employeeId.split('-');
            const seq = parseInt(parts[2]);
            if (!isNaN(seq) && seq > highestSeq) highestSeq = seq;
        });
        console.log(`  Highest EMP sequence used: ${highestSeq}`);

        // 4. Get the DocumentType config for EMP (to know startFrom)
        const DocCounter = mongoose.connection.useDb('hrms'); // Main DB for company configs
        // Actually DocumentCounter is in the main DB

        // Find tenant ID from company configs
        const mainDb = mongoose.connection.db;
        const tenantDoc = await mainDb.collection('tenants').findOne({});
        if (!tenantDoc) {
            console.log('  No tenant found in main DB, skipping DocumentCounter fix');
            continue;
        }

        // Get DocumentType startFrom for EMP
        const docType = await mainDb.collection('documenttypes').findOne({
            companyId: tenantDoc._id,
            key: 'EMP'
        });

        console.log(`  EMP DocumentType config:`, docType ? { startFrom: docType.startFrom, prefix: docType.prefix } : 'NOT FOUND');

        const startFrom = docType ? docType.startFrom : 1000;
        const currentYear = String(new Date().getFullYear());

        // 5. Set DocumentCounter to max of (startFrom - 1) and highest used sequence
        // This ensures next generated ID starts correctly
        const correctLastNumber = Math.max(highestSeq, startFrom - 1);

        const counterResult = await mainDb.collection('documentcounters').findOneAndUpdate(
            {
                companyId: tenantDoc._id,
                documentType: 'EMP',
                financialYear: currentYear
            },
            {
                $set: {
                    companyId: tenantDoc._id,
                    documentType: 'EMP',
                    financialYear: currentYear,
                    lastNumber: correctLastNumber
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        console.log(`  Set EMP DocumentCounter lastNumber to: ${correctLastNumber}`);
        console.log(`  Next employee will get: EMP-${currentYear}-${String(correctLastNumber + 1).padStart(4, '0')}`);
    }

    console.log('\n✅ Counter fix complete!');
    await mongoose.disconnect();
    process.exit(0);
}

fixCounters().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
