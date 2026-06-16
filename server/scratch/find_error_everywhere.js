const fs = require('fs');
const path = require('path');

const rootDir = 'd:\\new hrms\\Gitakshmi_HRMS_Web_App';

function searchDir(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (file === '.git' || file === '.vite') {
          return;
        }
        searchDir(filePath);
      } else {
        if (file.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|xlsx|xls|gz|tar|mp4|mov|mp3|wav|woff|woff2|eot|ttf|otf)$/i)) {
          return;
        }
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('supports YYYY-MM-DD') || content.includes('invalid format')) {
            console.log(`Found in: ${filePath}`);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.includes('supports YYYY-MM-DD') || line.includes('invalid format')) {
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

searchDir(rootDir);
