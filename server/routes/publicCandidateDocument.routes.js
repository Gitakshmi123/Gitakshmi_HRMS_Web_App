const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const candidateDocumentController = require('../controllers/candidateDocument.controller');
const CloudinaryService = require('../services/CloudinaryService');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 1024 * 1024 * 10 } // 10MB
});

/**
 * Public Onboarding Document routes
 * (Base mount point: /api/public/candidate-documents)
 */
router.get('/token/:token', candidateDocumentController.getPrefilledDetails);
router.post('/save-draft/:token', candidateDocumentController.saveCandidateDraft);
router.post('/submit/:token', candidateDocumentController.submitCandidateProfile);

// Public document upload endpoint for candidates submitting their profile details
// Uses Cloudinary if configured, falls back to local storage
router.post('/upload/:token', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded or file type not allowed.' });
        }

        // 1. Try Cloudinary first if configured
        if (CloudinaryService.isConfigured()) {
            try {
                const result = await CloudinaryService.uploadFile(
                    req.file.path,
                    'hrms/candidate-documents',
                    true // cleanup local file after upload
                );
                return res.json({
                    success: true,
                    url: result.url,
                    message: 'File uploaded successfully'
                });
            } catch (cloudError) {
                console.warn('[PUBLIC_UPLOAD] Cloudinary upload failed, using local fallback:', cloudError.message);
                // continue to local fallback below
            }
        }

        // 2. Local Fallback — serve from /uploads/:filename
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            url: fileUrl,
            message: 'File uploaded successfully'
        });
    } catch (err) {
        console.error('[PUBLIC_UPLOAD_ERROR]', err);
        res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
    }
});

module.exports = router;
