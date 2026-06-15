const axios = require('axios');

/**
 * Facebook Page Adapter using Meta Graph API
 */
class FacebookAdapter {
    constructor(accessToken, pageId) {
        this.accessToken = accessToken;
        this.id = pageId;
        this.baseUrl = 'https://graph.facebook.com/v19.0';
    }

    /**
     * Publishes a post to Facebook Page
     * @param {Object} postData { content, media }
     * @returns {Promise<string>} platformPostId
     */
    async publishPost(postData) {
        try {
            const { content, media = [], postType = 'post' } = postData;
            const video = media.find(m => m.type === 'video');
            const images = media.filter(m => m.type === 'image');

            // Production Rule: Meta require absolute HTTPS public URLs
            this._validateMediaUrls(media);

            if (video) {
                return await this._publishVideo(video.url, content, postType);
            } else if (images.length > 0) {
                return await this._publishPhotos(images.map(img => img.url), content, postType);
            } else {
                return await this._publishFeed(content);
            }
        } catch (error) {
            const errorData = error.response?.data?.error || {};
            const message = errorData.message || error.message;
            const code = errorData.code;
            const subcode = errorData.error_subcode;

            console.error('Facebook API Error Details:', JSON.stringify(errorData, null, 2));

            if (code === 324 || subcode === 2069019) {
                throw new Error("Facebook Publish Failed: Image Required. The provided image URL is either invalid or unreachable by Meta's servers (localhost URLs are not allowed).");
            }

            throw new Error(`Facebook Platform Error: ${message} (Code: ${code})`);
        }
    }

    _validateMediaUrls(media) {
        if (!media || media.length === 0) return;

        for (const item of media) {
            const url = item.url?.toLowerCase() || '';
            if (url.includes('localhost') || url.includes('127.0.0.1')) {
                throw new Error("Meta Graph API cannot access 'localhost'. The image MUST be hosted on a public HTTPS server (like Cloudinary) to be published.");
            }
            if (!url.startsWith('https://')) {
                throw new Error("Facebook and Instagram require secure HTTPS URLs for all media files.");
            }
        }
    }

    async _publishFeed(message, link) {
        const res = await axios.post(`${this.baseUrl}/${this.id}/feed`, {
            message: message,
            link: link,
            access_token: this.accessToken
        });
        return res.data.id;
    }

    async _publishPhotos(imageUrls, message, postType = 'post') {
        // Validation: Verify URLs are absolute and public (localhost check)
        for (const url of imageUrls) {
            if (url.includes('localhost') || url.includes('127.0.0.1')) {
                throw new Error("Facebook cannot access 'localhost'. Please use a public HTTPS URL or an Ngrok tunnel.");
            }
        }

        if (postType === 'story') {
             const res = await axios.post(`${this.baseUrl}/${this.id}/photo_stories`, {
                 url: imageUrls[0],
                 access_token: this.accessToken
             });
             return res.data.id;
        }

        if (imageUrls.length === 1) {
            const res = await axios.post(`${this.baseUrl}/${this.id}/photos`, {
                url: imageUrls[0],
                caption: message,
                access_token: this.accessToken
            });
            // CRITICAL: Use post_id (feed-level ID) for later editing, not photo id
            // Facebook returns { id: "photoId", post_id: "pageId_postId" }
            // The post_id is needed for caption editing via POST /{post_id}
            return res.data.post_id || res.data.id;
        }

        // Multi-photo post
        const attachedMedia = [];
        for (const url of imageUrls) {
            const uploadRes = await axios.post(`${this.baseUrl}/${this.id}/photos`, {
                url: url,
                published: false,
                access_token: this.accessToken
            });
            attachedMedia.push({ media_fbid: uploadRes.data.id });
        }

        const res = await axios.post(`${this.baseUrl}/${this.id}/feed`, {
            message: message,
            attached_media: attachedMedia,
            access_token: this.accessToken
        });
        return res.data.id;
    }

    async _publishVideo(videoUrl, description, postType = 'post') {
        // Regular videos can use the simple 1-step endpoint
        if (postType === 'post') {
            const res = await axios.post(`${this.baseUrl}/${this.id}/videos`, {
                file_url: videoUrl,
                description: description,
                access_token: this.accessToken
            });
            return res.data.post_id || res.data.id;
        }

        // Reels and Stories require the 3-step Resumable Upload API
        const endpoint = postType === 'reel' ? 'video_reels' : 'video_stories';

        // STEP 1: Initialize
        const startRes = await axios.post(`${this.baseUrl}/${this.id}/${endpoint}`, {
            upload_phase: 'start',
            access_token: this.accessToken
        });
        const videoId   = startRes.data.video_id;
        const uploadUrl = startRes.data.upload_url || `https://rupload.facebook.com/video-upload/v19.0/${videoId}`;

        // STEP 2: Upload (Server-to-Server pull via file_url parameter in headers)
        await axios.post(uploadUrl, null, {
            headers: {
                'Authorization': `OAuth ${this.accessToken}`,
                'file_url': videoUrl
            }
        });

        // POLLING: Wait for Facebook to process the video before finishing
        let isReady = false;
        let attempts = 0;
        while (!isReady && attempts < 15) {
            await new Promise(r => setTimeout(r, 4000)); // wait 4 seconds
            try {
                const statRes = await axios.get(`https://graph.facebook.com/v19.0/${videoId}?fields=status&access_token=${this.accessToken}`);
                const statusStr = statRes.data?.status?.video_status?.toLowerCase();
                
                if (statusStr === 'ready' || statusStr === 'published') {
                    isReady = true;
                } else if (statusStr === 'error') {
                    throw new Error('Facebook video processing failed.');
                }
            } catch (pollErr) {
                console.warn(`[FacebookAdapter] Video status poll error:`, pollErr.message);
            }
            attempts++;
        }

        // STEP 3: Finish and Publish
        const finishPayload = {
            upload_phase: 'finish',
            video_id: videoId,
            video_state: 'PUBLISHED',
            access_token: this.accessToken
        };
        if (postType === 'reel' && description) {
            finishPayload.description = description;
        }

        const finishRes = await axios.post(`${this.baseUrl}/${this.id}/${endpoint}`, finishPayload);
        
        // Return post_id if available, otherwise fallback to videoId
        return finishRes.data?.post_id || finishRes.data?.id || videoId;
    }

    /**
     * Deletes a Facebook post.
     * DELETE /{post-id}?access_token=...
     */
    async deletePost(platformPostId) {
        const candidates = this._buildDeleteCandidates(platformPostId);
        let lastError = null;

        for (const candidateId of candidates) {
            for (const method of ['delete', 'post_method_delete']) {
                try {
                    if (method === 'delete') {
                        await axios.delete(`${this.baseUrl}/${candidateId}`, {
                            params: { access_token: this.accessToken }
                        });
                    } else {
                        await axios.post(`${this.baseUrl}/${candidateId}`, null, {
                            params: {
                                method: 'delete',
                                access_token: this.accessToken
                            }
                        });
                    }
                    console.log(`[Facebook] Deleted post: ${candidateId}`);
                    return true;
                } catch (error) {
                    if (candidateId === candidates[0] && this._isAlreadyDeleted(error)) {
                        console.warn(`[Facebook] deletePost: post ${candidateId} already gone, treating as success`);
                        return true;
                    }
                    lastError = error;
                }
            }
        }

        const errorData = lastError?.response?.data?.error || {};
        const status = lastError?.response?.status;
        throw new Error(`Facebook deletePost failed (${status || 'unknown'}) for ${candidates.join(', ')}: ${errorData.message || lastError?.message || 'Unknown error'}`);
    }

    _buildDeleteCandidates(platformPostId) {
        const raw = String(platformPostId || '').trim();
        const candidates = [raw];

        if (raw.includes('_')) {
            const parts = raw.split('_').filter(Boolean);
            const suffix = parts[parts.length - 1];
            if (suffix) candidates.push(suffix);
        }

        return [...new Set(candidates.filter(Boolean))];
    }

    _isAlreadyDeleted(error) {
        const errorData = error?.response?.data?.error || {};
        const status = error?.response?.status;
        const message = (errorData.message || error?.message || '').toLowerCase();

        return status === 404 || status === 410 || (
            errorData.code === 100 &&
            message.includes('does not exist') &&
            !message.includes('does not support this operation') &&
            !message.includes('missing permissions')
        );
    }

    /**
     * Updates the message (caption) of an existing Facebook post.
     *
     * CRITICAL: Facebook Graph API requires message & access_token as QUERY PARAMS,
     * NOT as a JSON body. Axios sends JSON by default — must use `params` instead.
     *
     * Correct endpoint:
     *   POST https://graph.facebook.com/v19.0/{post-id}
     *   params: { message: "new text", access_token: "TOKEN" }
     *
     * Required permission: pages_manage_posts
     */
    async updatePost(platformPostId, newText) {
        try {
            await axios.post(
                `${this.baseUrl}/${platformPostId}`,
                null,   // ← NO JSON body (Facebook ignores JSON body for this endpoint)
                {
                    params: {
                        message: newText,
                        access_token: this.accessToken
                    }
                }
            );
            console.log(`[Facebook] Updated post in-place: ${platformPostId}`);
            return platformPostId;
        } catch (error) {
            const errorData = error.response?.data?.error || {};
            const status = error.response?.status;

            console.error(`[Facebook] updatePost error for ${platformPostId}:`, JSON.stringify(errorData, null, 2));

            if (status === 403 || errorData.code === 200) {
                throw new Error(`Facebook (403): Permission denied — ensure pages_manage_posts permission is granted for this page.`);
            }
            if (status === 100 || errorData.code === 100) {
                throw new Error(`Facebook (100): Post not found — platformPostId may be stale: ${platformPostId}`);
            }
            if (errorData.code === 368) {
                throw new Error(`Facebook (368): Post editing is not supported for this post type (e.g. video posts cannot have caption edited via API).`);
            }

            throw new Error(`Facebook updatePost failed (${status}): ${errorData.message || error.message}`);
        }
    }

    async getMetrics(platformPostId) {
        const res = await axios.get(`${this.baseUrl}/${platformPostId}/insights`, {
            params: {
                metric: 'post_impressions,post_engaged_users,post_reactions_by_type_total',
                access_token: this.accessToken
            }
        });
        return res.data;
    }
}

module.exports = FacebookAdapter;
