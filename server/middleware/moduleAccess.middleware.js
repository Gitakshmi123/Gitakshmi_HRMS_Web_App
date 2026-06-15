const Tenant = require('../models/Tenant');
const mongoose = require('mongoose');
const AUTHZ_BYPASS = String(process.env.AUTHZ_BYPASS || '').toLowerCase() === 'true';
const DEBUG_MODULE_ACCESS = String(process.env.DEBUG_MODULE_ACCESS || '').toLowerCase() === 'true';
const MODULE_ARRAY_TO_KEY = {
    hr: 'hr',
    'hr management': 'hr',
    payroll: 'payroll',
    attendance: 'attendance',
    leave: 'leave',
    hiring: 'recruitment',
    recruitment: 'recruitment',
    bgv: 'backgroundVerification',
    'background verification': 'backgroundVerification',
    documents: 'documentManagement',
    'document management': 'documentManagement',
    'social media': 'socialMediaIntegration',
    'social media integration': 'socialMediaIntegration',
    'employee portal': 'employeePortal',
    ess: 'employeePortal',
    reports: 'reports',
    onboarding: 'onboarding',
    policy: 'policy'
};

function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    const compact = r.replace(/[\s-]+/g, '_');
    const aliases = {
        superadmin: 'super_admin',
        super_admin: 'super_admin',
        companysuperadmin: 'company_super_admin',
        company_superadmin: 'company_super_admin',
        company_super_admin: 'company_super_admin',
        companyadmin: 'company_admin',
        company_admin: 'company_admin',
        hrmanager: 'hr_manager',
        hr_manager: 'hr_manager',
        hradmin: 'hr_admin',
        hr_admin: 'hr_admin'
    };
    return aliases[compact] || compact;
}

function normalizeModuleKey(key) {
    const raw = String(key || '').trim();
    if (!raw) return null;
    const compact = raw.replace(/[\s-]+/g, '').toLowerCase();
    const directAliases = {
        hr: 'hr',
        payroll: 'payroll',
        attendance: 'attendance',
        leave: 'leave',
        recruitment: 'recruitment',
        backgroundverification: 'backgroundVerification',
        documentmanagement: 'documentManagement',
        socialmediaintegration: 'socialMediaIntegration',
        socialmedia: 'socialMediaIntegration',
        employeeportal: 'employeePortal',
        reports: 'reports',
        onboarding: 'onboarding',
        policy: 'policy'
    };

    return directAliases[compact] || MODULE_ARRAY_TO_KEY[raw.toLowerCase()] || null;
}

function modulesArrayToFlags(modules = []) {
    const flags = {};
    for (const item of Array.isArray(modules) ? modules : []) {
        const normalizedKey = normalizeModuleKey(item);
        if (normalizedKey) flags[normalizedKey] = true;
    }
    return flags;
}

function normalizeEnabledModulesObject(input = {}) {
    const flags = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return flags;

    Object.entries(input).forEach(([key, value]) => {
        const normalizedKey = normalizeModuleKey(key);
        if (normalizedKey) flags[normalizedKey] = value === true;
    });

    return flags;
}

async function resolveEffectiveRole(req) {
    let role = normalizeRole(req.user?.role);
    if (role && role !== 'employee' && role !== 'manager') return role;

    try {
        let User;
        try {
            User = mongoose.model('User');
        } catch (_) {
            User = require('../models/User');
        }
        const email = String(req.user?.email || '').trim();
        if (!email) return role;
        const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const tenantId = String(req.user?.tenantId || req.user?.companyId || req.tenantId || '').trim();
        const query = { email: emailRegex };
        if (tenantId) {
            query.$or = [
                { tenant: tenantId },
                { companyId: tenantId }
            ];
        }
        const userDoc = await User.findOne(query).select('role').lean();
        return normalizeRole(userDoc?.role) || role;
    } catch (_) {
        return role;
    }
}

/**
 * Middleware to check if a module is enabled for the current company/tenant.
 * Super Admin (role: 'psa') bypasses this check.
 * 
 * @param {string} moduleName - The name of the module to check (e.g., 'hr', 'payroll')
 */
const checkModuleAccess = (moduleName) => {
    return async (req, res, next) => {
        if (AUTHZ_BYPASS) {
            if (DEBUG_MODULE_ACCESS) {
                console.log(`[DEBUG_MODULE_ACCESS] Bypassing check for '${moduleName}' (AUTHZ_BYPASS is true)`);
            }
            return next();
        }

        if (DEBUG_MODULE_ACCESS) {
            console.log(`[DEBUG_MODULE_ACCESS] Checking access to '${moduleName}' for path '${req.path}'`);
        }
        try {
            // 1. Skip for OAuth routes (safety check)
            const oauthPaths = ['/connect', '/callback'];

            if (oauthPaths.some(path => req.path.includes(path))) {
                return next();
            }

            // 2. Product-owner bypass only. Company HR/admin roles must still respect
            // the selected company's active/inactive module configuration.
            const role = await resolveEffectiveRole(req);
            const BYPASS_ROLES = new Set([
                'psa',
                'super_admin'
            ]);
            if (BYPASS_ROLES.has(role)) {
                return next();
            }

            // 2. Identify tenant ID
            // Prioritize req.tenantId (resolved by tenantMiddleware) or user context.
            const tenantId = req.tenantId || req.user?.tenantId || req.user?.mainCompanyId || req.user?.companyId;

            if (!tenantId) {
                // If we are authenticated but missing a tenantId, try one last check for the user's tenant link
                if (req.user?.id || req.user?._id) {
                    try {
                        let User;
                        try { User = mongoose.model('User'); } catch (e) { User = require('../models/User'); }
                        const uid = String(req.user?.id || req.user?._id || '').trim();
                        if (uid && mongoose.Types.ObjectId.isValid(uid)) {
                            const userDoc = await User.findById(uid).select('tenant companyId').lean();
                            const resolvedId = userDoc?.tenant || userDoc?.companyId;
                            if (resolvedId && mongoose.Types.ObjectId.isValid(String(resolvedId))) {
                                req.tenantId = String(resolvedId);
                                if (req.user) req.user.tenantId = req.tenantId;
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
            }

            const finalTenantId = req.tenantId || req.user?.tenantId || req.user?.mainCompanyId || req.user?.companyId;

            if (!finalTenantId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access Denied: No tenant context found.'
                });
            }

            // 3. Fetch tenant/company configuration
            let tenant = await Tenant.findById(finalTenantId).select('enabledModules modules status code');

            if (!tenant) {
                console.warn(`[moduleAccess] Company not found for tenantId: ${finalTenantId}, user: ${req.user?.email}`);
                return res.status(404).json({
                    success: false,
                    message: `Company not found. (ID: ${finalTenantId || 'none'})`
                });
            }

            if (tenant.status !== 'active') {
                return res.status(403).json({
                    success: false,
                    message: `Access Denied: Company account is ${tenant.status}.`
                });
            }

            // 4. Check if module is enabled.
            // Older tenants may only have the `modules` array populated, while some SSO/company
            // records keep module flags in alternate fields. Normalize and merge all known sources.
            let resolvedEnabledModules = {
                ...modulesArrayToFlags(tenant.modules),
                ...normalizeEnabledModulesObject(tenant.enabledModules)
            };

            if (resolvedEnabledModules[moduleName] !== true) {
                const companyId = String(
                    req.user?.companyId || req.user?.company || req.user?.externalCompanyId || req.tenantId || tenantId || ''
                ).trim();
                const companyCode = String(req.user?.companyCode || tenant.code || '').trim();

                let companyDoc = null;
                const companiesCollection = mongoose.connection?.db?.collection('companies');

                if (companiesCollection) {
                    const projection = {
                        enabledModules: 1,
                        hrmsEnabledModules: 1,
                        modules: 1,
                        hrmsModules: 1,
                        code: 1
                    };

                    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
                        companyDoc = await companiesCollection.findOne(
                            { _id: new mongoose.Types.ObjectId(companyId) },
                            { projection }
                        );
                    }

                    if (!companyDoc && companyCode) {
                        companyDoc = await companiesCollection.findOne(
                            { code: new RegExp(`^${companyCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                            { projection }
                        );
                    }
                }

                if (companyDoc) {
                    resolvedEnabledModules = {
                        ...resolvedEnabledModules,
                        ...modulesArrayToFlags(companyDoc.modules),
                        ...modulesArrayToFlags(companyDoc.hrmsModules),
                        ...normalizeEnabledModulesObject(companyDoc.enabledModules),
                        ...normalizeEnabledModulesObject(companyDoc.hrmsEnabledModules)
                    };
                }
            }

            const isEnabled = resolvedEnabledModules[moduleName] === true;

            if (!isEnabled) {
                return res.status(403).json({
                    success: false,
                    module: moduleName,
                    message: `Access Denied: The '${moduleName}' module is not enabled for your company. Please contact your Super Admin.`
                });
            }

            // 5. Success
            req._tenantEnabledModules = resolvedEnabledModules;
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Internal server error during module access validation.'
            });
        }
    };
};

module.exports = checkModuleAccess;
