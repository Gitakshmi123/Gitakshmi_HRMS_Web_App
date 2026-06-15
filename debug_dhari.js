const https = require('https');

const city = 'dhari';
const url = `https://api.postalpincode.in/postoffice/${city}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json[0]?.PostOffice) {
          console.log(`Found ${json[0].PostOffice.length} results.`);
          json[0].PostOffice.forEach(po => {
              console.log(`${po.Name}, ${po.District}, ${po.State}, ${po.Pincode}`);
          });
      } else {
          console.log("No results");
      }
    } catch (e) {
      console.error(e.message);
    }
  });
}).on('error', (err) => {
  console.error("Error: " + err.message);
});
