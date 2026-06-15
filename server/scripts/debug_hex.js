const fs = require('fs');
const content = fs.readFileSync('.env');
console.log('Buffer hex:', content.toString('hex'));
