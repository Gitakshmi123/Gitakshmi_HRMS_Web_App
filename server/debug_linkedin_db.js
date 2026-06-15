const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function debug() {
    const results = [];
    try {
        await mongoose.connect(MONGO_URI);
        const adminDb = mongoose.connection.db.admin();
        const dbsRes = await adminDb.listDatabases();

        const companyDbs = dbsRes.databases.filter(d => d.name.startsWith('company_'));

        console.log(`Found ${companyDbs.length} potential company databases.`);

        for (const dbInfo of companyDbs) {
            const dbName = dbInfo.name;
            const tenantConn = mongoose.connection.useDb(dbName);

            const collections = await tenantConn.db.listCollections().toArray();
            const hasPosts = collections.some(c => c.name === 'social_posts');
            const hasAccounts = collections.some(c => c.name === 'social_accounts');

            if (hasPosts || hasAccounts) {
                const posts = hasPosts ? await tenantConn.collection('social_posts').find({
                    platform: 'linkedin'
                }).toArray() : [];

                const accounts = hasAccounts ? await tenantConn.collection('social_accounts').find({
                    platform: 'linkedin'
                }).toArray() : [];

                if (posts.length > 0 || accounts.length > 0) {
                    results.push({
                        dbName,
                        accounts: accounts.map(a => ({ name: a.accountName, id: a.platformAccountId, status: a.status })),
                        posts: posts.map(p => ({ id: p._id, status: p.status, platformPostId: p.platformPostId }))
                    });
                }
            }
        }

        fs.writeFileSync('debug_db_results.json', JSON.stringify(results, null, 2));
        console.log('Results written to debug_db_results.json');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
