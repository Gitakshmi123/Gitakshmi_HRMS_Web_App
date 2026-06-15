exports.attachCompanyId = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  req.user.companyId = req.user.tenantId || req.user.companyId || null;
  if (!req.user.companyId) {
    return res.status(400).json({
      success: false,
      message: 'Company context is missing in token'
    });
  }

  return next();
};
