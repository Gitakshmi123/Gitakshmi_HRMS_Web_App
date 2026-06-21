const XLSX = require('@sheetjs/xlsx');
const path = require('path');

function run() {
  try {
    const filePath = path.join(__dirname, '..', 'Book3.xlsx');
    console.log("Reading file:", filePath);
    const workbook = XLSX.readFile(filePath);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Find range
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log(`Range: cols ${range.s.c} to ${range.e.c}, rows ${range.s.r} to ${range.e.r}`);
    
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowParts = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellRef];
        if (cell && cell.v !== undefined && cell.v !== '') {
          const formula = cell.f ? ` [Formula: =${cell.f}]` : '';
          rowParts.push(`${cellRef}: "${cell.v}"${formula}`);
        }
      }
      if (rowParts.length > 0) {
        console.log(`Row ${r + 1}: ${rowParts.join(' | ')}`);
      }
    }
  } catch (err) {
    console.error("Error reading Excel:", err);
  }
}

run();
