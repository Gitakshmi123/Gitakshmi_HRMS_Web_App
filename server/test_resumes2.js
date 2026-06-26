const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/company_gitakshmi_technologies_private').then(async () => {
    const db = mongoose.connection.useDb('company_gitakshmi_technologies_private');
    const apps = await db.collection('applicants').find({resume: {$exists: true}}).limit(5).toArray();
    console.log('Applicants', apps.map(c => c.resume));
    
    const exts = await db.collection('externalemployeerecords').find({}).limit(5).toArray();
    console.log('ExternalEmployeeRecords', exts.map(c => c.documentDetails));
    process.exit(0);
});
