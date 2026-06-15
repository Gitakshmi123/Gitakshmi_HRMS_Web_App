const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
    try {
        const tenantId = process.argv[2] || '697c757f5977cdc15b8dd10c';
        const token = jwt.sign({ id: '000000000000000000000000', role: 'hr', tenantId }, 'hrms_secret_key_123');
        const res = await axios.get('http://localhost:5003/api/attendance/settings', { headers: { Authorization: 'Bearer ' + token } });
        console.log('STATUS', res.status);
        console.log('DATA', res.data);
    } catch (err) {
        if (err.response) console.error('ERR_STATUS', err.response.status, err.response.data);
        else console.error('ERR', err.message);
    }
})();