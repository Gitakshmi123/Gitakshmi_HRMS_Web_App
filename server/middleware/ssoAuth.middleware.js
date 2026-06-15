const jwt = require("jsonwebtoken");

const SSO_COOKIE_NAME = "sso_token";
const SSO_JWT_SECRET = process.env.SSO_JWT_SECRET || process.env.JWT_SECRET;
const SSO_COOKIE_CANDIDATES = [SSO_COOKIE_NAME, "accessToken", "token", "jwt", "ssoToken"];
const SSO_QUERY_CANDIDATES = ["token", "accessToken", "access_token", "ssoToken", "sso_token", "jwt", "id_token"];

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (["psa", "super_admin", "superadmin"].includes(value)) return "super_admin";
  if (["company_admin", "companyadmin", "admin", "hr", "company_super_admin"].includes(value)) return "company_admin";
  return value;
}

function verifySsoToken(token) {
  if (!SSO_JWT_SECRET) {
    throw new Error("SSO_JWT_SECRET is required for SSO verification");
  }
  return jwt.verify(token, SSO_JWT_SECRET);
}

function extractTokenFromRequest(req) {
  // 1. Authorization Header (Explicit token from client wins)
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (header && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, "").trim();
  }

  // 2. Query Parameter (e.g. for simple token passing)
  const queryToken = req.query?.token;
  if (queryToken) return String(queryToken);

  // 3. Cookies (Implicit session)
  for (const name of SSO_COOKIE_CANDIDATES) {
    const value = req.cookies?.[name];
    if (value) return value;
  }

  return null;
}

function buildSsoPayload(user) {
  return {
    sub: String(user.id || user._id),
    email: user.email,
    role: user.role,
    tenantId: String(user.tenantId || user.tenant || user.companyId || ""),
    products: ["HRMS"],
  };
}

function signSsoToken(payload) {
  return jwt.sign(payload, SSO_JWT_SECRET, { expiresIn: "10d" });
}

function setSsoCookie(res, token) {
  res.cookie(SSO_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days
  });
}

function verifySSO(req, res, next) {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      console.warn("[HRMS-AUTH] No SSO token found in request");
      return res.status(200).json({ success: false, authenticated: false, message: "No SSO session found" });
    }

    let payload = null;
    try {
      payload = verifySsoToken(token);
    } catch (verifyErr) {
      if (!isProduction()) {
        const decoded = jwt.decode(token);
        if (decoded && typeof decoded === "object") {
          const sig = token.split('.')[2] || 'no-sig';
          if (!global.loggedSsoWarns) global.loggedSsoWarns = new Set();
          if (!global.loggedSsoWarns.has(sig)) {
            global.loggedSsoWarns.add(sig);
            console.warn(`[HRMS-AUTH] SSO verify failed in dev; using decoded token payload: ${verifyErr.message} (Warning logged once per token)`);
          }
          payload = decoded;
        }
      }
      if (!payload) throw verifyErr;
    }

    req.user = payload;
    return next();
  } catch (err) {
    console.error(`[HRMS-AUTH] SSO Token verification failed: ${err.message}`);
    return res.status(401).json({ success: false, message: "Invalid SSO session" });
  }
}

module.exports = {
  SSO_COOKIE_NAME,
  normalizeRole,
  verifySsoToken,
  verifySSO,
  requireSsoAuth: verifySSO,
  buildSsoPayload,
  signSsoToken,
  setSsoCookie,
};
