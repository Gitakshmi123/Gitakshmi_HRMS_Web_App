const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId in request parameters.
 * Usage: router.get('/:id', validateId('id'), controller.get)
 */
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_id',
        message: `Invalid identifier provided: ${id}`
      });
    }
    next();
  };
};

module.exports = validateId;
