const SalaryCalculationEngine = require('./services/salaryCalculationEngine');

const ctc = 143726 * 12; // 1724712 (Annual)
const minWage = 13897;

const result = SalaryCalculationEngine._calculateExcelStructure(ctc, minWage, {}, 'Skilled');

console.log(JSON.stringify(result, null, 2));
