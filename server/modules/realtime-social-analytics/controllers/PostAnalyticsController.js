const PostRepository = require('../repositories/PostRepository');

const repository = new PostRepository();

function getTenantId(req) {
  return req.tenantId || req.user?.tenantId || req.user?.companyId || null;
}

function handleAnalyticsError(res, error) {
  const serviceUnavailableCodes = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'TENANT_DB_UNAVAILABLE'
  ]);
  const status = serviceUnavailableCodes.has(error.code) ? 503 : 500;
  const message = error.message || (
    error.code === 'ECONNREFUSED'
      ? 'MongoDB is not reachable. Start MongoDB or update MONGO_URI.'
      : 'Social analytics service is temporarily unavailable.'
  );
  res.status(status).json({
    success: false,
    message,
    code: error.code || 'SOCIAL_ANALYTICS_ERROR'
  });
}

exports.getPosts = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const posts = await repository.listPosts({
      tenantId: getTenantId(req),
      limit,
      offset
    });

    res.json({
      success: true,
      data: posts
    });
  } catch (error) {
    handleAnalyticsError(res, error);
  }
};

exports.getPostMetrics = async (req, res) => {
  try {
    const result = await repository.getPostMetrics(req.params.id, {
      tenantId: getTenantId(req),
      limit: Math.min(Number(req.query.limit || 100), 500)
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleAnalyticsError(res, error);
  }
};
