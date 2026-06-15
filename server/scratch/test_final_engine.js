require('dotenv').config();
const SalaryCalculationEngine = require('../services/salaryCalculationEngine');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const db = mongoose.connection.useDb('company_pnr');
        
        // Find salary template or components from DB
        const Earning = db.collection('salarycomponents');
        const Benefit = db.collection('benefitcomponents');
        const Deduction = db.collection('deductioncomponents');
        
        const earnings = await Earning.find({ isActive: { $ne: false } }).toArray();
        const benefits = await Benefit.find({ isActive: { $ne: false } }).toArray();
        const deductions = await Deduction.find({ isActive: { $ne: false } }).toArray();
        
        console.log('Active Earnings in DB count:', earnings.length);
        console.log('Active Benefits in DB count:', benefits.length);
        console.log('Active Deductions in DB count:', deductions.length);
        
        // Let's run preview with these components on CTC 413085 (which had the +75,414.84 difference)
        const testPayload = {
            annualCTC: 413085,
            earnings,
            deductions,
            benefits,
            payrollContext: {
                applyStatutory: true,
                locationContext: {
                    country: 'IN',
                    payrollRegion: 'Gujarat',
                    workState: 'Gujarat',
                    workCity: 'Ahmedabad'
                }
            }
        };
        
        const res = SalaryCalculationEngine.calculateSalary(testPayload);
        
        console.log('\n--- CALCULATED SALARY STRUCTURE FOR CTC 413085 ---');
        console.log('Earnings:');
        res.earnings.forEach(e => {
            console.log(`  ${e.name.padEnd(25)} Monthly: ${e.monthly} (${e.calculationType}, value: ${e.value}), Yearly: ${e.yearly}`);
        });
        console.log('Benefits:');
        res.benefits.forEach(b => {
            console.log(`  ${b.name.padEnd(25)} Monthly: ${b.monthly} (${b.calculationType}, value: ${b.value}), Yearly: ${b.yearly}`);
        });
        console.log('Deductions:');
        res.deductions.forEach(d => {
            console.log(`  ${d.name.padEnd(25)} Monthly: ${d.monthly} (${d.calculationType}, value: ${d.value}), Yearly: ${d.yearly}`);
        });
        
        const calculatedCTC = res.earnings.reduce((s, e) => s + e.yearly, 0) + res.benefits.reduce((s, b) => s + b.yearly, 0);
        console.log('\nCalculated CTC Sum:', calculatedCTC);
        console.log('Target CTC:', res.annualCTC);
        console.log('Difference:', calculatedCTC - res.annualCTC);
        console.log('Totals:', JSON.stringify(res.totals, null, 2));

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
