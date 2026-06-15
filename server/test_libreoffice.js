const path = require('path');
const fs = require('fs');

async function testLibreOffice() {
    try {
        const libreOfficeService = require('./services/LibreOfficeService');
        const testDocx = path.join(__dirname, 'test.docx');

        // Let's create a dummy docx if it doesn't exist? Actually, I should find a real one.
        // Or I'll just check if conversion starts.

        const outputDir = path.join(__dirname, 'temp_test_pdf');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        console.log('Testing PDF conversion...');
        // I'll need a real docx File to test.
        // Let's list some files in c:\HRMS\backend\uploads to find a docx.
    } catch (err) {
        console.error(err);
    }
}
