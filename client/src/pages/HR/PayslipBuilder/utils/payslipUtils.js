/**
 * -------------------------------------------------------------
 *  PAYSLIP UTILITIES – FULL ERROR-FREE VERSION (FINAL)
 * -------------------------------------------------------------
 */

/* -------------------------------------------------------------
   1. PLACEHOLDERS
------------------------------------------------------------- */
export const PAYSLIP_PLACEHOLDERS = [
    { name: '{{COMPANY_LOGO}}', description: 'Company Logo URL', category: 'Company' },
    { name: '{{COMPANY_NAME}}', description: 'Company Name', category: 'Company' },
    { name: '{{COMPANY_ADDRESS}}', description: 'Company Address', category: 'Company' },
    { name: '{{COMPANY_EMAIL}}', description: 'Company Email', category: 'Company' },
    { name: '{{COMPANY_PHONE}}', description: 'Company Phone', category: 'Company' },

    { name: '{{EMPLOYEE_NAME}}', description: 'Employee Full Name', category: 'Employee' },
    { name: '{{EMPLOYEE_ID}}', description: 'Employee ID', category: 'Employee' },
    { name: '{{EMPLOYEE_CODE}}', description: 'Employee Code', category: 'Employee' },
    { name: '{{DEPARTMENT}}', description: 'Department', category: 'Employee' },
    { name: '{{COST_CENTER}}', description: 'Cost Center', category: 'Employee' },
    { name: '{{DESIGNATION}}', description: 'Designation', category: 'Employee' },
    { name: '{{JOB_TITLE}}', description: 'Job Title', category: 'Employee' },
    { name: '{{DOB}}', description: 'Date of Birth', category: 'Employee' },
    { name: '{{DOJ}}', description: 'Date of Joining', category: 'Employee' },
    { name: '{{GENDER}}', description: 'Gender', category: 'Employee' },

    { name: '{{PF_NO}}', description: 'PF Number', category: 'Payroll' },
    { name: '{{UAN_NO}}', description: 'UAN Number', category: 'Payroll' },
    { name: '{{PAN_NO}}', description: 'PAN Number', category: 'Payroll' },
    { name: '{{BANK_NAME}}', description: 'Bank Name', category: 'Payroll' },
    { name: '{{BANK_ACCOUNT_NO}}', description: 'Bank Account Number', category: 'Payroll' },

    { name: '{{MONTH}}', description: 'Month', category: 'Date' },
    { name: '{{YEAR}}', description: 'Year', category: 'Date' },
    { name: '{{GENERATED_ON}}', description: 'Generation Date', category: 'Date' },

    { name: '{{BASIC}}', description: 'Basic Salary', category: 'Earnings' },
    { name: '{{SPECIAL}}', description: 'Special Allowance', category: 'Earnings' },
    { name: '{{HRA}}', description: 'HRA', category: 'Earnings' },
    { name: '{{DEARNESS}}', description: 'Dearness Allowance', category: 'Earnings' },

    { name: '{{GROSS_EARNINGS}}', description: 'Gross Earnings', category: 'Earnings' },
    { name: '{{GROSS}}', description: 'Gross (Essential)', category: 'Earnings', essential: true },

    { name: '{{EPF}}', description: 'EPF', category: 'Deductions' },
    { name: '{{ESI}}', description: 'ESI', category: 'Deductions' },
    { name: '{{PT}}', description: 'Professional Tax', category: 'Deductions' },
    { name: '{{INCOME_TAX}}', description: 'Income Tax', category: 'Deductions' },
    { name: '{{TOTAL_DEDUCTIONS}}', description: 'Total Deductions', category: 'Deductions', essential: true },

    { name: '{{TOTAL_REIMBURSEMENTS}}', description: 'Reimbursements', category: 'Reimbursements' },

    { name: '{{PAID_DAYS}}', description: 'Paid Days', category: 'Attendance' },
    { name: '{{LOP_DAYS}}', description: 'Loss of Pay Days', category: 'Attendance' },
    { name: '{{TOTAL_DAYS}}', description: 'Total Days', category: 'Attendance' },

    { name: '{{NET_PAY}}', description: 'Net Pay (Essential)', category: 'Totals', essential: true },
    { name: '{{NET_PAY_IN_WORDS}}', description: 'Net Pay in Words', category: 'Totals' },
];

/* -------------------------------------------------------------
   2. EXTRACT PLACEHOLDERS
------------------------------------------------------------- */
export const extractPlaceholders = (text) => {
    if (!text) return [];
    const regex = /\{\{([A-Z_0-9]+)\}\}/g;
    const out = new Set();
    let m;
    while ((m = regex.exec(text)) !== null) out.add(`{{${m[1]}}}`);
    return Array.from(out);
};

/* -------------------------------------------------------------
   3. CHECK ESSENTIAL PLACEHOLDERS
------------------------------------------------------------- */
export const checkMissingEssentialPlaceholders = (html) => {
    if (!html) return [];
    // Allow either {{GROSS}} or {{GROSS_EARNINGS}}
    const essential = ['{{TOTAL_DEDUCTIONS}}', '{{NET_PAY}}'];
    const found = extractPlaceholders(html);

    const missing = essential.filter(e => !found.includes(e));

    if (!found.includes('{{GROSS}}') && !found.includes('{{GROSS_EARNINGS}}')) {
        missing.push('{{GROSS}}');
    }

    return missing;
};

/* -------------------------------------------------------------
   4. DEFAULT TEMPLATE
------------------------------------------------------------- */
export const getDefaultPayslipDesign = () => {
    // This is now handled by defaultTemplate.js, but keeping a fallback
    return [];
};

/* -------------------------------------------------------------
   5. DESIGN → HTML
------------------------------------------------------------- */
export const convertDesignToHTML = (sections) => {
    if (!Array.isArray(sections)) return "";

    let html = `
<!DOCTYPE html>
<html>
<head>
<style>
*{box-sizing:border-box;}
body{font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;margin:0;padding:0;color:#333;line-height:1.5;}
.payslip-container{padding:40px;width:210mm;margin:0 auto;background:white;}
.section{margin-bottom:25px;}
.table-section table{width:100%;border-collapse:collapse;margin-top:10px;}
.table-section th, .table-section td{padding:10px;border:1px solid #eee;font-size:12px;}
.table-section th{background:#f9f9f9;text-align:left;font-weight:600;}
.text-center{text-align:center;}
.text-right{text-align:right;}
.font-bold{font-weight:bold;}
.border-b{border-bottom:1px solid #eee;}
.bg-light{background:#fafafa;}
</style>
</head>
<body>
<div class="payslip-container">
`;

    sections.forEach(section => {
        html += renderSectionHTML(section);
    });

    html += `
</div>
</body>
</html>
`;

    return html;
};

/* -------------------------------------------------------------
   6. SECTION RENDERER
------------------------------------------------------------- */
const renderSectionHTML = (section) => {
    if (!section) return "";
    const p = section.props || section.content || {}; // Support both terms for safety
    const safe = (v, f = "") => (v !== undefined && v !== null ? v : f);

    switch (section.type) {

        case "company-header":
            return `
            <div class="section" style="display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:2px solid #444;">
                <div>${p.logo ? `<img src="${p.logo}" style="height:60px;object-fit:contain;">` : ""}</div>
                <div style="text-align:right;font-size:13px;">
                    <h2 style="margin:0;font-size:20px;color:#1a73e8;">${safe(p.companyName)}</h2>
                    <p style="margin:4px 0;">${safe(p.address)}</p>
                    <p style="margin:2px 0;">${safe(p.email)} | ${safe(p.phone)}</p>
                </div>
            </div>`;

        case "payslip-title":
            return `
            <div class="section" style="text-align:${safe(p.align, "center")};margin-top:${safe(p.marginTop, 20)}px;">
                <h2 style="font-size:20px;margin:0;${p.underline ? 'text-decoration:underline;' : ''}">
                    ${safe(p.title)}
                </h2>
            </div>`;

        case "employee-grid":
            return `
            <div class="section" style="border:1px solid #eee;border-radius:4px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="width:40%;padding:15px;vertical-align:top;border-right:1px solid #eee;font-size:12px;">
                            ${(p.left || []).map(i => `
                                <div style="display:flex;margin-bottom:6px;">
                                    <span style="width:100px;color:#666;">${i.label}</span>
                                    <span style="font-weight:600;">: ${i.value}</span>
                                </div>
                            `).join("")}
                        </td>
                        <td style="width:40%;padding:15px;vertical-align:top;border-right:1px solid #eee;font-size:12px;">
                            ${(p.right || []).map(i => `
                                <div style="display:flex;margin-bottom:6px;">
                                    <span style="width:120px;color:#666;">${i.label}</span>
                                    <span style="font-weight:600;">: ${i.value}</span>
                                </div>
                            `).join("")}
                        </td>
                        <td style="width:20%;padding:15px;vertical-align:top;background:#fcfcfc;text-align:center;">
                            <div style="font-size:11px;color:#666;margin-bottom:4px;">Net Payable</div>
                            <div style="font-size:22px;font-weight:bold;color:#1a73e8;margin-bottom:15px;">${safe(p.netPay?.amount)}</div>
                            <div style="font-size:11px;color:#666;border-top:1px solid #eee;padding-top:10px;">
                                Paid Days: <strong>${safe(p.netPay?.paidDays)}</strong><br>
                                LOP Days: <strong>${safe(p.netPay?.lopDays)}</strong>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>`;

        case "table":
            return `
            <div class="section table-section">
                <h3 style="font-size:14px;margin-bottom:10px;color:#444;border-left:4px solid #1a73e8;padding-left:10px;">${safe(p.title)}</h3>
                <table style="width:100%;border:1px solid #eee;border-collapse:collapse;">
                    <thead>
                     <tr style="background:#f9f9f9;">
                         ${(p.columns || []).map(col => `<th style="padding:10px;text-align:left;border:1px solid #eee;font-size:12px;">${col}</th>`).join("")}
                     </tr>
                    </thead>
                    <tbody>
                        ${(p.rows || []).map(r => `
                            <tr>
                                ${Array.isArray(r)
                    ? r.map((cell, idx) => `<td style="padding:10px;border:1px solid #eee;font-size:12px;${idx > 0 ? 'text-align:right;' : ''}">${cell}</td>`).join("")
                    : `<td style="padding:10px;border:1px solid #eee;font-size:12px;">${r.label}</td>
                                       <td style="padding:10px;border:1px solid #eee;font-size:12px;text-align:right;">${r.amount}</td>
                                       <td style="padding:10px;border:1px solid #eee;font-size:12px;text-align:right;">${r.ytd}</td>`
                }
                            </tr>
                        `).join("")}
                        <tr style="font-weight:bold;background:#fcfcfc;">
                            <td colspan="${(p.columns?.length || 3) - 1}" style="padding:10px;border:1px solid #eee;font-size:12px;">${safe(p.footerLabel)}</td>
                            <td style="padding:10px;border:1px solid #eee;font-size:12px;text-align:right;color:#1a73e8;">${safe(p.footerValue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>`;

        case "net-pay-summary":
            return `
            <div class="section" style="background:#f8faff;border:1px solid #e1e8f5;border-radius:6px;padding:20px;display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:13px;color:#555;">
                    <span style="margin-right:20px;">Gross: <strong>${safe(p.gross)}</strong></span>
                    <span style="margin-right:20px;">Deductions: <strong>${safe(p.deductions)}</strong></span>
                    ${p.reimbursements ? `<span>Reimbursements: <strong>${safe(p.reimbursements)}</strong></span>` : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px;color:#666;">TOTAL NET PAYABLE</div>
                    <div style="font-size:24px;font-weight:bold;color:#1a73e8;">${safe(p.netPay)}</div>
                </div>
            </div>`;

        case "payslip-footer":
            return `
            <div class="section" style="text-align:${safe(p.align, "center")};padding-top:20px;border-top:1px dashed #ccc;margin-top:40px;">
                <p style="font-size:14px;font-weight:600;margin-bottom:10px;white-space:pre-wrap;">${safe(p.text)}</p>
                <p style="font-size:11px;color:#999;">End of Payslip</p>
            </div>`;
    }

    return "";
};


/* -------------------------------------------------------------
   7. SAMPLE DATA
------------------------------------------------------------- */
export const getSamplePayslipData = () => ({
    COMPANY_LOGO: "https://via.placeholder.com/120x60?text=GITAKSHMI",
    COMPANY_NAME: "Gitakshmi Industries Pvt Ltd",
    COMPANY_ADDRESS: "123 Technology Park, Floor 4, Ahmedabad, Gujarat 380054",
    COMPANY_EMAIL: "hr@gitakshmi.com",
    COMPANY_PHONE: "+91 79 1234 5678",

    EMPLOYEE_NAME: "Rohan Verma",
    EMPLOYEE_ID: "GPL/2024/042",
    EMPLOYEE_CODE: "EMP-042",
    DEPARTMENT: "Software Development",
    COST_CENTER: "CC-INDIA-01",
    DESIGNATION: "Senior Full Stack Engineer",
    JOB_TITLE: "Engineering Lead",
    DOB: "22/10/1992",
    DOJ: "01/02/2024",
    GENDER: "Male",
    PF_NO: "MH/BAN/12345/678",
    UAN_NO: "100987654321",
    PAN_NO: "ABCDE1234F",
    BANK_NAME: "HDFC Bank",
    BANK_ACCOUNT_NO: "50100012345678",

    MONTH: "February",
    YEAR: "2024",
    GENERATED_ON: new Date().toLocaleDateString(),

    PAID_DAYS: "28",
    LOP_DAYS: "0",
    TOTAL_DAYS: "29",

    // Earnings
    EARNING_NAME_1: "Basic Salary",
    EARNING_AMOUNT_1: "45,000",
    EARNING_YTD_1: "4,50,000",
    EARNING_NAME_2: "House Rent Allowance",
    EARNING_AMOUNT_2: "18,000",
    EARNING_YTD_2: "1,80,000",

    BASIC: "45,000",
    HRA: "18,000",
    SPECIAL: "7,000",
    GROSS_EARNINGS: "70,000",
    GROSS: "70,000",

    // Deductions
    DEDUCTION_NAME_1: "Provident Fund",
    DEDUCTION_AMOUNT_1: "1,800",
    DEDUCTION_YTD_1: "18,000",
    DEDUCTION_NAME_2: "Professional Tax",
    DEDUCTION_AMOUNT_2: "200",
    DEDUCTION_YTD_2: "2,000",

    EPF: "1,800",
    PT: "200",
    TOTAL_DEDUCTIONS: "2,000",

    // Reimbursements
    REIMB_NAME_1: "Internet Allowance",
    REIMB_AMOUNT_1: "1,000",
    REIMB_YTD_1: "10,000",
    TOTAL_REIMBURSEMENTS: "1,000",

    NET_PAY: "69,000",
    NET_PAY_IN_WORDS: "Sixty Nine Thousand Indian Rupees Only",
});

/* -------------------------------------------------------------
   8. REPLACE PLACEHOLDERS
------------------------------------------------------------- */
export const replacePlaceholdersWithData = (html, data) => {
    let fresh = html;
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, "g");
        fresh = fresh.replace(regex, data[key]);
    });
    return fresh;
};

