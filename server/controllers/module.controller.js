const Tenant = require("../models/Tenant");

/* ---------------------------------------------------
   GET MODULES (per-tenant)
--------------------------------------------------- */
exports.getModules = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant;
    const tenant = await Tenant.findById(tenantId).lean();

    if (!tenant)
      return res.status(404).json({ success: false, message: "tenant_not_found" });

    const modules = tenant.meta?.modules || {}; // stored module config

    res.json({ success: true, data: modules });
  } catch (err) {
    next(err);
  }
};

/* ---------------------------------------------------
   UPDATE MODULE CONFIG (per-tenant)
--------------------------------------------------- */
exports.updateModuleConfig = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant;
    const { modules } = req.body;

    if (!modules || typeof modules !== "object")
      return res.status(400).json({ success: false, message: "invalid_modules" });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant)
      return res.status(404).json({ success: false, message: "tenant_not_found" });

    // merge with existing meta
    tenant.meta = tenant.meta || {};
    tenant.meta.modules = modules;

    await tenant.save();

    res.json({ success: true, message: "modules_updated", data: tenant.meta.modules });
  } catch (err) {
    next(err);
  }
};
