
const mongoose = require('mongoose');
const mongoUri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';

async function checkUsers() {
  try {
    await mongoose.connect(mongoUri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({ role: 'psa' }).lean();
    console.log('PSA_USERS:' + JSON.stringify(users));
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}
checkUsers();
