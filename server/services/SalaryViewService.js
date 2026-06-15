const mongoose = require('mongoose');

class SalaryViewService {

    /**
     * Generates a document-specific view of the salary data.
     * Use this before passing data to Docxtemplater or Puppeteer.
     * 
     * @param {Object} salarySnapshot - The complete salary snapshot from Applicant record (Source of Truth)
     * @param {Object} viewConfig - The DocumentViewConfig object (Configuration)
     * @returns {Object} - Key-value map where keys are section keys (e.g. 'earnings_list') and values are filtered arrays
     */
    generateView(salarySnapshot, viewConfig) {
        if (!salarySnapshot) return {};
        if (!viewConfig || !viewConfig.sections) {
            // Default behavior: Return everything unmodified if no config exists
            return {
                earnings: this.formatList(salarySnapshot.earnings),
                deductions: this.formatList(salarySnapshot.employeeDeductions),
                contributions: this.formatList(salarySnapshot.employerContributions)
            };
        }

        const renderData = {};

        // Iterate through configured sections
        viewConfig.sections.forEach(section => {
            // 1. Select Source Data
            let sourceList = [];
            if (section.dataSource === 'earnings') sourceList = salarySnapshot.earnings || [];
            else if (section.dataSource === 'employeeDeductions') sourceList = salarySnapshot.employeeDeductions || [];
            else if (section.dataSource === 'employerContributions') sourceList = salarySnapshot.employerContributions || [];
            else if (section.dataSource === 'all') {
                sourceList = [
                    ...(salarySnapshot.earnings || []).map(i => ({ ...i, _isDeduction: false })),
                    ...(salarySnapshot.employeeDeductions || []).map(i => ({ ...i, _isDeduction: true })),
                    ...(salarySnapshot.employerContributions || []).map(i => ({ ...i, _isDeduction: false })) // Contributions aren't deductions from salary, usually just informational
                ];
            } else {
                // For specific sources, we might still want to know if it's a deduction to negative it? 
                // For now, only 'all' implies mixed context where sign matters.
                // But let's be safe: if source is employeeDeductions, assume deduction.
                if (section.dataSource === 'employeeDeductions') {
                    sourceList = sourceList.map(i => ({ ...i, _isDeduction: true }));
                }
            }

            // 2. Filter Data
            let filteredList = [];
            if (section.mode === 'INCLUDE_ALL') {
                filteredList = sourceList;
            } else if (section.mode === 'INCLUDE_SPECIFIC') {
                // Filter where name contains any of the config keys (fuzzy match)
                filteredList = sourceList.filter(item =>
                    section.components.some(compName =>
                        item.name.toLowerCase().includes(compName.toLowerCase())
                    )
                );
            } else if (section.mode === 'EXCLUDE_SPECIFIC') {
                filteredList = sourceList.filter(item =>
                    !section.components.some(compName =>
                        item.name.toLowerCase().includes(compName.toLowerCase())
                    )
                );
            }

            // STRICT RULE: Remove Zero-Value Rows (unless explicitly allowed via config, default to stricter cleanup)
            // User requirement: "No zero-value or empty rows"
            if (!section.allowZero) {
                filteredList = filteredList.filter(item => (item.monthlyAmount > 0 || item.annualAmount > 0));
            }

            // 3. Format for Display (Currencies, etc.)
            // Stores result in the key defined in config (e.g. 'joining_salary_table')
            renderData[section.sectionKey] = filteredList.map(item => {
                const isDed = item._isDeduction;
                const mVal = item.monthlyAmount || 0;
                const yVal = item.annualAmount || 0;

                // Format: If deduction, prepend '-' manually because toLocaleString might not do it for positive numbers we treat as deduction
                // Actually, if we just multiply by -1, toLocaleString handles it.

                const finalMonthly = isDed ? -Math.abs(mVal) : mVal;
                const finalYearly = isDed ? -Math.abs(yVal) : yVal;

                return {
                    name: item.name,
                    monthly: section.columns.monthly ? finalMonthly.toLocaleString('en-IN') : null,
                    yearly: section.columns.yearly ? finalYearly.toLocaleString('en-IN') : null,
                    _monthlyRaw: finalMonthly,
                    _yearlyRaw: finalYearly
                };
            });

            // 4. Calculate Section Total if requested
            if (section.showTotal) {
                const totalMonthly = filteredList.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0);
                const totalYearly = filteredList.reduce((sum, item) => sum + (item.annualAmount || 0), 0);

                renderData[`${section.sectionKey}_total_monthly`] = totalMonthly.toLocaleString('en-IN');
                renderData[`${section.sectionKey}_total_yearly`] = totalYearly.toLocaleString('en-IN');
                renderData[`${section.sectionKey}_total_label`] = section.totalLabel;
            }
        });

        // Always pass top-level totals from snapshot (Source of Truth)
        renderData.ctc_monthly = (salarySnapshot.ctc?.monthly || 0).toLocaleString('en-IN');
        renderData.ctc_yearly = (salarySnapshot.ctc?.yearly || 0).toLocaleString('en-IN');
        renderData.gross_monthly = (salarySnapshot.grossA?.monthly || 0).toLocaleString('en-IN');
        renderData.net_monthly = (salarySnapshot.takeHome?.monthly || 0).toLocaleString('en-IN');

        return renderData;
    }

    // Helper for default formatting
    formatList(list) {
        if (!list) return [];
        return list.map(item => ({
            name: item.name,
            monthly: (item.monthlyAmount || 0).toLocaleString('en-IN'),
            yearly: (item.annualAmount || 0).toLocaleString('en-IN')
        }));
    }
}

module.exports = new SalaryViewService();
