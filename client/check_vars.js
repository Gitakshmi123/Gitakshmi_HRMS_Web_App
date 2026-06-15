const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'HR', 'EmployeeForm.jsx'), 'utf8');

const undefinedVars = [];
// This is a naive check
const usageRegex = /\b([a-zA-Z_]\w*)\b(?!\s*=|\s*[:(])/g;
// We should exclude keywords, known states, etc.
// But it's too complex for a script.

// Instead, let's just grep for employeeCode usage
console.log('EmployeeCode usage:', content.match(/employeeCode/g));
