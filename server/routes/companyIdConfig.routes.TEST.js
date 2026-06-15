/**
 * COMPANY ID CONFIGURATION ROUTES - SIMPLIFIED
 * Test route to verify 404 fix
 */

const express = require('express');
const router = express.Router();

// Simple test route - NO AUTH for testing
router.get('/', (req, res) => {
    console.log('✅ Company ID Config route HIT!');
    res.json({
        success: true,
        message: 'Company ID Config API is working!',
        data: []
    });
});

module.exports = router;
