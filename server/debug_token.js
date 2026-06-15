require('dotenv').config();
const mongoose = require('mongoose');
const UserSchema = require('./models/User');
const User = mongoose.model('User', UserSchema);
const jwt = require('jsonwebtoken');

async function debug() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'test@test.com' }).lean();
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  const token = jwt.sign(
    { id: user._id, role: user.role, tenantId: user.tenant },
    process.env.JWT_SECRET
  );

  console.log('Use this token for debugging:', token);
  
  // Now we can try to call the middleware directly or look for logs
  console.log('Simulating request to /api/attendance');
  
  process.exit(0);
}

debug();
