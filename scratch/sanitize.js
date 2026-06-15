const fs = require('fs');
const path = 'c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/[^\x00-\x7F]/g, '-');
fs.writeFileSync(path, content);
console.log('Non-ASCII characters replaced with -');
