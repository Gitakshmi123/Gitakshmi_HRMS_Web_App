const jwt = require('jsonwebtoken');

exports.verify = (token) => jwt.verify(token, process.env.JWT_SECRET || 'secret');
exports.sign = (payload, opts) => jwt.sign(payload, process.env.JWT_SECRET || 'secret', opts);
