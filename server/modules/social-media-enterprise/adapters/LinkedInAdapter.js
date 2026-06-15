const axios = require('axios');

/**
 * LinkedIn Adapter — v2 ugcPosts API
 *
 * URN formats:
 *   Person profile:  urn:li:person:XXXXXXXX
 *   Organization:    urn:li:organization:XXXXXXXX
 *   Post ID:         urn:li:ugcPost:XXXXXXXXXXXXXXXXX
 *
 * EDIT RULES (strictly enforced):
 *   - updatePost()  → PATCH /v2/ugcPosts/{postId}  (X-Restli-Method: PARTIAL_UPDATE)
 *   - NEVER calls publishPost() during an edit
 *   - If PATCH fails → caller (SocialPostService) handles delete + repost fallback
 *
 * DELETE RULES:
 *   - deletePost()  → DELETE /v2/ugcPosts/{postId}
 */
class LinkedInAdapter {
    constructor(accessToken, accountUrn) {
        this.accessToken = accessToken;
        this.accountUrn = accountUrn; // 'urn:li:person:ABC' or 'urn:li:organization:XYZ'
        this.baseUrl = 'https://api.linkedin.com/v2';
    }

    _normalizePostUrn(platformPostId) {
        return decodeURIComponent(String(platformPostId || '').trim());
    }

    _extractAssetId(assetUrn) {
        const normalized = decodeURIComponent(String(assetUrn || '').trim());
        if (!normalized) return '';
        return normalized.includes(':') ? normalized.split(':').pop() : normalized;
    }

    _classifyAssetState(assetData = {}) {
        const overallStatus = String(assetData.status || '').toUpperCase();
        const recipeStatus = String(assetData.recipes?.[0]?.status || '').toUpperCase();
        const effectiveStatus = recipeStatus || overallStatus;

        const readyStatuses = new Set(['READY', 'AVAILABLE']);
        const processingStatuses = new Set(['PROCESSING', 'WAITING_UPLOAD', 'MUTATING']);
        const failedStatuses = new Set(['FAILED', 'CLIENT_ERROR', 'SERVER_ERROR', 'INCOMPLETE', 'PROCESSING_FAILED']);
        const blockedOverallStatuses = new Set(['BLOCKED', 'ABANDONED', 'DELETED', 'SCHEDULED_DELETION']);

        if (blockedOverallStatuses.has(overallStatus) || failedStatuses.has(effectiveStatus)) {
            return { state: 'failed', overallStatus, recipeStatus, effectiveStatus };
        }

        if (readyStatuses.has(effectiveStatus) || (overallStatus === 'ALLOWED' && !recipeStatus)) {
            return { state: 'ready', overallStatus, recipeStatus, effectiveStatus };
        }

        if (processingStatuses.has(effectiveStatus) || overallStatus === 'ALLOWED') {
            return { state: 'processing', overallStatus, recipeStatus, effectiveStatus };
        }

        return { state: 'processing', overallStatus, recipeStatus, effectiveStatus };
    }

    /**
     * Publishes a NEW post to LinkedIn.
     * Called ONLY during initial campaign publish or Instagram-style repost.
     * NEVER called during an edit — use updatePost() instead.
     *
     * @param {Object} postData { content, media }
     * @returns {string} URN — e.g. "urn:li:ugcPost:1234567890123456789"
     */
    /**
     * Publishes a NEW post to LinkedIn.
     * Handles both IMAGE and VIDEO content with proper asset registration.
     */
    async publishPost(postData) {
        const { content, media = [] } = postData;

        if (!content?.trim()) {
            throw new Error('Post content (commentary) is required for LinkedIn');
        }

        // 1. Process and upload media assets
        const mediaAssets = [];
        let shareMediaCategory = 'NONE';

        if (media.length > 0) {
            const firstItem = media[0];
            const type = firstItem.type?.toLowerCase();

            if (type === 'video') {
                const assetUrn = await this._uploadVideoAsset(firstItem.url, postData.existingAssetUrn);
                mediaAssets.push(assetUrn);
                shareMediaCategory = 'VIDEO';
            } else if (type === 'image') {
                const assetUrn = await this._uploadImageAsset(firstItem.url);
                mediaAssets.push(assetUrn);
                shareMediaCategory = 'IMAGE';
            }
        }

        // 2. Build UGC Post Payload
        const payload = {
            author: this.accountUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text: content },
                    shareMediaCategory: shareMediaCategory,
                    media: mediaAssets.map(asset => ({
                        status: 'READY',
                        media: asset,
                        title: { text: content.substring(0, 30) }
                    }))
                }
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
        };

        try {
            const res = await axios.post(`${this.baseUrl}/ugcPosts`, payload, {
                headers: this._headers()
            });

            const postUrn = res.data.id || res.headers['x-restli-id'];
            if (!postUrn) throw new Error('LinkedIn did not return a post URN');
            return postUrn;
        } catch (error) {
            const errorData = error.response?.data;
            throw new Error(`LinkedIn publishPost failed: ${errorData?.message || error.message}`);
        }
    }

    /**
     * Updates the text/commentary of an existing LinkedIn post via PATCH.
     */
    async updatePost(platformPostId, newText) {
        if (!platformPostId) throw new Error('LinkedIn updatePost: platformPostId is required');
        if (!newText?.trim()) throw new Error('LinkedIn updatePost: newText cannot be empty');

        const URN = this._normalizePostUrn(platformPostId);
        const patchPayload = {
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: { text: newText }
                }
            }
        };

        try {
            await axios.patch(`${this.baseUrl}/ugcPosts/${encodeURIComponent(URN)}`, patchPayload, { 
                headers: this._headers() 
            });
            return URN;
        } catch (error) {
            // If PATCH fails, we use the Restli POST fallback
            try {
                await axios.post(`${this.baseUrl}/ugcPosts/${encodeURIComponent(URN)}`, 
                    { patch: { "$set": patchPayload } }, 
                    { headers: { ...this._headers(), 'X-Restli-Method': 'PARTIAL_UPDATE' } }
                );
                return URN;
            } catch (e2) {
                throw new Error(`LinkedIn updatePost failed: ${e2.message}`);
            }
        }
    }

    /**
     * Deletes a LinkedIn post by its URN.
     */
    async deletePost(platformPostId) {
        if (!platformPostId) throw new Error('LinkedIn deletePost: platformPostId is required');
        const URN = this._normalizePostUrn(platformPostId);
        const encodedUrn = encodeURIComponent(URN);
        const deleteAttempts = [
            `${this.baseUrl}/ugcPosts/${encodedUrn}`
        ];

        if (URN.startsWith('urn:li:share:')) {
            deleteAttempts.push(`${this.baseUrl}/shares/${encodedUrn}`);
            deleteAttempts.push(`${this.baseUrl}/shares/${encodeURIComponent(URN.split(':').pop())}`);
        }

        let lastError = null;

        for (const endpoint of deleteAttempts) {
            try {
                await axios.delete(endpoint, { headers: this._headers() });
                return true;
            } catch (error) {
                const status = error.response?.status;
                if (status === 404 || status === 410) {
                    return true;
                }
                lastError = error;
            }
        }

        const responseMessage = lastError?.response?.data?.message || lastError?.message || 'Unknown LinkedIn delete error';
        throw new Error(`LinkedIn deletePost failed for ${URN}: ${responseMessage}`);
    }

    async getMetrics(platformPostId) {
        if (!platformPostId) return null;
        try {
            const res = await axios.get(`${this.baseUrl}/socialActions/${encodeURIComponent(platformPostId)}`, {
                headers: this._headers()
            });
            return {
                likes: res.data.likesSummary?.totalLikes || 0,
                comments: res.data.commentsSummary?.totalComments || 0
            };
        } catch (error) {
            return null;
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    _headers() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json'
        };
    }

    /**
     * LinkedIn Video Upload Flow (3-Step)
     * Supports resuming if an assetUrn is already registered.
     */
    async _uploadVideoAsset(videoUrl, existingAssetUrn = null) {
        let assetUrn = existingAssetUrn;
        let uploadUrl = null;

        // STEP 1: Register Upload (Only if we don't have an assetUrn)
        if (!assetUrn) {
            const registerRes = await axios.post(`${this.baseUrl}/assets?action=registerUpload`, {
                registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
                    owner: this.accountUrn,
                    serviceRelationships: [{
                        relationshipType: 'OWNER',
                        identifier: 'urn:li:userGeneratedContent'
                    }]
                }
            }, { headers: this._headers() });

            uploadUrl = registerRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
            assetUrn = registerRes.data.value.asset;

            // Notify caller that we just got a new assetUrn so they can persist it for resume logic
            if (this.onAssetRegistered) {
                await this.onAssetRegistered(assetUrn);
            }
        } else {
            // If we have an assetUrn but no uploadUrl, we might still need to upload the binary
            // However, LinkedIn rarely gives the uploadUrl back for an existing asset.
            // Normally, if we survived registration, we proceed to Step 3 (Polling)
            // to see if it's already uploaded.
            const status = await this._getAssetStatus(assetUrn);
            if (status.state === 'ready') return assetUrn;
            
            // If it's NOT ready, we might need the uploadUrl again. 
            // In LinkedIn v2, if you lose the uploadUrl, you usually have to re-register.
            // So for simplicity, we resume at Step 3 (Polling).
            // If polling fails or says it's not uploaded, the caller should handle re-registration.
            return await this._resumeVideoUpload(assetUrn, videoUrl);
        }

        // STEP 2: Stream binary to LinkedIn with local retry
        let uploadSuccess = false;
        let lastErr = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Fetch direct from URL as stream to save memory
                const videoStream = await axios.get(videoUrl, { responseType: 'stream' });
                
                await axios.put(uploadUrl, videoStream.data, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/octet-stream'
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                uploadSuccess = true;
                break;
            } catch (err) {
                lastErr = err;
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }

        if (!uploadSuccess) throw new Error(`LinkedIn video binary upload failed after 3 attempts: ${lastErr.message}`);

        // STEP 3: Poll for READY status (LinkedIn processing)
        await this._pollAssetStatus(assetUrn);
        return assetUrn;
    }

    async _uploadImageAsset(imageUrl) {
        const registerRes = await axios.post(`${this.baseUrl}/assets?action=registerUpload`, {
            registerUploadRequest: {
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                owner: this.accountUrn,
                serviceRelationships: [{
                    relationshipType: 'OWNER',
                    identifier: 'urn:li:userGeneratedContent'
                }]
            }
        }, { headers: this._headers() });

        const uploadUrl = registerRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const assetUrn = registerRes.data.value.asset;

        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        await axios.put(uploadUrl, imageRes.data, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/octet-stream'
            }
        });

        return assetUrn;
    }

    async _getAssetStatus(assetUrn) {
        try {
            const assetId = this._extractAssetId(assetUrn);
            const res = await axios.get(`${this.baseUrl}/assets/${encodeURIComponent(assetId)}`, {
                headers: this._headers()
            });
            return {
                ...this._classifyAssetState(res.data),
                raw: res.data,
                assetId
            };
        } catch (e) {
            return {
                state: 'failed',
                overallStatus: 'NOT_FOUND',
                recipeStatus: '',
                effectiveStatus: 'NOT_FOUND',
                raw: e?.response?.data || null,
                assetId: this._extractAssetId(assetUrn)
            };
        }
    }

    async _resumeVideoUpload(assetUrn, videoUrl) {
        const status = await this._getAssetStatus(assetUrn);
        if (status.state === 'ready') return assetUrn;
        if (status.state === 'failed') {
            throw new Error(`LinkedIn video asset is not usable (${status.effectiveStatus || status.overallStatus || 'UNKNOWN'}).`);
        }
        
        // If it's still PROCESSING or waiting, we just poll.
        // If we never uploaded the binary, LinkedIn will eventually mark it as FAILED.
        await this._pollAssetStatus(assetUrn);
        return assetUrn;
    }

    async _pollAssetStatus(assetUrn, retries = 60) {
        for (let i = 0; i < retries; i++) {
            try {
                const status = await this._getAssetStatus(assetUrn);

                if (status.state === 'ready') return true;
                if (status.state === 'failed') {
                    throw new Error(
                        `LinkedIn video processing failed (${status.effectiveStatus || status.overallStatus || 'UNKNOWN'}): ${JSON.stringify(status.raw?.statusDetails || status.raw || 'No details')}`
                    );
                }
            } catch (err) {
                // Ignore transient network errors during polling
                if (i === retries - 1) throw err;
            }
            
            await new Promise(r => setTimeout(r, 5000));
        }
        throw new Error('LinkedIn video processing timed out after 5 minutes.');
    }
}

module.exports = LinkedInAdapter;
module.exports.LinkedInPublishError = class extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'LinkedInPublishError';
        this.details = details;
    }
};
