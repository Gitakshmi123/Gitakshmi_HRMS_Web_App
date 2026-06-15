function normalizeRole(role) {
  if (!role) return '';
  // If role is an object like { _id, name }, extract the name
  const raw = (typeof role === 'object' && role.name) ? role.name : String(role);
  const r = raw.trim().toLowerCase();
  
  // Existing app uses "psa" for product super admin. Map it to super_admin.
  if (r === 'psa') return 'super_admin';
  return r;
}

exports.requireRoles = (...allowedRoles) => {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const userRole = normalizeRole(req.user.role);
    if (!normalizedAllowed.includes(userRole)) {
      process.stdout.write(`\n🚫 [RBAC_DENIED] Path: ${req.originalUrl}, UserRole: ${userRole}, Allowed: ${normalizedAllowed.join(',')}\n`);
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission for this action',
        debug: { userRole, normalizedAllowed }
      });
    }

    return next();
  };
};
