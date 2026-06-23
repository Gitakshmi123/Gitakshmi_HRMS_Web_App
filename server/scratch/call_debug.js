const http = require('http');

http.get('http://localhost:5006/api/debug-candidate-db', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log('Error parsing JSON:', e.message);
            console.log('Raw response:', data);
        }
    });
}).on('error', (err) => {
    console.error('HTTP Request failed:', err.message);
});
