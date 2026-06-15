const express = require('express');
const router = express.Router();
const proxyController = require('../controllers/securityProxy.controller');
const auth = require('../middleware/auth.jwt');

// router.use(auth.authenticate);

router.get('/pincode/:pin', proxyController.lookupPincode);
router.get('/postoffice/:city', proxyController.lookupPostOffice);
router.get('/ifsc/:code', proxyController.lookupIfsc);
router.get('/geo/:city', proxyController.lookupGeo);

module.exports = router;
