const fs = require('fs');

function findUnbalancedTags(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const stack = [];
    
    // Improved regex to handle self-closing divs and multiline
    // We search for <div (possibly followed by attributes) and > or />
    // And </div >
    const regex = /<div|(?:\s|\/)>|<\/div>/g;
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        const lineRegex = /<div|<\/div>|\/>/g;
        
        while ((match = lineRegex.exec(line)) !== null) {
            const token = match[0];
            if (token === '<div') {
                stack.push({ line: i + 1, type: 'div' });
            } else if (token === '</div>') {
                if (stack.length === 0) {
                    console.log(`!!! Orphaned </div> at line ${i + 1}`);
                } else {
                    stack.pop();
                }
            } else if (token === '/>') {
                // Check if the previous open tag on the stack was a div on the SAME line or recent
                // This is a bit tricky for multiline, but usually self-closing divs are on one line.
                // If it's a self-closing div like <div ... />, we pop it.
                // However, icons like <ShieldCheck /> also end with />.
                // So we only pop if we just pushed a <div.
                // But icons are usually NOT preceded by <div on the same line if they are self-closing.
                
                // Let's refine: if the line has <div and /> and NO </div>, it's likely self-closing.
                if (line.includes('<div') && !line.includes('</div>')) {
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
