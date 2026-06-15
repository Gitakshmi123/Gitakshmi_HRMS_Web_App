const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { authenticate } = require('../middleware/auth.jwt');

// Routes prefixed with /api/comments
router.get('/:entityType/:entityId', authenticate, commentController.getComments);
router.post('/:entityType/:entityId', authenticate, commentController.addComment);

module.exports = router;
