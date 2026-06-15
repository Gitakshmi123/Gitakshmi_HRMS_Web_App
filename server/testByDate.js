const axios = require('axios');
(async () => {
    try {
        const date = '2026-01-15';
        const url = `http://localhost:5005/api/attendance/by-date?date=${encodeURIComponent(date)}`;
        console.log('Requesting', url);
        const res = await axios.get(url, { timeout: 10000 });
        console.log('Status', res.status);
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        if (err.response) console.error('HTTP Error', err.response.status, err.response.data);
        else console.error('Error', err.message);
        process.exit(1);
    }
})();
