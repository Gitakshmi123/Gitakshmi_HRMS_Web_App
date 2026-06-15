const fs = require('fs');

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let currentComponent = null;
    let componentDivs = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.match(/export default function|function [A-Z]/)) {
            if (currentComponent) {
                console.log(`Component ${currentComponent}: Div balance ${componentDivs}`);
            }
            currentComponent = line.trim();
            componentDivs = 0;
        }
        
        const open = (line.match(/<div/g) || []).length;
        const close = (line.match(/<\/div>/g) || []).length;
        componentDivs += (open - close);
    }
    console.log(`Component ${currentComponent}: Div balance ${componentDivs}`);
}

analyzeFile('c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx');
