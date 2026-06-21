const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EmployeeSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
  subCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCompany', default: null, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null, index: true },
  firstName: { type: String, trim: true },
  firstNameCapital: { type: String, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: false },
  employeeId: { type: String, trim: true, unique: true, index: true },
  dob: { type: Date },
  contactNo: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    // required: function() { return this.status === 'Active'; } // Removed as per user request 
  },
  personalEmail: { type: String, trim: true },
  customFields: [{
    label: { type: String, trim: true },
    value: { type: String, trim: true }
  }],
  status: { type: String, enum: ['ACTIVE', 'Active', 'active', 'notice', 'resigned', 'Draft', 'INACTIVE', 'Inactive'], default: 'active' },
  lastStep: { type: Number, default: 6 },
  resignationDate: { type: Date },
  lastWorkingDate: { type: Date },
  replacementRequired: { type: Boolean, default: false },
  replacementId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReplacementRequest' },
  category: { type: String, trim: true }, // UNSKILLED, SEMI-SKILLED, SKILLED
  state: { type: String, trim: true },    // WORK STATE
  salary: { type: Number, default: 0 },
  employmentType: { type: String, enum: ['permanent', 'contract'], default: 'permanent' },
  password: { type: String, trim: true },
  profilePic: { type: String, trim: true },
  bloodGroup: { type: String, trim: true },
  role: { type: String, trim: true }, // Legacy role string
  employeeCode: { type: String, trim: true, index: true },
  leavePolicy: { type: mongoose.Schema.Types.ObjectId, ref: 'LeavePolicy', default: null },
  leaveBalance: {
    SL: { type: Number, default: 0 },
    PL: { type: Number, default: 0 },
    CL: { type: Number, default: 0 },
    LWP: { type: Number, default: 0 },
    EL: { type: Number, default: 0 }
  },
  leaveBalanceYear: { type: Number, default: null },
  // Salary Template reference
  salaryTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate', default: null, index: true },
  // Department reference (ObjectId for proper relationship)
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  // logical department linkage (name or code) - kept for backward compatibility
  department: { type: String, trim: true },
  
  employeeCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeCategory', default: null, index: true },
  holidayCalendar: { type: mongoose.Schema.Types.ObjectId, ref: 'HolidayCalendar', default: null, index: true },
  leaveGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveGroup', default: null, index: true },
  confirmationPeriod: { type: String, trim: true },
  basic: { type: String, trim: true },
  leaveTravelAllowance: { type: String, trim: true },
  // direct manager (self-referencing within same tenant)
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  reportingTeamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  reportingManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  reportingHR: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  reportingHRHead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  reportingFinanceHead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  reportingCEO: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  // joining date
  joiningDate: { type: Date, default: Date.now },
  maritalStatus: { type: String, trim: true },
  nationality: { type: String, trim: true },
  // Physical disability or serious sickness in last 2 years (yes/no); if yes, details
  physicalDisabilityOrSickness: { type: String, trim: true, enum: ['', 'yes', 'no'] },
  physicalDisabilityDetails: { type: String, trim: true },
  fatherName: { type: String, trim: true },
  motherName: { type: String, trim: true },
  emergencyContactName: { type: String, trim: true },
  emergencyContactNumber: {
    type: String,
    trim: true
  },

  placeOfBirth: { type: String, trim: true },
  hobbies: { type: String, trim: true },
  height: { type: String, trim: true },
  weight: { type: String, trim: true },

  fatherFirstName: { type: String, trim: true },
  fatherLastName: { type: String, trim: true },
  fatherAadhaar: { type: String, trim: true },
  motherFirstName: { type: String, trim: true },
  motherLastName: { type: String, trim: true },
  motherAadhaar: { type: String, trim: true },

  fatherCustomFields: [{ label: String, value: String }],
  motherCustomFields: [{ label: String, value: String }],

  spouseDetails: {
    spouseName: { type: String, trim: true },
    relation: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Female' },
    bloodGroup: { type: String, trim: true },
    dob: { type: Date },
    contactNo: { type: String, trim: true },
    additionalFields: [{ label: String, value: String }]
  },

  children: [{
    name: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    dob: { type: Date },
    bloodGroup: { type: String, trim: true },
    additionalFields: [{ label: String, value: String }]
  }],
  brothers: [{
    name: { type: String, trim: true },
    gender: { type: String, default: 'Male' },
    dob: { type: Date },
    bloodGroup: { type: String, trim: true },
    additionalFields: [{ label: String, value: String }]
  }],
  sisters: [{
    name: { type: String, trim: true },
    gender: { type: String, default: 'Female' },
    dob: { type: Date },
    bloodGroup: { type: String, trim: true },
    additionalFields: [{ label: String, value: String }]
  }],

  languages: [{
    name: String,
    read: Boolean,
    write: Boolean,
    speak: Boolean,
    understand: Boolean,
    motherTongue: Boolean
  }],

  previousInterview: { type: String, trim: true },
  previousInterviewDate: { type: Date },
  previousInterviewDeptLocation: { type: String, trim: true },
  previousInterviewedBy: { type: String, trim: true },

  perquisites: {
    companyCarModel: String,
    companyCarMileageKm: String,
    companyCarPetrolRsMonth: String,
    leasedAccomSpecify: String,
    leasedAccomFlatInWifeName: String,
    leasedAccomMonthlyRentRs: String,
    leasedAccomDepositRs: String,
    hardFurnishingLimits: String,
    hardFurnishingPeriod: String,
    hardFurnishingAnnualCostRs: String,
    incentiveParticulars: String,
    incentiveAvoidDuplication: String,
    telephoneCompanyOrPersonal: String,
    telephoneReimbursementLimit: String,
    telephoneLimitAmountRs: String,
    taxAtSourceMonthlyRs: String,
    remarks: { type: mongoose.Schema.Types.Mixed },
    customFields: [{ label: String, value: String, remarks: String }]
  },

  relatedEmployee: {
    hasRelated: String,
    name: String,
    designation: String,
    location: String,
    company: String,
    relationship: String,
    contactNumber: String
  },

  references: [{
    name: String,
    company: String,
    designation: String,
    address: String,
    phone: String,
    periodKnown: String,
    email: String
  }],

  jobHistoryAnnexure: [{
    companyName: String,
    turnoverRs: Number,
    totalEmployees: Number,
    industry: String,
    designation: String,
    dutiesResponsibilities: String,
    organogramUrl: String
  }],

  tempAddress: {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },

  localAddress: {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },

  permAddress: {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },

  commAddress: {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },

  experience: [
    {
      companyName: { type: String, trim: true },
      employmentType: { type: String, enum: ['Full Time', 'Contract', 'Internship', 'Freelance'], default: 'Full Time' },
      from: { type: Date },
      to: { type: Date },
      lastDrawnSalary: { type: Number },
      reportingPersonName: { type: String, trim: true },
      reportingPersonContact: { type: String, trim: true },
      reportingPersonEmail: { type: String, trim: true },
      reasonForLeaving: { type: String, trim: true },
      experienceCertificateUrl: { type: String, trim: true }, // URL
      payslips: [String], // Array of URLs
      bankProofUrl: { type: String, trim: true }, // Chequebook or passbook photo
    }
  ],

  employeeType: {
    type: String,
    enum: ['Full-time', 'Full-Time', 'Part-time', 'Part-Time', 'Intern', 'Internship', 'Contract', 'Consultant'],
    default: 'Full-time',
    trim: true
  },
  workMode: {
    type: String,
    enum: ['Work From Office (WFO)', 'Work From Home (WFH)', 'Hybrid', 'Field / Onsite'],
    default: 'Work From Office (WFO)',
    trim: true
  },

  bankDetails: {
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true },
    branchName: { type: String, trim: true },
    location: { type: String, trim: true }, // City or Address
    bankProofUrl: { type: String, trim: true } // Cancelled check or passbook
  },

  highestQualification: { type: String, trim: true },
  marriageDate: { type: Date },

  education: {
    type: { type: String, trim: true },
    university: { type: String, trim: true },
    class10Marks: { type: String, trim: true },
    class12Marks: { type: String, trim: true },
    yearOfPassing: { type: String, trim: true },
    cgpaOrPercentage: { type: String, trim: true },
    class10Marksheet: { type: String, trim: true }, // URL
    class12Marksheet: { type: String, trim: true }, // URL (Bachelor only)
    diplomaCertificate: { type: String, trim: true }, // URL (Diploma only)
    bachelorDegree: { type: String, trim: true }, // URL (Bachelor only)
    masterDegree: { type: String, trim: true }, // URL (Optional)
    otherDegree: { type: String, trim: true }, // Optional degree for diploma
    lastSem1Marksheet: { type: String, trim: true }, // Alternative to Degree
    lastSem2Marksheet: { type: String, trim: true }, // Alternative to Degree
    lastSem3Marksheet: { type: String, trim: true } // Alternative to Degree
  },

  academicQualifications: [{
    qualification: { type: String, trim: true },
    universityBoard: { type: String, trim: true },
    yearOfPassing: { type: Number },
    percentageCgpa: { type: Number },
    mode: { type: String, enum: ['Regular', 'Distance', 'Online', 'Correspondence'] },
    documentUrl: { type: String, trim: true }
  }],

  documents: {
    aadharFront: { type: String, trim: true },
    aadharBack: { type: String, trim: true },
    aadharNumber: { type: String, trim: true },
    panCard: { type: String, trim: true },
    panNumber: { type: String, trim: true }
  },

  // ========================================
  // SALARY SNAPSHOT SYSTEM (IMMUTABLE)
  // ========================================

  salarySnapshots: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeSalarySnapshot'
  }],

  // Current active snapshot (for quick access)
  currentSalarySnapshotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeSalarySnapshot',
    default: null,
    index: true
  },

  salaryAssigned: { type: Boolean, default: false },
  salaryLocked: { type: Boolean, default: false },
  currentSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSalarySnapshot', default: null },

  // Payroll & attendance lock after exit (disable payroll run and attendance for exited employees)
  payrollLocked: { type: Boolean, default: false, index: true },
  attendanceLocked: { type: Boolean, default: false, index: true },

  // ========================================
  // PROMOTION & CAREER PROGRESSION
  // ========================================

  designation: {
    type: String,
    trim: true,
    index: true
  },

  grade: {
    type: String,
    trim: true,
    index: true
  },
  gradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade',
    default: null,
    index: true
  },
  bandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Band',
    default: null,
    index: true
  },
  band: {
    type: String,
    trim: true,
    index: true
  },
  payrollTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate', default: null, index: true },

  lastPromotionDate: { type: Date },
  lastIncrementDate: { type: Date },
  lastRevisionDate: { type: Date },

  meta: { type: Object, default: {} },
  attendanceLocked: { type: Boolean, default: false },
  payrollLocked: { type: Boolean, default: false },
  location: [{
    lat: Number,
    lng: Number
  }],
  geofance: [
    {
      lat: Number,
      lng: Number
    }
  ],
  geofence: [
    {
      lat: Number,
      lng: Number
    }
  ],
  allowedAccuracy: {
    type: Number,
    default: 300  // Increased from 150m to 300m for better indoor performance
  },
  attendanceSecurity: {
    deviceBinding: {
      fingerprint: { type: String, trim: true, default: '' },
      userAgent: { type: String, trim: true, default: '' },
      platform: { type: String, trim: true, default: '' },
      firstBoundAt: { type: Date, default: null },
      lastSeenAt: { type: Date, default: null },
      trustScore: { type: Number, default: 100 }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },



  // ========================================
  // SHIFT ASSIGNMENT
  // ========================================
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    default: null,
  },

  // Employee-specific holiday dates (attendance blocked on these dates)
  holidays: {
    type: [Date],
    default: [],
  },
}, { timestamps: true });

// --- SECURITY: Hash password before saving ---
EmployeeSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  // Skip when password is already a bcrypt hash (prevents double-hashing in bulk imports).
  if (typeof this.password === 'string' && this.password.startsWith('$2')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compound indexes for efficient org/department queries
EmployeeSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1 });
EmployeeSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, divisionId: 1 });
EmployeeSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, divisionId: 1, departmentId: 1 });
EmployeeSchema.index({ mainCompanyId: 1, subCompanyId: 1, branchId: 1, divisionId: 1, departmentId: 1, designationId: 1 });
EmployeeSchema.index({ mainCompanyId: 1, joiningDate: -1 });


// ❗ MULTI-TENANT FIX
// Do NOT export mongoose.model()
// Only export Schema
module.exports = EmployeeSchema;
