const { lookupGstin, normalizeGstin } = require('../services/gstLookup.service');

exports.lookupGstin = async (req, res) => {
  try {
    const gstin = normalizeGstin(req.params.gstin || req.query.gstin || '');
    const data = await lookupGstin(gstin);

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to fetch GST details.'
    });
  }
};
