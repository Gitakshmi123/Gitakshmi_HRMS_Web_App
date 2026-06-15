const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const UserSchema = require('./models/User');
  const User = mongoose.model('User', UserSchema);
  
  const users = await User.find({}).lean();
  console.log('USERS IN DB:', JSON.stringify(users, null, 2));
  process.exit(0);
}

checkUsers();
