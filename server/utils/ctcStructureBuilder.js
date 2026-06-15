/**
 * CTC Structure Builder for Joining Letters
 * 
 * RULES (STRICT):
 * 1. ONLY fetch from EmployeeSalarySnapshot where locked = true
 * 2. Use snapshot.breakdown as single source of truth
 * 3. Build ctcStructure with monthly & yearly values
 * 4. Flatten keys exactly matching Word placeholders
 * 5. Every placeholder gets numeric value (default 0)
 * 6. NO recalculation - ONLY read from snapshot
 * 7. Never depend on frontend state
 */

/**
 * Format currency value for Indian locale
 * @param {Number} val - Raw numeric value
 * @returns {String} Formatted string (e.g., "50,000")
 */
function formatCurrency(val) {
    return Math.round(val || 0).toLocaleString('en-IN');
}

/**
 * Find component by code or name patterns
 * @param {Array} list - Array of salary components
 * @param {Array} patterns - Search patterns (lowercase, alphanumeric only)
 * @returns {Object} Component with monthly and yearly amounts
 */
function findComponent(list, patterns) {
    if (!Array.isArray(list) || list.length === 0) {
        return { monthly: 0, yearly: 0, name: '', code: '' };
    }

    const found = list.find(item => {
        const name = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const code = (item.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return patterns.some(p => name.includes(p) || code.includes(p));
    });

    if (!found) {
        return { monthly: 0, yearly: 0, name: '', code: '' };
    }

    return {
        monthly: found.monthlyAmount || 0,
        yearly: found.yearlyAmount || 0,
        name: found.name || '',
        code: found.code || ''
    };
}

/**
 * Build CTC structure data from locked salary snapshot
 * 
 * @param {Object} snapshot - EmployeeSalarySnapshot document (MUST be locked)
 * @returns {Object} Flattened CTC structure matching Word placeholders
 * @throws {Error} If snapshot is not locked or invalid
 */
function buildCTCStructure(snapshot) {
    // VALIDATION: Snapshot must exist and be locked
    if (!snapshot) {
        throw new Error('Salary snapshot is required');
    }

    if (!snapshot.locked) {
        throw new Error('Salary snapshot must be LOCKED before generating joining letter');
    }

    // Extract arrays (with safe defaults)
    const earnings = snapshot.earnings || [];
    const employeeDeductions = snapshot.employeeDeductions || [];
    const benefits = snapshot.benefits || [];

    // Extract individual components using pattern matching
    const basic = findComponent(earnings, ['basic']);
    const hra = findComponent(earnings, ['hra', 'house']);
    const conveyance = findComponent(earnings, ['conveyance', 'transport', 'travel']);
    const medical = findComponent(earnings, ['medical', 'medicalallow']);
    const special = findComponent(earnings, ['special', 'other', 'specialallow']);
    const transport = findComponent(earnings, ['transportation', 'transportallow']);
    const education = findComponent(earnings, ['education', 'educationallow']);
    const books = findComponent(earnings, ['books', 'periodicals']);
    const uniform = findComponent(earnings, ['uniform', 'uniformallow']);
    const mobile = findComponent(earnings, ['mobile', 'phone', 'mobileallow']);
    const compensatory = findComponent(earnings, ['compensatory', 'compensatoryallow']);
    const lta = findComponent(earnings, ['lta', 'leavetravel']);
    const bonus = findComponent(earnings, ['bonus']);
    const incentive = findComponent(earnings, ['incentive', 'performance']);

    // Deductions
    const pf = findComponent(employeeDeductions, ['pf', 'provident', 'employeepf']);
    const pt = findComponent(employeeDeductions, ['professional', 'pt', 'proftax']);
    const esic = findComponent(employeeDeductions, ['esic', 'stateinsurance']);
    const tds = findComponent(employeeDeductions, ['tds', 'tax']);

    // Benefits (Employer contributions)
    const employerPF = findComponent(benefits, ['employerpf', 'epf', 'employer']);
    const gratuity = findComponent(benefits, ['gratuity']);
    const insurance = findComponent(benefits, ['insurance', 'medicalinsurance']);

    // Use breakdown as single source of truth for totals
    const breakdown = snapshot.breakdown || {};
    const summary = snapshot.summary || {};

    // Calculate totals from breakdown (NEVER recalculate)
    const totalEarningsYearly = breakdown.totalEarnings || summary.grossEarnings || snapshot.ctc || 0;
    const totalDeductionsYearly = breakdown.totalDeductions || summary.totalDeductions || 0;
    const totalBenefitsYearly = breakdown.totalBenefits || summary.totalBenefits || 0;
    const netPayYearly = breakdown.netPay || summary.netPay || (totalEarningsYearly - totalDeductionsYearly);
    const totalCTCYearly = snapshot.ctc || (totalEarningsYearly + totalBenefitsYearly);

    // Monthly values (divide by 12)
    const totalEarningsMonthly = totalEarningsYearly / 12;
    const totalDeductionsMonthly = totalDeductionsYearly / 12;
    const totalBenefitsMonthly = totalBenefitsYearly / 12;
    const netPayMonthly = netPayYearly / 12;
    const totalCTCMonthly = totalCTCYearly / 12;

    // Build flattened structure matching Word placeholders
    // Format: {component}_monthly, {component}_annual
    const ctcStructure = {
        // Individual Components - Earnings
        basic_monthly: formatCurrency(basic.monthly),
        basic_annual: formatCurrency(basic.yearly),
        BASIC_MONTHLY: formatCurrency(basic.monthly),
        BASIC_ANNUAL: formatCurrency(basic.yearly),

        hra_monthly: formatCurrency(hra.monthly),
        hra_annual: formatCurrency(hra.yearly),
        HRA_MONTHLY: formatCurrency(hra.monthly),
        HRA_ANNUAL: formatCurrency(hra.yearly),

        conveyance_monthly: formatCurrency(conveyance.monthly),
        conveyance_annual: formatCurrency(conveyance.yearly),
        CONVEYANCE_MONTHLY: formatCurrency(conveyance.monthly),
        CONVEYANCE_ANNUAL: formatCurrency(conveyance.yearly),

        medical_monthly: formatCurrency(medical.monthly),
        medical_annual: formatCurrency(medical.yearly),
        MEDICAL_MONTHLY: formatCurrency(medical.monthly),
        MEDICAL_ANNUAL: formatCurrency(medical.yearly),

        special_monthly: formatCurrency(special.monthly),
        special_annual: formatCurrency(special.yearly),
        SPECIAL_MONTHLY: formatCurrency(special.monthly),
        SPECIAL_ANNUAL: formatCurrency(special.yearly),

        transport_monthly: formatCurrency(transport.monthly),
        transport_annual: formatCurrency(transport.yearly),
        TRANSPORT_MONTHLY: formatCurrency(transport.monthly),
        TRANSPORT_ANNUAL: formatCurrency(transport.yearly),

        education_monthly: formatCurrency(education.monthly),
        education_annual: formatCurrency(education.yearly),
        EDUCATION_MONTHLY: formatCurrency(education.monthly),
        EDUCATION_ANNUAL: formatCurrency(education.yearly),

        books_monthly: formatCurrency(books.monthly),
        books_annual: formatCurrency(books.yearly),
        BOOKS_MONTHLY: formatCurrency(books.monthly),
        BOOKS_ANNUAL: formatCurrency(books.yearly),

        uniform_monthly: formatCurrency(uniform.monthly),
        uniform_annual: formatCurrency(uniform.yearly),
        UNIFORM_MONTHLY: formatCurrency(uniform.monthly),
        UNIFORM_ANNUAL: formatCurrency(uniform.yearly),
        uniform_allowance_monthly: formatCurrency(uniform.monthly),  // Alternative naming
        uniform_allowance_annual: formatCurrency(uniform.yearly),

        mobile_monthly: formatCurrency(mobile.monthly),
        mobile_annual: formatCurrency(mobile.yearly),
        MOBILE_MONTHLY: formatCurrency(mobile.monthly),
        MOBILE_ANNUAL: formatCurrency(mobile.yearly),
        mobile_allowance_monthly: formatCurrency(mobile.monthly),  // Alternative naming
        mobile_allowance_annual: formatCurrency(mobile.yearly),

        compensatory_monthly: formatCurrency(compensatory.monthly),
        compensatory_annual: formatCurrency(compensatory.yearly),
        COMPENSATORY_MONTHLY: formatCurrency(compensatory.monthly),
        COMPENSATORY_ANNUAL: formatCurrency(compensatory.yearly),
        compensatory_allowance_monthly: formatCurrency(compensatory.monthly),  // Alternative naming
        compensatory_allowance_annual: formatCurrency(compensatory.yearly),

        lta_monthly: formatCurrency(lta.monthly),
        lta_annual: formatCurrency(lta.yearly),
        LTA_MONTHLY: formatCurrency(lta.monthly),
        LTA_ANNUAL: formatCurrency(lta.yearly),

        bonus_monthly: formatCurrency(bonus.monthly),
        bonus_annual: formatCurrency(bonus.yearly),
        BONUS_MONTHLY: formatCurrency(bonus.monthly),
        BONUS_ANNUAL: formatCurrency(bonus.yearly),

        incentive_monthly: formatCurrency(incentive.monthly),
        incentive_annual: formatCurrency(incentive.yearly),
        INCENTIVE_MONTHLY: formatCurrency(incentive.monthly),
        INCENTIVE_ANNUAL: formatCurrency(incentive.yearly),

        // Deductions
        pf_monthly: formatCurrency(pf.monthly),
        pf_annual: formatCurrency(pf.yearly),
        PF_MONTHLY: formatCurrency(pf.monthly),
        PF_ANNUAL: formatCurrency(pf.yearly),

        pt_monthly: formatCurrency(pt.monthly),
        pt_annual: formatCurrency(pt.yearly),
        PT_MONTHLY: formatCurrency(pt.monthly),
        PT_ANNUAL: formatCurrency(pt.yearly),

        esic_monthly: formatCurrency(esic.monthly),
        esic_annual: formatCurrency(esic.yearly),
        ESIC_MONTHLY: formatCurrency(esic.monthly),
        ESIC_ANNUAL: formatCurrency(esic.yearly),

        tds_monthly: formatCurrency(tds.monthly),
        tds_annual: formatCurrency(tds.yearly),
        TDS_MONTHLY: formatCurrency(tds.monthly),
        TDS_ANNUAL: formatCurrency(tds.yearly),

        // Benefits (Employer Contributions)
        employer_pf_monthly: formatCurrency(employerPF.monthly),
        employer_pf_annual: formatCurrency(employerPF.yearly),
        EMPLOYER_PF_MONTHLY: formatCurrency(employerPF.monthly),
        EMPLOYER_PF_ANNUAL: formatCurrency(employerPF.yearly),

        gratuity_monthly: formatCurrency(gratuity.monthly),
        gratuity_annual: formatCurrency(gratuity.yearly),
        GRATUITY_MONTHLY: formatCurrency(gratuity.monthly),
        GRATUITY_ANNUAL: formatCurrency(gratuity.yearly),

        insurance_monthly: formatCurrency(insurance.monthly),
        insurance_annual: formatCurrency(insurance.yearly),
        INSURANCE_MONTHLY: formatCurrency(insurance.monthly),
        INSURANCE_ANNUAL: formatCurrency(insurance.yearly),

        // Totals (from breakdown - single source of truth)
        gross_monthly: formatCurrency(totalEarningsMonthly),
        gross_annual: formatCurrency(totalEarningsYearly),
        GROSS_MONTHLY: formatCurrency(totalEarningsMonthly),
        GROSS_ANNUAL: formatCurrency(totalEarningsYearly),

        gross_a_monthly: formatCurrency(totalEarningsMonthly),
        gross_a_annual: formatCurrency(totalEarningsYearly),
        GROSS_A_MONTHLY: formatCurrency(totalEarningsMonthly),
        GROSS_A_ANNUAL: formatCurrency(totalEarningsYearly),

        total_deductions_monthly: formatCurrency(totalDeductionsMonthly),
        total_deductions_annual: formatCurrency(totalDeductionsYearly),
        TOTAL_DEDUCTIONS_MONTHLY: formatCurrency(totalDeductionsMonthly),
        TOTAL_DEDUCTIONS_ANNUAL: formatCurrency(totalDeductionsYearly),

        total_benefits_monthly: formatCurrency(totalBenefitsMonthly),
        total_benefits_annual: formatCurrency(totalBenefitsYearly),
        TOTAL_BENEFITS_MONTHLY: formatCurrency(totalBenefitsMonthly),
        TOTAL_BENEFITS_ANNUAL: formatCurrency(totalBenefitsYearly),

        net_monthly: formatCurrency(netPayMonthly),
        net_annual: formatCurrency(netPayYearly),
        NET_MONTHLY: formatCurrency(netPayMonthly),
        NET_ANNUAL: formatCurrency(netPayYearly),

        take_home_monthly: formatCurrency(netPayMonthly),
        take_home_annual: formatCurrency(netPayYearly),
        TAKE_HOME_MONTHLY: formatCurrency(netPayMonthly),
        TAKE_HOME_ANNUAL: formatCurrency(netPayYearly),

        total_ctc_monthly: formatCurrency(totalCTCMonthly),
        total_ctc_annual: formatCurrency(totalCTCYearly),
        TOTAL_CTC_MONTHLY: formatCurrency(totalCTCMonthly),
        TOTAL_CTC_ANNUAL: formatCurrency(totalCTCYearly),

        annual_ctc: formatCurrency(totalCTCYearly),
        monthly_ctc: formatCurrency(totalCTCMonthly),
        ANNUAL_CTC: formatCurrency(totalCTCYearly),
        MONTHLY_CTC: formatCurrency(totalCTCMonthly),

        ctc: formatCurrency(totalCTCYearly),
        CTC: formatCurrency(totalCTCYearly)
    };

    return ctcStructure;
}

/**
 * Build salary components array for table rendering
 * @param {Object} snapshot - EmployeeSalarySnapshot document
 * @returns {Array} Array of {name, monthly, yearly} objects
 */
function buildSalaryComponentsTable(snapshot) {
    if (!snapshot || !snapshot.locked) {
        throw new Error('Salary snapshot must be LOCKED');
    }

    const earnings = snapshot.earnings || [];
    const employeeDeductions = snapshot.employeeDeductions || [];
    const benefits = snapshot.benefits || [];
    const breakdown = snapshot.breakdown || {};

    const components = [];

    // Section A: Monthly Benefits (Earnings)
    components.push({ name: 'A – Monthly Benefits', monthly: '', yearly: '' });
    earnings.forEach(e => {
        components.push({
            name: e.name,
            monthly: formatCurrency(e.monthlyAmount || 0),
            yearly: formatCurrency(e.yearlyAmount || 0)
        });
    });
    components.push({
        name: 'GROSS A',
        monthly: formatCurrency((breakdown.totalEarnings || 0) / 12),
        yearly: formatCurrency(breakdown.totalEarnings || 0)
    });

    // Section B: Deductions
    if (employeeDeductions.length > 0) {
        components.push({ name: '', monthly: '', yearly: '' }); // Separator
        components.push({ name: 'B – Annual Benefits', monthly: '', yearly: '' });
        employeeDeductions.forEach(d => {
            components.push({
                name: d.name,
                monthly: formatCurrency(d.monthlyAmount || 0),
                yearly: formatCurrency(d.yearlyAmount || 0)
            });
        });
        components.push({
            name: 'GROSS B',
            monthly: formatCurrency((breakdown.totalDeductions || 0) / 12),
            yearly: formatCurrency(breakdown.totalDeductions || 0)
        });
    }

    // Section C: Employer Benefits
    if (benefits.length > 0) {
        components.push({ name: '', monthly: '', yearly: '' }); // Separator
        components.push({ name: 'C – Employer Company\'s Benefits', monthly: '', yearly: '' });
        benefits.forEach(b => {
            components.push({
                name: b.name,
                monthly: formatCurrency(b.monthlyAmount || 0),
                yearly: formatCurrency(b.yearlyAmount || 0)
            });
        });
        components.push({
            name: 'GROSS C',
            monthly: formatCurrency((breakdown.totalBenefits || 0) / 12),
            yearly: formatCurrency(breakdown.totalBenefits || 0)
        });
    }

    // Section D: Other Benefits (if any)
    components.push({ name: '', monthly: '', yearly: '' }); // Separator
    components.push({ name: 'D – Other Benefits', monthly: '', yearly: '' });
    components.push({ name: 'Employer\'s contribution towards Medical Insurance', monthly: '0', yearly: '0' });

    // Total CTC
    components.push({ name: '', monthly: '', yearly: '' }); // Separator
    components.push({
        name: 'Computed CTC (A+B+C)',
        monthly: formatCurrency((snapshot.ctc || 0) / 12),
        yearly: formatCurrency(snapshot.ctc || 0)
    });

    return components;
}

module.exports = {
    buildCTCStructure,
    buildSalaryComponentsTable,
    formatCurrency
};
