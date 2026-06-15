const fs = require('fs/promises');
const path = require('path');
const { checksum } = require('./security');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function assertFile(file) {
  if (!file) {
    const err = new Error('file_required');
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error('unsupported_file_type');
    err.status = 400;
    throw err;
  }
  if (file.size > 10 * 1024 * 1024) {
    const err = new Error('file_too_large');
    err.status = 400;
    throw err;
  }
}

function normalizeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

async function storeLocalOnboardingFile({ file, tenantId, employeeId, category, documentType, version }) {
  assertFile(file);
  const bytes = await fs.readFile(file.path);
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase() || '.bin';
  const key = path.join(
    'uploads',
    'onboarding-suite',
    normalizeSegment(tenantId),
    'employees',
    normalizeSegment(employeeId),
    normalizeSegment(category),
    normalizeSegment(documentType),
    `v${version}-${Date.now()}${ext}`
  );
  const absolute = path.join(__dirname, '..', '..', key);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.copyFile(file.path, absolute);
  await fs.unlink(file.path).catch(() => null);
  return {
    storageProvider: 'local',
    storageKey: key.replace(/\\/g, '/'),
    secureUrl: `/${key.replace(/\\/g, '/')}`,
    checksum: checksum(bytes),
  };
}

module.exports = { ALLOWED_MIME_TYPES, storeLocalOnboardingFile };
