const axios = require('axios');

class InstagramPublishError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'InstagramPublishError';
        this.code = details.code || 'INSTAGRAM_PUBLISH_FAILED';
        this.step = details.step || null;
        this.statusCode = details.statusCode || null;
        this.metaResponse = details.metaResponse || null;
        this.isRetryable = Boolean(details.isRetryable);
    }
}

/**
 * Instagram Business Adapter using Meta Graph API
 */
class InstagramAdapter {
    constructor(accessToken, instagramBusinessId) {
        this.accessToken = accessToken;
        this.id = instagramBusinessId;
        this.baseUrl = 'https://graph.facebook.com/v19.0';
    }

    _assertPublicMediaUrl(mediaUrl, allowedExtensions = ['jpg', 'jpeg', 'png']) {
        let parsedUrl;
        try {
            parsedUrl = new URL(mediaUrl);
        } catch (error) {
            throw new InstagramPublishError('Media URL must be a valid absolute URL.', {
                step: 'validation',
                code: 'INVALID_MEDIA_URL'
            });
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        const isPrivateHost = (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname.endsWith('.local') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
        );

        if (parsedUrl.protocol !== 'https:' || isPrivateHost) {
            throw new InstagramPublishError('Instagram requires a public HTTPS media URL.', {
                step: 'validation',
                code: 'MEDIA_URL_NOT_PUBLIC'
            });
        }

        const pathSegments = parsedUrl.pathname.split('/');
        const fileName = pathSegments[pathSegments.length - 1] || '';
        const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : null;
        if (allowedExtensions.length && extension && !allowedExtensions.includes(extension)) {
            throw new InstagramPublishError(`Only ${allowedExtensions.join('/')} media URLs are allowed for this request.`, {
                step: 'validation',
                code: 'UNSUPPORTED_MEDIA_TYPE'
            });
        }
    }

    _buildMetaError(error, fallbackMessage, step, options = {}) {
        const metaResponse = error?.response?.data || options.metaResponse || null;
        const metaMessage = metaResponse?.error?.message || metaResponse?.message || fallbackMessage;
        return new InstagramPublishError(metaMessage, {
            code: metaResponse?.error?.code || options.code,
            step,
            statusCode: error?.response?.status || options.statusCode || null,
            metaResponse,
            isRetryable: options.isRetryable
        });
    }

    async createMediaContainer({ imageUrl, caption = '' }) {
        this._assertPublicMediaUrl(imageUrl, ['jpg', 'jpeg', 'png']);

        try {
            const response = await axios.post(`${this.baseUrl}/${this.id}/media`, {
                image_url: imageUrl,
                caption,
                access_token: this.accessToken
            });

            return {
                creationId: response.data.id,
                raw: response.data
            };
        } catch (error) {
            throw this._buildMetaError(error, 'Failed to create Instagram media container.', 'create_container');
        }
    }

    async getContainerStatus(creationId) {
        try {
            const response = await axios.get(`${this.baseUrl}/${creationId}`, {
                params: {
                    fields: 'status_code,status',
                    access_token: this.accessToken
                }
            });

            return response.data;
        } catch (error) {
            throw this._buildMetaError(error, 'Failed to fetch Instagram media container status.', 'container_status', {
                isRetryable: true
            });
        }
    }

    async publishContainer(creationId) {
        try {
            const response = await axios.post(`${this.baseUrl}/${this.id}/media_publish`, {
                creation_id: creationId,
                access_token: this.accessToken
            });

            return {
                platformPostId: response.data.id,
                raw: response.data
            };
        } catch (error) {
            throw this._buildMetaError(error, 'Failed to publish Instagram media container.', 'publish_media');
        }
    }

    async publishImagePost({ imageUrl, caption = '', pollRetries = 15, pollIntervalMs = 2000 }) {
        const container = await this.createMediaContainer({ imageUrl, caption });
        const status = await this._pollStatus(container.creationId, pollRetries, pollIntervalMs);
        const published = await this.publishContainer(container.creationId);

        return {
            creationId: container.creationId,
            status,
            platformPostId: published.platformPostId,
            containerResponse: container.raw,
            publishResponse: published.raw
        };
    }

    /**
     * Unified entry point for publishing to Instagram.
     * Selects the correct modular flow based on media content.
     */
    async publishPost(postData) {
        const { content = '', media = [], postType = 'post' } = postData;
        const TAG = '[InstagramAdapter][Publish]';

        if (!media || media.length === 0) {
            throw new InstagramPublishError('Instagram requires at least one media file.', {
                step: 'validation',
                code: 'MEDIA_REQUIRED'
            });
        }

        const video = media.find(m => m.type === 'video');
        const images = media.filter(m => m.type === 'image');

        try {
            if (video) {
                // console.log(`${TAG} Routing to Video/Reels flow...`);
                return await this._publishVideo(video.url, content, postType);
            } 
            
            if (images.length > 1 && postType !== 'story') {
                // console.log(`${TAG} Routing to Carousel flow (${images.length} images)...`);
                return await this._publishCarousel(images.map(img => img.url), content);
            } 
            
            // Default: Single Image post
            // console.log(`${TAG} Routing to Single Image flow...`);
            return await this._publishSingleImage(images[0].url, content, postType);

        } catch (error) {
            if (error instanceof InstagramPublishError) throw error;
            throw this._buildMetaError(error, 'Instagram execution failed.', 'adapter_publish');
        }
    }

    async _publishSingleImage(imageUrl, caption, postType = 'post') {
        this._assertPublicMediaUrl(imageUrl, ['jpg', 'jpeg', 'png']);

        // 1. Create Media Container
        const payload = {
            image_url: imageUrl,
            access_token: this.accessToken
        };
        
        if (postType === 'story') {
            payload.media_type = 'STORIES';
        } else {
            payload.caption = caption;
        }

        const containerRes = await axios.post(`${this.baseUrl}/${this.id}/media`, payload);
        const creationId = containerRes.data.id;

        // 2. Poll for readiness (Wait for Meta to process the public URL)
        await this._pollStatus(creationId, 30, 2000); // 1 minute max for single image

        // 3. Publish Media
        return await this._executePublish(creationId);
    }

    async _publishCarousel(imageUrls, caption) {
        for (const url of imageUrls) {
            this._assertPublicMediaUrl(url, ['jpg', 'jpeg', 'png']);
        }

        // 1. Create individual item containers
        const itemIds = [];
        for (const url of imageUrls) {
            const itemRes = await axios.post(`${this.baseUrl}/${this.id}/media`, {
                image_url: url,
                is_carousel_item: true,
                access_token: this.accessToken
            });
            const itemId = itemRes.data.id;
            await this._pollStatus(itemId, 15, 2000); // Wait for item
            itemIds.push(itemId);
        }

        // 2. Create the parent carousel container
        const carouselRes = await axios.post(`${this.baseUrl}/${this.id}/media`, {
            caption: caption,
            media_type: 'CAROUSEL',
            children: itemIds,
            access_token: this.accessToken
        });
        const creationId = carouselRes.data.id;
        await this._pollStatus(creationId, 15, 2000);

        // 3. Final Publish
        return await this._executePublish(creationId);
    }

    /**
     * Internal: Publishes a single Video (Reel, Story, or Post)
     */
    async _publishVideo(videoUrl, caption, postType = 'post') {
        // Validation
        this._assertPublicMediaUrl(videoUrl, ['mp4', 'mov']);

        // 1. Create Media Container
        // Meta Rule: Use 'VIDEO' for Reels/Feed and 'STORIES' for stories.
        const isStory = postType === 'story';
        const payload = {
            media_type: isStory ? 'STORIES' : 'VIDEO',
            video_url: videoUrl,
            access_token: this.accessToken
        };

        if (!isStory) {
            payload.caption = caption;
            // For Reels, we can also set share_to_feed or thumb_offset
            // payload.share_to_feed = true; 
        }

        const containerRes = await axios.post(`${this.baseUrl}/${this.id}/media`, payload);
        const creationId = containerRes.data.id;

        // 2. POLLING: IG Video processing takes time (15s to 3 mins)
        // More retries for videos as they take longer than images.
        const maxRetries = isStory ? 60 : 120; // Up to 4 minutes for Reels
        await this._pollStatus(creationId, maxRetries, 2000);

        // 3. Publish
        return await this._executePublish(creationId);
    }

    async _executePublish(creationId) {
        try {
            const publishRes = await axios.post(`${this.baseUrl}/${this.id}/media_publish`, {
                creation_id: creationId,
                access_token: this.accessToken
            });
            return publishRes.data.id;
        } catch (error) {
            throw this._buildMetaError(error, 'Failed to publish media container.', 'publish_media');
        }
    }

    async _pollStatus(creationId, retries = 20, pollIntervalMs = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                const statusRes = await this.getContainerStatus(creationId);
                const statusCode = statusRes.status_code || statusRes.status;

                if (statusCode === 'FINISHED') return true;
                
                if (statusCode === 'ERROR') {
                    throw new InstagramPublishError(`Meta reported processing ERROR for container ${creationId}`, {
                        step: 'polling',
                        code: 'MEDIA_PROCESSING_ERROR',
                        metaResponse: statusRes
                    });
                }

                // If still IN_PROGRESS or similar, wait and retry
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

            } catch (err) {
                if (err instanceof InstagramPublishError) throw err;
                // Network errors during polling are ignored until retries run out
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            }
        }

        throw new InstagramPublishError('Instagram media processing timed out.', {
            step: 'polling',
            code: 'POLLING_TIMEOUT',
            isRetryable: true
        });
    }

    /**
     * Fetches post metrics (Impressions, Reach, Engagement)
     */
    async getMetrics(platformPostId) {
        try {
            const res = await axios.get(`${this.baseUrl}/${platformPostId}/insights`, {
                params: {
                    metric: 'impressions,reach,engagement,saved',
                    access_token: this.accessToken
                }
            });
            return res.data;
        } catch (error) {
            return null; // Metrics shouldn't break the flow
        }
    }

    async deletePost(platformPostId) {
        if (!platformPostId) {
            throw new InstagramPublishError('Instagram deletePost: platformPostId is required.', {
                step: 'delete_media',
                code: 'MISSING_PLATFORM_POST_ID'
            });
        }

        let lastError = null;
        try {
            await axios.delete(`${this.baseUrl}/${platformPostId}`, {
                params: { access_token: this.accessToken }
            });
            return true;
        } catch (error) {
            if (this._isAlreadyDeleted(error)) {
                return true;
            }
            lastError = error;
        }

        try {
            await axios.post(`${this.baseUrl}/${platformPostId}`, null, {
                params: {
                    method: 'delete',
                    access_token: this.accessToken
                }
            });
            return true;
        } catch (error) {
            if (this._isAlreadyDeleted(error)) {
                return true;
            }
            lastError = error;
            throw this._buildMetaError(
                lastError,
                `Failed to delete Instagram media ${platformPostId}.`,
                'delete_media'
            );
        }
    }

    _isAlreadyDeleted(error) {
        const status = error?.response?.status || null;
        const metaError = error?.response?.data?.error || {};
        const message = (metaError.message || error?.message || '').toLowerCase();

        return status === 404 || status === 410 || (
            metaError.code === 100 &&
            message.includes('does not exist') &&
            !message.includes('does not support this operation') &&
            !message.includes('missing permissions')
        );
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Publishes a single Video (Reel, Story, or Post)
     */
    async _publishVideo(videoUrl, caption, postType = 'post') {
        const isStory = postType === 'story';
        const isReel = postType === 'reel';

        // 1. Create Media Container
        const payload = {
            media_type: isStory ? 'STORIES' : (isReel ? 'REELS' : 'VIDEO'),
            video_url: videoUrl,
            access_token: this.accessToken
        };

        if (isReel || postType === 'post') {
            payload.caption = caption;
            if (isReel) payload.share_to_feed = true; // Typical for reels
        }

        const containerRes = await axios.post(`${this.baseUrl}/${this.id}/media`, payload);
        const creationId = containerRes.data.id;

        // 2. Poll Status (Longer for reels)
        await this._pollStatus(creationId, isReel ? 120 : 80, 2000);

        // 3. Final Publish
        return await this._executePublish(creationId);
    }

    /**
     * Final step: Publish the created container
     */
    async _executePublish(creationId) {
        const res = await axios.post(`${this.baseUrl}/${this.id}/media_publish`, {
            creation_id: creationId,
            access_token: this.accessToken
        });
        return res.data.id;
    }

    _assertPublicMediaUrl(url, allowedExts = []) {
        if (!url || typeof url !== 'string') throw new Error('Invalid Media URL');
        if (!url.startsWith('http')) throw new Error('Media URL must be public HTTPS');
    }
}

module.exports = InstagramAdapter;
module.exports.InstagramPublishError = InstagramPublishError;
module.exports.InstagramPublishError = InstagramPublishError;
