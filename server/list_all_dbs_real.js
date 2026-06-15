const mongoose = require('mongoose');

async function listAllDbs() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0');
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        console.log('--- ALL DATABASES ---');
        dbs.databases.forEach(db => {
            console.log(db.name);
        });
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

listAllDbs();
