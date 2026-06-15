const fs = require('fs');

function checkBrackets(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const stack = [];
    const brackets = {
        '{': '}',
        '(': ')',
        '[': ']'
    };
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (brackets[char]) {
            stack.push({ char, pos: i });
        } else if (Object.values(brackets).includes(char)) {
            if (stack.length === 0) {
                console.log(`!!! Orphaned ${char} at position ${i}`);
                return;
            }
            const last = stack.pop();
            if (brackets[last.char] !== char) {
                console.log(`!!! Mismatch: ${last.char} at pos ${last.pos} closed by ${char} at pos ${i}`);
                return;
            }
        }
    }
    
    console.log(`Remaining: ${stack.length}`);
    stack.forEach(b => console.log(`Unclosed ${b.char} at pos ${b.pos}`));
}

checkBrackets('c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx');
