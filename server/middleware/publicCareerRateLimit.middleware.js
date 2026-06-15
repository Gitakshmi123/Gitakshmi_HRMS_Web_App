const rateLimit = require('express-rate-limit');

const publicCareerReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_CAREER_READ_RATE_LIMIT || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const publicCareerApplyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PUBLIC_CAREER_APPLY_RATE_LIMIT || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many applications from this IP. Please try again later.',
  },
});

module.exports = {
  publicCareerReadLimiter,
  publicCareerApplyLimiter,
};
