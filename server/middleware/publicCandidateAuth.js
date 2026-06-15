const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');
const { verifyJwtWithCandidates, getRequestAccessToken } = require('./auth.jwt');

/**
 * RESOLVE TENANT
 */
async function resolvePublicTenant() {
    let tenant = await Tenant.findOne({ status: 'active' }).sort({ updatedAt: -1 }).lean();
    if (!tenant) {
        tenant = await Tenant.findOne({}).sort({ updatedAt: -1 }).lean();
    }
    return tenant;
}

/**
 * AUTHENTICATE PUBLIC CANDIDATE
 */
exports.authenticatePublicCandidate = async (req, res, next) => {
    try {
        // Use the same token extraction as the main HRMS auth
        const token = getRequestAccessToken(req);

        if (!token) {
            return res.status(401).json({ success: false, message: 'Authorization token required' });
        }

        // Use the global multi-secret verification logic for consistency
        let decoded;
        try {
            // Trim token to handle any accidentally copied spaces
            decoded = verifyJwtWithCandidates(token.trim());
        } catch (jwtErr) {
            console.error('[AUTH_JWT_VERIFY_FAILED]', jwtErr.message, 'Token preview:', token.substring(0, 10) + '...');
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        if (decoded.role !== 'candidate') {
            return res.status(403).json({ success: false, message: 'Access denied: Candidate role required' });
        }

        // Set candidate info
        req.candidate = {
            id: decoded.id,
            tenantId: decoded.tenantId,
            email: decoded.email,
            role: decoded.role
        };

        // Ensure req.tenantId is set for global middleware compatibility
        req.tenantId = decoded.tenantId;

        // Attach Tenant DB
        const tenantDB = await getTenantDB(decoded.tenantId);
        if (!tenantDB) {
            return res.status(500).json({ success: false, message: 'Tenant database connection failed' });
        }
        req.tenantDB = tenantDB;

        next();
    } catch (err) {
        console.error('[AUTH_CANDIDATE_GLOBAL_ERROR]', err.message);
        return res.status(401).json({ success: false, message: 'Authentication failed' });
    }
};

/**
 * ATTACH TENANT DB (For public auth routes like Login/Register)
 */
exports.attachPublicTenant = async (req, res, next) => {
    try {
        if (req.tenantId && req.tenantDB) {
            req.publicTenant = { _id: req.tenantId };
            return next();
        }

        const tenant = await resolvePublicTenant();
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'No company found in system' });
        }
        
        req.tenantId = String(tenant._id);
        req.publicTenant = tenant;
        
        const tenantDB = await getTenantDB(req.tenantId);
        if (!tenantDB) {
            return res.status(500).json({ success: false, message: 'Database connection error' });
        }
        req.tenantDB = tenantDB;
        
        next();
    } catch (err) {
        console.error('[ATTACH_TENANT_ERROR]', err.message);
        next(err);
    }
};
