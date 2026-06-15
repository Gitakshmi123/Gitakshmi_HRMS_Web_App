const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const db = mongoose.connection.useDb('company_pnr');
        const Applicant = db.collection('applicants');
        const Snapshot = db.collection('employeesalarysnapshots');

        const ids = ["6a26c9b0e456b894e90f83ab", "6a290ef1f5b907fea264f76c"];
        for (const id of ids) {
            const applicant = await Applicant.findOne({ _id: new mongoose.Types.ObjectId(id) });
            if (applicant) {
                console.log(`\n=================== Applicant: ${applicant.name} (${id}) ===================`);
                console.log(JSON.stringify(applicant, null, 2));
                
                const snapshot = await Snapshot.findOne({ applicant: applicant._id });
                if (snapshot) {
                    console.log('Linked Snapshot:');
                    console.log(JSON.stringify(snapshot, null, 2));
                } else {
                    console.log('No direct snapshot found by applicant field. Searching all for this applicant...');
                    const snaps = await Snapshot.find({ applicant: applicant._id }).toArray();
                    console.log('Found snapshots:', snaps.length);
                }
            }
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
