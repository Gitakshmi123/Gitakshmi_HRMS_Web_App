const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const companyId = new mongoose.Types.ObjectId('69ddd0f7800b442c114befbe');
  
  // 1. Fix HRMS central users
  const emails = ['baldaniyanitesh2003@gmail.com', 'nitesh@gmail.com', 'niteshbaldanitya@gmail.com'];
  const res1 = await mongoose.connection.db.collection('users').updateMany(
    { email: { $in: emails } },
    { $set: { tenantId: companyId, companyId: companyId } }
  );
  console.log('HRMS Users updated:', res1.modifiedCount);

  // 2. Fix TMS AuthLookups
  const lookups = emails.map(email => ({
    email: email.toLowerCase().trim(),
    tenantId: companyId,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  
  for (const lookup of lookups) {
    await mongoose.connection.db.collection('authlookups').updateOne(
      { email: lookup.email },
      { $set: lookup },
      { upsert: true }
    );
  }
  console.log('TMS AuthLookups ensured for:', emails.join(', '));

  process.exit(0);
}

run().catch(console.error);
