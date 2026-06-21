const SalaryCalculationEngine = require('./services/salaryCalculationEngine');

const categories = [
  { name: 'Unskilled', mw: 13325 },
  { name: 'Semi Skilled', mw: 13585 },
  { name: 'Skilled', mw: 13897 }
];

const targetTotalCTCAnnual = 1724709; // This is the total A+B+C from Book5 to get 140000 CTC-A

categories.forEach(cat => {
  const result = SalaryCalculationEngine._calculateExcelStructure(targetTotalCTCAnnual, cat.mw, {}, cat.name);
  console.log(`\n--- Category: ${cat.name} (MW: ${cat.mw}) ---`);
  console.log(`CTC-A (Monthly): ${result.totals.grossA_Monthly}`);
  console.log(`Basic (Monthly): ${result.earnings.find(e => e.code === 'BASIC').monthly}`);
  console.log(`HRA (Monthly): ${result.earnings.find(e => e.code === 'HOUSE_RENT_ALLOWANCE').monthly}`);
  console.log(`Conveyance: ${result.earnings.find(e => e.code === 'CONVEYANCE').monthly}`);
  console.log(`Compensatory: ${result.earnings.find(e => e.code === 'COMPENSATORY_ALLOWANCE').monthly}`);
  console.log(`PF Employer: ${result.benefits.find(e => e.code === 'EMPLOYER_PF').monthly}`);
  console.log(`Total CTC: ${result.totals.totalCTC}`);
});
