const mongoose = require('mongoose');

const LocationWeeklyOffSchema = new mongoose.Schema({
    mode: {
        type: String,
        enum: ['COMPANY_DEFAULT', 'SUNDAY', 'SATURDAY_SUNDAY', 'CUSTOM', 'ALTERNATE_SATURDAY'],
        default: 'COMPANY_DEFAULT'
    },
    weeklyOffDays: {
        type: [Number],
        default: []
    },
    saturdayHalfDayEnabled: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const LocationLocalAllowanceSchema = new mongoose.Schema({
    label: {
        type: String,
        trim: true,
        default: ''
    },
    amount: {
        type: Number,
        default: null
    },
    includedInCtc: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const LocationOvertimePolicySchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        trim: true,
        default: 'Overtime Pay'
    },
    multiplier: {
        type: Number,
        default: 1
    },
    weeklyOffMultiplier: {
        type: Number,
        default: 1.5
    },
    holidayMultiplier: {
        type: Number,
        default: 2
    },
    fixedHourlyRate: {
        type: Number,
        default: null
    }
}, { _id: false });

const LocationStatutorySchema = new mongoose.Schema({
    esiApplicable: {
        type: Boolean,
        default: null
    },
    lwfEnabled: {
        type: Boolean,
        default: false
    },
    lwfEmployeeAmount: {
        type: Number,
        default: null
    },
    lwfEmployerAmount: {
        type: Number,
        default: null
    },
    lwfDeductionMonth: {
        type: Number,
        default: null
    }
}, { _id: false });

const LocationPolicySchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true,
        default: 'IN'
    },
    legalEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null
    },
    branchIds: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch'
        }],
        default: []
    },
    payrollRegion: {
        type: String,
        trim: true,
        default: ''
    },
    workState: {
        type: String,
        trim: true,
        default: ''
    },
    workCity: {
        type: String,
        trim: true,
        default: ''
    },
    isMetro: {
        type: Boolean,
        default: false
    },
    hraPercentageOfBasic: {
        type: Number,
        default: null
    },
    professionalTaxAmount: {
        type: Number,
        default: null
    },
    holidayCalendarCode: {
        type: String,
        trim: true,
        default: ''
    },
    payCalendarCode: {
        type: String,
        trim: true,
        default: ''
    },
    minimumWageCategory: {
        type: String,
        trim: true,
        default: ''
    },
    minimumWageMonthlyAmount: {
        type: Number,
        default: null
    },
    weeklyOff: {
        type: LocationWeeklyOffSchema,
        default: () => ({})
    },
    localAllowance: {
        type: LocationLocalAllowanceSchema,
        default: () => ({})
    },
    overtimePolicy: {
        type: LocationOvertimePolicySchema,
        default: () => ({})
    },
    statutoryApplicability: {
        type: LocationStatutorySchema,
        default: () => ({})
    },
    enabled: {
        type: Boolean,
        default: true
    }
}, { _id: true });

const CompanyPayrollRuleSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, unique: true },

    // Basic Salary Rules
    basicSalary: {
        percentageOfCTC: { type: Number, default: 40 }, // e.g. 40%
        enabled: { type: Boolean, default: true }
    },

    // HRA Rules
    hra: {
        percentageOfBasic: { type: Number, default: 40 }, // e.g. 40% or 50%
        enabled: { type: Boolean, default: true }
    },

    // Conveyance
    conveyance: {
        type: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
        value: { type: Number, default: 1600 }, // Monthly fixed amount
        enabled: { type: Boolean, default: true }
    },

    // Medical Allowance
    medical: {
        type: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
        value: { type: Number, default: 1250 }, // Monthly fixed amount
        enabled: { type: Boolean, default: true }
    },

    // PF Rules
    pf: {
        enabled: { type: Boolean, default: true },
        employeeRate: { type: Number, default: 12 }, // 12%
        employerRate: { type: Number, default: 12 }, // 12%
        wageCeiling: { type: Number, default: 15000 },
        capContribution: { type: Boolean, default: true }, // Whether to cap calculation at 15000 basic
        includeInCTC: { type: Boolean, default: true } // Employer contribution moves out of Special Allowance
    },

    // ESIC Rules
    esic: {
        enabled: { type: Boolean, default: true },
        employeeRate: { type: Number, default: 0.75 },
        employerRate: { type: Number, default: 3.25 },
        wageCeiling: { type: Number, default: 21000 },
        includeInCTC: { type: Boolean, default: true }
    },

    // Professional Tax (Simple Slab for MVP, can be expanded to array of states)
    professionalTax: {
        enabled: { type: Boolean, default: true },
        defaultAmount: { type: Number, default: 200 } // Default monthly
    },

    // Location-aware overrides used by the payroll engine
    locationPolicies: {
        type: [LocationPolicySchema],
        default: []
    },

    updatedAt: { type: Date, default: Date.now }
});

module.exports = CompanyPayrollRuleSchema;
