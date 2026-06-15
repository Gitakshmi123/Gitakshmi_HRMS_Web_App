const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const ids = [
    '69ddd0f7800b442c114befc0',
    '69de49aa4304f9247a1085f7',
    '69de1055fc6bc4fe62e16295'
  ].map(id => new mongoose.Types.ObjectId(id));
  
  const users = await mongoose.connection.db.collection('users').find({ _id: { $in: ids } }).toArray();
  console.log('Central users found:', users.map(u => ({ email: u.email, id: u._id })));

  process.exit(0);
}

run().catch(console.error);
