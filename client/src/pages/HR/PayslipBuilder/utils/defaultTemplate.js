// utils/defaultTemplate.js

export const DEFAULT_TEMPLATE = [
  // ----------------------------------
  // COMPANY HEADER
  // ----------------------------------
  {
    id: "company-header",
    type: "company-header",
    props: {
      companyName: "{{COMPANY_NAME}}",
      address: "{{COMPANY_ADDRESS}}",
      email: "{{COMPANY_EMAIL}}",
      phone: "{{COMPANY_PHONE}}",
      logo: "{{COMPANY_LOGO}}",
      padding: 20,
    },
  },

  // ----------------------------------
  // TITLE SECTION
  // ----------------------------------
  {
    id: "payslip-title",
    type: "payslip-title",
    props: {
      title: "PAYSHEET FOR THE MONTH OF {{MONTH}}-{{YEAR}}",
      underline: true,
      align: "center",
      marginTop: 20,
    },
  },

  // ----------------------------------
  // EMPLOYEE GRID SECTION
  // ----------------------------------
  {
    id: "employee-grid",
    type: "employee-grid",
    props: {
      left: [
        { label: "Emp Code", value: "{{EMPLOYEE_CODE}}" },
        { label: "Department", value: "{{DEPARTMENT}}" },
        { label: "Designation", value: "{{DESIGNATION}}" },
        { label: "Date of Birth", value: "{{DOB}}" },
        { label: "Date of Joining", value: "{{DOJ}}" },
        { label: "PF No", value: "{{PF_NO}}" },
        { label: "UAN No", value: "{{UAN_NO}}" },
      ],
      right: [
        { label: "Employee Name", value: "{{EMPLOYEE_NAME}}" },
        { label: "Cost Center", value: "{{COST_CENTER}}" },
        { label: "Job Title", value: "{{JOB_TITLE}}" },
        { label: "PAN No", value: "{{PAN_NO}}" },
        { label: "Bank Name", value: "{{BANK_NAME}}" },
        { label: "Account No", value: "{{BANK_ACCOUNT_NO}}" },
        { label: "Gender", value: "{{GENDER}}" },
      ],
      netPay: {
        amount: "{{NET_PAY}}",
        paidDays: "{{PAID_DAYS}}",
        lopDays: "{{LOP_DAYS}}",
      },
    },
  },

  // ----------------------------------
  // EARNINGS TABLE
  // ----------------------------------
  {
    id: "earnings-table",
    type: "table",
    props: {
      title: "EARNINGS",
      columns: ["Particulars", "Amount", "YTD"],
      rows: [
        ["{{EARNING_NAME_1}}", "{{EARNING_AMOUNT_1}}", "{{EARNING_YTD_1}}"],
        ["{{EARNING_NAME_2}}", "{{EARNING_AMOUNT_2}}", "{{EARNING_YTD_2}}"],
      ],
      footerLabel: "Gross Earnings",
      footerValue: "{{GROSS_EARNINGS}}",
    },
  },

  // ----------------------------------
  // DEDUCTIONS TABLE
  // ----------------------------------
  {
    id: "deductions-table",
    type: "table",
    props: {
      title: "DEDUCTIONS",
      columns: ["Particulars", "Amount", "YTD"],
      rows: [
        ["{{DEDUCTION_NAME_1}}", "{{DEDUCTION_AMOUNT_1}}", "{{DEDUCTION_YTD_1}}"],
        ["{{DEDUCTION_NAME_2}}", "{{DEDUCTION_AMOUNT_2}}", "{{DEDUCTION_YTD_2}}"],
      ],
      footerLabel: "Total Deductions",
      footerValue: "{{TOTAL_DEDUCTIONS}}",
    },
  },

  // ----------------------------------
  // REIMBURSEMENTS TABLE
  // ----------------------------------
  {
    id: "reimbursements-table",
    type: "table",
    props: {
      title: "REIMBURSEMENTS",
      columns: ["Particular", "Amount", "YTD"],
      rows: [
        ["{{REIMB_NAME_1}}", "{{REIMB_AMOUNT_1}}", "{{REIMB_YTD_1}}"],
      ],
      footerLabel: "Total Reimbursements",
      footerValue: "{{TOTAL_REIMBURSEMENTS}}",
    },
  },

  // ----------------------------------
  // NET PAY SUMMARY
  // ----------------------------------
  {
    id: "net-pay-summary",
    type: "net-pay-summary",
    props: {
      gross: "{{GROSS_EARNINGS}}",
      deductions: "{{TOTAL_DEDUCTIONS}}",
      reimbursements: "{{TOTAL_REIMBURSEMENTS}}",
      netPay: "{{NET_PAY}}",
      netPayWords: "{{NET_PAY_IN_WORDS}}",
    },
  },

  // ----------------------------------
  // FOOTER
  // ----------------------------------
  {
    id: "payslip-footer",
    type: "payslip-footer",
    props: {
      text:
        "Total Net Payable: {{NET_PAY}} ({{NET_PAY_IN_WORDS}})\n\n" +
        "This is a system generated payslip.",
      align: "center",
    },
  },
];
