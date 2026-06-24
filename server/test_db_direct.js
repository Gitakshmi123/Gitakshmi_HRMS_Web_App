const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/hrms_saas');
const db = mongoose.connection;
db.once('open', async () => {
  try {
    const applicants = await db.collection('applicants').find({}).sort({ _id: -1 }).limit(10).toArray();
    console.log('Recent Applicants in DB:');
    applicants.forEach(a => console.log(`- ID: ${a._id}, Name: ${a.name}, DocReqStatus: ${a.documentRequestStatus}, Status: ${a.status}`));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
