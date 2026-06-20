const fs = require('fs');
const path = require('path');

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace email input with autocomplete
    content = content.replace(/name="email"\s*placeholder=/g, 'name="email"\n                                                autoComplete="username"\n                                                placeholder=');
    
    // Replace password input with autocomplete
    content = content.replace(/name="password"\s*placeholder=/g, 'name="password"\n                                                    autoComplete="new-password"\n                                                    placeholder=');
    
    fs.writeFileSync(filePath, content);
    console.log('Updated ' + filePath);
}

const p = path.join('d:', 'new hrms', 'Gitakshmi_HRMS_Web_App', 'client', 'src', 'pages', 'PSA');
updateFile(path.join(p, 'AddCompany.jsx'));
updateFile(path.join(p, 'EditCompany.jsx'));
