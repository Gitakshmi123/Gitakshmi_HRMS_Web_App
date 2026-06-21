const fs = require('fs');
const filePath = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// 1. Remove the dead block at the end of the file (> 4600)
const deadBlockStart = lines.findIndex((l, i) => i > 4600 && l.includes('// Excel bulk upload handler'));
if (deadBlockStart !== -1) {
    lines.splice(deadBlockStart);
}

// 2. Remove the block I accidentally injected around line 1292
// It starts with '// Excel bulk upload handler' and ends just before 'return ('
const injectedStart = lines.findIndex((l, i) => i > 1200 && i < 1350 && l.includes('// Excel bulk upload handler'));
if (injectedStart !== -1) {
    let injectedEnd = injectedStart;
    while (injectedEnd < lines.length && !lines[injectedEnd].includes('    return (')) {
        injectedEnd++;
    }
    // Delete from injectedStart up to injectedEnd - 1
    lines.splice(injectedStart, injectedEnd - injectedStart);
}

fs.writeFileSync(filePath, lines.join('\n'));
