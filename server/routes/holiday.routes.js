const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const holidayController = require('../controllers/holiday.controller');
const { authenticate, requireHr } = require('../middleware/auth.jwt');

// Configure multer for holiday file uploads
const uploadDir = path.join(__dirname, '..', 'uploads', 'holidays');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const name = `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// All users can view holidays (for calendar display)
router.get('/', authenticate, holidayController.getHolidays);

// Only HR can create, update, delete holidays
router.post('/', authenticate, requireHr, holidayController.createHoliday);
router.put('/:id', authenticate, requireHr, holidayController.updateHoliday);
router.delete('/:id', authenticate, requireHr, holidayController.deleteHoliday);

// Bulk upload routes (HR only)
router.post('/bulk/preview', authenticate, requireHr, upload.single('file'), holidayController.bulkUploadPreview);
router.post('/bulk/confirm', authenticate, requireHr, holidayController.bulkUploadConfirm);

module.exports = router;
