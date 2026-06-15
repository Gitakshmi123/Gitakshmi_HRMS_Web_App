
const express = require('express');
const router = express.Router();
const careerController = require('../controllers/career-optimized.controller');
const payloadValidator = require('../middleware/payloadValidator');
// === ALIAS ROUTES for legacy/frontend compatibility ===
router.post('/career/seo/save', payloadValidator(10), careerController.saveSEOSettings);
router.post('/career/sections/save', payloadValidator(10), careerController.saveSections);

// ============= PUBLIC ENDPOINTS (NO MIDDDLEWARE) =============
// Get public published career page (for frontend display)
// EXEMPT from tenantMiddleware because it receives ID in params, not headers
router.get('/public/:tenantId', careerController.getPublicPage);
router.get('/public-customization/:tenantId', careerController.getPublicPage);


// Tenant detection middleware (gets tenantId from X-Tenant-ID header)
const tenantMiddleware = (req, res, next) => {
    const tenantId =
        req.tenantId ||
        req.user?.tenantId ||
        req.headers['x-tenant-id'] ||
        req.query.tenantId;

    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required (X-Tenant-ID header)' });
    }
    req.tenantId = tenantId;
    next();
};

// Apply tenant detection to all routes
router.use(tenantMiddleware);

// ============= DRAFT OPERATIONS =============

// Save SEO settings (small, separate document)
router.post('/seo/save', payloadValidator(10), careerController.saveSEOSettings);

// Save sections (each section separately, max 2MB each)
router.post('/sections/save', payloadValidator(10), careerController.saveSections);

// Get current draft data for editing
router.get('/draft', careerController.getDraftData);

// ============= PUBLISH OPERATIONS =============

// Publish all draft data to live (merges from 3 collections)
router.post('/publish', careerController.publishLive);

module.exports = router;
