const { seedDemoData } = require('../services/demoDataSeeder.service');

exports.seedTenantDemoData = async (req, res) => {
  try {
    if (!req.tenantDB || !req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant/company context is required. Please select a company and try again.'
      });
    }

    const data = await seedDemoData({
      tenantDB: req.tenantDB,
      tenantId: req.tenantId,
      user: req.user
    });

    return res.json({
      success: true,
      message: 'Demo data is ready for this company.',
      data
    });
  } catch (error) {
    console.error('[DEMO_DATA_SEED] Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to seed demo data.'
    });
  }
};
