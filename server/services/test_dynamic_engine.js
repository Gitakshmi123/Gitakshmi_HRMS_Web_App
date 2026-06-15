require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const DynamicPayrollEngine = require('./DynamicPayrollEngine');

async function testEngine() {
    await mongoose.connect(process.env.MONGO_URI);
    const tenantId = '6a0c43ab3245aa33f5c2a410';
    const tenantDB = await getTenantDB(tenantId);

    // Make sure models are loaded
    const SalaryComponent = tenantDB.model("SalaryComponent");
    const DeductionMaster = tenantDB.model("DeductionMaster");
    const BenefitComponent = tenantDB.model("BenefitComponent");
    
    if (!tenantDB.models.MinimumWage) {
        tenantDB.model("MinimumWage", require('../models/MinimumWage'));
    }

    const engine = new DynamicPayrollEngine(tenantDB);

    // Let's create some dummy components if not exist
    const basic = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Basic Salary',
        calculationType: 'FORMULA',
        formula: '[CTC] * 0.5',
        type: 'EARNING'
    };

    const hra = {
        _id: new mongoose.Types.ObjectId(),
        name: 'HRA',
        calculationType: 'FORMULA',
        formula: '[BASIC] * 0.4',
        type: 'EARNING'
    };

    const pfEmployer = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Employer PF',
        calculationType: 'PERCENTAGE_OF_BASIC',
        percentage: 12,
        type: 'BENEFIT'
    };

    const special = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Special Allowance',
        type: 'EARNING'
    };

    const pt = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Professional Tax',
        calculationType: 'FLAT_AMOUNT',
        amount: 200,
        type: 'DEDUCTION'
    };

    console.log('Testing Auto Mode (CTC = 1200000 / year)');
    const autoResult = await engine.generateBreakup({
        tenantId,
        enteredCTC: 1200000,
        availableEarnings: [basic, hra, special],
        availableDeductions: [pt],
        availableBenefits: [pfEmployer]
    });
    console.log(JSON.stringify(autoResult.earnings, null, 2));
    console.log('Gross:', autoResult.monthly.grossEarnings);
    console.log('Net:', autoResult.monthly.netSalary);

    console.log('\nTesting Manual Mode (Basic overridden to 60000)');
    const manualResult = await engine.generateBreakup({
        tenantId,
        enteredCTC: 1200000,
        availableEarnings: [basic, hra, special],
        availableDeductions: [pt],
        availableBenefits: [pfEmployer],
        manualOverrides: {
            [basic._id]: 60000
        }
    });
    console.log(JSON.stringify(manualResult.earnings, null, 2));

    await mongoose.disconnect();
}

testEngine().catch(console.error);
