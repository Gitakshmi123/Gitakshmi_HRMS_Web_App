const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
    try {
        const token = jwt.sign({ id: '69c56fa3d01f8b09a61759d5', email: 'git@gmail.com', role: 'hr', tenantId: '69c56fa3d01f8b09a61759d4' }, 'hrms@123');
        const res = await axios.get('http://localhost:5003/api/tenants/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('SUCCESS:', res.status, res.data);
    } catch (e) {
        if (e.response) {
            console.log('FAILED:', e.response.status, e.response.data);
        } else {
            console.log('ERROR:', e.message);
        }
    }
})();
