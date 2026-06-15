
const axios = require('axios');

async function testApi() {
  try {
    const res = await axios.get('http://localhost:5003/api/health');
    console.log('Health check success:', res.data);
  } catch (err) {
    console.error('Health check failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

testApi();
