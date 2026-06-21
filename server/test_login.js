const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('balnit@2004', salt);
    await db.collection('users').updateOne({ email: 'baldaniyanitesh2003@gmail.com' }, { $set: { password: hash } });
    console.log('DB Updated with new password hash');
    
    // Test the login
    const res = await axios.post('http://localhost:5009/api/auth/login-employee', {
      identifier: 'baldaniyanitesh2003@gmail.com',
      password: 'balnit@2004'
    });
    
    console.log('Login Response Success:', res.data.success);
    console.log('Login Role:', res.data.user.role);
    
  } catch (e) {
    console.error('Login Failed:', e.response ? e.response.data : e.message);
  } finally {
    process.exit(0);
  }
}

test();
