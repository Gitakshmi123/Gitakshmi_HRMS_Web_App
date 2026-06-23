const { execSync } = require('child_process');
try {
    console.log(execSync('where git', { encoding: 'utf8' }));
} catch (e) {
    try {
        console.log(execSync('where /r "C:\\Program Files" git.exe', { encoding: 'utf8' }));
    } catch (err) {
        console.error('Git not found', err);
    }
}
