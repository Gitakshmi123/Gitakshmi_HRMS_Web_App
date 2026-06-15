const express = require('express');
const router = express.Router();
const positionController = require('../controllers/position.controller');
const authMiddleware = require('../middleware/auth.jwt').authenticate;

router.use(authMiddleware);

router.get('/', positionController.getPositions);
router.post('/', positionController.createPosition);
router.get('/:id', positionController.getPositionById);
router.put('/:id', positionController.updatePosition);
router.delete('/:id', positionController.deletePosition);

module.exports = router;
