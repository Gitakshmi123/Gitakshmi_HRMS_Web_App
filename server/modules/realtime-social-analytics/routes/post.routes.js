const express = require('express');
const auth = require('../../../middleware/auth.jwt');
const controller = require('../controllers/PostAnalyticsController');

const router = express.Router();

router.get('/posts', auth.authenticate, controller.getPosts);
router.get('/posts/:id/metrics', auth.authenticate, controller.getPostMetrics);

module.exports = router;
