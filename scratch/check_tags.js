const fs = require('fs');

function checkTags(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let divOpen = 0;
    let divClose = 0;
    let braceOpen = 0;
    let braceClose = 0;
    let parenOpen = 0;
    let parenClose = 0;
    let fragmentOpen = 0;
    let fragmentClose = 0;

    const divOpenMatches = content.match(/<div/g) || [];
    const divCloseMatches = content.match(/<\/div>/g) || [];
    const braceOpenMatches = content.match(/{/g) || [];
    const braceCloseMatches = content.match(/}/g) || [];
    const parenOpenMatches = content.match(/\(/g) || [];
    const parenCloseMatches = content.match(/\)/g) || [];
    const fragmentOpenMatches = content.match(/<>/g) || [];
    const fragmentCloseMatches = content.match(/<\/>/g) || [];

    console.log(`Divs: Open ${divOpenMatches.length}, Close ${divCloseMatches.length}`);
    console.log(`Braces: Open ${braceOpenMatches.length}, Close ${braceCloseMatches.length}`);
    console.log(`Parens: Open ${parenOpenMatches.length}, Close ${parenCloseMatches.length}`);
    console.log(`Fragments: Open ${fragmentOpenMatches.length}, Close ${fragmentCloseMatches.length}`);
    
    if (divOpenMatches.length !== divCloseMatches.length) {
        console.log("!!! DIV MISMATCH !!!");
    }
}

checkTags('c:\\HRMS\\client\\src\\pages\\ApplicationTrack.jsx');
