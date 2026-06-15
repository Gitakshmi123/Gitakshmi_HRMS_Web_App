const mongoose = require('mongoose');

async function checkAuditLogs() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        
        const logs = await db.collection('auditlogs').find({}).sort({ timestamp: -1 }).limit(10).toArray();
        console.log('--- LATEST AUDIT LOGS ---');
        logs.forEach(l => {
            console.log(`Time: ${l.timestamp} | Action: ${l.action} | Message: ${l.message}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkAuditLogs();
