const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
    try {
        const token = jwt.sign({ id: '000000000000000000000000', role: 'hr', tenantId: '697c757f5977cdc15b8dd10c' }, 'hrms_secret_key_123');
        const res = await axios.get('http://localhost:5003/api/hr/attendance-calendar?year=2026&month=2', { headers: { Authorization: 'Bearer ' + token } });
        console.log('STATUS', res.status);
        console.log('DAYS_COUNT', Array.isArray(res.data.days) ? res.data.days.length : 'no-days');
        console.log('SAMPLE', res.data.days ? res.data.days.slice(0, 3) : res.data);
    } catch (err) {
        if (err.response) {
            console.error('ERR_STATUS', err.response.status, err.response.data);
        } else {
            console.error('ERR', err.message);
        }
    }
})();