const mongoose = require('mongoose');
const uri = 'mongodb+srv://ravaldhruv85_db_user:5NxeIbx7yH3mMYiJ@cluster0.rydhhi4.mongodb.net/hrms_e2e_test?retryWrites=true&w=majority&appName=Cluster0';

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
