/**
 * PayrollConfiguration Model
 * Tenant-specific payroll rules, tax configuration, and statutory deductions
 * Production-ready configuration management
 */

const mongoose = require('mongoose');

const PayrollConfigurationSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    unique: true,
    index: true
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX RULES (Country & Regime Specific)
  // ═══════════════════════════════════════════════════════════════
  taxRules: {
    country: {
      type: String,
      enum: ['IN', 'US', 'UK', 'AE', 'SG', 'CA', 'AU'],
      default: 'IN',
      required: true
    },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'GBP', 'AED', 'SGD', 'CAD', 'AUD'],
      default: 'INR'
    },
    
    // India-specific
    taxRegime: {
      type: String,
      enum: ['OLD', 'NEW'],
      default: 'NEW'  // India switched to NEW regime
    },
    
    // Tax Year (FY start/end)
    taxYearStart: { type: String, default: '04-01' },  // MM-DD format
    taxYearEnd: { type: String, default: '03-31' },
    
    // Tax Slabs (Progressive taxation)
    taxSlabs: [{
      minIncome: { type: Number, required: true },
      maxIncome: { type: Number, required: true },
      rate: { type: Number, required: true }  // Percentage
    }],
    
    // Standard Deduction
    standardDeduction: {
      type: Number,
      default: 50000  // India FY2024-25
    },
    
    // Rebate 87A (India specific)
    rebateSection87A: {
      maxIncome: { type: Number, default: 500000 },
      rebateAmount: { type: Number, default: 12500 }
    },
    
    // Surcharge (higher incomes)
    surcharge: [{
      minIncome: Number,
      maxIncome: Number,
      rate: Number  // % of tax
    }],
    
    // Cess (education cess, etc.)
    cess: {
      type: Number,
      default: 0  // 4% in India
    },
    
    // HRA Exemption Rules (India specific)
    hraExemption: {
      method: {
        type: String,
        enum: ['ACTUAL', 'PERCENT_OF_SALARY', 'METRO_NON_METRO'],
        default: 'METRO_NON_METRO'
      },
      metroPercentage: { type: Number, default: 50 },    // Metro: 50% of salary
      nonMetroPercentage: { type: Number, default: 40 },  // Non-metro: 40%
      maxCap: { type: Number, default: 5000000 },
      rentPaidRequired: { type: Boolean, default: true }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // STATUTORY DEDUCTIONS & CONTRIBUTIONS
  // ═══════════════════════════════════════════════════════════════
  statutoryRules: {
    // EMPLOYEE PROVIDENT FUND (EPF)
    epf: {
      enabled: { type: Boolean, default: true },
      employeeRate: { type: Number, default: 12 },    // 12% employee contribution
      employerRate: { type: Number, default: 12 },    // 12% employer contribution
      wageLimit: { type: Number, default: 15000 },    // Restricted to ₹15,000
      applyWageRestriction: { type: Boolean, default: true }
    },
    
    // EMPLOYEE STATE INSURANCE (ESI)
    esi: {
      enabled: { type: Boolean, default: true },
      employeeRate: { type: Number, default: 0.75 },   // 0.75% employee
      employerRate: { type: Number, default: 3.25 },   // 3.25% employer
      wageLimit: { type: Number, default: 21000 },     // Wages up to ₹21,000
      applyWageLimit: { type: Boolean, default: true }
    },
    
    // PROFESSIONAL TAX
    professionalTax: {
      enabled: { type: Boolean, default: true },
      stateWise: [{
        state: String,  // 'MH', 'KA', 'DL', etc.
        slabs: [{
          minIncome: Number,
          maxIncome: Number,
          amount: Number
        }]
      }],
      defaultAmount: { type: Number, default: 0 }
    },
    
    // GRATUITY (Employer contribution, not deducted from employee)
    gratuity: {
      enabled: { type: Boolean, default: true },
      accrualRate: { type: Number, default: 4.833 },  // % of salary
      vestingPeriod: { type: Number, default: 60 }   // Months
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYROLL PROCESSING RULES
  // ═══════════════════════════════════════════════════════════════
  payrollRules: {
    // Pro-Rata Calculation Method
    proRataMethod: {
      type: String,
      enum: ['DAYS_WORKED', 'CALENDAR_DAYS'],
      default: 'DAYS_WORKED'
    },
    
    // Loss of Pay (LOP) Rules
    lopRate: {
      type: Number,
      default: 1.0  // 1.0 = 100% of daily basic as LOP
    },
    lopCalculationBase: {
      type: String,
      enum: ['BASIC', 'BASIC_HRA', 'GROSS'],
      default: 'BASIC'
    },
    
    // Overtime Rules
    overtimeMultiplier: {
      regular: { type: Number, default: 1.0 },
      weekendPublicHoliday: { type: Number, default: 2.0 }
    },
    
    // Bank Transfer Rules
    bankTransferCutoffDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 25  // Salary expected on/before 25th
    },
    
    // Attendance Thresholds
    minimumAttendanceForFullSalary: {
      type: Number,
      default: 80  // 80% attendance required for full month's salary
    },
    
    // Rounding Rules
    roundingMethod: {
      type: String,
      enum: ['HALF_UP', 'HALF_DOWN', 'CEIL', 'FLOOR'],
      default: 'HALF_UP'
    },
    roundingUnit: {
      type: Number,
      default: 0.05  // Round to nearest ₹0.05
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // COMPLIANCE & AUDIT SETTINGS
  // ═══════════════════════════════════════════════════════════════
  complianceSettings: {
    // Lock Period (days after which payroll cannot be modified)
    lockPeriodDays: {
      type: Number,
      default: 30
    },
    
    // Approval Levels
    approvalLevels: {
      type: String,
      enum: ['SINGLE', 'DUAL', 'TRIPLE'],
      default: 'TRIPLE'  // HR → Finance → Admin
    },
    
    // Audit Trail
    enableDetailedAudit: { type: Boolean, default: true },
    retentionYears: { type: Number, default: 7 },
    
    // Amendment Allowance
    allowAmendmentAfterPayment: {
      type: Boolean,
      default: false  // Strict: no amendments after payment
    },
    amendmentAllowanceDays: {
      type: Number,
      default: 30
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // DEDUCTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  deductionConfig: {
    // Loan Management
    loanDeductions: {
      enabled: { type: Boolean, default: true },
      maxNumberOfActiveLoans: { type: Number, default: 3 },
      interestCalculationMethod: {
        type: String,
        enum: ['SIMPLE', 'COMPOUND'],
        default: 'SIMPLE'
      }
    },
    
    // Advance Management
    advances: {
      enabled: { type: Boolean, default: true },
      maxAdvanceAsPercentOfGross: { type: Number, default: 30 },  // 30% of monthly gross
      repaymentPeriodMonths: { type: Number, default: 3 }
    },
    
    // Disciplinary Deductions
    disciplinaryDeductions: {
      enabled: { type: Boolean, default: true },
      requiresApproval: { type: Boolean, default: true }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ALLOWANCE RULES
  // ═══════════════════════════════════════════════════════════════
  allowanceRules: {
    // House Rent Allowance
    hra: {
      taxExemption: {
        minOfThree: [
          { label: 'Actual HRA', field: 'actualHRA' },
          { label: '50% of salary (Metro)', field: 'salaryPercent' },
          { label: 'Rent minus 10% of salary', field: 'rentMinus' }
        ]
      }
    },
    
    // Leave Travel Allowance
    lta: {
      enabled: { type: Boolean, default: true },
      exemptionAmount: { type: Number, default: 350000 },  // Per annum
      carryForwardAllowed: { type: Boolean, default: true }
    },
    
    // Transport Allowance
    transport: {
      taxExemption: { type: Number, default: 19200 }  // Per annum
    },
    
    // Medical Reimbursement
    medical: {
      exemption: { type: Number, default: 15000 }  // Per annum
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // COMPANY-SPECIFIC SETTINGS
  // ═══════════════════════════════════════════════════════════════
  companySettings: {
    companyName: { type: String, required: true },
    registrationNumber: String,
    panNumber: String,
    tanNumber: String,
    
    fiscalYearStart: { type: String, default: '04-01' },  // MM-DD
    fiscalYearEnd: { type: String, default: '03-31' },
    
    timezone: { type: String, default: 'Asia/Kolkata' },
    
    // Company Welfare Contributions
    welfareContributions: [{
      name: String,
      rate: Number,  // % of salary
      category: {
        type: String,
        enum: ['EMPLOYER_PF', 'WELFARE_FUND', 'MEDICAL', 'OTHER']
      }
    }]
  },

  // ═══════════════════════════════════════════════════════════════
  // STATUS & CONTROL
  // ═══════════════════════════════════════════════════════════════
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  approvedAt: Date

}, {
  timestamps: true
});

module.exports = PayrollConfigurationSchema;
