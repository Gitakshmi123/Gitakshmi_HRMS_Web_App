const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testFrontendProxy() {
  try {
    // We need to create a valid JWT for baldaniyanitesh2003@gmail.com
    const token = jwt.sign(
      { 
        id: 'user_id', 
        email: 'baldaniyanitesh2003@gmail.com',
        role: 'employee',
        tenantId: '69ddd0f7800b442c114befbe'
      }, 
      process.env.JWT_SECRET || 'hrms_secret_key_123',
      { expiresIn: '1h' }
    );

    const res = await axios.get('http://localhost:5001/api/tasks', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('PROXY_RESPONSE:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('PROXY_ERR:', err.response.status, err.response.data);
    } else {
      console.error('PROXY_ERR:', err.message);
    }
  }
}

testFrontendProxy();
