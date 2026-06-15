const fs = require('fs');

function findUnbalancedTags(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const stack = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Find all <div or </div>
        const tokens = line.match(/<div|<\/div>/g) || [];
        
        for (const token of tokens) {
            if (token === '<div') {
                stack.push({ line: i + 1, type: 'div' });
            } else if (token === '</div>') {
                if (stack.length === 0) {
                    console.log(`!!! Orphaned </div> at line ${i + 1}`);
                } else {
                    stack.pop();
                }
            }
        }
    }
    
    console.log(`Remaining open tags: ${stack.length}`);
    stack.forEach(tag => {
        console.log(`Unclosed ${tag.type} from line ${tag.line}`);
    });
}

findUnbalancedTags('c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx');
