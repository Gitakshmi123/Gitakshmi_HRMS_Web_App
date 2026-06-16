const fs = require('fs');
const path = require('path');

const rootDir = 'd:\\new hrms\\Gitakshmi_HRMS_Web_App';

function searchDir(dir, pattern) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.vite') {
          return;
        }
        searchDir(filePath, pattern);
      } else {
        // Search all files that are not binary
        if (file.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|xlsx|xls|gz|tar|mp4|mov|mp3|wav|woff|woff2|eot|ttf|otf)$/i)) {
          return;
        }
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`Found in: ${filePath}`);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.toLowerCase().includes(pattern.toLowerCase())) {
                console.log(`  Line ${idx + 1}: ${line.trim()}`);
              }
            });
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    });
  } catch (err) {
    // Ignore errors
  }
}

console.log('Searching all files for "supports YYYY-MM-DD"...');
searchDir(rootDir, 'supports YYYY-MM-DD');

console.log('Searching all files for "invalid format"...');
searchDir(rootDir, 'invalid format');
