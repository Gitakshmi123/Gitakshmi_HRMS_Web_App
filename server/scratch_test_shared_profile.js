const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

function toFileUrl(p) {
    const abs = path.resolve(p).replace(/\\/g, '/');
    return `file:///${abs.replace(/^([A-Za-z]):/, '$1:')}`;
}

function clearProfileLocks(profileDir) {
    try {
        const lockFile = path.join(profileDir, '.lock');
        if (fs.existsSync(lockFile)) {
            console.log("Removing profile lock file...");
            fs.unlinkSync(lockFile);
        }
    } catch (e) {
        console.warn("Failed to clear profile lock:", e.message);
    }
}

async function convertSingle(inputPath, outputDir, profileDir, index) {
    const start = Date.now();
    const userProfile = toFileUrl(profileDir);
    clearProfileLocks(profileDir);

    const args = [
        `-env:UserInstallation=${userProfile}`,
        '--headless',
        '--norestore',
        '--nolockcheck',
        '--nologo',
        '--nodefault',
        '--convert-to', 'pdf',
        '--outdir', outputDir,
        inputPath
    ];

    const sofficeExe = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
    
    return new Promise((resolve, reject) => {
        const child = spawn(sofficeExe, args, { windowsHide: true });
        child.on('close', (code) => {
            console.log(`Conversion ${index} completed in ${Date.now() - start}ms with exit code ${code}`);
            resolve();
        });
        child.on('error', reject);
    });
}

async function main() {
    const docxPath = `D:\\Project\\GT_HRMS\\server\\uploads\\templates\\template-template-1780491384645.docx`;
    const outputDir = path.join(__dirname, 'uploads/shared_test_output');
    const profileDir = path.join(os.tmpdir(), 'hrms_libreoffice_shared_profile');
    
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    console.log("Running 3 consecutive conversions using shared profile...");
    
    await convertSingle(docxPath, outputDir, profileDir, 1);
    await convertSingle(docxPath, outputDir, profileDir, 2);
    await convertSingle(docxPath, outputDir, profileDir, 3);
    
    console.log("Done.");
}

main();
