const ACCESS_COOKIE_NAME = 'accessToken';
const REFRESH_COOKIE_NAME = 'refreshToken';
const LEGACY_COOKIE_NAMES = ['token', 'jwt', 'sso_token', 'sso_refresh'];

function isSecureRequest(req) {
  if (!req) return String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  return Boolean(
    req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  );
}

function getCookieDomain() {
  const domain = String(process.env.COOKIE_DOMAIN || '').trim();
  return domain || undefined;
}

function getBaseCookieOptions(req, overrides = {}) {
  const domain = getCookieDomain();

  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
    ...overrides,
  };
}

function setAccessTokenCookie(req, res, token, maxAge) {
  res.cookie(
    ACCESS_COOKIE_NAME,
    token,
    getBaseCookieOptions(req, typeof maxAge === 'number' ? { maxAge } : {})
  );
}

function setRefreshTokenCookie(req, res, token, maxAge) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    token,
    getBaseCookieOptions(req, {
      maxAge,
      path: '/api/auth/refresh-token',
    })
  );
}

function clearAuthCookies(req, res) {
  const options = getBaseCookieOptions(req);
  const refreshOptions = getBaseCookieOptions(req, {
    path: '/api/auth/refresh-token',
  });

  // 1. Clear cookies for the current domain (usually localhost or current host)
  res.clearCookie(ACCESS_COOKIE_NAME, options);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshOptions);

  for (const legacyName of LEGACY_COOKIE_NAMES) {
    res.clearCookie(legacyName, options);
  }

  // 2. Explicitly attempt to clear production domain cookies if we are on localhost
  // This helps clean up stale sessions from production when testing locally.
  const prodDomain = '.gitakshmi.com';
  if (!options.domain || options.domain !== prodDomain) {
    const prodOptions = { ...options, domain: prodDomain };
    const prodRefreshOptions = { ...refreshOptions, domain: prodDomain };

    res.clearCookie(ACCESS_COOKIE_NAME, prodOptions);
    res.clearCookie(REFRESH_COOKIE_NAME, prodRefreshOptions);
    for (const legacyName of LEGACY_COOKIE_NAMES) {
      res.clearCookie(legacyName, prodOptions);
    }
  }
}

module.exports = {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  getBaseCookieOptions,
  isSecureRequest,
  setAccessTokenCookie,
  setRefreshTokenCookie,
};
