const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
    try {
        const token = jwt.sign({ id: '000000000000000000000000', role: 'hr', tenantId: '697c757f5977cdc15b8dd10c' }, 'hrms_secret_key_123');
        console.log('TOKEN', token.slice(0, 16), '...');
        const res = await axios.get('http://localhost:5003/api/hr/attendance-calendar?year=2026&month=2', { headers: { Authorization: 'Bearer ' + token } });
        console.log('STATUS', res.status);
        if (!res.data || !Array.isArray(res.data.days)) {
            console.error('NO DAYS', res.data);
            return;
        }
        console.log('DAYS:', res.data.days.length);
        res.data.days.forEach(d => {
            console.log(JSON.stringify({ date: d.date, dayName: d.dayName, isWeeklyOff: d.isWeeklyOff, finalStatus: d.finalStatus, approvedLeave: d.approvedLeave, attendance: d.attendance }));
        });
    } catch (err) {
        if (err.response) {
            console.error('ERR_STATUS', err.response.status, JSON.stringify(err.response.data));
        } else {
            console.error('ERR', err.message);
        }
    }
})();