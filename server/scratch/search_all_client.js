const fs = require('fs');
const content = fs.readFileSync('d:/new hrms/Gitakshmi_HRMS_Web_App/client/src/pages/HR/Applicants.jsx', 'utf8');
const lines = content.split('\n');

const query = 'resetOfferLetterUi';
console.log(`Searching for "${query}":`);
lines.forEach((line, index) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
