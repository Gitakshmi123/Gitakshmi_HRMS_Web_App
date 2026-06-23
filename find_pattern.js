const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'HR', 'LeavePolicies.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Total lines:', lines.length);

const query = process.argv[2] || 'Formula';
console.log(`Searching for "${query}":`);
let count = 0;
lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
        count++;
        if (count <= 50) {
            console.log(`${idx + 1}: ${line.trim().substring(0, 100)}`);
        }
    }
});
console.log(`Found ${count} occurrences.`);
