const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Book5.xlsx');
console.log(`Analyzing file: ${filePath}`);

try {
  const workbook = xlsx.readFile(filePath, { cellFormula: true });
  const sheetNames = workbook.SheetNames;
  
  sheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log("Raw Data:");
    console.table(data);

    // Optionally check for formulas if needed
    for (const z in worksheet) {
      if (z[0] === '!') continue;
      if (worksheet[z].f) {
        console.log(`Cell ${z} formula: ${worksheet[z].f} (value: ${worksheet[z].v})`);
      }
    }
  });

} catch (err) {
  console.error("Error reading file:", err.message);
}
