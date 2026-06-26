const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/company_gitakshmi_technologies_private').then(async () => {
    const db = mongoose.connection.useDb('company_gitakshmi_technologies_private');
    const candidates = await db.collection('candidates').find({resume: {$exists: true}}).limit(5).toArray();
    console.log(candidates.map(c => c.resume));
    process.exit(0);
});
