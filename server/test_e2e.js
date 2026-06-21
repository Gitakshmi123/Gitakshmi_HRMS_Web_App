const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  
  // Find a super admin
  const user = await db.collection('users').findOne({ role: { $in: ['SUPER_ADMIN', 'admin', 'company_admin', 'main_company_admin', 'hr', 'HR'] } });
  if (!user) return console.log('No admin found');
  
  const token = jwt.sign(
    { _id: user._id, role: user.role, tenantId: user.mainCompanyId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  const records = [{
    'Name': 'BALDANIYA NITESH HADABHAI',
    'DOB': '06.05.2004',
    'Official Email': 'testnitesh2004@gmail.com', // use slightly different email to test insertion
    'Employee Code': 'TEST10094',
    'Department': 'Full Stack Development',
    'Designation': 'Junior Full Stack Developer',
    'Gender': 'Male',
    'D.O.J': '17.04.2026',
    'Password': 'balnit@2004'
  }];
  
  try {
    const res = await axios.post('http://localhost:5009/api/hr/bulk/upload', { records }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Upload Success:', res.data);
    
    // Now test login
    const loginRes = await axios.post('http://localhost:5009/api/auth/login-employee', {
      identifier: 'testnitesh2004@gmail.com',
      password: 'balnit@2004'
    });
    console.log('Login Success:', loginRes.data.success);
    
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  } finally {
    process.exit(0);
  }
}
run();
