const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://192.168.1.93:5180',
  'http://localhost:5173',
  'http://192.168.1.93:5173'
];

const DEFAULT_PROD_ORIGINS = [
  'https://hrms.gitakshmi.com',
  'https://hrms.dev.gitakshmi.com',
  'https://projects.gitakshmi.com',
];

function normalizeOrigin(input) {
  if (!input) return null;

  try {
    return new URL(String(input).trim()).origin;
  } catch (_error) {
    return null;
  }
}

function parseOrigins(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
}

function getDynamicOrigins() {
  const dynamicOrigins = new Set();

  [
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.NGROK_URL,
  ]
    .flatMap((value) => parseOrigins(value))
    .forEach((origin) => dynamicOrigins.add(origin));

  return [...dynamicOrigins];
}

function getAllowedOrigins() {
  const fromEnv = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const dynamicOrigins = getDynamicOrigins();
  
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const defaults = isProduction
    ? DEFAULT_PROD_ORIGINS
    : [...DEFAULT_DEV_ORIGINS, ...DEFAULT_PROD_ORIGINS];
  
  return [...new Set([...fromEnv, ...dynamicOrigins, ...defaults])];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  return getAllowedOrigins().includes(normalized);
}

function buildCorsOptions() {
  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn('⚠️ CORS DEBUG - WOULD BLOCK Origin:', origin);
      return callback(null, true); // ALLOW TEMPORARILY
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Company-Code'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  };
}

function shouldTrustProxy() {
  const explicit = String(process.env.TRUST_PROXY || '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(explicit)) return true;
  if (['0', 'false', 'no'].includes(explicit)) return false;

  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

module.exports = {
  buildCorsOptions,
  getAllowedOrigins,
  isAllowedOrigin,
  normalizeOrigin,
  shouldTrustProxy,
};
