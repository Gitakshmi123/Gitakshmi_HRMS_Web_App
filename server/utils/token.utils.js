const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'access_secret_123';
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret_456';

function ttlToMilliseconds(ttl) {
  const normalized = String(ttl || '').trim().toLowerCase();
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/);

  if (!match) {
    throw new Error(`Unsupported JWT ttl format: ${ttl}`);
  }

  const value = Number(match[1]);
  const unit = match[2] || 'ms';
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

function createRandomId() {
  return crypto.randomUUID();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function buildBasePayload(authUser, sessionId) {
  return {
    sub: String(authUser.id),
    email: authUser.email || null,
    role: authUser.role,
    tenantId: authUser.tenantId ? String(authUser.tenantId) : null,
    companyCode: authUser.companyCode || null,
    companyId: authUser.companyId ? String(authUser.companyId) : null,
    mainCompanyId: authUser.mainCompanyId ? String(authUser.mainCompanyId) : null,
    subCompanyId: authUser.subCompanyId ? String(authUser.subCompanyId) : null,
    branchId: authUser.branchId ? String(authUser.branchId) : null,
    divisionId: authUser.divisionId ? String(authUser.divisionId) : null,
    departmentId: authUser.departmentId ? String(authUser.departmentId) : null,
    designationId: authUser.designationId ? String(authUser.designationId) : null,
    groupId: authUser.groupId ? String(authUser.groupId) : null,
    subjectType: authUser.subjectType || 'user',
    sid: sessionId,
  };
}

function generateAccessToken(authUser, sessionId) {
  return jwt.sign(
    {
      ...buildBasePayload(authUser, sessionId),
      typ: 'access',
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function generateRefreshToken(authUser, sessionId, tokenId) {
  return jwt.sign(
    {
      ...buildBasePayload(authUser, sessionId),
      typ: 'refresh',
      jti: tokenId,
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
  if (payload.typ !== 'access') {
    const error = new Error('invalid_access_token');
    error.status = 401;
    throw error;
  }
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
  if (payload.typ !== 'refresh') {
    const error = new Error('invalid_refresh_token');
    error.status = 401;
    throw error;
  }
  return payload;
}

function normalizeTokenPayload(payload) {
  return {
    id: payload.sub || payload.id || payload.userId,
    email: payload.email || null,
    role: payload.role || null,
    tenantId: payload.tenantId || payload.tenant || null,
    companyCode: payload.companyCode || payload.company_code || null,
    companyId: payload.companyId || null,
    mainCompanyId: payload.mainCompanyId || payload.tenantId || payload.companyId || null,
    subCompanyId: payload.subCompanyId || null,
    branchId: payload.branchId || null,
    divisionId: payload.divisionId || null,
    departmentId: payload.departmentId || null,
    designationId: payload.designationId || null,
    groupId: payload.groupId || null,
    subjectType: payload.subjectType || 'user',
    sessionId: payload.sid || null,
    tokenId: payload.jti || null,
    tokenType: payload.typ || null,
  };
}

module.exports = {
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS: ttlToMilliseconds(ACCESS_TOKEN_TTL),
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS: ttlToMilliseconds(REFRESH_TOKEN_TTL),
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_TTL,
  createRandomId,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  normalizeTokenPayload,
  ttlToMilliseconds,
  verifyAccessToken,
  verifyRefreshToken,
};
