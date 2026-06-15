const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;
    return next();
  } catch (error) {
    const issues = Array.isArray(error?.issues)
      ? error.issues
      : Array.isArray(error?.errors)
        ? error.errors
        : [];

    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'Request validation failed',
      details: issues.map((issue) => ({
        path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
        message: issue.message,
      })),
    });
  }
};

module.exports = validate;
