const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'pages', 'HR', 'LeavePolicies.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Target the third index of HolidayMasterPanel: 279418
const index = 279418;
const targetText = "HolidayMasterPanel";
const replacementText = "HolidayCalendarWorkspace";

const leftPart = content.slice(0, index);
const rightPart = content.slice(index + targetText.length);

const newContent = leftPart + replacementText + rightPart;
fs.writeFileSync(filePath, newContent, 'utf8');

console.log("Successfully replaced HolidayMasterPanel with HolidayCalendarWorkspace by index!");
