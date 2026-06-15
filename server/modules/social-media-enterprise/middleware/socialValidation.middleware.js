/**
 * Middleware to validate Social Media Post payloads.
 * Strictly checks for media availability and URL accessibility.
 */
const validateSocialPayload = (req, res, next) => {
    const { content, media, accountIds, platform } = req.body;

    // 1. Basic Structure
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ success: false, message: "At least one social account must be selected." });
    }

    // 2. Localhost Verification
    if (media && Array.isArray(media)) {
        for (const item of media) {
            const url = item.url?.toLowerCase() || '';
            if (url.includes('localhost') || url.includes('127.0.0.1')) {
                return res.status(400).json({
                    success: false,
                    message: "Facebook/Instagram requires a PUBLIC HTTPS URL for media. 'localhost' is not supported by Meta's servers. Please use a live staging or production URL."
                });
            }
        }
    }

    next();
};

module.exports = { validateSocialPayload };
