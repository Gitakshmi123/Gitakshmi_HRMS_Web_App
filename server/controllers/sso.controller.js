const axios = require("axios");

const GTONE_API_BASE_URL = String(process.env.GTONE_API_BASE_URL || "http://localhost:5004/api").replace(/\/+$/, "");
const GTONE_APP_KEY = String(process.env.GTONE_APP_KEY || "hrms").trim();
const GTONE_REDIRECT_URI = String(process.env.GTONE_REDIRECT_URI || "http://localhost:5006/api/auth/sso/callback").trim();
const GTONE_CLIENT_SECRET = String(process.env.GTONE_CLIENT_SECRET || "").trim();
const FRONTEND_URL = String(process.env.FRONTEND_URL || "http://localhost:5176").replace(/\/+$/, "");

/**
 * GET /api/auth/sso/start
 * Redirects browser to GT-ONE authorize endpoint.
 * HRMS frontend calls this when user clicks "Login with GT-ONE".
 */
const ssoStart = (req, res) => {
  try {
    const params = new URLSearchParams({
      app: GTONE_APP_KEY,
    });
    const authorizeUrl = `${GTONE_API_BASE_URL}/sso/authorize?${params.toString()}`;
    console.log(`[HRMS-SSO] Redirecting to GT-ONE: ${authorizeUrl}`);
    return res.redirect(authorizeUrl);
  } catch (err) {
    console.error(`[HRMS-SSO] ssoStart error: ${err.message}`);
    return res.redirect(`${FRONTEND_URL}/login?error=sso_start_failed`);
  }
};

/**
 * GET /api/auth/sso/callback
 * GT-ONE redirects here with ?code=...
 * We exchange the code for a user token, then log the user into HRMS.
 */
const ssoCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error(`[HRMS-SSO] GT-ONE returned error: ${error}`);
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error("[HRMS-SSO] No code in callback");
    return res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
  }

  try {
    // Exchange the authorization code with GT-ONE
    const exchangePayload = {
      app: GTONE_APP_KEY,
      code: String(code),
      redirectUri: GTONE_REDIRECT_URI,
    };

    if (GTONE_CLIENT_SECRET) {
      exchangePayload.clientSecret = GTONE_CLIENT_SECRET;
    }

    console.log(`[HRMS-SSO] Exchanging code with GT-ONE. Payload: ${JSON.stringify({ ...exchangePayload, clientSecret: exchangePayload.clientSecret ? '***' : undefined })}`);
    const exchangeRes = await axios.post(
      `${GTONE_API_BASE_URL}/sso/exchange`,
      exchangePayload,
      { timeout: 10000 }
    );

    const { accessToken, user } = exchangeRes.data || {};

    if (!accessToken) {
      console.error("[HRMS-SSO] No token received from GT-ONE exchange");
      return res.redirect(`${FRONTEND_URL}/login?error=no_token`);
    }

    const email = user?.email || exchangeRes.data?.email;
    console.log(`[HRMS-SSO] Exchange successful for: ${email}`);

    // Set the GT-ONE token as a cookie for HRMS
    res.cookie("sso_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days
    });

    // Also set as accessToken so existing HRMS auth middleware picks it up
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 24 * 60 * 60 * 1000,
    });

    console.log(`[HRMS-SSO] Login successful, redirecting to HRMS dashboard`);
    // Redirect to dashboard with token in URL so frontend can pick it up
    return res.redirect(`${FRONTEND_URL}/tenant/dashboard?token=${accessToken}`);
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err.message;
    console.error(`[HRMS-SSO] Code exchange failed [${status}]: ${msg}`);
    return res.redirect(`${FRONTEND_URL}/login?error=exchange_failed&reason=${encodeURIComponent(msg)}`);
  }
};

/**
 * GET /api/auth/sso/login-url
 * Returns the GT-ONE login URL as JSON (for frontend redirect).
 */
const getSsoLoginUrl = (req, res) => {
  const params = new URLSearchParams({
    app: GTONE_APP_KEY,
  });
  const loginUrl = `${GTONE_API_BASE_URL}/sso/authorize?${params.toString()}`;
  return res.json({ loginUrl });
};

module.exports = { ssoStart, ssoCallback, getSsoLoginUrl };
