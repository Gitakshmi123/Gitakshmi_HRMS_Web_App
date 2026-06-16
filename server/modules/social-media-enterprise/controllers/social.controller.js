const SocialAuthService = require('../services/SocialAuthService');
const SocialCampaignService = require('../services/SocialCampaignService');
const SocialPostService = require('../services/SocialPostService');
const SocialAnalyticsService = require('../services/SocialAnalyticsService');
const SocialDashboardService = require('../services/SocialDashboardService');
const getTenantDB = require('../../../utils/tenantDB');

const isPublicImageUrl = (value) => {
    try {
        const parsed = new URL(value);
        const hostname = parsed.hostname.toLowerCase();
        const privateHost = (
            parsed.protocol !== 'https:' ||
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname.endsWith('.local') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
        );

        if (privateHost) return false;

        const extension = parsed.pathname.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png'].includes(extension);
    } catch (error) {
        return false;
    }
};

/**
 * Helper to safely derive branchId 
 */
const resolveSafeBranchId = async (req, db, companyId) => {
    // 1. Check from various request locations
    let branchId = req.query?.branchId || req.body?.branchId || req.user?.branch || req.user?.branchId || req.branchId;

    // 2. If branch is missing, fallback to companyId to prevent 'Branch context missing' errors
    if (!branchId) {
        branchId = companyId;
    }
    return branchId;
};

const getRedirectUri = (req, platform) => {
    // 1. Check override from .env
    const envUri = platform === 'linkedin' ? process.env.LINKEDIN_REDIRECT_URI : process.env.FACEBOOK_REDIRECT_URI;
    if (envUri) return envUri; // Return as-is because OAuth providers require exact matches.

    // 2. Dynamic Fallback (Multi-environment safe)
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = process.env.BACKEND_URL || `${protocol}://${host.includes(':') ? host : host + ':' + (process.env.PORT || 5003)}`;
    if (platform === 'linkedin') {
        return `${baseUrl}/api/social-media-enterprise/oauth/linkedin/callback`;
    }
    return `${baseUrl}/api/social-media-enterprise/oauth/callback`;
};

/**
 * Enterprise Social Media Controller
 */
const socialController = {
    /**
     * OAuth Initiation
     */
    initiateOAuth: async (req, res) => {
        const platform = req.query?.platform || req.params?.platform;
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;

        if (!platform) {
            return res.status(400).json({ success: false, message: "Platform parameter missing (facebook, instagram, or linkedin required)." });
        }

        if (!companyId) {
            return res.status(400).json({ success: false, message: "Authentication context missing. Cannot derive tenant." });
        }

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);
            const redirectUri = getRedirectUri(req, platform);

/*
            console.log("SOCIAL CONNECT CONTEXT [INITIATE]", {
                user: req.user?.id,
                companyId,
                branchId,
                role: req.user?.role,
                platform,
                redirectUri
            });
*/

            if (!branchId) {
                return res.status(400).json({
                    success: false,
                    message: "Branch context missing. Please ensure at least one Branch exists in your HRMS Settings."
                });
            }

            // Encode the entire state variable via base64url to avoid URL truncation/colon-split 
            // issues with complex returnUrls that contain their own colons (e.g. localhost ports)
            const returnUrl = req.query.returnUrl || '';
            const stateObj = { c: companyId, b: branchId, p: platform, r: returnUrl };
            const combinedState = encodeURIComponent(Buffer.from(JSON.stringify(stateObj)).toString('base64'));

            let url = '';
            if (platform === 'facebook' || platform === 'instagram') {
                // Scope update for Reels and Insights support
                url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${combinedState}&scope=pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,business_management`;
            } else if (platform === 'linkedin') {
                url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${combinedState}&scope=openid,profile,email,w_member_social`;
            }

            if (!url) {
                return res.status(400).json({ success: false, message: `Invalid platform: ${platform}` });
            }

            res.json({ url });
        } catch (error) {
            console.error("Initiate OAuth Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * OAuth Callback
     */
    handleCallback: async (req, res) => {
        const { code, state } = req.query;
        let tenantId, branchId, platform, returnUrl;

        const fallbackUrl = process.env.FRONTEND_URL || 'http://localhost:5176';

        try {
            // Decode state: base64 JSON { c: companyId, b: branchId, p: platform, r: returnUrl }
            if (state && !state.includes(':')) {
                const raw = Buffer.from(state, 'base64').toString('utf8');
                const decodedState = JSON.parse(raw);
                tenantId = decodedState.c;
                branchId = decodedState.b;
                platform = decodedState.p;
                returnUrl = decodedState.r;
            } else if (state && state.includes(':')) {
                [tenantId, branchId, platform] = state.split(':');
            }
        } catch (e) {
            // console.error("State decode error", e);
            [tenantId, branchId, platform] = (state || '').split(':');
        }

        const finalRedirectBase = returnUrl || fallbackUrl;
        const redirectAccounts = `${finalRedirectBase}/hr/settings/social-media/accounts`;

        if (!tenantId || !branchId || !platform) {
            // console.error("SOCIAL CONNECT CONTEXT [CALLBACK] Missing state:", { tenantId, branchId, platform });
            return res.redirect(`${redirectAccounts}?connected=false&message=${encodeURIComponent('Invalid or missing OAuth state. Please try connecting again from Social Media settings.')}`);
        }

        // console.log("SOCIAL CONNECT CONTEXT [CALLBACK]", { tenantId, branchId, platform });

        try {
            const db = await getTenantDB(tenantId);
            const authService = new SocialAuthService(db);
            const redirectUri = getRedirectUri(req, platform);

            let accounts = [];
            if (platform === 'linkedin') {
                accounts = await authService.handleLinkedInOAuth(code, tenantId, branchId, redirectUri);
            } else {
                accounts = await authService.handleMetaOAuth(code, tenantId, branchId, redirectUri);
            }

            // Redirect back to frontend
            res.redirect(`${redirectAccounts}?connected=true&platform=${platform}&count=${accounts?.length || 0}`);
        } catch (error) {
            /*
            console.error('OAuth Callback Error:', {
                message: error.message,
                platform
            });
            */
            res.redirect(`${redirectAccounts}?connected=false&message=${encodeURIComponent(error.message)}`);
        }
    },

    /**
     * Get Accounts
     */
    getAccounts: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;

        try {
            const db = await getTenantDB(companyId);
            // console.log(`[SOCIAL_DEBUG] getAccounts | db resolved | companyId: ${companyId}`);
            const branchId = await resolveSafeBranchId(req, db, companyId);
            // console.log(`[SOCIAL_DEBUG] getAccounts | branchId: ${branchId}`);

            if (!branchId) {
                // If no branch exists, don't crash, just return empty list
                return res.json([]);
            }

            const authService = new SocialAuthService(db);
            const SocialAccount = db.model('SocialAccountEnterprise', require('../../../models/social/SocialAccount'));
            const accounts = await SocialAccount.find({
                branch: branchId,
                status: { $ne: 'disconnected' }
            });
            res.json(accounts);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    /**
     * Create Campaign / Post
     */
    createPost: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);

            // console.log("SOCIAL CONTEXT [CREATE_POST]", { companyId, branchId });

            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch context missing." });
            }

            const postService = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);

            const result = await campaignService.createCampaign({
                ...req.body,
                userId: req.user.id,
                tenantId: companyId,
                branchId: branchId
            });

            if (!result.success && !req.body.scheduledAt) {
                return res.status(400).json(result);
            }

            res.status(result.success ? 200 : 201).json(result);
        } catch (error) {
            console.error("CREATE_POST_ERROR:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * POST /instagram/post
     * Creates a one-off Instagram Business publishing job backed by campaign/history records.
     */
    postToInstagram: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { access_token, image_url, caption = '', ig_user_id, account_name, expires_in } = req.body || {};

        if (!access_token) {
            return res.status(400).json({ success: false, message: 'access_token is required.' });
        }
        if (!ig_user_id) {
            return res.status(400).json({ success: false, message: 'ig_user_id is required.' });
        }
        if (!image_url || !isPublicImageUrl(image_url)) {
            return res.status(400).json({
                success: false,
                message: 'image_url must be a public HTTPS JPG or PNG URL.'
            });
        }

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);

            if (!branchId) {
                return res.status(400).json({ success: false, message: 'Branch context missing.' });
            }

            const authService = new SocialAuthService(db);
            const postService = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);

            const account = await authService.upsertManualInstagramAccount({
                tenantId: companyId,
                branchId,
                igUserId: ig_user_id,
                accessToken: access_token,
                accountName: account_name || 'Instagram Business',
                expiresAt: expires_in ? new Date(Date.now() + (Number(expires_in) * 1000)) : null
            });

            const result = await campaignService.createCampaign({
                content: caption,
                media: [{ url: image_url, type: 'image', name: 'Instagram Graph API Image' }],
                postType: 'post',
                userId: req.user.id,
                tenantId: companyId,
                branchId,
                accountIds: [account._id]
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            const history = await campaignService.getCampaignWithPosts(result.campaignId);
            res.status(result.success ? 202 : 400).json({
                success: result.success,
                message: result.message,
                status: result.status,
                campaignId: result.campaignId,
                post: history.posts?.[0] || null
            });
        } catch (error) {
            // console.error('[INSTAGRAM_POST] Error:', error);
            res.status(500).json({
                success: false,
                message: error.message,
                error: error.metaResponse || null
            });
        }
    },

    /**
     * Get History
     */
    getHistory: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);

            // console.log("SOCIAL CONTEXT [GET_HISTORY]", { companyId, branchId });

            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch context missing." });
            }

            const postService = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);

            const history = await campaignService.getBranchHistory(companyId, branchId);
            res.json(history);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    /**
     * Delete Post / Campaign
     * Deletes remotely first, then removes local records only after success.
     */
    deletePost: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { id } = req.params;

        try {
            const db = await getTenantDB(companyId);
            const postService = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);

            // Ownership check before responding
            const SocialCampaign = db.model('SocialCampaign', require('../../../models/social/SocialCampaign'));
            const campaign = await SocialCampaign.findById(id);
            if (!campaign) return res.status(404).json({ message: "Campaign not found" });

            const branchId = await resolveSafeBranchId(req, db, companyId);
            if (campaign.branch.toString() !== branchId.toString()) {
                return res.status(403).json({ message: "Forbidden: You cannot delete campaigns from another branch." });
            }

            const result = await campaignService.deleteCampaign(id);
            if (!result.success) {
                return res.status(409).json(result);
            }

            res.json(result);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    /**
     * Delete Single Post
     * Deletes a single social post from its platform and the database.
     */
    deleteSinglePost: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { id } = req.params;

        try {
            const db = await getTenantDB(companyId);
            const postService = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);
            const SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));
            const post = await SocialPost.findById(id);

            if (!post) {
                return res.status(404).json({ success: false, message: 'Post not found' });
            }

            const branchId = await resolveSafeBranchId(req, db, companyId);
            if (post.branch.toString() !== branchId.toString()) {
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot delete posts from another branch.' });
            }

            const result = await campaignService.deleteSinglePost(id);
            if (!result.success) {
                return res.status(409).json(result);
            }
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Disconnect Social Account
     */
    disconnectAccount: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { platform } = req.params;

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);

            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch context missing." });
            }

            const SocialAccount = db.model('SocialAccountEnterprise', require('../../../models/social/SocialAccount'));

            // Delete account(s) for this platform in this branch
            const result = await SocialAccount.deleteMany({
                tenant: companyId,
                branch: branchId,
                platform: platform.toLowerCase()
            });

            res.json({
                success: true,
                message: `${platform} disconnected successfully`,
                deletedCount: result.deletedCount
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    /**
     * Get Analytics
     */
    getAnalytics: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { platform, range } = req.query;

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);

            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch context missing." });
            }

            const analyticsService = new SocialAnalyticsService(db);
            const data = await analyticsService.getAggregatedAnalytics(companyId, branchId, platform, range);
            const summary = await analyticsService.getDashboardSummary(companyId, branchId, platform);

            res.json({ success: true, data, summary });
        } catch (error) {
            // console.error('[SOCIAL_CONTROLLER] getAnalytics error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Update Post / Campaign
     * Responds instantly after DB update. Platform sync runs in background.
     */
    updatePost: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { id } = req.params;

        /*
        console.log(`\n========== [UPDATE_POST] START ==========`);
        console.log(`[UPDATE_POST] Campaign ID: ${id}`);
        console.log(`[UPDATE_POST] req.body.content: "${(req.body.content || '').substring(0, 80)}..."`);
        console.log(`[UPDATE_POST] req.body.postUpdates count: ${req.body.postUpdates?.length || 0}`);
        console.log(`[UPDATE_POST] req.body.postUpdates:`, JSON.stringify(req.body.postUpdates || [], null, 2));
        */

        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);

            const postService = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);

            // Apply DB changes synchronously (instant response)
            const result = await campaignService.updateCampaignDBOnly(id, req.body);
            // console.log(`[UPDATE_POST] DB update done. Campaign media count: ${result.campaign?.media?.length || 0}`);

            // Respond immediately
            res.json({ success: true, message: 'Campaign updated. Syncing to platforms in background...', campaign: result.campaign });

            // Build postUpdatesMap for per-account caption lookup in syncUpdateToPlatforms
            // postUpdates = [{ postId, caption }] sent by the Edit modal
            const postUpdatesMap = {};
            if (Array.isArray(req.body.postUpdates)) {
                req.body.postUpdates.forEach(({ postId, caption }) => {
                    if (postId) postUpdatesMap[postId] = caption ?? '';
                });
            }
            // console.log(`[UPDATE_POST] postUpdatesMap keys: ${Object.keys(postUpdatesMap).length}`);
            // console.log(`[UPDATE_POST] Firing syncUpdateToPlatforms...`);

            // Fire-and-forget platform sync — pass both global content AND per-post map
            setImmediate(() => {
                campaignService.syncUpdateToPlatforms(
                    id,
                    req.body.content,
                    result.campaign,
                    Object.keys(postUpdatesMap).length > 0 ? postUpdatesMap : null
                ).then(() => {
                    // console.log(`[UPDATE_POST] ✅ syncUpdateToPlatforms COMPLETED for campaign ${id}`);
                    // console.log(`========== [UPDATE_POST] END ==========\n`);
                }).catch(err => {
                    // console.error(`[UPDATE_POST] ❌ syncUpdateToPlatforms FAILED for campaign ${id}:`, err.message);
                    // console.error(`[UPDATE_POST] Full error:`, err.stack || err);
                    // console.log(`========== [UPDATE_POST] END (ERROR) ==========\n`);
                });
            });
        } catch (error) {
            console.error(`[UPDATE_POST] ❌ Controller error:`, error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * POST /post/:id/retry
     * Retries a single failed SocialPost.
     * Deduplication: refuses to retry if already published or publishing.
     */
    retryPost: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { id } = req.params;

        console.log(`[RETRY_POST] Requested for post ${id} | tenant: ${companyId}`);

        try {
            const db = await getTenantDB(companyId);
            const postService     = new SocialPostService(db);
            const campaignService = new SocialCampaignService(db, postService);

            const result = await campaignService.retrySinglePost(id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            console.log(`[RETRY_POST] ✅ Success for post ${id}`);
            res.json(result);
        } catch (error) {
            console.error(`[RETRY_POST] ❌ Error for post ${id}:`, error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get Dashboard Stats (Dynamic)
     */
    getDashboardStats: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        const { platform } = req.query;
        // console.log(`[SOCIAL_DEBUG] getDashboardStats START | Platform: ${platform} | Company: ${companyId}`);
        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);
            const stats = await SocialDashboardService.getStats(db, companyId, branchId, platform);
            // console.log(`[SOCIAL_DEBUG] getDashboardStats SUCCESS | Tenant: ${companyId}`);
            res.json({ success: true, stats });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * GET /analytics/dashboard
     * Returns aggregated engagement totals + posts array for the dashboard.
     */
    getAnalyticsDashboard: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        try {
            const db = await getTenantDB(companyId);
            const branchId = await resolveSafeBranchId(req, db, companyId);
            const mongoose = require('mongoose');

            const SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));
            // console.log(`[SOCIAL_DEBUG] SocialPost model initialized for tenant: ${companyId}`);

            const { platform } = req.query;

            const query = {
                tenant: new mongoose.Types.ObjectId(companyId),
                status: { $in: ['published', 'completed'] } // Only successful posts for engagement
            };
            if (branchId) query.branch = new mongoose.Types.ObjectId(branchId);
            if (platform && platform !== 'all') query.platform = platform;

            // Get all published posts for the posts array and total calculation
            const posts = await SocialPost.find(query).sort({ publishedAt: -1 }).lean();

            // Calculate totals
            const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
            const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
            const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
            const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);

            // console.log(`[SOCIAL_CONTROLLER] getAnalyticsDashboard SUCCESS | Tenant: ${companyId} | Posts: ${posts?.length || 0}`);
            res.json({
                success: true,
                totalLikes,
                totalComments,
                totalShares,
                totalViews,
                posts: posts.map(p => ({
                    _id: p._id,
                    platform: p.platform,
                    caption: p.caption,
                    mediaUrls: p.mediaUrls,
                    likes: p.likes || 0,
                    comments: p.comments || 0,
                    shares: p.shares || 0,
                    views: p.views || 0,
                    impressions: p.impressions || 0,
                    reach: p.reach || 0,
                    status: p.status,
                    publishedAt: p.publishedAt,
                    createdAt: p.createdAt
                }))
            });
        } catch (error) {
            // console.error('[SOCIAL_CONTROLLER] getAnalyticsDashboard error:', error);
            res.status(500).json({
                success: false,
                totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0,
                posts: []
            });
        }
    },

    /**
     * Upload Media (Image/Video/URL)
     */
    /**
     * Upload Media (Image/Video/URL)
     */
    uploadMedia: async (req, res) => {
        try {
            // [HARD-DEBUG] - Total Transparency
            /*
            console.log("\n=======================================");
            console.log("🚀 [MEDIA_UPLOAD] INCOMING REQUEST");
            console.log("=======================================");
            console.log("TIMESTAMP:", new Date().toISOString());
            console.log("HEADERS:", JSON.stringify(req.headers, null, 2));
            console.log("BODY:", JSON.stringify(req.body, null, 2));

            // Check files parsed by Multer
            if (req.files) {
                console.log(`[MEDIA_UPLOAD] Files detected: ${req.files.length}`);
                req.files.forEach((f, i) => {
                    console.log(`[FILE ${i}]:`, {
                        fieldname: f.fieldname,
                        originalname: f.originalname,
                        path: f.path,
                        mimetype: f.mimetype
                    });
                });
            } else if (req.file) {
                console.log("[MEDIA_UPLOAD] Single file detected:", req.file.originalname);
            } else {
                console.warn("⚠️ [MEDIA_UPLOAD] No files detected in req.files or req.file");
            }
            */

            const CloudinaryService = require('../services/CloudinaryService');
            const MediaDownloadService = require('../services/MediaDownloadService');
            const mediaResults = [];

            // Validation Guard
            if ((!req.files || req.files.length === 0) && !req.body.imageUrl) {
                // console.error("❌ [MEDIA_UPLOAD] REJECTED: No media content found (file or URL)");
                return res.status(400).json({
                    success: false,
                    error: "EMPTY_UPLOAD",
                    message: "No file was found. Ensure your FormData key is 'media'."
                });
            }

            // 1. Process Physical Files
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    try {
                        // console.log(`[MEDIA_UPLOAD] ☁️ Uploading to Cloudinary: ${file.originalname}`);
                        const cloudRes = await CloudinaryService.uploadFile(file.path, true);
                        mediaResults.push({
                            url: cloudRes.url,
                            type: file.mimetype.startsWith('video') ? 'video' : 'image',
                            name: file.originalname
                        });
                    } catch (uploadErr) {
                        // console.error(`❌ [MEDIA_UPLOAD] Cloudinary FAILURE for ${file.originalname}:`, uploadErr.message);
                        throw uploadErr; // Propagate to outer catch
                    }
                }
            }

            // 2. Process URL
            if (req.body.imageUrl) {
                try {
                    // console.log(`[MEDIA_UPLOAD] 🌐 Downloading from URL: ${req.body.imageUrl}`);
                    const downloadRes = await MediaDownloadService.downloadImage(req.body.imageUrl);
                    mediaResults.push({
                        url: downloadRes.url,
                        type: 'image',
                        name: 'External Image'
                    });
                } catch (urlErr) {
                    // console.error("❌ [MEDIA_UPLOAD] URL Download FAILURE:", urlErr.message);
                    throw urlErr;
                }
            }

            // console.log(`✅ [MEDIA_UPLOAD] SUCCESS: ${mediaResults.length} items processed`);
            // console.log("=======================================\n");

            res.json({
                success: true,
                media: mediaResults
            });

        } catch (error) {
            // console.error("❌ [MEDIA_UPLOAD] CRITICAL ERROR:", error);
            res.status(500).json({
                success: false,
                message: error.message,
                details: error,
                diagnostics: {
                    cloud_name_used: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key_present: !!process.env.CLOUDINARY_API_KEY,
                    api_secret_present: !!process.env.CLOUDINARY_API_SECRET
                }
            });
        }
    },

    /**
     * Process and merge Video + Audio for Stories/Reels
     */
    processMedia: async (req, res) => {
        try {
            const MediaProcessingService = require('../services/MediaProcessingService');
            const CloudinaryService = require('../services/CloudinaryService');
            const path = require('path');
            
            const videoFile = req.files['video'] ? req.files['video'][0] : null;
            const audioFile = req.files['audio'] ? req.files['audio'][0] : null;

            if (!videoFile || !audioFile) {
                return res.status(400).json({ success: false, message: 'Both video and audio files are required for merging.' });
            }

            const outputPath = path.join(process.cwd(), 'uploads', `merged-${Date.now()}.mp4`);

            // Async processing (doesn't block Node.js)
            await MediaProcessingService.mergeAudioVideo(videoFile.path, audioFile.path, outputPath);

            // Upload the newly merged video to Cloudinary
            const result = await CloudinaryService.uploadFile(outputPath, true);

            // Clean up all local files (inputs and output)
            MediaProcessingService.cleanupFiles([videoFile.path, audioFile.path, outputPath]);

            return res.json({ 
                success: true, 
                media: [{
                    url: result.url,
                    type: 'video',
                    name: `Merged-${videoFile.originalname}`,
                    key: result.public_id
                }]
            });

        } catch (error) {
            const MediaProcessingService = require('../services/MediaProcessingService');
            // console.error('Media Processing Error:', error.message);
            
            // Cleanup local files on failure
            const filesToClean = [];
            if (req.files?.['video']) filesToClean.push(req.files['video'][0].path);
            if (req.files?.['audio']) filesToClean.push(req.files['audio'][0].path);
            MediaProcessingService.cleanupFiles(filesToClean);

            res.status(500).json({ success: false, message: 'Failed to process media', error: error.message });
        }
    },

    /**
     * Diagnostic Test: Verify Cloudinary Credentials
     */
    testCloudinary: async (req, res) => {
        try {
            const CloudinaryService = require('../services/CloudinaryService');
            // console.log("[SOCIAL_CONTROLLER] Running /cloudinary-test...");
            const result = await CloudinaryService.testConfig();
            res.json({
                success: true,
                message: "Cloudinary Configuration is VALID.",
                url: result.secure_url,
                diagnostics: {
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret_present: !!process.env.CLOUDINARY_API_SECRET
                }
            });
        } catch (error) {
            console.error("❌ CLOUDINARY_TEST_FAILED:", error);
            res.status(500).json({
                success: false,
                message: "Cloudinary Configuration FAILED.",
                error: error.message,
                diagnostics: {
                    cloud_name_used: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key_used: process.env.CLOUDINARY_API_KEY,
                    api_secret_present: !!process.env.CLOUDINARY_API_SECRET
                }
            });
        }
    },    // ← comma added: separates testCloudinary from syncAnalytics
    /**
     * POST /analytics/sync
     * Manually trigger engagement metrics sync for this tenant.
     */
    syncAnalytics: async (req, res) => {
        const companyId = req.user?.company || req.tenantId || req.user?.tenantId;
        try {
            const db = await getTenantDB(companyId);
            const analyticsService = new SocialAnalyticsService(db);
            const count = await analyticsService.syncMetricsForTenant();
            const branchId = await resolveSafeBranchId(req, db, companyId);
            const summary = await analyticsService.getDashboardSummary(companyId, branchId);
            res.json({ success: true, synced: count, summary });
        } catch (error) {
            console.error('[SOCIAL_CONTROLLER] syncAnalytics error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = socialController;
