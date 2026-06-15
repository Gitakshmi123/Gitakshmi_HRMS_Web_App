/**
 * Platform-specific rules and limitations for social media posting.
 * Enforced at both frontend (for UX) and backend (for stability).
 */

const PLATFORM_RULES = {
    instagram: {
        maxCaptionLength: 2200,
        maxHashtags: 30,
        supportedMedia: ['image/jpeg', 'image/png', 'video/mp4'],
        maxImageSize: 8 * 1024 * 1024, // 8MB
        maxVideoSize: 100 * 1024 * 1024, // 100MB
        aspectRatio: { min: 4 / 5, max: 1.91 / 1 },
        allowEdit: false,
        allowDelete: true,
        requireMedia: true,
        carouselLimit: 10
    },
    facebook: {
        maxCaptionLength: 63206,
        maxHashtags: null, // No strict limit, but recommended < 10
        supportedMedia: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'],
        maxImageSize: 10 * 1024 * 1024, // 10MB
        maxVideoSize: 1024 * 1024 * 1024, // 1GB (API limit varies, but 1GB is safe)
        allowEdit: true,
        allowDelete: true,
        requireMedia: false,
        carouselLimit: 10
    },
    linkedin: {
        maxCaptionLength: 3000,
        maxHashtags: null,
        supportedMedia: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
        maxImageSize: 5 * 1024 * 1024, // 5MB
        maxVideoSize: 200 * 1024 * 1024, // 200MB
        allowEdit: false,
        allowDelete: false, // Per user request: LinkedIn NO edit/delete after publish
        requireMedia: false,
        carouselLimit: 9 // LinkedIn carousel (multi-image) limit
    }
};

/**
 * Validates a post against platform rules
 * @param {string} platform 
 * @param {Object} postData { content, imageUrls, videoUrl }
 * @returns {Object} { isValid: boolean, error: string }
 */
function validatePost(platform, postData) {
    const rules = PLATFORM_RULES[platform];
    if (!rules) return { isValid: false, error: 'Unsupported platform' };

    const { content, imageUrls = [], videoUrl } = postData;

    // Content length
    if (content && content.length > rules.maxCaptionLength) {
        return {
            isValid: false,
            error: `${platform.toUpperCase()} caption exceeds ${rules.maxCaptionLength} characters.`
        };
    }

    // Media requirement
    if (rules.requireMedia && imageUrls.length === 0 && !videoUrl) {
        return {
            isValid: false,
            error: `${platform.toUpperCase()} requires at least one image or video.`
        };
    }

    // Carousel limit
    if (imageUrls.length > rules.carouselLimit) {
        return {
            isValid: false,
            error: `${platform.toUpperCase()} supports maximum ${rules.carouselLimit} images per post.`
        };
    }

    return { isValid: true };
}

module.exports = { PLATFORM_RULES, validatePost };
