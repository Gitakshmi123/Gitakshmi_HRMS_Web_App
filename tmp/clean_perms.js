const mongoose = require('mongoose');
require('dotenv').config({path: './server/.env'});
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gt_hrms').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, {strict: false, collection: 'users'}));
  const users = await User.find({ role: { $in: ['employee', 'user', 'staff', 'manager'] } });
  
  let count = 0;
  for (const u of users) {
    if (u.permissions && u.permissions.length > 0) {
      const bad = ['overview.dashboard', 'onboarding.dashboard', 'onboarding.tasks', 'onboarding.documents'];
      const oldLen = u.permissions.length;
      const newPerms = u.permissions.filter(p => !bad.includes(p.module));
      if (oldLen !== newPerms.length) {
        await User.updateOne({ _id: u._id }, { $set: { permissions: newPerms } });
        count++;
        console.log(`Updated user ${u.email}`);
      }
    }
  }
  console.log(`Updated ${count} users.`);
  process.exit(0);
}).catch(console.error);
