const axios = require('axios');

async function testPublish() {
    try {
        // We need a valid token to test this, or we can bypass auth if we run it on server
        // But let's try to simulate the call that failed
        const response = await axios.post('http://localhost:5003/api/hrms/hr/career/publish', {
            applyPage: {
                sections: [],
                theme: {}
            }
        }, {
            headers: {
                'X-Tenant-ID': '6783637e96b866da2a13ccbf', // Use a real tenant ID from your DB
                'Authorization': `Bearer ...` // We need a real token here
            }
        });
        console.log(response.data);
    } catch (error) {
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

// Since I can't easily get a token, I'll just check the code again.
