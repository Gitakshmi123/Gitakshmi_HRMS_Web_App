/**
 * Platform-specific rules and limitations for social media posting.
 * Enforced at both frontend (for UX) and backend (for stability).
 */

export const PLATFORM_RULES = {
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
        maxHashtags: null,
        supportedMedia: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'],
        maxImageSize: 10 * 1024 * 1024, // 10MB
        maxVideoSize: 1024 * 1024 * 1024, // 1GB
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
        carouselLimit: 9
    }
};
