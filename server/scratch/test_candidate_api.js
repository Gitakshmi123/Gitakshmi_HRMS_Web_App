const jwt = require('jsonwebtoken');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const secret = process.env.JWT_SECRET || 'hrms_secret_key_123';
const payload = {
    id: '6a38bfd2df2bf9edadde3852',
    tenantId: '6a38a703cb814b0fb61b362f',
    role: 'candidate'
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });

const options = {
    hostname: 'localhost',
    port: 5006,
    path: '/api/candidate/dashboard',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log('Error parsing:', e.message);
            console.log('Raw:', data);
        }
    });
});

req.on('error', (err) => {
    console.error('Request failed:', err.message);
});

req.end();
