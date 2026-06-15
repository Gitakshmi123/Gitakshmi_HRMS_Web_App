const mongoose = require('mongoose');

const EmployeeOnboardingSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  
  // Personal Details
  personalDetails: {
    firstName: String,
    lastName: String,
    gender: String,
    dob: Date,
    contactNo: String,
    fatherName: String,
  },
  
  // Addresses
  address: {
    current: String,
    permanent: String,
  },
  
  // Bank Details
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifsc: String,
    branchName: String,
  },
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relation: String,
    contactNo: String,
  },
  
  // Education & Experience
  education: [{
    degree: String,
    institution: String,
    year: String,
  }],
  experience: [{
    company: String,
    role: String,
    duration: String,
  }],
  
  // Status
  status: { 
    type: String, 
    enum: ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'], 
    default: 'PENDING' 
  },
  
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: String,

}, { timestamps: true });

module.exports = EmployeeOnboardingSchema;
