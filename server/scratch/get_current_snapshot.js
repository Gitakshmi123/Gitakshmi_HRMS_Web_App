const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const db = mongoose.connection.useDb('company_pnr');
        const Snapshot = db.collection('employeesalarysnapshots');
        const snapshots = await Snapshot.find({}).toArray();
        console.log('Snapshots count:', snapshots.length);
        if (snapshots.length > 0) {
            console.log('Latest Snapshot details:');
            const latest = snapshots[snapshots.length - 1];
            console.log(JSON.stringify(latest, null, 2));
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
