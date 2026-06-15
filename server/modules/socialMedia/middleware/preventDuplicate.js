const crypto = require('crypto');

// In-memory store for recent requests
// Key: userId + hash(requestBody)
// Value: timestamp
const requestCache = new Map();

// Clean up cache every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of requestCache.entries()) {
        if (now - timestamp > 5 * 60 * 1000) { // 5 minutes retention
            requestCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Middleware to prevent duplicate requests within a short time window
 * Uses a combination of User ID and hashed request body to identify duplicates
 */
const preventDuplicate = (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id || 'anonymous';

        // Create a unique hash of the request body
        // We exclude fields that might change but don't affect uniqueness (like weak timestamps if any)
        // For create post, content + platforms + scheduledAt + link + images determine uniqueness
        const payload = {
            content: req.body.content,
            platforms: req.body.platforms,
            link: req.body.link,
            scheduledAt: req.body.scheduledAt,
            imageUrls: req.body.imageUrls
        };

        const hash = crypto
            .createHash('md5')
            .update(JSON.stringify(payload))
            .digest('hex');

        const key = `${userId}:${hash}`;
        const now = Date.now();

        // Check if this exact request was made recently (e.g., within last 60 seconds)
        if (requestCache.has(key)) {
            const lastTime = requestCache.get(key);
            if (now - lastTime < 60 * 1000) { // 60 seconds duplicate window
                console.warn(`[Duplicate Prevention] Blocked duplicate request from ${userId}`);
                return res.status(409).json({
                    message: 'Duplicate request detected. Please wait a moment.'
                });
            }
        }

        // Store current request
        requestCache.set(key, now);

        next();
    } catch (error) {
        console.error('Error in preventDuplicate middleware:', error);
        // On error, we fail safe and allow the request
        next();
    }
};

module.exports = preventDuplicate;
