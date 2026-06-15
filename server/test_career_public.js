const axios = require('axios');

const tenantId = "6a1eb73c056191af5f4cf27c";

async function test() {
    try {
        const res = await axios.get(`http://localhost:5006/api/career/public/${tenantId}`);
        console.log("API Response Status:", res.status);
        console.log("API Response Data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Fetch error:", e.message);
        if (e.response) {
            console.error("Response data:", e.response.data);
        }
    }
}

test();
