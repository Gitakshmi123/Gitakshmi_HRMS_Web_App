const https = require('https');

const city = 'Toronto';
const url = `https://nominatim.openstreetmap.org/search?city=${city}&format=json&addressdetails=1&limit=1`;

const options = {
  headers: {
    'User-Agent': 'HRMS-App-Test/1.0'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("Postcode present:", json[0]?.address?.postcode);
      console.log(JSON.stringify(json[0]?.address, null, 2));
    } catch (e) {
      console.error(e.message);
    }
  });
}).on('error', (err) => {
  console.error("Error: " + err.message);
});
