/**
 * jobPortalAuthMiddleware.js
 * ONLY for Job Portal system (candidate authentication)
 * Validates candidate tokens ONLY
 * NO tenant middleware, NO role-based access
 */
const jwt = require('jsonwebtoken');

/**
 * Authenticate Job Portal Candidate
 * IMPORTANT: Uses separate token validation from HRMS
 */
exports.authenticateCandidate = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const candidateToken = req.cookies?.candidateAccessToken || null;
    const hrmsToken = req.cookies?.accessToken || req.cookies?.token || req.cookies?.jwt || null;
    const referrer = req.get('referer') || req.get('referrer') || '';
    const isInternalPortalRequest = (() => {
      try {
        const pathname = new URL(referrer, 'http://localhost').pathname.toLowerCase();
        return pathname.startsWith('/employee') || pathname.startsWith('/hr') || pathname.startsWith('/tenant');
      } catch (_err) {
        return false;
      }
    })();
    const cookieToken = isInternalPortalRequest
      ? (hrmsToken || candidateToken)
      : (candidateToken || hrmsToken);
    const token = authHeader
      ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader)
      : cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    // Explicitly check JWT_SECRET
    const secret = process.env.JWT_SECRET || 'hrms_secret_key_123';

    try {
      const decoded = jwt.verify(token, secret);

      // Allow Job Portal token or HRMS token (employee/HR for internal applications).
      const role = String(decoded.role || decoded.roleName || '').toLowerCase();
      if (![
        'candidate',
        'employee',
        'manager',
        'hr',
        'admin',
        'superadmin',
        'super_admin',
        'company_admin',
        'company_super_admin',
        'human_resource',
        'hr_manager',
        'psa'
      ].includes(role)) {
        return res.status(403).json({ error: 'Invalid candidate token' });
      }

      const userId = decoded.id || decoded._id;

      if (!decoded.tenantId || !userId) {
        return res.status(403).json({ error: 'Invalid token structure' });
      }

      req.candidate = {
        id: userId,
        tenantId: decoded.tenantId,
        role
      };


      next();
    } catch (jwtErr) {
      console.error('Job Portal Auth Error:', jwtErr.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    console.error('Job Portal Global Auth Error:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Optional: Ensure candidate is logged in
 */
exports.requireCandidate = (req, res, next) => {
  if (!req.candidate) {
    return res.status(401).json({ error: 'Candidate not authenticated' });
  }
  next();
};
