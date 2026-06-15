const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

async function diagnose() {
  const results = {
    connected: false,
    emailSearch: 'git@gmail.com',
    user: null,
    passwordMatch: null,
    error: null
  };

  try {
    await mongoose.connect(MONGO_URI);
    results.connected = true;

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const user = await User.findOne({ email: /git@gmail\.com/i }).lean();
    
    if (user) {
      results.user = { id: user._id, role: user.role, tenant: user.tenant, passwordHash: user.password };
      
      const testPass = '123456';
      if (user.password) {
        if (user.password.startsWith('$2')) {
          results.passwordMatch = await bcrypt.compare(testPass, user.password);
        } else {
          results.passwordMatch = (user.password === testPass);
        }
      }
    }

    fs.writeFileSync('diag_output_pass.json', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('diag_output_pass.json', JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  }
}

diagnose();
