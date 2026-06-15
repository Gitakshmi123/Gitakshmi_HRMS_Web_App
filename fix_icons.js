const fs = require('fs');
const path = require('path').join(__dirname, 'client', 'src', 'pages', 'HR', 'Applicants.jsx');
let content = fs.readFileSync(path, 'utf8');

// Fix search icon
content = content.replace(/<span className="absolute left-3 top-1\/2 -translate-y-1\/2 text-slate-400">[^<]+<\/span>/,
    '<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>');

fs.writeFileSync(path, content);
console.log('Successfully fixed search icon');
