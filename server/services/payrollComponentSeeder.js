const SalaryComponentSchema = require('../models/SalaryComponent');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
}

/**
 * Seed default payroll components for a tenant. Idempotent (safe to run multiple times).
 * @param {Object} tenantDB - Mongoose connection for tenant (must be provided)
 * @param {String|ObjectId} tenantId - Tenant id to scope components
 * @returns {Promise<Array>} results per component
 */
async function seedDefaultComponents(tenantDB, tenantId) {
  if (!tenantDB) throw new Error('tenantDB required');
  if (!tenantId) throw new Error('tenantId required');

  const SalaryComponent = tenantDB.models.SalaryComponent || tenantDB.model('SalaryComponent', SalaryComponentSchema);

  const components = [
    // Monthly Earnings
    { name: 'Basic', payslipName: 'Basic', earningType: 'Basic', calculationType: 'PERCENTAGE_OF_CTC', percentage: 50, isTaxable: true, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'House Rent Allowance', payslipName: 'HRA', earningType: 'HRA', calculationType: 'PERCENTAGE_OF_BASIC', percentage: 40, isTaxable: true, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Medical Reimbursement', payslipName: 'Med. Reimb.', earningType: 'Medical', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Transport Allowance', payslipName: 'Transport', earningType: 'Transport', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: true, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Education Allowance', payslipName: 'Education', earningType: 'Education', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Book & Periodicals Allowance', payslipName: 'Books & Per.', earningType: 'Books', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Uniform Allowance', payslipName: 'Uniform', earningType: 'Uniform', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Conveyance Allowance', payslipName: 'Conveyance', earningType: 'Conveyance', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Mobile Reimbursement', payslipName: 'Mobile', earningType: 'Mobile', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Hardship Allowance', payslipName: 'Hardship', earningType: 'Hardship', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: true, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },
    { name: 'Compensatory Allowance', payslipName: 'Compensatory', earningType: 'Compensatory', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: true, isProRataBasis: true, includeInSalaryStructure: true, showInPayslip: true },

    // Annual Earning
    { name: 'Leave Pay', payslipName: 'Leave Pay', earningType: 'Annual Benefit', calculationType: 'PERCENTAGE_OF_CTC', percentage: 0, isTaxable: true, isProRataBasis: false, includeInSalaryStructure: true, showInPayslip: false },

    // Employee-side Deductions
    { name: 'Provident Fund (Employee)', payslipName: 'PF', earningType: 'Employee Contribution', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_BASIC', percentage: 12, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: false, showInPayslip: true, epf: { enabled: true, rule: 'ALWAYS' } },
    { name: 'Income Tax', payslipName: 'TDS', earningType: 'Statutory', type: 'DEDUCTION', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: false, showInPayslip: true },
    { name: 'Professional Tax', payslipName: 'Prof. Tax', earningType: 'Statutory', type: 'DEDUCTION', calculationType: 'FLAT_AMOUNT', amount: 200, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: false, showInPayslip: true },
    { name: 'ESI (Employee)', payslipName: 'ESI', earningType: 'Employee Contribution', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_CTC', percentage: 0.75, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: false, showInPayslip: true, esi: { enabled: true } },

    // Employer Contributions (part of CTC, do not affect net salary)
    { name: 'Provident Fund (Employer)', payslipName: 'EPF (ER)', earningType: 'Employer Contribution', calculationType: 'PERCENTAGE_OF_BASIC', percentage: 12, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: true, showInPayslip: false, epf: { enabled: true, rule: 'ALWAYS' } },
    { name: 'Gratuity', payslipName: 'Gratuity', earningType: 'Retiral Benefit', calculationType: 'PERCENTAGE_OF_BASIC', percentage: 4.81, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: true, showInPayslip: false },
    { name: 'Medical Insurance (Employer)', payslipName: 'Employer Med. Ins.', earningType: 'Employer Benefit', calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isProRataBasis: false, includeInSalaryStructure: true, showInPayslip: false }
  ];

  const results = [];

  for (const raw of components) {
    try {
      const comp = Object.assign({}, raw);
      const type = comp.type || 'EARNING';

      // Ensure default fields exist and normalized
      comp.type = type;
      comp.tenantId = tenantId;
      comp.isActive = comp.isActive === false ? false : true;
      comp.isTaxable = typeof comp.isTaxable === 'boolean' ? comp.isTaxable : false;
      comp.isProRataBasis = typeof comp.isProRataBasis === 'boolean' ? comp.isProRataBasis : true;
      comp.includeInSalaryStructure = typeof comp.includeInSalaryStructure === 'boolean' ? comp.includeInSalaryStructure : true;
      comp.showInPayslip = typeof comp.showInPayslip === 'boolean' ? comp.showInPayslip : true;
      comp.amount = typeof comp.amount === 'number' ? comp.amount : 0;
      comp.percentage = typeof comp.percentage === 'number' ? comp.percentage : 0;

      // Case-insensitive existence check
      const existing = await SalaryComponent.findOne({ tenantId, name: new RegExp('^' + escapeRegExp(comp.name) + '$', 'i') });
      if (existing) {
        results.push({ name: comp.name, status: 'exists', id: existing._id });
        continue;
      }

      const doc = new SalaryComponent(comp);
      await doc.save();
      results.push({ name: comp.name, status: 'created', id: doc._id });
    } catch (err) {
      results.push({ name: raw.name, status: 'error', message: err.message });
    }
  }

  return results;
}

module.exports = { seedDefaultComponents };
