const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.useDb('company_gitakshmi_te_git002_f5c2a410');
    
    const applicants = await db.collection('applicants').find({}).toArray();
    console.log('Applicants:');
    applicants.forEach(a => {
      console.log(`- ID: ${a._id}, Name: ${a.name}, source: ${a.source}, intro: ${a.intro}, referral: ${JSON.stringify(a.referral)}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
