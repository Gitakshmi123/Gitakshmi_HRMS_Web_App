const express = require('express');
const router = express.Router();
const { authenticate, requireAdminOrHr } = require('../middleware/auth.jwt');
const { getAnnouncements, createAnnouncement, deleteAnnouncement } = require('../controllers/announcement.controller');

router.get('/', authenticate, getAnnouncements);
router.post('/', authenticate, requireAdminOrHr, createAnnouncement);
router.delete('/:id', authenticate, requireAdminOrHr, deleteAnnouncement);

module.exports = router;
