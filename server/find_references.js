const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git') continue;
            searchDir(fullPath, query);
        } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(query)) {
                console.log(`Match found in: ${fullPath}`);
                // Print lines
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.includes(query)) {
                        console.log(`  Line ${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log('Searching for selectBestPolicyForEmployee...');
searchDir(__dirname, 'selectBestPolicyForEmployee');

console.log('\nSearching for getAssignedLeavePolicyForEmployee...');
searchDir(__dirname, 'getAssignedLeavePolicyForEmployee');
