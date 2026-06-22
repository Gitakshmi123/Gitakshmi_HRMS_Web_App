const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'pages', 'HR', 'LeavePolicies.jsx');
const content = fs.readFileSync(filePath, 'utf8');

console.log("Index of HolidayCalendarWorkspace:", content.indexOf("HolidayCalendarWorkspace"));
console.log("Index of HolidayMasterPanel:", content.indexOf("HolidayMasterPanel"));

// Let's print the occurrences of HolidayMasterPanel
let pos = content.indexOf("HolidayMasterPanel");
while (pos !== -1) {
    const startLine = content.slice(0, pos).split('\n').length;
    console.log(`HolidayMasterPanel found at line ${startLine}`);
    pos = content.indexOf("HolidayMasterPanel", pos + 1);
}
