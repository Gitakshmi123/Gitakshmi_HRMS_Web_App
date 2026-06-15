const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, 'CreatePost.jsx'), 'utf8');

const tags = [];
const regex = /<\/?(div|Card|Modal|Avatar|Button|Checkbox|TextArea|Select|Divider|DatePicker|Upload|Switch|span|label|p|li|ul|Info|LinkIcon|ImageIcon|Video|AlertCircle|Calendar|X|Send|UploadIcon|App|ProtectedRoute| EssLayout|Navigate|Route|contextHolder)/g;
let match;

while ((match = regex.exec(content)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) {
        const opening = tag.replace('</', '<');
        const last = tags.pop();
        if (last !== opening) {
            console.log(`Mismatch: expected ${last} to be closed, but found ${tag} at pos ${match.index}`);
            tags.push(last); // push it back
        }
    } else if (!tag.endsWith('/>')) {
        // Check if it's a self-closing tag without /> (not common in JSX but possible with some parsers)
        // But in JSX, components like DatePicker are usually self-closing or have a closing tag.
        tags.push(tag);
    }
}

console.log('Unclosed tags:', tags);
