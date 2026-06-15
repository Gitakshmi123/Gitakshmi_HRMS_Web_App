const fs = require('fs');
const path = 'c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const trimmed = lines.slice(0, 1143);
fs.writeFileSync(path, trimmed.join('\n'));
console.log('Trimmed file to 1143 lines');
