function requirePermission(moduleKey, action = 'read') {
  return async (req, res, next) => {
    try {
      if (!req.tenantDB || !req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authenticated tenant user required' });
      }

      const User = req.tenantDB.model('TenantUser');
      const Role = req.tenantDB.model('TenantRole');
      const user = await User.findById(req.user.id).lean();
      if (!user || user.status !== 'active') {
        return res.status(401).json({ success: false, message: 'Tenant user inactive or missing' });
      }

      const role = await Role.findOne({ code: user.roleCode }).lean();
      const permission = role?.permissions?.find((item) => item.module === moduleKey);
      const allowed = permission?.actions?.includes(action);

      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Insufficient role permission' });
      }

      req.tenantUser = user;
      req.tenantRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  requirePermission
};
