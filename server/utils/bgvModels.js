



const BGVCaseSchema = require('../models/BGVCase');
const BGVCheckSchema = require('../models/BGVCheck');
const BGVDocumentSchema = require('../models/BGVDocument');
const BGVTimelineSchema = require('../models/BGVTimeline');
const BGVReportSchema = require('../models/BGVReport');
const BGVEvidenceConfigSchema = require('../models/BGVEvidenceConfig');
const BGVEmailTemplateSchema = require('../models/BGVEmailTemplate');
const BGVEmailLogSchema = require('../models/BGVEmailLog');
const BGVConsentSchema = require('../models/BGVConsent');
const BGVRiskScoreSchema = require('../models/BGVRiskScore');
const BGVTaskAssignmentSchema = require('../models/BGVTaskAssignment');
const ApplicantSchema = require('../models/Applicant');
const getTenantDB = require('./tenantDB');



/**
 * HELPER: Load BGV models for a specific tenant.
 * Accepts either a 'req' object (with tenantDB/tenantId) or a raw 'tenantId' string.
 */
async function getBGVModels(context) {
    let db;
    let tenantId;

    if (typeof context === 'string') {
        tenantId = context;
        db = await getTenantDB(tenantId);
    } else if (context && (context.tenantDB || context.headers)) {
        // Handle Express Request context
        if (context.tenantDB) {
            db = context.tenantDB;
            tenantId = context.tenantId;
        } else {
            // Context is a request but tenantDB is missing (e.g. PSA user)
            // Try to resolve from headers or query
            tenantId = context.headers['x-tenant-id'] || context.query?.tenantId;
            if (tenantId) {
                db = await getTenantDB(tenantId);
                // PERSIST: Set back on request object so subsequent code can use it
                context.tenantId = tenantId;
                context.tenantDB = db;
            } else {
                throw new Error("Invalid context for getBGVModels: Tenant context missing for non-scoped request (PSA). Please provide X-Tenant-ID header.");
            }
        }
    } else {
        throw new Error("Invalid context for getBGVModels: Expected req object or tenantId string");
    }

    return {
        BGVCase: db.models.BGVCase || db.model("BGVCase", BGVCaseSchema),
        BGVCheck: db.models.BGVCheck || db.model("BGVCheck", BGVCheckSchema),
        BGVDocument: db.models.BGVDocument || db.model("BGVDocument", BGVDocumentSchema),
        BGVTimeline: db.models.BGVTimeline || db.model("BGVTimeline", BGVTimelineSchema),
        BGVReport: db.models.BGVReport || db.model("BGVReport", BGVReportSchema),
        BGVEvidenceConfig: db.models.BGVEvidenceConfig || db.model("BGVEvidenceConfig", BGVEvidenceConfigSchema),
        BGVEmailTemplate: db.models.BGVEmailTemplate || db.model("BGVEmailTemplate", BGVEmailTemplateSchema),
        BGVEmailLog: db.models.BGVEmailLog || db.model("BGVEmailLog", BGVEmailLogSchema),
        BGVConsent: db.models.BGVConsent || db.model("BGVConsent", BGVConsentSchema),
        BGVRiskScore: db.models.BGVRiskScore || db.model("BGVRiskScore", BGVRiskScoreSchema),
        BGVTaskAssignment: db.models.BGVTaskAssignment || db.model("BGVTaskAssignment", BGVTaskAssignmentSchema),
        Applicant: db.models.Applicant || db.model("Applicant", ApplicantSchema),
        Employee: db.models.Employee || db.model("Employee", require('../models/Employee'))
    };


}

module.exports = { getBGVModels };
