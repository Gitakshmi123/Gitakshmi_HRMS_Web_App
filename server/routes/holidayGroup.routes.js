const express = require('express');
const router = express.Router();
const holidayGroupController = require('../controllers/holidayGroup.controller');
const { authenticate, requireHr } = require('../middleware/auth.jwt');

// Get all holiday groups
router.get('/', authenticate, holidayGroupController.getHolidayGroups);

// Get specific holiday group
router.get('/:id', authenticate, holidayGroupController.getHolidayGroupById);

// Create holiday group
router.post('/', authenticate, requireHr, holidayGroupController.createHolidayGroup);

// Update holiday group
router.put('/:id', authenticate, requireHr, holidayGroupController.updateHolidayGroup);

// Delete holiday group
router.delete('/:id', authenticate, requireHr, holidayGroupController.deleteHolidayGroup);

// Copy calendar
router.post('/:id/copy', authenticate, requireHr, holidayGroupController.copyCalendar);

module.exports = router;
