const ActivityLog = require('../models/ActivityLog');

exports.getRecent = async (req, res, next) => {
  try {
    const db = req.tenantDB;                   // 🔥 tenant DB
    const Activity = db.model("Activity");     // load model from tenant DB

    const items = await Activity.find({ tenant: req.tenantId })
      .sort({ time: -1 })
      .limit(10);

    res.json({ success: true, data: items });

  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------
// PSA: Get activities across ALL tenants
// ---------------------------------------------------------
exports.getAllActivities = async (req, res, next) => {
  try {
    const Tenant = require('../models/Tenant');
    const ActivitySchema = require('../models/Activity');
    const getTenantDB = require('../utils/tenantDB');

    const tenants = await Tenant.find({ status: 'active' }).lean();
    const allActivities = [];

    // Query each tenant database for activities
    for (const tenant of tenants) {
      try {
        const tenantDB = await getTenantDB(tenant._id);
        tenantDB.model('Activity', ActivitySchema);
        const Activity = tenantDB.model('Activity');

        const activities = await Activity.find({ tenant: tenant._id })
          .sort({ time: -1 })
          .limit(50) // Get more from each tenant, we'll limit total later
          .lean();

        // Add tenant info to each activity
        activities.forEach(act => {
          act.tenantInfo = {
            name: tenant.companyName || tenant.name,
            code: tenant.code,
            _id: tenant._id
          };
        });

        allActivities.push(...activities);
      } catch (err) {
        console.error(`Error fetching activities for tenant ${tenant.code}:`, err.message);
        // Continue with other tenants
      }
    }

    // Sort all activities by time (newest first) and limit to 100
    allActivities.sort((a, b) => {
      const dateA = a.time ? new Date(a.time) : new Date(a.createdAt || 0);
      const dateB = b.time ? new Date(b.time) : new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // Limit to 100 most recent
    const limited = allActivities.slice(0, 100);

    res.json({ success: true, data: limited });

  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------
// NEW: Global Activities from ActivityLog Model (Task 5)
// ---------------------------------------------------------
exports.getGlobalActivities = async (req, res, next) => {
  try {
    const logs = await ActivityLog
      .find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error("Fetch global activities error:", err);
    next(err);
  }
};

// ---------------------------------------------------------

exports.create = async (req, res, next) => {
  try {
    const db = req.tenantDB;
    const Activity = db.model("Activity");

    const body = { ...(req.body || {}) };
    body.time = new Date();
    body.tenant = req.tenantId;

    const a = await Activity.create(body);
    res.status(201).json({ success: true, data: a });

  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------

exports.delete = async (req, res, next) => {
  try {
    const db = req.tenantDB;
    const Activity = db.model("Activity");

    const id = req.params.id;

    const deleted = await Activity.findOneAndDelete({ _id: id, tenant: req.tenantId });

    if (!deleted)
      return res.status(404).json({ success: false, message: "not_found" });

    res.json({ success: true });

  } catch (err) {
    next(err);
  }
};
