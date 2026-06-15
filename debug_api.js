const https = require('https');

const city = 'surat';
const url = `https://api.postalpincode.in/postoffice/${city}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.error(e.message);
    }
  });
}).on('error', (err) => {
  console.error("Error: " + err.message);
});
