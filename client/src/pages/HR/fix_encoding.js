const fs = require('fs');
const path = 'Applicants.jsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
let count = 0;
const newLines = lines.map(line => {
    if (line.includes('absolute left-3 top-1/2 -translate-y-1/2 text-slate-400')) {
        count++;
        return line.replace(/ðŸ” /g, '').replace(/ðŸ”/g, '');
    }
    if (line.includes('req.location') && line.includes('Full-time')) {
        count++;
        return line.replace(/ðŸ“ /g, '').replace(/ðŸ“/g, '').replace(/â€¢/g, '|');
    }
    return line;
});
fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('Fixed ' + count + ' lines');
