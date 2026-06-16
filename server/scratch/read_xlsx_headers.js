const XLSX = require('@sheetjs/xlsx');

function printHeaders(filePath) {
    console.log(`\n=== Headers for ${filePath} ===`);
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length > 0) {
            console.log('Row 1 (Headers):', jsonData[0]);
            if (jsonData.length > 1) {
                console.log('Row 2:', jsonData[1]);
            }
        } else {
            console.log('File is empty');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

printHeaders('C:\\Users\\raval\\Downloads\\Employee_Template_1781617064329.xlsx');
printHeaders('C:\\Users\\raval\\Downloads\\Employee Master - Final 16.06.2026.xlsx');
