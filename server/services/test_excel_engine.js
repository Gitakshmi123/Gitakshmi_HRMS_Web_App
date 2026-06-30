const SalaryCalculationEngine = require('./SalaryCalculationEngine');

const ctc = 300000; // 25,000 per month
const minWage = 13897; // Gujarat Skilled

const ctxRules = {
    companyRules: {},
    locationPolicy: {}
};

const result = SalaryCalculationEngine.calculateSalary({
    annualCTC: ctc,
    minWageAmount: minWage,
    useExcelStructure: true,
    payrollContext: ctxRules
});

console.log(JSON.stringify(result, null, 2));
