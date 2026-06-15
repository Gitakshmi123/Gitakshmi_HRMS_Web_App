const { decrypt } = require('../utils/tokenEncryption');
const InstagramAdapter = require('../adapters/InstagramAdapter');
const FacebookAdapter = require('../adapters/FacebookAdapter');
const LinkedInAdapter = require('../adapters/LinkedInAdapter');
const SocialAuthService = require('./SocialAuthService');
const MediaDownloadService = require('./MediaDownloadService');

/**
 * SocialPostService: Low-level platform execution with strict Platform Rule Engine.
 *
 * EDIT RULES (enforced in updateOnPlatform):
 *   Facebook  – Update existing post caption via Graph API PATCH. Never create a new post.
 *   Instagram – Editing not supported. Delete old post then publish new one. Returns new platformPostId.
 *   LinkedIn  – Update existing post text. On failure, fallback to delete + repost. Returns new platformPostId if reposted.
 *
 * DELETE RULES (enforced in deleteFromPlatform):
 *   Facebook  – DELETE /{post-id}
 *   Instagram – DELETE /{media-id}
 *   LinkedIn  – DELETE /ugcPosts/{postId}
 */
class SocialPostService {
    constructor(db) {
        this.db = db;
        this.SocialAccount = db.model('SocialAccountEnterprise', require('../../../models/social/SocialAccount'));
        this.SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));
        this.socialAuthService = new SocialAuthService(db);
    }

    /**
     * Executes a single scheduled post on a platform.
     * Updates status to 'completed' and stores platformPostId on success.
     */
    async executePost(postId) {
        const post = await this.SocialPost.findById(postId).populate('account').populate('campaign');
        if (!post) throw new Error('Post not found');

        post.status = 'publishing';
        await post.save();

        try {
            const postData = {
                content: post.caption || post.campaign.content,
                media: post.campaign.media,
                postType: post.postType || post.campaign.postType || 'post'
            };

            const platformPostId = await this.publishToPlatform(post.account, postData, post);
            const latestPost = await this.SocialPost.findById(postId).populate('account');

            if (!latestPost || ['deleted', 'cancelled'].includes(latestPost.status)) {
                const cleanupAccount = latestPost?.account || post.account;
                if (cleanupAccount && platformPostId) {
                    try {
                        await this.deleteFromPlatform(cleanupAccount, platformPostId);
                    } catch (cleanupError) {
                        console.error(`Post Execution Cleanup Failed [${postId}]:`, cleanupError.message);
                    }
                }
                return platformPostId;
            }

            post.platformPostId = platformPostId;
            post.platform_media_id = platformPostId;
            post.platformAssetUrn = null; // Clear on success
            post.status = 'completed';
            post.publishedAt = new Date();
            await post.save();

            return platformPostId;
        } catch (error) {
            console.error(`Post Execution Failed [${postId}]:`, error.message);
            const currentPost = await this.SocialPost.findById(postId);
            if (currentPost && !['deleted', 'cancelled'].includes(currentPost.status)) {
                currentPost.status = 'failed';
                currentPost.error = error.message;
                await currentPost.save();
            }
            throw error;
        }
    }

    /**
     * Entry method that routes to specific modular functions.
     * @returns {string} platformPostId
     */
    async publishToPlatform(account, postData, postRecord = null) {
        switch (account.platform) {
            case 'facebook': return await this.publishToFacebook(account, postData, postRecord);
            case 'instagram': return await this.publishToInstagram(account, postData, postRecord);
            case 'linkedin': return await this.publishToLinkedIn(account, postData, postRecord);
            default: throw new Error(`Unsupported platform: ${account.platform}`);
        }
    }

    /**
     * Modular Service: Publish to Facebook
     */
    async publishToFacebook(account, postData) {
        const accessToken = await this._getToken(account);
        const adapter = new FacebookAdapter(accessToken, account.platformAccountId);
        return await this._withRetry(() => adapter.publishPost(postData), 3, 'Facebook');
    }

    /**
     * Modular Service: Publish to Instagram
     */
    async publishToInstagram(account, postData) {
        const accessToken = await this._getToken(account);
        const adapter = new InstagramAdapter(accessToken, account.platformAccountId);
        const normalizedPostData = await this._normalizeInstagramPostData(postData);
        return await this._withRetry(() => adapter.publishPost(normalizedPostData), 3, 'Instagram');
    }

    /**
     * Modular Service: Publish to LinkedIn
     */
    async publishToLinkedIn(account, postData) {
        const accessToken = await this._getToken(account);
        const adapter = new LinkedInAdapter(accessToken, account.platformAccountId);
        return await this._withRetry(() => adapter.publishPost(postData), 3, 'LinkedIn');
    }

    /**
     * Standardized Retry Mechanism for external API calls
     */
    async _withRetry(operation, maxRetries = 3, platformName = 'API') {
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                return await operation();
            } catch (error) {
                attempt++;
                const isRetryable = this._isRetryablePlatformError(error);
                const isClientError = this._isClientError(error);

                if (attempt >= maxRetries || (isClientError && !isRetryable)) {
                    throw error;
                }

                const backoffDelay = this._getRetryDelayMs(error, attempt);
                await new Promise(res => setTimeout(res, backoffDelay));
            }
        }
    }

    /**
     * Platform Rule Engine: Update an existing post caption/text.
     */
    async updateOnPlatform(account, platformPostId, newText, mediaData) {
        const accessToken = await this._getToken(account);
        const adapter = this._getAdapter(account.platform, accessToken, account.platformAccountId);
        const platform = account.platform;
        const mediaArray = mediaData?.media || [];

        if (platform === 'facebook') {
            try {
                await adapter.updatePost(platformPostId, newText);
                return platformPostId;
            } catch (updateErr) {
                try { await adapter.deletePost(platformPostId); } catch (e) {}
                const newId = await adapter.publishPost({ content: newText, media: mediaArray });
                return newId;
            }
        }

        if (platform === 'instagram') {
            try { await adapter.deletePost(platformPostId); } catch (e) {}
            const newId = await adapter.publishPost({ content: newText, media: mediaArray });
            return newId;
        }

        if (platform === 'linkedin') {
            try {
                await adapter.updatePost(platformPostId, newText);
                return platformPostId;
            } catch (updateErr) {
                try { await adapter.deletePost(platformPostId); } catch (e) {}
                const newId = await adapter.publishPost({ content: newText, media: mediaArray });
                return newId;
            }
        }

        throw new Error(`Unsupported platform for update: ${platform}`);
    }

    async deleteFromPlatform(account, platformPostId) {
        const accessToken = await this._getToken(account);
        const adapter = this._getAdapter(account.platform, accessToken, account.platformAccountId);
        return await adapter.deletePost(platformPostId);
    }

    async _getToken(account) {
        if (account?.platform && ['facebook', 'instagram'].includes(account.platform) && account?.expiresAt) {
            const refreshThresholdMs = 7 * 24 * 60 * 60 * 1000;
            const expiresAtMs = new Date(account.expiresAt).getTime();
            if (!Number.isNaN(expiresAtMs) && expiresAtMs - Date.now() <= refreshThresholdMs) {
                try { await this.socialAuthService.refreshMetaLongLivedToken(account); } catch (e) {}
            }
        }
        const accessToken = decrypt(account.accessToken);
        if (!accessToken) throw new Error(`Failed to decrypt access token for account ${account._id}`);
        return accessToken;
    }

    _getAdapter(platform, token, accountId) {
        switch (platform) {
            case 'instagram': return new InstagramAdapter(token, accountId);
            case 'facebook': return new FacebookAdapter(token, accountId);
            case 'linkedin': return new LinkedInAdapter(token, accountId);
            default: throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    // ─── Pre-Publish Normalization ───────────────────────────────────────────

    /**
     * Normalizes and uploads video/image media before platform execution.
     * Ensures Meta/LinkedIn compatability (H.264/AAC, Aspect Ratio).
     */
    async _normalizeMediaForPlatform(postData, platform) {
        const media = Array.isArray(postData?.media) ? postData.media : [];
        if (media.length === 0) return postData;

        // If no video, we only do image normalization (old logic)
        const hasVideo = media.some(m => m.type === 'video');
        if (!hasVideo) return await this._normalizeInstagramPostData(postData);

        const MediaProcessingService = require('./MediaProcessingService');
        const CloudinaryService = require('./CloudinaryService');
        const path = require('path');
        const fs = require('fs');

        const normalizedMedia = [];
        const tempFiles = [];

        try {
            for (const item of media) {
                if (item.type === 'video' && item.url) {
                    // console.log(`[SocialPostService] Normalizing video: ${item.url}`);
                    const inputPath = await MediaDownloadService.downloadFile(item.url); // Use generic downloadFile
                    tempFiles.push(inputPath);

                    const outputFilename = `normalized-${Date.now()}-${path.basename(inputPath)}`;
                    const outputPath = path.join(process.cwd(), 'uploads', outputFilename);
                    tempFiles.push(outputPath);

                    // Ensure directory exists
                    const uploadsDir = path.dirname(outputPath);
                    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

                    // 1. Run FFmpeg normalization
                    const mode = postData.postType === 'reel' ? 'reel' : (postData.postType === 'story' ? 'story' : 'feed');
                    await MediaProcessingService.normalizeVideoForSocial(inputPath, outputPath, mode);

                    // 2. Re-upload normalized video to Cloudinary
                    const cloudRes = await CloudinaryService.uploadFile(outputPath, true);
                    
                    // CRITICAL FIX: Meta (Instagram/Facebook) requires video URLs to end with .mp4 or .mov
                    // Cloudinary URLs may not have an extension by default. 
                    let finalUrl = cloudRes.url;
                    if (!finalUrl.toLowerCase().endsWith('.mp4')) {
                        finalUrl = finalUrl.includes('?') ? finalUrl.replace('?', '.mp4?') : `${finalUrl}.mp4`;
                    }

                    normalizedMedia.push({ ...item, url: finalUrl });
                    
                    // console.log(`[SocialPostService] Video normalized & re-uploaded: ${finalUrl}`);
                } else if (item.type === 'image' && item.url) {
                    // For Instagram, we still do the image download-only-if-needed check
                    if (platform === 'instagram') {
                        const parsed = new URL(item.url);
                        if (!parsed.hostname.includes('res.cloudinary.com')) {
                            const downloaded = await MediaDownloadService.downloadImage(item.url);
                            normalizedMedia.push({ ...item, url: downloaded.url });
                        } else {
                            normalizedMedia.push(item);
                        }
                    } else {
                        normalizedMedia.push(item);
                    }
                } else {
                    normalizedMedia.push(item);
                }
            }
        } catch (error) {
            console.error('[SocialPostService] Normalization Error:', error.message);
            // Default to original data on failure rather than crashing (best effort)
            return postData;
        } finally {
            // ALWAYS cleanup temp files
            if (MediaProcessingService && tempFiles.length > 0) {
                MediaProcessingService.cleanupFiles(tempFiles);
            }
        }

        return { ...postData, media: normalizedMedia };
    }

    async _normalizeInstagramPostData(postData) {
        const media = Array.isArray(postData?.media) ? postData.media : [];
        const normalizedMedia = [];

        for (const item of media) {
            if (!item?.url || item.type !== 'image') {
                normalizedMedia.push(item);
                continue;
            }

            try {
                const parsed = new URL(item.url);
                const isCloudinary = parsed.hostname.toLowerCase().includes('res.cloudinary.com');
                if (isCloudinary) {
                    normalizedMedia.push(item);
                    continue;
                }

                const downloaded = await MediaDownloadService.downloadImage(item.url);
                normalizedMedia.push({ ...item, url: downloaded.url });
            } catch (error) {
                // Keep original on failure
                normalizedMedia.push(item);
            }
        }

        return { ...postData, media: normalizedMedia };
    }

    // ─── Platform Orchestration ─────────────────────────────────────────────

    async publishToInstagram(account, postData, postRecord = null) {
        const accessToken = await this._getToken(account);
        const adapter = new InstagramAdapter(accessToken, account.platformAccountId);
        
        // Ensure standard video formats & aspect ratios
        const normalizedData = await this._normalizeMediaForPlatform(postData, 'instagram');
        
        return await this._withRetry(() => adapter.publishPost(normalizedData), 3, 'Instagram');
    }

    async publishToFacebook(account, postData, postRecord = null) {
        const accessToken = await this._getToken(account);
        const adapter = new FacebookAdapter(accessToken, account.platformAccountId);
        
        // Facebook is picky about sound codecs in videos — normalize to AAC.
        const normalizedData = await this._normalizeMediaForPlatform(postData, 'facebook');
        
        return await this._withRetry(() => adapter.publishPost(normalizedData), 3, 'Facebook');
    }

    async publishToLinkedIn(account, postData, postRecord = null) {
        const accessToken = await this._getToken(account);
        const adapter = new LinkedInAdapter(accessToken, account.platformAccountId);
        const normalizedData = await this._normalizeMediaForPlatform(postData, 'linkedin');

        // Resume Logic: Only register if we don't already have an URN
        const existingData = {
            ...normalizedData,
            existingAssetUrn: postRecord?.platformAssetUrn
        };

        // If we get a new URN, save it immediately for the next retry/restart
        adapter.onAssetRegistered = async (urn) => {
            if (postRecord?._id) {
                await this.SocialPost.findByIdAndUpdate(postRecord._id, {
                    $set: { platformAssetUrn: urn }
                });
            }
        };

        return await this._withRetry(() => adapter.publishPost(existingData), 3, 'LinkedIn');
    }

    // ─── Error Policy ────────────────────────────────────────────────────────

    _isClientError(error) {
        const statusCode = error?.statusCode || error?.response?.status || null;
        return [400, 401, 403, 404].includes(statusCode);
    }

    _isRetryablePlatformError(error) {
        const metaError = error?.metaResponse?.error || error?.response?.data?.error || {};
        const errorCode = Number(metaError.code || error?.code || 0);
        return Boolean(metaError.is_transient || error?.isRetryable || [4, 17, 32, 613].includes(errorCode));
    }

    _getRetryDelayMs(error, attempt) {
        const schedule = [15000, 30000, 60000, 120000, 300000];
        return schedule[Math.min(attempt - 1, schedule.length - 1)];
    }
}

module.exports = SocialPostService;
