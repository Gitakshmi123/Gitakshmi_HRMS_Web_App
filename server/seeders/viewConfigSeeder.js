const mongoose = require('mongoose');

const joiningLetterConfig = {
    tenantId: "PLACEHOLDER_TENANT_ID",
    documentType: "JOINING_LETTER",
    sections: [
        {
            sectionKey: "salary_table", // In Word: {{#salary_table}} {{name}} {{monthly}} {{/salary_table}}
            dataSource: "earnings",
            mode: "INCLUDE_SPECIFIC",
            components: ["Basic Salary", "HRA", "Special Allowance"], // Only show these 3
            columns: { monthly: true, yearly: false }, // Only monthly column
            showTotal: true,
            totalLabel: "Total Gross Salary"
        }
    ]
};

const ctcAnnexureConfig = {
    tenantId: "PLACEHOLDER_TENANT_ID",
    documentType: "CTC_ANNEXURE",
    sections: [
        {
            sectionKey: "earnings_list",
            dataSource: "earnings",
            mode: "INCLUDE_ALL", // Show all earnings
            columns: { monthly: true, yearly: true },
            showTotal: true,
            totalLabel: "Total Earnings (A)"
        },
        {
            sectionKey: "deductions_list",
            dataSource: "employeeDeductions",
            mode: "INCLUDE_ALL",
            columns: { monthly: true, yearly: true },
            showTotal: true,
            totalLabel: "Total Deductions (B)"
        },
        {
            sectionKey: "contributions_list",
            dataSource: "employerContributions",
            mode: "INCLUDE_ALL",
            columns: { monthly: false, yearly: true }, // Employer part usually annual
            showTotal: true,
            totalLabel: "Employer Contributions (C)"
        }
    ]
};

const payslipConfig = {
    tenantId: "PLACEHOLDER_TENANT_ID",
    documentType: "PAYSLIP",
    sections: [
        {
            sectionKey: "earnings",
            dataSource: "earnings",
            mode: "INCLUDE_ALL",
            columns: { monthly: true, yearly: false },
            showTotal: true,
            totalLabel: "Total Earnings"
        },
        {
            sectionKey: "deductions",
            dataSource: "employeeDeductions",
            mode: "INCLUDE_ALL",
            columns: { monthly: true, yearly: false },
            showTotal: true,
            totalLabel: "Total Deductions"
        }
    ]
};

module.exports = { joiningLetterConfig, ctcAnnexureConfig, payslipConfig };
