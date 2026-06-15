const axios = require('axios');
const { decrypt } = require('../utils/crypto');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const logFile = path.join(__dirname, '../../../../DEBUG_SOCIAL.log');

const logSocial = (msg, data = null) => {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${msg} ${data ? JSON.stringify(data) : ''}\n`;
        fs.appendFileSync(logFile, logEntry);
    } catch (e) { /* ignore */ }
};

class PlatformService {
    constructor(account) {
        this.account = account;
        this.accessToken = decrypt(account.accessToken);
        this.userToken = account.refreshToken ? decrypt(account.refreshToken) : null;
    }

    async createPost(data) { throw new Error('Not implemented'); }
}

class LinkedInService extends PlatformService {
    /**
     * Upload image to LinkedIn using 3-step process
     * Step 1: Register upload
     * Step 2: Download image from our server
     * Step 3: Upload binary to LinkedIn CDN
     */
    async uploadImageToLinkedIn(imageUrl) {
        try {
            console.log('📸 LinkedIn: Starting image upload process...');
            console.log('   Image URL:', imageUrl);

            // Step 1: Register upload with LinkedIn
            console.log('   Step 1/3: Registering upload...');
            const registerPayload = {
                registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                    owner: `urn:li:person:${this.account.platformUserId}`,
                    serviceRelationships: [{
                        relationshipType: 'OWNER',
                        identifier: 'urn:li:userGeneratedContent'
                    }]
                }
            };

            const registerResponse = await axios.post(
                'https://api.linkedin.com/v2/assets?action=registerUpload',
                registerPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Restli-Protocol-Version': '2.0.0'
                    }
                }
            );

            const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
            const asset = registerResponse.data.value.asset;
            console.log('   ✅ Upload registered, asset:', asset);

            // Step 2: Download image from our server
            console.log('   Step 2/3: Downloading image from server...');
            const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
            const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${backendUrl}${imageUrl}`;

            const imageResponse = await axios.get(fullImageUrl, {
                responseType: 'arraybuffer'
            });
            console.log('   ✅ Image downloaded, size:', imageResponse.data.length, 'bytes');

            // Step 3: Upload image binary to LinkedIn CDN
            console.log('   Step 3/3: Uploading to LinkedIn CDN...');
            await axios.put(uploadUrl, imageResponse.data, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg'
                }
            });
            console.log('   ✅ Image uploaded to LinkedIn CDN');

            return asset; // Return the asset URN
        } catch (error) {
            console.error('❌ LinkedIn image upload failed:', error.response?.data || error.message);
            if (error.response?.data) {
                console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    async createPost({ content, imageUrl, imageUrls, link }) {
        try {
            console.log('📤 LinkedIn: Creating post...');
            console.log('   Content:', content?.substring(0, 50) + '...');
            console.log('   Images:', imageUrls ? imageUrls.length : (imageUrl ? 1 : 0));
            console.log('   Link:', link || 'none');

            const mediaItems = [];

            // Handle multiple images
            if (imageUrls && imageUrls.length > 0) {
                console.log(`   Processing ${imageUrls.length} images...`);
                for (const url of imageUrls) {
                    try {
                        const asset = await this.uploadImageToLinkedIn(url);
                        mediaItems.push({
                            status: 'READY',
                            description: { text: content },
                            media: asset,
                            title: { text: 'Image' }
                        });
                    } catch (err) {
                        console.error('   ⚠️ Failed to upload one image, skipping:', url);
                    }
                }
            }
            // Fallback to single image
            else if (imageUrl) {
                try {
                    const asset = await this.uploadImageToLinkedIn(imageUrl);
                    mediaItems.push({
                        status: 'READY',
                        description: { text: content },
                        media: asset,
                        title: { text: 'Image' }
                    });
                } catch (err) {
                    console.error('⚠️ Failed to upload image:', imageUrl);
                }
            }

            // LinkedIn Share API v2 - Personal posts
            const payload = {
                author: `urn:li:person:${this.account.platformUserId}`,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: content
                        },
                        shareMediaCategory: mediaItems.length > 0 ? 'IMAGE' : (link ? 'ARTICLE' : 'NONE')
                    }
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            };

            // Add media items
            if (mediaItems.length > 0) {
                payload.specificContent['com.linkedin.ugc.ShareContent'].media = mediaItems;
            }
            // Add article link if no images
            else if (link) {
                payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
                    status: 'READY',
                    originalUrl: link
                }];
            }

            console.log('   Posting to LinkedIn API...');
            const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            console.log('✅ LinkedIn post created:', response.data.id);
            return { success: true, id: response.data.id };
        } catch (error) {
            console.error('❌ LinkedIn post failed:', error.response?.data || error.message);
            if (error.response?.data) {
                console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
            }
            return { success: false, error: error.response?.data?.message || error.message };
        }
    }

    async deletePost(urn) {
        try {
            console.log('🗑️ LinkedIn: Deleting post...', urn);

            // Extract URN if it's in full ID format
            // e.g., urn:li:share:123 or urn:li:ugcPost:123
            if (!urn) return { success: false, error: 'No URN provided' };

            // URNs MUST be URL encoded in the path (urn:li:ugcPost:123 -> urn%3Ali%3AugcPost%3A123)
            // But first decode in case it came in encoded, then encode for the URL
            const cleanUrn = decodeURIComponent(urn);
            const encodedUrn = encodeURIComponent(cleanUrn);

            await axios.delete(`https://api.linkedin.com/v2/ugcPosts/${encodedUrn}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            console.log('✅ LinkedIn post deleted:', urn);
            return { success: true };
        } catch (error) {
            // If 404, consider it already deleted
            if (error.response?.status === 404) {
                console.log('⚠️ LinkedIn post not found (already deleted):', urn);
                return { success: true };
            }

            // Try alternative endpoint if it's a "share" URN and ugcPosts failed
            if (urn.includes('urn:li:share:')) {
                try {
                    console.log('🔄 Retrying with /shares endpoint...');
                    const cleanUrn = decodeURIComponent(urn);
                    const encodedUrn = encodeURIComponent(cleanUrn);

                    await axios.delete(`https://api.linkedin.com/v2/shares/${encodedUrn}`, {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'X-Restli-Protocol-Version': '2.0.0'
                        }
                    });
                    console.log('✅ LinkedIn share deleted:', urn);
                    return { success: true };
                } catch (shareError) {
                    console.error('❌ LinkedIn share delete also failed:', shareError.message);
                }
            }

            console.error('❌ LinkedIn delete failed:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

class FacebookService extends PlatformService {
    async createPost({ content, imageUrl, imageUrls, link }) {
        try {
            console.log('📤 Facebook: Creating post...');
            logSocial('Facebook: Creating Post', { content, imageUrl, imageUrls, link });

            // Helper function to upload a single image (without publishing)
            const uploadImage = async (imgUrl) => {
                const isLocal = !imgUrl.startsWith('http') ||
                    imgUrl.includes('localhost') ||
                    imgUrl.includes('127.0.0.1') ||
                    imgUrl.includes('::1');

                let endpoint = `https://graph.facebook.com/v19.0/${this.account.pageId}/photos`;
                let payload;
                let headers = {};

                if (isLocal) {
                    // Resolve local path
                    const filename = imgUrl.split('/').pop();
                    const localPath = path.join(process.cwd(), 'uploads', 'social-posts', filename);

                    if (!fs.existsSync(localPath)) {
                        throw new Error(`Local image file not found: ${localPath}`);
                    }

                    const form = new FormData();
                    form.append('source', fs.createReadStream(localPath));
                    form.append('published', 'false'); // Important for multi-image
                    form.append('access_token', this.accessToken);

                    payload = form;
                    headers = form.getHeaders();
                } else {
                    payload = {
                        url: imgUrl,
                        published: false, // Important for multi-image
                        access_token: this.accessToken
                    };
                }

                const res = await axios.post(endpoint, payload, { headers });
                // Return media_fbid (id)
                return res.data.id;
            };

            // CASE 1: Multiple Images
            if (imageUrls && imageUrls.length > 1) {
                console.log(`   Processing ${imageUrls.length} images for Facebook Album...`);
                const uploadedMedia = [];

                for (const imgUrl of imageUrls) {
                    try {
                        const mediaId = await uploadImage(imgUrl);
                        uploadedMedia.push({ media_fbid: mediaId });
                        console.log('   ✅ Image uploaded, ID:', mediaId);
                    } catch (err) {
                        console.error('   ⚠️ Failed to upload one image, skipping:', imgUrl, err.message);
                    }
                }

                if (uploadedMedia.length === 0) {
                    throw new Error('Failed to upload any images for the album.');
                }

                // Final Feed Post with attached_media
                console.log('   Publishing Multi-Image Feed Post...');
                const feedEndpoint = `https://graph.facebook.com/v19.0/${this.account.pageId}/feed`;
                const feedPayload = {
                    message: content,
                    attached_media: uploadedMedia,
                    access_token: this.accessToken
                };

                const response = await axios.post(feedEndpoint, feedPayload);
                console.log('✅ Facebook multi-image post created:', response.data.id);
                logSocial('Facebook Response (Multi)', response.data);

                return { success: true, id: response.data.id };
            }

            // CASE 2: Single Image or No Image
            const finalImageUrl = imageUrl || (imageUrls && imageUrls.length > 0 ? imageUrls[0] : null);

            let endpoint;
            let payload;
            let headers = {};

            if (finalImageUrl) {
                // SINGLE IMAGE POST (POST directly to /photos with caption)
                const isLocal = !finalImageUrl.startsWith('http') ||
                    finalImageUrl.includes('localhost') ||
                    finalImageUrl.includes('127.0.0.1') ||
                    finalImageUrl.includes('::1');

                endpoint = `https://graph.facebook.com/v19.0/${this.account.pageId}/photos`;

                if (isLocal) {
                    const filename = finalImageUrl.split('/').pop();
                    const localPath = path.join(process.cwd(), 'uploads', 'social-posts', filename);

                    if (!fs.existsSync(localPath)) {
                        throw new Error(`Local image file not found: ${localPath}`);
                    }

                    const form = new FormData();
                    form.append('source', fs.createReadStream(localPath));
                    form.append('caption', content || '');
                    form.append('access_token', this.accessToken);

                    payload = form;
                    headers = form.getHeaders();

                    logSocial('Facebook Payload (Multipart)', { endpoint, localPath });
                } else {
                    payload = {
                        url: finalImageUrl,
                        caption: content,
                        access_token: this.accessToken
                    };
                    logSocial('Facebook Payload (JSON)', { endpoint, payload: { ...payload, access_token: 'REDACTED' } });
                }
            } else {
                // FEED POST (Text or Link)
                endpoint = `https://graph.facebook.com/v19.0/${this.account.pageId}/feed`;
                payload = {
                    message: content,
                    access_token: this.accessToken
                };
                if (link) {
                    payload.link = link;
                }
                logSocial('Facebook Payload (JSON)', { endpoint, payload: { ...payload, access_token: 'REDACTED' } });
            }

            const response = await axios.post(endpoint, payload, { headers });

            console.log('✅ Facebook post created:', response.data.id);
            logSocial('Facebook Response', response.data);

            return { success: true, id: response.data.post_id || response.data.id };

        } catch (error) {
            console.error('❌ Facebook post failed:', error.response?.data || error.message);
            logSocial('Facebook Error', error.response?.data || error.message);
            return { success: false, error: error.response?.data?.error?.message || error.message };
        }
    }

    async deletePost(postId) {
        try {
            console.log('🗑️ Facebook: Deleting post...', postId);
            if (!postId) return { success: false, error: 'No Post ID provided' };

            await axios.delete(`https://graph.facebook.com/v19.0/${postId}`, {
                params: { access_token: this.accessToken }
            });

            console.log('✅ Facebook post deleted:', postId);
            return { success: true };
        } catch (error) {
            if (error.response?.status === 404) { // Already deleted
                return { success: true };
            }
            console.error('❌ Facebook delete failed:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

class InstagramService extends PlatformService {
    /**
     * Validate image URL before sending to Meta
     * - Must be HTTPS
     * - Must be publicly accessible
     * - Must return 200 status
     * - Must not redirect
     * - Must have correct content-type (image/jpeg, image/png)
     */
    async validateImageUrl(imageUrl) {
        try {
            console.log('🔍 Instagram: Validating image URL...', imageUrl);

            // Check if HTTPS
            if (!imageUrl.startsWith('https://')) {
                return {
                    valid: false,
                    error: 'Image URL must be HTTPS (not HTTP). Instagram requires secure URLs.'
                };
            }

            // Check if publicly accessible using HEAD request
            const headResponse = await axios.head(imageUrl, {
                maxRedirects: 0, // Don't follow redirects
                validateStatus: (status) => status === 200 || status === 301 || status === 302
            });

            // Check status
            if (headResponse.status !== 200) {
                return {
                    valid: false,
                    error: `Image URL returned status ${headResponse.status}. Must return 200 OK.`
                };
            }

            // Check content-type
            const contentType = headResponse.headers['content-type'];
            if (!contentType || !contentType.startsWith('image')) {
                return {
                    valid: false,
                    error: `Invalid content-type: ${contentType}. Must be image/jpeg or image/png.`
                };
            }

            console.log('   ✅ Image URL validation passed:', {
                status: headResponse.status,
                contentType: contentType
            });

            return { valid: true };

        } catch (error) {
            console.error('   ❌ Image URL validation failed:', error.message);

            if (error.code === 'ENOTFOUND') {
                return { valid: false, error: 'Image URL domain not found. Check if URL is correct.' };
            }
            if (error.code === 'ECONNREFUSED') {
                return { valid: false, error: 'Connection refused. Image URL is not accessible.' };
            }
            if (error.response?.status === 404) {
                return { valid: false, error: 'Image not found (404). Check if URL is correct.' };
            }
            if (error.response?.status === 403) {
                return { valid: false, error: 'Access forbidden (403). Image URL must be publicly accessible.' };
            }

            return {
                valid: false,
                error: `Image URL validation failed: ${error.message}`
            };
        }
    }

    /**
     * Get the correct Page Access Token for a specific Instagram Business Account ID.
     * Uses the stored Long-lived User Access Token to find the Page mapping.
     */
    async getValidTokenForOwner(ownerIgId) {
        try {
            if (!this.userToken) {
                console.error('❌ Instagram: No User Access Token found in refreshToken field.');
                return null;
            }

            console.log('🔑 Instagram: Finding Page Token for Owner ID:', ownerIgId);

            // Fetch User's Pages and their connected IG Business Accounts
            const response = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
                params: {
                    fields: 'access_token,instagram_business_account',
                    access_token: this.userToken
                }
            });

            const pages = response.data.data;
            const matchingPage = pages.find(p => p.instagram_business_account?.id === ownerIgId);

            if (!matchingPage) {
                console.error('❌ Instagram: Could not find a linked Facebook Page for Owner ID:', ownerIgId);
                return null;
            }

            console.log(`   ✅ Found matching Page: ${matchingPage.id} for IG Account: ${ownerIgId}`);
            return matchingPage.access_token;
        } catch (error) {
            console.error('❌ Instagram: Error retrieving token for owner:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Get Page Access Token (PAT) for the current account (fallback)
     */
    async getPageAccessToken() {
        try {
            const pageId = this.account.pageId;
            if (!pageId) {
                console.error('❌ Instagram: No linked Facebook Page ID found');
                return null;
            }

            console.log('🔑 Instagram: Fetching Page Access Token for Page:', pageId);

            // The this.accessToken in PlatformService is decrypted. 
            // In SocialAccount, we store the Page Token as 'accessToken' during OAuth.
            // However, to be extra safe and ensure we have a fresh token with correct scopes,
            // we try to verify/fetch it from the /me/accounts or /{page-id} endpoint.

            const response = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
                params: {
                    fields: 'access_token',
                    access_token: this.accessToken
                }
            });

            const pageAccessToken = response.data.access_token;
            if (!pageAccessToken) {
                console.error('❌ Instagram: Failed to retrieve Page Access Token from API');
                return null;
            }

            console.log('   ✅ Page Access Token retrieved successfully');
            return pageAccessToken;
        } catch (error) {
            console.error('❌ Instagram: Error fetching Page Access Token:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Convert local image path to public URL
     */
    convertToPublicUrl(imageUrl) {
        if (!imageUrl) return null;

        // Already a full URL
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        // Relative path - convert to absolute
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5003}`;
        const publicUrl = imageUrl.startsWith('/') ? `${backendUrl}${imageUrl}` : `${backendUrl}/${imageUrl}`;

        return publicUrl;
    }

    async createPost({ content, imageUrl, imageUrls, link }) {
        try {
            console.log('📤 Instagram: Creating post...');
            console.log('   Content:', content?.substring(0, 50) + '...');
            console.log('   Single Image:', imageUrl || 'none');
            console.log('   Multiple Images:', imageUrls?.length || 0);

            // Prepare image URLs (convert local paths to public URLs)
            const allImageUrls = [];

            if (imageUrls && imageUrls.length > 0) {
                // Multiple images provided
                imageUrls.forEach(url => {
                    const publicUrl = this.convertToPublicUrl(url);
                    if (publicUrl) allImageUrls.push(publicUrl);
                });
            } else if (imageUrl) {
                // Single image provided
                const publicUrl = this.convertToPublicUrl(imageUrl);
                if (publicUrl) allImageUrls.push(publicUrl);
            } else if (link) {
                // Fallback to link as image
                allImageUrls.push(link);
            }

            // Validate we have at least one image
            if (allImageUrls.length === 0) {
                console.error('❌ Instagram: No image URL provided');
                return {
                    success: false,
                    platform: 'instagram',
                    error: 'Instagram requires at least one image. Text-only posts are not supported.'
                };
            }

            // Instagram carousel limit is 10 images
            if (allImageUrls.length > 10) {
                console.warn('⚠️ Instagram: Too many images, limiting to 10');
                allImageUrls.splice(10);
            }

            console.log(`📸 Processing ${allImageUrls.length} image(s) for Instagram...`);

            // Validate all image URLs
            for (let i = 0; i < allImageUrls.length; i++) {
                const validation = await this.validateImageUrl(allImageUrls[i]);
                if (!validation.valid) {
                    console.error(`❌ Instagram: Image ${i + 1} validation failed:`, validation.error);

                    // Check if it's a localhost error
                    if (validation.error.includes('localhost') || validation.error.includes('HTTPS')) {
                        return {
                            success: false,
                            platform: 'instagram',
                            error: `Image ${i + 1}: ${validation.error}\n\n💡 TIP: Instagram requires publicly accessible HTTPS URLs. For local development, use ngrok or deploy to a public server.`
                        };
                    }

                    return {
                        success: false,
                        platform: 'instagram',
                        error: `Image ${i + 1}: ${validation.error}`
                    };
                }
            }

            // Get Instagram Business Account ID
            const pageId = this.account.pageId;
            if (!pageId) {
                console.error('❌ Instagram: No linked Facebook Page ID');
                throw new Error("No linked Facebook Page ID found for this Instagram account.");
            }

            console.log('   Step 1: Fetching IG Business Account ID...');
            const accountRes = await axios.get(
                `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${this.accessToken}`
            );

            const igUserId = accountRes.data.instagram_business_account?.id;

            if (!igUserId) {
                console.error('❌ Instagram: No Instagram Business Account linked');
                throw new Error("No Instagram Business Account linked to this Page.");
            }

            console.log('   ✅ IG Business Account ID:', igUserId);

            // CAROUSEL vs SINGLE IMAGE LOGIC
            if (allImageUrls.length === 1) {
                // ========================================
                // SINGLE IMAGE POST
                // ========================================
                console.log('   Step 2: Creating single image container...');
                const containerResponse = await axios.post(
                    `https://graph.facebook.com/v19.0/${igUserId}/media`,
                    {
                        image_url: allImageUrls[0],
                        caption: content,
                        access_token: this.accessToken
                    }
                );

                const containerId = containerResponse.data.id;
                console.log('   ✅ Container created:', containerId);

                // Wait for Instagram to process
                console.log('   Step 3: Waiting for Instagram to process (3s)...');
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Publish with retry
                console.log('   Step 4: Publishing...');
                const publishResponse = await this.publishWithRetry(igUserId, containerId);

                return publishResponse;

            } else {
                // ========================================
                // CAROUSEL POST (2-10 images)
                // ========================================
                console.log(`   Step 2: Creating carousel with ${allImageUrls.length} images...`);

                // Create item containers for each image
                const itemContainerIds = [];

                for (let i = 0; i < allImageUrls.length; i++) {
                    console.log(`   Creating item container ${i + 1}/${allImageUrls.length}...`);

                    const itemResponse = await axios.post(
                        `https://graph.facebook.com/v19.0/${igUserId}/media`,
                        {
                            image_url: allImageUrls[i],
                            is_carousel_item: true,
                            access_token: this.accessToken
                        }
                    );

                    itemContainerIds.push(itemResponse.data.id);
                    console.log(`   ✅ Item ${i + 1} container:`, itemResponse.data.id);

                    // Small delay between item creations
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Create carousel container
                console.log('   Step 3: Creating carousel container...');
                const carouselResponse = await axios.post(
                    `https://graph.facebook.com/v19.0/${igUserId}/media`,
                    {
                        media_type: 'CAROUSEL',
                        children: itemContainerIds,
                        caption: content,
                        access_token: this.accessToken
                    }
                );

                const carouselContainerId = carouselResponse.data.id;
                console.log('   ✅ Carousel container created:', carouselContainerId);

                // Wait for Instagram to process all items
                console.log('   Step 4: Waiting for Instagram to process carousel (5s)...');
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Publish carousel with retry
                console.log('   Step 5: Publishing carousel...');
                const publishResponse = await this.publishWithRetry(igUserId, carouselContainerId);

                return publishResponse;
            }

        } catch (error) {
            console.error('❌ Instagram post failed:', error.response?.data || error.message);
            console.error('   Full error:', error.response?.data);

            return {
                success: false,
                platform: 'instagram',
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Publish media container with retry mechanism
     */
    async publishWithRetry(igUserId, containerId, maxAttempts = 2) {
        let publishError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`   Publishing attempt ${attempt}/${maxAttempts}...`);

                const publishResponse = await axios.post(
                    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
                    {
                        creation_id: containerId,
                        access_token: this.accessToken
                    }
                );

                console.log('✅ Instagram post published:', publishResponse.data.id);

                return {
                    success: true,
                    platform: 'instagram',
                    id: publishResponse.data.id,
                    igMediaId: publishResponse.data.id
                };

            } catch (error) {
                publishError = error;
                console.error(`   ❌ Attempt ${attempt} failed:`, error.response?.data || error.message);

                // If first attempt failed and we have more attempts, wait and retry
                if (attempt < maxAttempts) {
                    console.log('   ⏳ Waiting 3 seconds before retry...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        }

        // All attempts failed
        console.error('❌ Instagram: All publish attempts failed');
        return {
            success: false,
            platform: 'instagram',
            error: publishError.response?.data?.error?.message || publishError.message
        };
    }

    async deletePost(mediaId) {
        try {
            console.log('🗑️ Instagram: Deleting media...', mediaId);
            if (!mediaId) return { success: false, error: 'No Media ID provided' };

            // 1. Get the correct Page Access Token (PAT)
            // For Instagram Business Account management, we MUST use the Page Access Token 
            // of the Facebook Page linked to the Instagram Account.

            console.log('🔍 Instagram: Verifying media ownership and token...');

            // First, try to get the owner to find the right token if it's not the current one
            const mediaInfo = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
                params: {
                    fields: 'owner',
                    access_token: this.accessToken
                }
            });

            const ownerId = mediaInfo.data.owner?.id;
            let correctPat = this.accessToken; // Default to current stored token

            if (ownerId && ownerId !== this.account.platformUserId) {
                console.log(`   🔄 Owner mismatch (Owner: ${ownerId}, Account: ${this.account.platformUserId}). Fetching specific PAT...`);
                const dynamicToken = await this.getValidTokenForOwner(ownerId);
                if (dynamicToken) correctPat = dynamicToken;
            }

            // 2. Call Instagram Graph API DELETE endpoint
            // IMPORTANT: Meta's public documentation says DELETE is not supported for IG Media nodes.
            // However, ensuring the correct PAT is used is the first step to resolving #10 errors.
            console.log('   🚀 Sending DELETE request to Instagram Graph API...');
            await axios.delete(`https://graph.facebook.com/v19.0/${mediaId}`, {
                params: { access_token: correctPat }
            });

            console.log('✅ Instagram media deleted from platform:', mediaId);
            return { success: true };

        } catch (error) {
            const errorData = error.response?.data?.error || {};
            const errorMessage = errorData.message || error.message;
            const errorCode = errorData.code;
            const errorSubcode = errorData.error_subcode;

            console.error('❌ Instagram platform delete failed:', errorData);

            // CASE 1: Already deleted or doesn't exist
            if (error.response?.status === 404 || errorCode === 100 || errorMessage.includes('does not exist')) {
                console.log('⚠️ Instagram media not found (already deleted):', mediaId);
                return { success: true };
            }

            // CASE 2: Insufficient Permissions (The core issue)
            if (errorCode === 10 || errorSubcode === 2207001) {
                return {
                    success: false,
                    error: "Instagram Graph API does not support deleting published posts via the API. Please delete this post manually through the Instagram app.",
                    code: 10,
                    isApiLimitation: true
                };
            }

            return {
                success: false,
                error: errorMessage,
                code: errorCode
            };
        }
    }
}

class TwitterService extends PlatformService {
    async createPost({ content }) {
        if (content.length > 280) return { success: false, error: 'Twitter limit 280' };
        try {
            const response = await axios.post('https://api.twitter.com/2/tweets', { text: content }, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
            return { success: true, id: response.data.data.id };
        } catch (e) { return { success: false, error: e.message }; }
    }
}

module.exports = { LinkedInService, FacebookService, InstagramService, TwitterService };
