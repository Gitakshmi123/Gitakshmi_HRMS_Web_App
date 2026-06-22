const { execSync } = require('child_process');

function runCmd(cmd) {
    try {
        console.log(`Running: ${cmd}`);
        const out = execSync(cmd, { encoding: 'utf8' });
        console.log(out);
        return true;
    } catch (e) {
        console.error(`Failed: ${cmd}`, e.message);
        return false;
    }
}

// Try standard git first
let success = runCmd('git add .');
if (success) {
    runCmd('git commit -m "feat: implement SAP SuccessFactors-style Enterprise Holiday Calendar Workspace and integrations"');
    runCmd('git push');
} else {
    // Try absolute path check in typical Local AppData or Program Files
    const paths = [
        'C:\\Program Files\\Git\\bin\\git.exe',
        'C:\\Program Files (x86)\\Git\\bin\\git.exe',
        `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Git\\bin\\git.exe`
    ];
    for (const p of paths) {
        console.log(`Checking path: ${p}`);
        if (runCmd(`"${p}" add .`)) {
            runCmd(`"${p}" commit -m "feat: implement SAP SuccessFactors-style Enterprise Holiday Calendar Workspace and integrations"`);
            runCmd(`"${p}" push`);
            break;
        }
    }
}
