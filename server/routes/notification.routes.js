const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.jwt');

// Routes prefixed with /api/notifications
router.get('/', authenticate, notificationController.getNotifications);
router.get('/my-requests', authenticate, notificationController.getMyRequests);
router.patch('/:id/read', authenticate, notificationController.markAsRead);
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

module.exports = router;

