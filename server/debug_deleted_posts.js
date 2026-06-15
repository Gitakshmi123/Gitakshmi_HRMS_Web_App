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

        for (const dbInfo of companyDbs) {
            const dbName = dbInfo.name;
            const tenantConn = mongoose.connection.useDb(dbName);

            const collections = await tenantConn.db.listCollections().toArray();
            if (collections.some(c => c.name === 'social_posts')) {
                const deletedPosts = await tenantConn.collection('social_posts').find({
                    status: 'deleted'
                }).toArray();

                const linkedinPosts = await tenantConn.collection('social_posts').find({
                    platform: 'linkedin'
                }).toArray();

                if (deletedPosts.length > 0 || linkedinPosts.length > 0) {
                    results.push({
                        dbName,
                        deletedCount: deletedPosts.length,
                        linkedinCount: linkedinPosts.length,
                        deletedPosts: deletedPosts.map(p => ({ id: p._id, platform: p.platform, status: p.status, platformPostId: p.platformPostId })),
                        linkedinPosts: linkedinPosts.map(p => ({ id: p._id, status: p.status, platformPostId: p.platformPostId }))
                    });
                }
            }
        }

        fs.writeFileSync('debug_db_deleted.json', JSON.stringify(results, null, 2));
        console.log('Results written to debug_db_deleted.json');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
