const express = require('express');
const router = express.Router();
const controller = require('../modules/socialMedia/controllers/socialMedia.controller');
const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const upload = require('../modules/socialMedia/middleware/upload');

// Custom authorization for social media - accepts company-level users
const authorizeSocialMedia = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Allow company-level roles (not candidates)
    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const allowedRoles = ['admin', 'hr', 'hr head', 'company_admin', 'user', 'psa', 'employee'];

    if (allowedRoles.includes(userRole)) {
        return next();
    }

//     console.warn(`[Social Media Auth] Blocked role: ${req.user.role}`);
    return res.status(403).json({ message: 'Forbidden: Company access required' });
};

// OAuth routes - NO AUTH on connect (public initiation)
// Auth happens in callback after LinkedIn redirects back
// Note: These routes are mounted BEFORE any global auth/tenant middleware in app.js
router.get('/linkedin/connect', (req, res, next) => {
//     console.log(`[SOCIAL_ROUTE] LinkedIn Connect Hit | tenantId: ${req.query.tenantId}`);
    next();
}, controller.initiateLinkedInOAuth);

router.get('/linkedin/callback', controller.handleLinkedInCallback);

// Other platform OAuth routes (also public for initiation)
router.get('/:platform/connect', controller.initiateOAuth);
router.get('/:platform/callback', controller.handleOAuthCallback);

// Protected routes - use custom authorization
router.use(auth.authenticate);
router.use(checkModuleAccess('socialMediaIntegration'));
router.use(authorizeSocialMedia);

// Image upload route
router.post('/upload-image', upload.single('image'), controller.uploadImage);
router.post('/upload-images', upload.array('images', 10), controller.uploadImages);

// Other protected routes
router.get('/stats', require('../modules/social-media-enterprise/controllers/social.controller').getDashboardStats);
router.get('/accounts', controller.getAccounts);
router.delete('/disconnect/:platform', controller.disconnect);
router.post('/post', require('../modules/socialMedia/middleware/preventDuplicate'), controller.createPost);
router.get('/posts', controller.getPosts);
router.put('/post/:id', controller.updatePost);
router.delete('/post/:id', controller.deletePost);

module.exports = router;

