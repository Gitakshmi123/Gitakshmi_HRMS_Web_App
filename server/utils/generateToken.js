const jwt = require('./jwt');

module.exports = (user) => {
  const payload = { id: user._id, role: user.role };
  return jwt.sign(payload, { expiresIn: '7d' });
};
