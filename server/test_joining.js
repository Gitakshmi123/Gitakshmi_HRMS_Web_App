const mongoose = require('mongoose');
const { getModels } = require('./controllers/letter.controller');
const joiningLetterUtils = require('./utils/joiningLetterUtils');

function mockGetModels(db) {
    if (!db.models.Requirement) {
        db.model('Requirement', require('./models/Requirement'));
    }
    return {
        Applicant: db.model("Applicant", require('./models/Applicant')),
        EmployeeSalarySnapshot: db.model("EmployeeSalarySnapshot", require('./models/EmployeeSalarySnapshot')),
        SalaryAssignment: db.model("SalaryAssignment", require('./models/SalaryAssignment')),
        Employee: db.model("Employee", require('./models/Employee')),
        CompanyProfile: db.model("CompanyProfile", require('./models/CompanyProfile')),
        LetterTemplate: db.model("LetterTemplate", require('./models/LetterTemplate')),
        Requirement: db.model("Requirement")
    };
}

async function resolveLetterSalarySnapshot(db, { employeeId, applicantId, target, targetType }) {
    const { EmployeeSalarySnapshot, SalaryAssignment } = mockGetModels(db);
    const query = employeeId ? { employee: employeeId } : { applicant: applicantId };
    let snapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();

    if (!snapshot && target) {
        const snapId = target.currentSalarySnapshotId || target.salarySnapshotId;
        if (snapId) snapshot = await EmployeeSalarySnapshot.findById(snapId).lean();
        if (!snapshot && targetType === 'employee' && target.salarySnapshots?.length > 0) {
            snapshot = await EmployeeSalarySnapshot.findById(target.salarySnapshots[target.salarySnapshots.length - 1]).lean();
        }
    }

    return snapshot;
}

const toMoneyNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const amountPair = (component = {}) => {
    const monthly = toMoneyNumber(component.monthlyAmount ?? component.monthly ?? component.amount);
    const yearly = toMoneyNumber(component.yearlyAmount ?? component.annualAmount ?? component.yearly ?? component.annual ?? (monthly * 12));
    return { monthly, yearly: yearly || monthly * 12 };
};

const safeCur = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('en-IN');
};

const normalizeSalaryKey = (name) => {
    if (!name) return 'unknown';
    const n = name.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (/gross_a|gross_earnings/i.test(n)) return 'gross_a';
    if (/gross_b|annual_benefits|benefit_b/i.test(n)) return 'gross_b';
    if (/gross_c|retirals|benefit_c/i.test(n)) return 'gross_c';
    if (/gross_salary|gross/i.test(n)) return 'gross';
    if (/ctc|total_ctc|cost_to_company/i.test(n)) return 'total_ctc';
    if (/net|take_home/i.test(n)) return 'net_salary';
    if (/basic/i.test(n)) return 'basic';
    if (/hra|house|rent/i.test(n)) return 'hra';
    if (/medical|health/i.test(n)) return 'medical';
    if (/conveyance|travel/i.test(n)) return 'conveyance';
    if (/transport/i.test(n)) return 'transport';
    if (/education/i.test(n)) return 'education';
    if (/book|periodical/i.test(n)) return 'books';
    if (/uniform/i.test(n)) return 'uniform';
    if (/mobile|phone/i.test(n)) return 'mobile';
    if (/compensatory/i.test(n)) return 'compensatory';
    if (/leave/i.test(n)) return 'leave';
    if (/special|allowance/i.test(n)) return 'special';
    if (/pt|prof|tax/i.test(n)) return 'pt';
    if (/^pf$|provident/i.test(n) && !/employer/i.test(n)) return 'pf';
    if (/employer_pf|employer_contribution_to_pf/i.test(n)) return 'employer_pf';
    if (/gratuity/i.test(n)) return 'gratuity';
    if (/insur/i.test(n)) return 'insurance';

    return n;
};

const addSalaryAlias = (salary, key, monthly, yearly) => {
    const normalized = normalizeSalaryKey(key);
    const m = safeCur(monthly);
    const y = safeCur(yearly);
    const keys = new Set([
        normalized,
        String(key || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    ]);

    keys.forEach((alias) => {
        if (!alias) return;
        salary[alias] = { monthly: m, yearly: y, annual: y };
    });
};

const buildSalaryTemplatePayload = (snapshot = {}, totals = {}) => {
    const salary = {};
    const earnings = snapshot.earnings || [];
    const employeeDeductions = snapshot.employeeDeductions || snapshot.deductions || [];
    const benefits = snapshot.benefits || [];

    [...earnings, ...employeeDeductions, ...benefits].forEach((component) => {
        const { monthly, yearly } = amountPair(component);
        addSalaryAlias(salary, component.name || component.code, monthly, yearly);
    });

    const sumYearly = (items) => items.reduce((sum, item) => sum + amountPair(item).yearly, 0);
    const earningsYearly = toMoneyNumber(snapshot.summary?.grossEarnings || snapshot.breakdown?.totalEarnings || sumYearly(earnings));
    const deductionsYearly = toMoneyNumber(snapshot.summary?.totalDeductions || snapshot.breakdown?.totalDeductions || sumYearly(employeeDeductions));

    const benefitYearlyBy = (pattern) => benefits
        .filter((item) => pattern.test(`${item.name || ''} ${item.code || ''}`))
        .reduce((sum, item) => sum + amountPair(item).yearly, 0);

    const employerPfYearly = benefitYearlyBy(/pf|provident/i);
    const employerEsicYearly = benefitYearlyBy(/esic|esi|state\s*insurance/i);
    const gratuityYearly = benefitYearlyBy(/gratuity/i);
    const paPolicyYearly = benefitYearlyBy(/pa\s*policy|personal\s*accident|insurance|mediclaim|medical\s*insurance/i);
    const totalAYearly = earningsYearly + employerPfYearly + employerEsicYearly;
    const totalBYearly = gratuityYearly;
    const totalCYearly = paPolicyYearly;
    const totalCTCYearly = toMoneyNumber(snapshot.ctc || snapshot.annualCTC || totals.computedCTC?.yearly || (totalAYearly + totalBYearly + totalCYearly));
    const takeHomeYearly = toMoneyNumber(snapshot.summary?.netPay || snapshot.breakdown?.netPay || totals.net?.yearly || (earningsYearly - deductionsYearly));

    const setTotal = (key, yearly) => addSalaryAlias(salary, key, yearly / 12, yearly);
    setTotal('gross', earningsYearly);
    setTotal('gross_salary', earningsYearly);
    setTotal('total_a', totalAYearly);
    setTotal('take_home', takeHomeYearly);
    setTotal('take_home_salary', takeHomeYearly);
    setTotal('total_b', totalBYearly);
    setTotal('total_c', totalCYearly);
    setTotal('total_ctc', totalCTCYearly);
    setTotal('ctc', totalCTCYearly);

    addSalaryAlias(salary, 'pf_employer', employerPfYearly / 12, employerPfYearly);
    addSalaryAlias(salary, 'esic_employer', employerEsicYearly / 12, employerEsicYearly);
    addSalaryAlias(salary, 'gratuity', gratuityYearly / 12, gratuityYearly);
    addSalaryAlias(salary, 'pa_policy', paPolicyYearly / 12, paPolicyYearly);

    employeeDeductions.forEach((component) => {
        const text = `${component.name || ''} ${component.code || ''}`;
        const { monthly, yearly } = amountPair(component);
        if (/pf|provident/i.test(text)) addSalaryAlias(salary, 'pf_employee', monthly, yearly);
        if (/esic|esi|state\s*insurance/i.test(text)) addSalaryAlias(salary, 'esic_employee', monthly, yearly);
        if (/professional|prof|pt|tax/i.test(text)) addSalaryAlias(salary, 'professional_tax', monthly, yearly);
    });

    [
        'minimum_wage', 'basic', 'hra', 'conveyance', 'compensatory_allowance', 'bonus',
        'pf_employer', 'esic_employer', 'pf_employee', 'esic_employee',
        'professional_tax', 'gratuity', 'pa_policy', 'gross', 'gross_salary',
        'total_a', 'take_home', 'take_home_salary', 'total_b', 'total_c', 'total_ctc'
    ].forEach((key) => {
        if (!salary[key]) salary[key] = { monthly: '0', yearly: '0', annual: '0' };
    });

    return {
        salary,
        salary_flat: Object.fromEntries(
            Object.entries(salary).flatMap(([key, value]) => [
                [`salary_${key}_monthly`, value.monthly],
                [`salary_${key}_yearly`, value.yearly],
                [`salary_${key}_annual`, value.annual || value.yearly]
            ])
        )
    };
};

async function main() {
    try {
        const uri = "mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0";
        await mongoose.connect(uri);
        const db = mongoose.connection.useDb("company_pnr");
        
        const applicantId = '6a290ef1f5b907fea264f76c';
        const { Applicant, LetterTemplate } = mockGetModels(db);
        const target = await Applicant.findById(applicantId).populate('requirementId');

        let snapshot = await resolveLetterSalarySnapshot(db, { applicantId, target, targetType: 'applicant' });
        
        const earnings = (snapshot.earnings || []).map(e => ({
            ...e,
            monthly: e.monthlyAmount || e.monthly || 0,
            yearly: e.yearlyAmount || e.yearly || e.annualAmount || (e.monthlyAmount * 12) || 0
        }));

        const employeeDeductions = (snapshot.employeeDeductions || snapshot.deductions || []).map(d => ({
            ...d,
            monthly: d.monthlyAmount || d.monthly || 0,
            yearly: d.yearlyAmount || d.yearly || d.annualAmount || (d.monthlyAmount * 12) || 0
        }));

        const benefits = (snapshot.benefits || []).map(b => ({
            ...b,
            monthly: b.monthlyAmount || b.monthly || 0,
            yearly: b.yearlyAmount || b.yearly || b.annualAmount || (b.monthlyAmount * 12) || 0
        }));

        const grossAAnnual = snapshot.summary?.grossEarnings || snapshot.breakdown?.totalEarnings || earnings.reduce((sum, e) => sum + e.yearly, 0);
        const totalBenefitsAnnual = snapshot.summary?.totalBenefits || snapshot.breakdown?.totalBenefits || benefits.reduce((sum, b) => sum + b.yearly, 0);
        const totalDeductionsAnnual = snapshot.summary?.totalDeductions || snapshot.breakdown?.totalDeductions || employeeDeductions.reduce((sum, d) => sum + d.yearly, 0);
        const totalCTCAnnual = snapshot.ctc || snapshot.annualCTC || (grossAAnnual + totalBenefitsAnnual);
        const netAnnual = snapshot.summary?.netPay || snapshot.breakdown?.netPay || (grossAAnnual - totalDeductionsAnnual);

        const grossBListRaw = benefits.filter(b => /bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));
        const grossCListRaw = benefits.filter(b => !/bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));

        const grossBAnnualTotal = grossBListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);
        const grossCAnnualTotal = grossCListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);

        const totals = {
            grossA: {
                monthly: Math.round(grossAAnnual / 12),
                yearly: Math.round(grossAAnnual),
                formattedM: safeCur(grossAAnnual / 12),
                formattedY: safeCur(grossAAnnual)
            },
            grossB: {
                monthly: Math.round(grossBAnnualTotal / 12),
                yearly: Math.round(grossBAnnualTotal),
                formattedM: safeCur(grossBAnnualTotal / 12),
                formattedY: safeCur(grossBAnnualTotal)
            },
            grossC: {
                monthly: Math.round(grossCAnnualTotal / 12),
                yearly: Math.round(grossCAnnualTotal),
                formattedM: safeCur(grossCAnnualTotal / 12),
                formattedY: safeCur(grossCAnnualTotal)
            },
            deductions: {
                monthly: Math.round(totalDeductionsAnnual / 12),
                yearly: Math.round(totalDeductionsAnnual),
                formattedM: safeCur(totalDeductionsAnnual / 12),
                formattedY: safeCur(totalDeductionsAnnual)
            },
            net: {
                monthly: Math.round(netAnnual / 12),
                yearly: Math.round(netAnnual),
                formattedM: safeCur(netAnnual / 12),
                formattedY: safeCur(netAnnual)
            },
            computedCTC: {
                monthly: Math.round(totalCTCAnnual / 12),
                yearly: Math.round(totalCTCAnnual),
                formattedM: safeCur(totalCTCAnnual / 12),
                formattedY: safeCur(totalCTCAnnual)
            }
        };

        console.log("grossAAnnual:", grossAAnnual);
        console.log("totalBenefitsAnnual:", totalBenefitsAnnual);
        console.log("totalDeductionsAnnual:", totalDeductionsAnnual);
        console.log("totals.grossA:", totals.grossA);
        console.log("totals.net:", totals.net);
        console.log("totals.computedCTC:", totals.computedCTC);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
