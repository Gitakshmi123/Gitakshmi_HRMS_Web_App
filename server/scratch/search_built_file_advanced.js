const fs = require('fs');
const path = require('path');

const filePath = 'd:\\new hrms\\Gitakshmi_HRMS_Web_App\\server\\public\\assets\\index-BHIxJZ4a.js';

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File size:', content.length);
  
  const query = 'invalid format';
  let idx = -1;
  while ((idx = content.indexOf(query, idx + 1)) !== -1) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + query.length + 100);
    console.log(`Match at ${idx}: ...${content.slice(start, end)}...`);
  }
} else {
  console.log('File does not exist');
}
