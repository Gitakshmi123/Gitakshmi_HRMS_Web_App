const SalaryEngine = require('../services/salaryEngine');
const payrollRuleResolver = require('../services/payrollRuleResolver.service');

// Helper to get models from tenant database
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    return {
        // Use db.models if already registered, otherwise fallback to schema
        // CompanyPayrollRule is a NEW model, needs schema
        CompanyPayrollRule: db.models.CompanyPayrollRule || db.model("CompanyPayrollRule", require('../models/CompanyPayrollRule'))
    };
}

/**
 * Get Company Payroll Rules
 */
exports.getRules = async (req, res) => {
    try {
        const rules = await payrollRuleResolver.getCompanyPayrollRules(
            req.tenantDB,
            req.user.tenantId,
            { createIfMissing: true }
        );

        res.json(rules);
    } catch (error) {
        console.error("Get Payroll Rules Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update Company Payroll Rules
 */
exports.updateRules = async (req, res) => {
    try {
        const { CompanyPayrollRule } = getModels(req);
        const updates = payrollRuleResolver.normalizeCompanyPayrollRulesPayload(
            req.body,
            { tenantId: req.user.tenantId }
        );
        delete updates._id;

        // Find and update or create
        const rules = await CompanyPayrollRule.findOneAndUpdate(
            { tenantId: req.user.tenantId },
            { $set: updates },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(
            payrollRuleResolver.normalizeCompanyPayrollRulesPayload(
                typeof rules?.toObject === 'function' ? rules.toObject() : rules,
                { tenantId: req.user.tenantId }
            )
        );
    } catch (error) {
        console.error("Update Payroll Rules Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Preview the resolved location policy for a location/profile scope
 */
exports.previewResolvedLocationPolicy = async (req, res) => {
    try {
        const rules = await payrollRuleResolver.getCompanyPayrollRules(
            req.tenantDB,
            req.user.tenantId,
            { createIfMissing: true }
        );

        const scope = {
            country: req.query.country || req.body?.country || 'IN',
            legalEntityId: req.query.legalEntityId || req.body?.legalEntityId || req.user?.tenantId || null,
            branchId: req.query.branchId || req.body?.branchId || null,
            payrollRegion: req.query.payrollRegion || req.body?.payrollRegion || '',
            workState: req.query.workState || req.body?.workState || '',
            workCity: req.query.workCity || req.body?.workCity || '',
            policyOverrides: req.body?.policyOverrides || {}
        };

        const resolved = payrollRuleResolver.buildResolvedLocationPolicy(rules, scope);

        res.json({
            success: true,
            data: {
                rules,
                scope,
                resolvedPolicy: resolved,
                snapshot: payrollRuleResolver.buildLocationPolicySnapshot(resolved)
            }
        });
    } catch (error) {
        console.error("Preview Payroll Location Policy Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Calculate Salary Breakup (Preview)
 * Use this for the Salary Structure UI to auto-populate
 */
exports.calculateBreakup = async (req, res) => {
    res.status(410).json({ message: "This endpoint is deprecated. Use SalaryController.preview instead." });
};
