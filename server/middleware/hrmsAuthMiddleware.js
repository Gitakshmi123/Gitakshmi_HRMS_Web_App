/**
 * hrmsAuthMiddleware.js
 * ONLY for HRMS system (PSA, HR, Employee, Manager)
 * Validates HRMS-specific tokens and tenant context
 */
const jwt = require('jsonwebtoken');

/**
 * Authenticate HRMS User (PSA/HR/Employee/Manager)
 */
exports.authenticateHrms = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hrms_secret_key_123');

    // HRMS token must have role (psa, hr, admin, employee, manager)
    if (!decoded.role || !['psa', 'hr', 'admin', 'employee', 'manager'].includes(decoded.role)) {
      return res.status(403).json({ message: 'Invalid HRMS role' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('HRMS Auth Error:', err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Require specific HRMS roles
 */
exports.requireHrmsRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};
