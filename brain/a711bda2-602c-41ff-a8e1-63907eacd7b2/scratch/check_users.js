const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({}).limit(10).lean();
  console.log('Total Users:', await User.countDocuments({}));
  console.log('Sample Users:', JSON.stringify(users, null, 2));
  process.exit(0);
}
check();
