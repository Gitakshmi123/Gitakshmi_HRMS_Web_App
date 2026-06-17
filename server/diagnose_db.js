const mongoose = require('mongoose');

async function main() {
    try {
        const uri = "mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0";
        await mongoose.connect(uri);
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases.filter(d => d.name.startsWith('company_'))) {
            const db = mongoose.connection.useDb(dbInfo.name);
            const rawApplicants = await db.collection('applicants').find({ name: /raval|dhruv/i }).toArray();
            if (rawApplicants.length > 0) {
                console.log(`\nFound in Database: ${dbInfo.name}`);
                for (const app of rawApplicants) {
                    console.log(`Applicant: ${app.name} (${app._id})`);
                    console.log(`  salarySnapshotId: ${app.salarySnapshotId}`);
                    console.log(`  salarySnapshot:`, app.salarySnapshot);
                    if (app.salarySnapshotId) {
                        const snapshot = await db.collection('employeesalarysnapshots').findOne({ _id: app.salarySnapshotId });
                        console.log(`  Snapshot ID:`, snapshot?._id);
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
