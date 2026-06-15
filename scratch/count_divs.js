const fs = require('fs');
const content = fs.readFileSync('c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx', 'utf8');
const main = content.split('function SignatureModal')[0];
const open = (main.match(/<div/g) || []).length;
const close = (main.match(/<\/div>/g) || []).length;
console.log(`Open: ${open}, Close: ${close}, Balance: ${open - close}`);
