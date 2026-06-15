const fs = require('fs');
const path = require('path');
const multer = require('multer');

const resumeDir = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(resumeDir)) {
  fs.mkdirSync(resumeDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, resumeDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 60);
    cb(null, `resume-${Date.now()}-${safeName || 'candidate'}${ext}`);
  },
});

const uploadResume = multer({
  storage,
  limits: {
    fileSize: Number(process.env.PUBLIC_CAREER_RESUME_MAX_SIZE || 5 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only PDF, DOC, and DOCX resume files are allowed'));
    }
    return cb(null, true);
  },
});

function handleUploadError(err, _req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError || err.message.includes('resume files are allowed')) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  return next(err);
}

module.exports = {
  uploadResume,
  handleUploadError,
};
