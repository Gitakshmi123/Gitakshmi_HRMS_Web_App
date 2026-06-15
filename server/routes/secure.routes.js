const router = require('express').Router();
const secureController = require('../controllers/secure.controller');

/**
 * @route GET /api/secure/source-view
 * @desc Returns masked XML representation of the system source
 * @access Public (Returned data is dummy/masked)
 */
router.get('/source-view', secureController.getSourceView);

module.exports = router;
