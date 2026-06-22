const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'pages', 'HR', 'LeavePolicies.jsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find all indices of HolidayMasterPanel
let pos = content.indexOf("HolidayMasterPanel");
let count = 1;
while (pos !== -1) {
    console.log(`Match ${count} at index ${pos}:`);
    const snippet = content.slice(pos - 100, pos + 100);
    console.log(JSON.stringify(snippet));
    pos = content.indexOf("HolidayMasterPanel", pos + 1);
    count++;
}
