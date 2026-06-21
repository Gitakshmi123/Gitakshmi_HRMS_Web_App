const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, 'Book3.xlsx'));
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

console.log("Sheet Name:", sheetName);
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

for (let r = 0; r < rows.length; r++) {
  const rowArr = rows[r];
  const rowOutput = [];
  for (let c = 0; c < rowArr.length; c++) {
    const addr = colLetter(c) + (r + 1);
    const cell = sheet[addr];
    let val = rowArr[c];
    let formula = '';
    if (cell && cell.f) {
      formula = ` (= ${cell.f})`;
    }
    rowOutput.push(`${addr}: ${val}${formula}`);
  }
  console.log(`Row ${r + 1}:`, rowOutput.join(' | '));
}
