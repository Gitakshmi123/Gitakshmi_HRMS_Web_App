// server/config/dbManager.js
const mongoose = require("mongoose");
const leaveManagementService = require("../services/leaveManagement.service");
const gradeLeavePolicyService = require("../services/gradeLeavePolicy.service");

const tenantDbs = {};
const MAX_CACHED_CONNECTIONS = 50;
const MAX_MONGO_DB_NAME_BYTES = 38;
const connectionAccessTime = {};
const registeredModels = new Set();

function isValidMongoDbName(dbName) {
  if (!dbName || typeof dbName !== "string") return false;
  if (Buffer.byteLength(dbName, "utf8") > MAX_MONGO_DB_NAME_BYTES) return false;
  return !/[\/\\. "$*<>:|?]/.test(dbName);
}

function compactTenantDbName(tenantId) {
  const id = String(tenantId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return `company_${id || "tenant"}`.slice(0, MAX_MONGO_DB_NAME_BYTES);
}

/**
 * Registers all tenant-specific models on a given database connection.
 */
function registerModels(db, tenantId, forceRefresh = false) {
  // SHARED MODELS LIST - These collections are stored globally to stay under Atlas 500 limit
  const SHARED_MODELS = [
    "AuditLog", "Activity", "Notification", "Comment", "FaceData", "FaceUpdateRequest",
    "LiveTracking", "LiveTrackingSession",
    "SocialAccount", "SocialAccountEnterprise", "SocialCampaign", "SocialPost", "SocialPostEnterprise", "SocialPostLog", "SocialAnalytics",
    "BGVDocument", "BGVCase", "BGVCheck", "BGVEmailLog", "BGVEmailTemplate", "BGVReport",
    "BGVTimeline", "BGVEvidenceConfig", "BGVConsent", "BGVRiskScore", "BGVTaskAssignment",
    "DocumentAudit", "DocumentAccess", "LetterRevocation", "DocumentViewConfig", "SignedLetter",
    "OnboardingTemplate", "OnboardingDocument", "OnboardingSubmission", "TicketTemplate", "RequirementTemplate",
    "PayslipTemplate"
  ];

  // MONKEYPATCH: Transparently redirect shared models to global connection (CRITICAL for 500 limit)
  if (!db._sharedPatchApplied) {
    const originalModel = db.model.bind(db);
    db.model = function (name, schema, collection) {
      if (SHARED_MODELS.includes(name)) {
        if (!mongoose.connection.models[name]) {
          try {
            const schemaToUse = schema || require(`../models/${name}`);
            mongoose.connection.model(name, schemaToUse);
          } catch (e) {
            // If it's already registered by another request, that's fine.
            if (e.name !== 'OverwriteModelError') {
              console.error(`[CRITICAL] Failed to load shared model ${name}:`, e.message);
            }
          }
        }
        return mongoose.connection.models[name] || originalModel(name, schema, collection);
      }
      return originalModel(name, schema, collection);
    };
    db._sharedPatchApplied = true;
  }

  // If models are registered and we don't need force refresh, skip remaining registration.
  if (registeredModels.has(tenantId) && !forceRefresh) {
    return;
  }

  try {
    // console.log(`[registerModels] Starting registration for tenant: ${tenantId}`);
    // FORCE FRESH SCHEMA LOAD (v7.2 HARD REFRESH)
    try {
      delete require.cache[require.resolve("../models/EmployeeSalarySnapshot")];
      delete require.cache[require.resolve("../models/SalaryComponent")];
      delete require.cache[require.resolve("../models/SalaryTemplate")];
    } catch (e) { /* skip if not in cache */ }

    const EmployeeSchema = require("../models/Employee");
    const SubCompanySchema = require("../models/SubCompany");
    const DivisionSchema = require("../models/Division");
    const DesignationSchema = require("../models/Designation");
    const DepartmentSchema = require("../models/Department");
    const LeaveRequestSchema = require("../models/LeaveRequest");
    const AttendanceSchema = require("../models/Attendance");
    const ActivitySchema = require("../models/Activity");
    const UserSchema = require("../models/User");
    const RequirementSchema = require("../models/Requirement");
    const ApplicantSchema = require("../models/Applicant");
    const OfferLetterTemplateSchema = require("../models/OfferLetterTemplate");
    const LetterTemplateSchema = require("../models/LetterTemplate");
    const GeneratedLetterSchema = require("../models/GeneratedLetter");
    const LeavePolicySchema = require("../models/LeavePolicy");
    const LeavePolicyCustomMappingSchema = require("../models/LeavePolicyCustomMapping");
    const LeaveBalanceSchema = require("../models/LeaveBalance");
    const LeaveAccrualLogSchema = require("../models/LeaveAccrualLog");
    const LeaveLedgerSchema = require("../models/LeaveLedger");
    const BandSchema = require("../models/Band");
    const DesignationGradeMapSchema = require("../models/DesignationGradeMap");
    const PromotionHistorySchema = require("../models/PromotionHistory");
    const NotificationSchema = require("../models/Notification");
    const RegularizationSchema = require("../models/Regularization");
    const AuditLogSchema = require("../models/AuditLog");
    const CommentSchema = require("../models/Comment");
    const AccessControlSchema = require("../models/AccessControl");
    const HolidaySchema = require("../models/Holiday");
    const AttendanceSettingsSchema = require("../models/AttendanceSettings");
    const SalaryComponentSchema = require("../models/SalaryComponent");
    const SalaryTemplateSchema = require("../models/SalaryTemplate");
    const BenefitComponentSchema = require("../models/BenefitComponent");
    const BenefitSchema = require("../models/Benefit.model.js");
    const CompanyProfileSchema = require("../models/CompanyProfile");
    const DeductionMasterSchema = require("../models/DeductionMaster");
    const EmployeeDeductionSchema = require("../models/EmployeeDeduction");
    const PayrollRunSchema = require("../models/PayrollRun");
    const PayslipSchema = require("../models/Payslip");
    const CompanyPayrollRuleSchema = require("../models/CompanyPayrollRule");
    const CandidateSchema = require("../models/Candidate");
    const TrackerCandidateSchema = require("../models/TrackerCandidate");
    const CandidateStatusLogSchema = require("../models/CandidateStatusLog");
    const SalaryAssignmentSchema = require("../models/SalaryAssignment");
    const PayrollRunItemSchema = require("../models/PayrollRunItem");
    const EmployeeSalarySnapshotSchema = require("../models/EmployeeSalarySnapshot");
    const AttendanceSnapshotSchema = require("../models/AttendanceSnapshot");
    const PayrollRunSnapshotSchema = require("../models/PayrollRunSnapshot");
    const SalaryRevisionSchema = require("../models/SalaryRevision");
    const RequirementTemplateSchema = require("../models/RequirementTemplate");
    const CounterSchema = require("../models/Counter");
    const EmployeeCompensationSchema = require("../models/EmployeeCompensation");
    const EmployeeCtcVersionSchema = require("../models/EmployeeCtcVersion");
    const EmployeePayrollProfileSchema = require("../models/EmployeePayrollProfile");
    const PayrollStatutoryRuleSetSchema = require("../models/PayrollStatutoryRuleSet");
    const EmployeeTaxProfileSchema = require("../models/EmployeeTaxProfile");
    const PayrollInputSnapshotSchema = require("../models/PayrollInputSnapshot");
    const PayrollCalculationTraceSchema = require("../models/PayrollCalculationTrace");
    const PayrollInputBatchSchema = require("../models/PayrollInputBatch");
    const PayrollExportArtifactSchema = require("../models/PayrollExportArtifact");
    const ReferralCodeSchema = require("../models/ReferralCode");
    const PayslipTemplateSchema = require("../models/PayslipTemplate");
    const PositionSchema = require("../models/Position");
    const BGVCaseSchema = require("../models/BGVCase");
    const BGVCheckSchema = require("../models/BGVCheck");
    const BGVEmailLogSchema = require("../models/BGVEmailLog");
    const BGVEmailTemplateSchema = require("../models/BGVEmailTemplate");
    const BGVReportSchema = require("../models/BGVReport");
    const BGVTimelineSchema = require("../models/BGVTimeline");
    const BGVDocumentSchema = require("../models/BGVDocument");
    const BGVConsentSchema = require("../models/BGVConsent");
    const BGVRiskScoreSchema = require("../models/BGVRiskScore");
    const BGVTaskAssignmentSchema = require("../models/BGVTaskAssignment");
    const ZohoLeavePolicySchema = require("../models/ZohoLeavePolicy");
    const LeaveApprovalWorkflowSchema = require("../models/LeaveApprovalWorkflow");
    const WorkflowSchema = require("../models/Workflow");
    const WorkflowVersionSchema = require("../models/WorkflowVersion");
    const WorkflowInstanceSchema = require("../models/WorkflowInstance");
    const WorkflowAssignmentSchema = require("../models/WorkflowAssignment");
    const WorkflowHistorySchema = require("../models/WorkflowHistory");
    const WorkflowDelegationSchema = require("../models/WorkflowDelegation");




    const DocumentAuditSchema = require("../models/DocumentAudit");
    const DocumentAccessSchema = require("../models/DocumentAccess");
    const LetterRevocationSchema = require("../models/LetterRevocation");
    const DocumentViewConfigSchema = require("../models/DocumentViewConfig");
    const SignedLetterSchema = require("../models/SignedLetter");
    const RequirementDraftSchema = require("../models/RequirementDraft");
    const SalaryStructureSchema = require("../models/SalaryStructure");
    const ShiftSchema = require("../models/Shift");
    const ShiftAssignmentSchema = require("../models/ShiftAssignment");
    const GradeSchema = require("../models/Grade");
    const PolicySchema = require("../models/Policy");
    const ReplacementRequestSchema = require("../models/ReplacementRequest");
    const ExitRequestSchema = require("../models/ExitRequest");
    const OnboardingTemplateSchema = require("../models/OnboardingTemplate");
    const OnboardingInstanceSchema = require("../models/OnboardingInstance");
    const OnboardingTaskSchema = require("../models/OnboardingTask");
    const OnboardingDocumentSchema = require("../models/OnboardingDocument");

    // Enterprise Social Media (avoids conflict with legacy models)
    const SocialAccountSchema = require("../models/social/SocialAccount");
    const SocialCampaignSchema = require("../models/social/SocialCampaign");
    const SocialPostSchema = require("../models/social/SocialPost");
    const SocialPostLogSchema = require("../models/social/SocialPostLog");
    const SocialAnalyticsSchema = require("../models/social/SocialAnalytics");
    const FaceDataSchema = require("../models/FaceData");
    const FaceUpdateRequestSchema = require("../models/FaceUpdateRequest");
    const TicketSchema = require("../models/Ticket");
    const TicketTemplateSchema = require("../models/TicketTemplate");
    const BranchSchema = require("../models/Branch");
    const LiveTrackingSchema = require("../models/LiveTracking");
    const LiveTrackingSessionSchema = require("../models/LiveTrackingSession");

    // Helper to register or FORCE refresh
    const register = (name, schema, isCritical = false) => {
      if (SHARED_MODELS.includes(name)) return; // Skip shared models in tenant-specific DB

      if (!schema) {
        console.error(`❌ [DB_MANAGER] FATAL: Schema for model '${name}' is ${schema}.`);
        return;
      }
      if (db.models[name] && (forceRefresh || isCritical)) {
        delete db.models[name];
      }
      if (!db.models[name]) {
        db.model(name, schema.schema || schema);
      }
    };

    register("EmployeeSalarySnapshot", EmployeeSalarySnapshotSchema, true);
    register("SalaryComponent", SalaryComponentSchema, true);
    register("SalaryTemplate", SalaryTemplateSchema, true);
    register("SalaryStructure", SalaryStructureSchema, true);
    register("Employee", EmployeeSchema);
    register("SubCompany", SubCompanySchema);
    register("Division", DivisionSchema);
    register("Designation", DesignationSchema);
    register("Department", DepartmentSchema);
    register("LeaveRequest", LeaveRequestSchema);
    register("Attendance", AttendanceSchema);
    register("Activity", ActivitySchema);
    register("User", UserSchema);
    register("Requirement", RequirementSchema);
    register("Applicant", ApplicantSchema);
    register("OfferLetterTemplate", OfferLetterTemplateSchema);
    register("LetterTemplate", LetterTemplateSchema);
    register("GeneratedLetter", GeneratedLetterSchema);
    register("LeavePolicy", LeavePolicySchema);
    register("LeavePolicyCustomMapping", LeavePolicyCustomMappingSchema);
    register("Band", BandSchema);
    register("DesignationGradeMap", DesignationGradeMapSchema);
    register("PromotionHistory", PromotionHistorySchema);
    register("Branch", BranchSchema);
    register("LeaveBalance", LeaveBalanceSchema);
    register("LeaveAccrualLog", LeaveAccrualLogSchema);
    register("LeaveLedger", LeaveLedgerSchema);
    register("Notification", NotificationSchema);
    register("Regularization", RegularizationSchema);
    register("AuditLog", AuditLogSchema);
    register("Comment", CommentSchema);
    register("AccessControl", AccessControlSchema);
    register("Holiday", HolidaySchema);
    register("AttendanceSettings", AttendanceSettingsSchema);
    register("BenefitComponent", BenefitComponentSchema);
    register("Benefit", BenefitSchema);
    register("CompanyProfile", CompanyProfileSchema);
    register("DeductionMaster", DeductionMasterSchema);
    register("EmployeeDeduction", EmployeeDeductionSchema);
    register("PayrollRun", PayrollRunSchema);
    register("Payslip", PayslipSchema);
    register("CompanyPayrollRule", CompanyPayrollRuleSchema);
    register("Candidate", CandidateSchema);
    register("TrackerCandidate", TrackerCandidateSchema);
    register("CandidateStatusLog", CandidateStatusLogSchema);
    register("SalaryAssignment", SalaryAssignmentSchema);
    register("PayrollRunItem", PayrollRunItemSchema);
    register("AttendanceSnapshot", AttendanceSnapshotSchema);
    register("PayrollRunSnapshot", PayrollRunSnapshotSchema);
    register("SalaryRevision", SalaryRevisionSchema);
    register("RequirementTemplate", RequirementTemplateSchema);
    register("Counter", CounterSchema);
    register("PayslipTemplate", PayslipTemplateSchema);
    register("Position", PositionSchema);
    register("Shift", ShiftSchema);
    register("ShiftAssignment", ShiftAssignmentSchema);
    register("Grade", GradeSchema);
    register("Policy", PolicySchema);
    register("ReplacementRequest", ReplacementRequestSchema);
    register("BGVDocument", BGVDocumentSchema);
    register("BGVCase", BGVCaseSchema);
    register("BGVCheck", BGVCheckSchema);
    register("BGVEmailLog", BGVEmailLogSchema);
    register("BGVEmailTemplate", BGVEmailTemplateSchema);
    register("BGVReport", BGVReportSchema);
    register("BGVTimeline", BGVTimelineSchema);
    register("BGVEvidenceConfig", require("../models/BGVEvidenceConfig"));
    register("BGVConsent", BGVConsentSchema);
    register("BGVRiskScore", BGVRiskScoreSchema);
    register("BGVTaskAssignment", BGVTaskAssignmentSchema);
    register("ZohoLeavePolicy", ZohoLeavePolicySchema);
    register("LeaveApprovalWorkflow", LeaveApprovalWorkflowSchema);
    register("Workflow", WorkflowSchema);
    register("WorkflowVersion", WorkflowVersionSchema);
    register("WorkflowInstance", WorkflowInstanceSchema);
    register("WorkflowAssignment", WorkflowAssignmentSchema);
    register("WorkflowHistory", WorkflowHistorySchema);
    register("WorkflowDelegation", WorkflowDelegationSchema);




    register("DocumentAudit", DocumentAuditSchema);
    register("DocumentAccess", DocumentAccessSchema);
    register("LetterRevocation", LetterRevocationSchema);
    register("DocumentViewConfig", DocumentViewConfigSchema);
    register("SignedLetter", SignedLetterSchema);
    register("RequirementDraft", RequirementDraftSchema);
    register("ExitRequest", ExitRequestSchema);
    register("OnboardingTemplate", OnboardingTemplateSchema);
    register("OnboardingInstance", OnboardingInstanceSchema);
    register("OnboardingTask", OnboardingTaskSchema);
    register("OnboardingDocument", OnboardingDocumentSchema);
    register("SocialAccountEnterprise", SocialAccountSchema);
    register("SocialCampaign", SocialCampaignSchema);
    register("SocialPostEnterprise", SocialPostSchema);
    register("SocialPostLog", SocialPostLogSchema);
    register("SocialAnalytics", SocialAnalyticsSchema);
    register("FaceData", FaceDataSchema);
    register("FaceUpdateRequest", FaceUpdateRequestSchema);
    register("LiveTracking", LiveTrackingSchema);
    register("LiveTrackingSession", LiveTrackingSessionSchema);
    register("Ticket", TicketSchema);
    register("TicketTemplate", TicketTemplateSchema);

    if (!db.models.PayrollAdjustment) {
      try {
        db.model("PayrollAdjustment", require("../models/PayrollAdjustment"));
      } catch (e) { }
    }
    if (!db.models.EmployeeCompensation) {
      db.model("EmployeeCompensation", EmployeeCompensationSchema);
    }
    register("EmployeeCtcVersion", EmployeeCtcVersionSchema);
    register("EmployeePayrollProfile", EmployeePayrollProfileSchema);
    register("PayrollStatutoryRuleSet", PayrollStatutoryRuleSetSchema);
    register("EmployeeTaxProfile", EmployeeTaxProfileSchema);
    register("PayrollInputSnapshot", PayrollInputSnapshotSchema);
    register("PayrollCalculationTrace", PayrollCalculationTraceSchema);
    register("PayrollInputBatch", PayrollInputBatchSchema);
    register("PayrollExportArtifact", PayrollExportArtifactSchema);
    register("ReferralCode", ReferralCodeSchema);

    registeredModels.add(tenantId);
    // console.log(`✅ [DB_MANAGER] Models registered/refreshed for tenant: ${tenantId}`);
  } catch (err) {
    console.error(`❌ [DB_MANAGER] registration failed for tenant ${tenantId}:`, err.message);
  }
}

function getTenantDB(tenantId, dbNameOverride = null) {
  if (!tenantId) throw new Error("tenantId required for getTenantDB");
  connectionAccessTime[tenantId] = Date.now();
  if (tenantDbs[tenantId]) return tenantDbs[tenantId];

  const cachedCount = Object.keys(tenantDbs).length;
  if (cachedCount >= MAX_CACHED_CONNECTIONS) {
    let lruTenantId = null;
    let oldestTime = Date.now();
    for (const tid in connectionAccessTime) {
      if (connectionAccessTime[tid] < oldestTime && tid !== tenantId) {
        oldestTime = connectionAccessTime[tid];
        lruTenantId = tid;
      }
    }
    if (lruTenantId) {
      delete tenantDbs[lruTenantId];
      delete connectionAccessTime[lruTenantId];
      registeredModels.delete(lruTenantId);
    }
  }

  const requestedDbName = dbNameOverride || `company_${tenantId}`;
  const dbName = isValidMongoDbName(requestedDbName)
    ? requestedDbName
    : compactTenantDbName(tenantId);
  if (requestedDbName !== dbName) {
    console.warn(`[DB_MANAGER] Ignoring invalid tenant database name "${requestedDbName}". Using "${dbName}".`);
  }
  const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
  registerModels(tenantDb, tenantId, false);
  tenantDbs[tenantId] = tenantDb;
  return tenantDb;
}

function clearCache() {
  Object.keys(tenantDbs).forEach(tenantId => {
    delete tenantDbs[tenantId];
    delete connectionAccessTime[tenantId];
    registeredModels.delete(tenantId);
  });
}

/**
 * Enforces mandatory leave policy for an employee.
 */
async function ensureLeavePolicy(employee, db, tenantIdOverride = null) {
  if (!employee) return null;

  const LeavePolicy = db.model("LeavePolicy");
  const Employee = db.model("Employee");

  let resolvedPolicy = null;
  let activePolicies = [];
  let tenantId = null;

  try {
    let tenantStr = tenantIdOverride || employee.tenant;
    if (!tenantStr && db && db.name) {
      tenantStr = db.name.replace(/^company_/, '');
    }
    if (!tenantStr) throw new Error('Tenant ID not available');
    tenantId = new mongoose.Types.ObjectId(tenantStr);
    activePolicies = await leaveManagementService.getActiveLeavePolicies({ LeavePolicy, tenantId });
  } catch (e) {
    console.error(`[POLICY_ENFORCEMENT] Active policy lookup failed:`, e.message);
  }

  // Step 1: Check existing policy validity
  const Grade = db.model("Grade");
  const resolvedGrade = await gradeLeavePolicyService.resolveEmployeeGrade({
    employee,
    Grade,
    tenantId,
    date: new Date()
  });

  // Step 2: Resolve the best active policy for the employee based on scope.
  // The explicitly assigned policy takes precedence over automatic matching.
  try {
    if (employee.leavePolicy) {
      try {
        resolvedPolicy = await leaveManagementService.getAssignedLeavePolicyForEmployee({ LeavePolicy, tenantId, employee });
      } catch (e) {
        console.error(`[POLICY_ENFORCEMENT] Verification error:`, e.message);
      }
    }

    if (!resolvedPolicy && activePolicies.length > 0) {
      resolvedPolicy = leaveManagementService.selectBestPolicyForEmployee({
        policies: activePolicies.filter((policy) => Array.isArray(policy.rules) && policy.rules.length > 0),
        employee,
        grade: resolvedGrade
      });
    }

    if (resolvedPolicy) {
      const currentPolicyId = employee.leavePolicy?._id || employee.leavePolicy;
      if (!currentPolicyId || currentPolicyId.toString() !== resolvedPolicy._id.toString()) {
        employee.leavePolicy = resolvedPolicy._id;
        await employee.save();
      }
    } else if (employee.leavePolicy) {
      employee.leavePolicy = null;
      await employee.save();
    }

    // Step 4: Consistency Sync → Ensure balances exist for this policy (pro-rata)
    if (resolvedPolicy) {
      try {
        await leaveManagementService.ensureEmployeeLeaveBalanceForYear({
          employee,
          tenantId: resolvedPolicy.tenant,
          tenantDB: db,
          year: new Date().getFullYear(),
          policy: resolvedPolicy
        });
        // console.log(`[POLICY_ENFORCEMENT] Leave balance sync complete for ${employee.employeeId}`);
      } catch (balErr) {
        console.error('[POLICY_ENFORCEMENT] Balance sync failed:', balErr.message);
      }
    }

    // Return populated employee record
    return await Employee.findById(employee._id)
      .populate('leavePolicy', 'name rules description status')
      .populate('departmentId', 'name')
      .populate('gradeId', 'name code level benefits attendanceRules leaveRules isActive')
      .populate('manager', 'firstName lastName email profilePic employeeId');

  } catch (err) {
    console.error(`[POLICY_ENFORCEMENT] Error:`, err.message);
    return employee;
  }
}

module.exports = { getTenantDB, clearCache, ensureLeavePolicy };
