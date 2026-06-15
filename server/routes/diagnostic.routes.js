const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const diagCtrl = require('../controllers/uploadDiagnostic.controller');
const auth = require('../middleware/auth.jwt');
const debugRoutesEnabled =
    String(process.env.ENABLE_DEBUG_ROUTES || '').trim().toLowerCase() === 'true';

// Auto-create folder
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `diag-${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

router.use((req, res, next) => {
    if (!debugRoutesEnabled) {
        return res.status(404).json({ success: false, message: 'not_found' });
    }

    return next();
});

router.use(auth.authenticate);
router.use(auth.requirePsa);

/**
 * Diagnostic Routes
 */

// 1. Isolated Upload (Exactly as requested by user Step 4)
// Target Path: POST /api/upload
// Key MUST be 'image'
router.post('/', upload.single('image'), diagCtrl.isolatedUpload);

// 2. Isolation Test (Per Requirement 6)
router.get('/cloudinary-test', diagCtrl.verifyCredentials);
router.get('/verify-config', diagCtrl.verifyCredentials); // Alias

// 3. Companies Visibility Diagnostic
router.get('/companies-check', async (req, res) => {
    try {
        const Tenant = require('../models/Tenant');
        const count = await Tenant.countDocuments();
        const activeCount = await Tenant.countDocuments({ status: { $ne: 'deleted' } });
        const parents = await Tenant.find({ parentCompanyId: null, status: { $ne: 'deleted' } }).lean();
        
        return res.json({
            success: true,
            totalCount: count,
            activeCount: activeCount,
            parentCount: parents.length,
            parents: parents.map(p => ({ id: p._id, name: p.companyName || p.name, status: p.status, parentId: p.parentCompanyId })),
            msg: "Diagnostic data fetched from " + (process.env.MONGO_URI ? "Atlas" : "Local")
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
