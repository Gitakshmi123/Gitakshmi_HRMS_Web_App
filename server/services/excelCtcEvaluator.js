const XLSX = require('@sheetjs/xlsx');

function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function safeEval(expr) {
  // Allow only numbers, parentheses, operators and dots
  if (!/^[0-9().+\-*/\s]+$/.test(expr)) throw new Error('Unsafe expression after substitution: ' + expr);
  // eslint-disable-next-line no-new-func
  return Function('return ' + expr)();
}

function normalizeKey(name) {
  if (!name) return '';
  return name.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/**
 * Evaluate workbook rows into normalized earnings/deductions inputs
 * @param {Workbook} workbook
 * @param {number} annualCTC
 * @returns {Object} { earningsInput: [], deductionsInput: [], annualCTC }
 */
async function evaluateWorkbook(workbook, annualCTC) {
  if (!workbook) throw new Error('Workbook required');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get rows as arrays to preserve formulas via cell lookup
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (!rows || rows.length < 2) return { earningsInput: [], deductionsInput: [], annualCTC };

  const headers = rows[0].map(h => (h || '').toString().trim());

  // Build raw parsed rows with formula awareness
  const parsed = [];
  for (let r = 1; r < rows.length; r++) {
    const rowArr = rows[r];
    if (!rowArr || rowArr.every(c => c === null || c === '')) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c] || `C${c}`;
      const addr = colLetter(c) + (r + 1);
      const cell = sheet[addr];
      if (cell && typeof cell.f === 'string' && cell.f.trim().length > 0) {
        obj[header] = '=' + cell.f; // formula
      } else {
        obj[header] = rowArr[c];
      }
    }
    parsed.push(obj);
  }

  // Map entries
  const entries = []; // { name, category, freq, raw, expr }
  parsed.forEach(row => {
    const name = row['Component'] || row['Component Name'] || row['component'] || row['component name'] || row['Name'] || row['name'];
    if (!name) return;
    const category = (row['Category'] || row['category'] || '').toString().trim().toLowerCase();
    const frequency = (row['Frequency'] || row['frequency'] || row['Period'] || row['period'] || '').toString().trim().toLowerCase();
    const raw = row['Value'] || row['value'] || row['Amount'] || row['amount'] || null;
    let expr = null;
    if (typeof raw === 'string' && raw.startsWith('=')) expr = raw.substring(1);
    // Also treat strings containing % or letters as expressions
    if (typeof raw === 'string' && !expr && /[%A-Za-z]/.test(raw)) expr = raw;

    entries.push({ name: name.toString().trim(), category: category, frequency: frequency, raw, expr });
  });

  // Build name->key map
  const keyMap = {};
  entries.forEach(e => { keyMap[normalizeKey(e.name)] = e.name; });

  // Resolve values
  const values = {}; // key -> annual numeric value
  values['CTC'] = Number(annualCTC);

  // First pass: direct numeric values
  entries.forEach(e => {
    if (e.expr) return;
    const raw = e.raw;
    if (raw === null || raw === undefined || raw === '') return;
    const num = Number(raw);
    if (!isNaN(num)) {
      // interpret frequency: default monthly for backward compatibility
      const annual = (e.frequency && e.frequency.includes('ann')) ? num : num * 12;
      values[normalizeKey(e.name)] = annual;
    }
  });

  // Iteratively resolve expressions
  let unresolved = entries.filter(e => e.expr);
  let progress = true;
  let iter = 0;
  while (unresolved.length > 0 && progress && iter < 50) {
    progress = false;
    iter++;
    const still = [];
    for (const e of unresolved) {
      let expr = e.expr;
      // Normalize percent tokens like 40% => (40/100)
      expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

      // Replace known names with numeric values if available
      // also allow common shorthand CTC and BASIC
      Object.keys(keyMap).forEach(k => {
        const nameToken = k; // normalized
        const regex = new RegExp('\\b' + nameToken + '\\b', 'gi');
        if (values[k] !== undefined) {
          expr = expr.replace(regex, String(values[k]));
        }
      });

      // Replace CTC and BASIC tokens
      if (/\bCTC\b/i.test(expr) && values['CTC'] !== undefined) expr = expr.replace(/\bCTC\b/gi, String(values['CTC']));
      if (/\bBASIC\b/i.test(expr) && values[normalizeKey('Basic')] !== undefined) expr = expr.replace(/\bBASIC\b/gi, String(values[normalizeKey('Basic')]));

      // After substitution, if expr contains letters, can't evaluate yet
      if (/[A-Za-z]/.test(expr)) {
        still.push(e);
        continue;
      }

      // Now evaluate safely
      try {
        const val = safeEval(expr);
        const num = Number(val) || 0;
        // expr result likely corresponds to monthly if original raw was non-annual; assume monthly unless frequency says annual
        const annual = (e.frequency && e.frequency.includes('ann')) ? num : num * 12;
        values[normalizeKey(e.name)] = annual;
        progress = true;
      } catch (err) {
        still.push(e);
      }
    }
    unresolved = still;
  }

  // For any remaining unresolved, set to 0
  unresolved.forEach(e => {
    values[normalizeKey(e.name)] = 0;
  });

  // Build earningsInput and deductionsInput
  const earningsInput = [];
  const deductionsInput = [];
  entries.forEach(e => {
    const key = normalizeKey(e.name);
    const annual = values[key] || 0;
    if (e.category === 'deduction' || (e.category && e.category.toLowerCase().includes('deduct'))) {
      deductionsInput.push({ name: e.name, annualAmount: annual, amountType: 'FIXED', recurring: true });
    } else {
      // If expression references CTC directly or contains percent of CTC then mark as percent of CTC
      const isPercentOfCtc = Boolean(e.expr && /CTC/i.test(e.expr) && /\/(100)|%/.test(e.expr || ''));
      const isPercentOfBasic = Boolean(e.expr && /BASIC/i.test(e.expr) && /\/(100)|%/.test(e.expr || ''));
      if (isPercentOfCtc) {
        // derive percentage
        const pct = annual / Number(annualCTC) * 100 || 0;
        earningsInput.push({ name: e.name, calculationType: 'PERCENT_CTC', percentage: pct, monthlyAmount: Math.round(annual/12*100)/100, annualAmount: Math.round(annual*100)/100 });
      } else if (isPercentOfBasic) {
        earningsInput.push({ name: e.name, calculationType: 'PERCENT_BASIC', percentage: 0, monthlyAmount: Math.round(annual/12*100)/100, annualAmount: Math.round(annual*100)/100 });
      } else {
        // fixed
        earningsInput.push({ name: e.name, calculationType: 'FIXED', monthlyAmount: Math.round(annual/12*100)/100, annualAmount: Math.round(annual*100)/100 });
      }
    }
  });

  return { earningsInput, deductionsInput, annualCTC };
}

module.exports = { evaluateWorkbook };
