const XLSX = require('@sheetjs/xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'Book3.xlsx'));
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const range = XLSX.utils.decode_range(sheet['!ref']);
console.log("Range:", sheet['!ref']);

for (let r = range.s.r; r <= range.e.r; r++) {
  let rowStr = `Row ${r + 1}: `;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const colLetter = String.fromCharCode(65 + c);
    const cellRef = `${colLetter}${r + 1}`;
    const cell = sheet[cellRef];
    if (cell) {
      const val = cell.v !== undefined ? cell.v : '';
      const formula = cell.f ? ` [=${cell.f}]` : '';
      rowStr += `${colLetter}: "${val}"${formula} | `;
    } else {
      rowStr += `${colLetter}: (empty) | `;
    }
  }
  console.log(rowStr);
}
