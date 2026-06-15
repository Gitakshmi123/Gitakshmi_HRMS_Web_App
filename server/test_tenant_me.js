
const axios = require('axios');

async function testMe() {
  try {
    const url = 'http://localhost:5003/api/auth/login-unified';
    const payload = {
       identifier: "Hello@gmain.com",
       password: "123456789"
    };

    console.log("Logging in...");
    const loginRes = await axios.post(url, payload);
    const token = loginRes.data.token;
    console.log("Logged in!");

    const meUrl = 'http://localhost:5003/api/tenants/me';
    console.log(`Getting tenant info from ${meUrl}...`);
    const meRes = await axios.get(meUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("TENANT INFO:", JSON.stringify(meRes.data, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("FAILED!");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error:", err.message);
    }
    process.exit(1);
  }
}

testMe();
