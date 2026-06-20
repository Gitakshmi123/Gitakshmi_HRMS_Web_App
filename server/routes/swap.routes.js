const express = require('express');
const router = express.Router();
const swapController = require('../controllers/swap.controller');
const { authenticate } = require('../middleware/auth.jwt');

// GET /api/swaps/pending
router.get('/pending', authenticate, swapController.getPendingSwaps);

// POST /api/swaps/:id/action
router.post('/:id/action', authenticate, swapController.actionSwap);

module.exports = router;
