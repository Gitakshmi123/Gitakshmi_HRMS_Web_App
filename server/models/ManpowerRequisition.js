const mongoose = require('mongoose');

const ManpowerRequisitionSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // The person raising the request (e.g. Department HOD)
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  
  // Basic Details
  requirementDate: { type: Date, default: Date.now },
  approvedHeadCount: { type: Number, required: true },
  totalRequiredNumber: { type: Number, required: true },
  minimumQualification: { type: String, required: true },
  jobLocation: { type: String, required: true },
  designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', required: true }, // Designation / Job Role
  availableCount: { type: Number, required: true },
  positionToBeFilledByDate: { type: Date, required: true },
  minimumExperience: { type: Number, required: true }, // Minimum Experience (Y)
  
  // Requirement Type
  requirementType: { type: String, enum: ['New', 'Replacement'], required: true },
  
  // If New Requirement
  newRequirementReason: { type: String }, // Please provide reason of additional requirement
  
  // If Replacement
  replacementAgainstName: { type: String },
  replacementAgainstDesignation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
  
  // Job Description
  jobDescription: { type: String, required: true },
  
  // Skills
  skillsRequired: { type: String, required: true }, // IT & Other skills required
  
  // Remarks
  remarks: { type: String },
  
  // Workflow / Approval Status
  status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  workflowInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance' },
  
  // Reference to created Requirement/Draft once approved
  linkedRequirementDraftId: { type: mongoose.Schema.Types.ObjectId, ref: 'RequirementDraft' }
}, { timestamps: true });

module.exports = mongoose.model('ManpowerRequisition', ManpowerRequisitionSchema);
