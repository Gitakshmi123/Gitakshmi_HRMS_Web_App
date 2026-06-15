const https = require('https');

const city = 'London';
const url = `https://nominatim.openstreetmap.org/search?city=${city}&format=json&addressdetails=1&limit=1`;

const options = {
  headers: {
    'User-Agent': 'HRMS-App-Test/1.0',
    'Accept': 'application/json'
  }
};

console.log("Fetching...");
const req = https.get(url, options, (res) => {
  console.log("Response status:", res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.error("Parse Error:", e.message);
      console.log("Raw Data:", data);
    }
  });
});

req.on('error', (err) => {
  console.error("Req Error: " + err.message);
});
req.end();
