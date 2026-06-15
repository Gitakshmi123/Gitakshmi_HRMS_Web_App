class EnterpriseError extends Error {
  constructor(message, statusCode = 500, code = 'enterprise_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = {
  EnterpriseError,
  asyncHandler
};
