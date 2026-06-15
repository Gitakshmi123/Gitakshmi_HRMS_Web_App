const mongoose = require('mongoose');
const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function listDbs() {
    try {
        console.log('Connecting to', uri.substring(0, 50) + '...');
        const conn = await mongoose.connect(uri);
        const admin = conn.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('✅ Databases on this cluster:');
        console.log(dbs.databases.map(db => db.name));
        await mongoose.disconnect();
    } catch (e) {
        console.error('❌ Error listing databases:', e.message);
    }
}
listDbs();
