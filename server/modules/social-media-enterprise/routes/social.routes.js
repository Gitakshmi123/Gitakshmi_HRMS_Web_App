const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const socialController = require('../controllers/social.controller');
const { authenticate } = require('../../../middleware/auth.jwt');
const checkModuleAccess = require('../../../middleware/moduleAccess.middleware');
const { checkPermission } = require('../../../middleware/rbac.middleware');

// 1. Ensure uploads directory exists (Prevention for Multer crash)
// process.cwd() is reliable in most deployments
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 2. Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename to prevent issues with spaces/special chars
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit to accommodate reels/videos
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Supported formats: Images (JPG, PNG), Videos (MP4), and Audio (MP3)'), false);
        }
    }
});

// --- PUBLIC ROUTES (No Auth) ---
router.get('/oauth/callback', socialController.handleCallback);
router.get('/oauth/linkedin/callback', socialController.handleCallback);
router.get('/cloudinary-test', socialController.testCloudinary); // MOVED: For public diagnostic testing

// --- PROTECTED ROUTES (Requires Auth) ---
// router.use((req, res, next) => {
//     console.log(`[SOCIAL_ROUTES_DEBUG] ${req.method} ${req.path} | Auth: ${req.headers.authorization ? 'YES' : 'NO'}`);
//     next();
// });
router.use(authenticate);
router.use(checkModuleAccess('socialMediaIntegration'));
// router.use((req, res, next) => {
//     console.log(`[SOCIAL_ROUTES_DEBUG] post-authenticate | ${req.method} ${req.path} | User: ${req.user ? req.user.id : 'NONE'}`);
//     next();
// });

// Management
router.get('/dashboard/stats', checkPermission('socialMedia.dashboard', 'view'), socialController.getDashboardStats); // ADDED: Required for enterprise dashboard
router.get('/analytics/dashboard', checkPermission('socialMedia.dashboard', 'view'), socialController.getAnalyticsDashboard);
router.get('/analytics', checkPermission('socialMedia.dashboard', 'view'), socialController.getAnalytics);
router.get('/oauth/initiate', checkPermission('socialMedia.accounts', 'edit'), socialController.initiateOAuth);
router.get('/:platform/connect', checkPermission('socialMedia.accounts', 'edit'), socialController.initiateOAuth);
router.get('/accounts', checkPermission('socialMedia.accounts', 'view'), socialController.getAccounts);
router.get('/posts', checkPermission('socialMedia.history', 'view'), socialController.getHistory);
router.get('/history', checkPermission('socialMedia.history', 'view'), socialController.getHistory);

// Publishing & Media
router.post('/post', checkPermission('socialMedia.create', 'create'), socialController.createPost);
router.post('/instagram/post', checkPermission('socialMedia.create', 'create'), socialController.postToInstagram);
router.post('/upload-media', checkPermission('socialMedia.create', 'create'), (req, res, next) => {
    // Wrap upload to catch Multer errors before they reach the controller
    upload.array('media', 5)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: `Multer Error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, socialController.uploadMedia);

router.post('/process-media', checkPermission('socialMedia.create', 'create'), (req, res, next) => {
    // Specialized route for video + audio merge
    upload.fields([{ name: 'video', maxCount: 1 }, { name: 'audio', maxCount: 1 }])(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, socialController.processMedia);

// Campaigns & Posts management
router.post('/analytics/sync', checkPermission('socialMedia.dashboard', 'edit'), socialController.syncAnalytics); // Manual trigger
router.post('/post/:id/retry', checkPermission('socialMedia.history', 'edit'), socialController.retryPost);     // Retry failed post
router.delete('/post/:id', checkPermission('socialMedia.history', 'delete'), socialController.deletePost);
router.delete('/single-post/:id', checkPermission('socialMedia.history', 'delete'), socialController.deleteSinglePost);
router.put('/post/:id', checkPermission('socialMedia.history', 'edit'), socialController.updatePost);

router.delete('/disconnect/:platform', checkPermission('socialMedia.accounts', 'delete'), socialController.disconnectAccount);

module.exports = router;
