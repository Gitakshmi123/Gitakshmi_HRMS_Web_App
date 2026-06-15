const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.jwt');
const hiringCtrl = require('../controllers/hiring.flow.controller');

// NOTE: tenantMiddleware is mounted globally under /api in app.js
// We still rely on req.tenantDB from tenantMiddleware (or req.db fallback).

router.use(auth.authenticate);
router.use(auth.requireHr);

// Offer
router.post('/offer/issue', hiringCtrl.issueOffer);

// Joining
router.post('/joining/issue', hiringCtrl.issueJoining);

module.exports = router;

