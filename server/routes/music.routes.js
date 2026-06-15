const express = require('express');
const router = express.Router();
const musicController = require('../controllers/music.controller');
const { authenticate } = require('../middleware/auth.jwt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for audio upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../uploads/music');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'music-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an audio file! Please upload an audio file.'), false);
        }
    }
});

// Protect routes
router.use(authenticate);

// Routes
router.get('/', musicController.getMusic);
router.post('/upload', upload.single('audio'), musicController.uploadMusic);

module.exports = router;
