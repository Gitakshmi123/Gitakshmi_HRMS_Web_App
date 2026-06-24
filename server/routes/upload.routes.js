const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth.jwt');

// ensure uploads folder exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
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
  limits: { fileSize: 1024 * 1024 * 5 } // 5MB
});

// Image upload for email editor — accepts all common image formats
const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: ${allowed.join(', ')}`), false);
    }
  },
  limits: { fileSize: 1024 * 1024 * 10 } // 10MB
});

const ctrl = require('../controllers/upload.controller');

router.use(auth.authenticate);
router.post('/medical-cert', upload.single('file'), ctrl.uploadLogo);

// Email template image upload — only needs basic auth, not admin role
router.post('/email-image', imageUpload.single('file'), ctrl.uploadLogo);

router.use(auth.requireAdminOrHr);

router.post('/logo', upload.single('file'), ctrl.uploadLogo);
router.post('/doc', upload.single('file'), ctrl.uploadLogo); // Reuse uploadLogo for generic doc upload

module.exports = router;
