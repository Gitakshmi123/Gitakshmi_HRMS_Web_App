const { execSync } = require('child_process');
try {
    const gitPath = 'C:\\Program Files\\Git\\cmd\\git.exe';
    console.log(execSync(`"${gitPath}" status`, { encoding: 'utf8' }));
} catch (e) {
    console.error(e);
}
