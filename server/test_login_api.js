
const axios = require('axios');

async function testLogin() {
  try {
    const url = 'http://localhost:5003/api/auth/login-unified';
    const payload = {
      identifier: "Hello@gmain.com",
      password: "123456789"
    };

    console.log(`Sending login request to ${url}...`);
    const res = await axios.post(url, payload);
    console.log("LOGIN SUCCESSFUL!");
    console.log("User:", JSON.stringify(res.data.user, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("LOGIN FAILED!");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error:", err.message);
    }
    process.exit(1);
  }
}

testLogin();
