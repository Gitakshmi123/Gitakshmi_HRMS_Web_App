const SocialAccount = require('../models/SocialAccount');
const SocialPost = require('../models/SocialPost');
const { encrypt, decrypt } = require('../utils/crypto');
const { LinkedInService, FacebookService, InstagramService, TwitterService } = require('../services/platformServices');
const axios = require('axios');
const crypto = require('crypto');

const getService = (account) => {
    switch (account.platform) {
        case 'linkedin': return new LinkedInService(account);
        case 'facebook': return new FacebookService(account);
        case 'instagram': return new InstagramService(account);
        case 'twitter': return new TwitterService(account);
        default: return null;
    }
};

/**
 * LinkedIn OAuth Configuration
 */
const LINKEDIN_CONFIG = {
    clientId: process.env.LINKEDIN_CLIENT_ID || 'your_linkedin_client_id',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || 'your_linkedin_client_secret',
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social-media/linkedin/callback`,
    // User has "Share on LinkedIn" product approved - can use posting scope
    scope: 'openid profile email w_member_social',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    profileUrl: 'https://api.linkedin.com/v2/userinfo',
    profileUrl: 'https://api.linkedin.com/v2/userinfo',
    organizationsUrl: 'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName,id),roleAssignee~))'
};

/**
 * Facebook OAuth Configuration
 */
const FACEBOOK_CONFIG = {
    clientId: process.env.FACEBOOK_APP_ID || 'your_facebook_app_id',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'your_facebook_app_secret',
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social-media/facebook/callback`,
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userAccountsUrl: 'https://graph.facebook.com/v19.0/me/accounts'
};

/**
 * Generate state parameter for CSRF protection
 * @param {string} redirectPath - Where to redirect after OAuth (default: /hr/settings/social-media)
 */
function generateState(tenantId, userId, redirectPath = '/hr/settings/social-media') {
    const stateObj = {
        tenantId,
        userId,
        redirectPath,  // Store redirect destination for OAuth callback
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
    };
    return Buffer.from(JSON.stringify(stateObj)).toString('base64');
}

/**
 * Validate state parameter
 */
function validateState(state) {
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());

        // Check if state is not older than 10 minutes
        const age = Date.now() - decoded.timestamp;
        if (age > 10 * 60 * 1000) {
            throw new Error('State parameter expired');
        }

        return decoded;
    } catch (error) {
        throw new Error('Invalid state parameter');
    }
}

/**
 * Initiate LinkedIn OAuth flow
 * NO AUTH REQUIRED - Public endpoint
 */
exports.initiateLinkedInOAuth = async (req, res) => {
    try {
        // Get tenant and user from query params (passed from frontend)
        // Frontend should include these when redirecting
        const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
        const userId = req.query.userId;

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID is required. Please provide tenantId in query params.' });
        }

        console.log('🔵 LinkedIn OAuth Initiation (Public):', { tenantId, userId });

        // Generate state parameter for CSRF protection
        const state = generateState(tenantId, userId, '/hr/settings/social-media');

        // Build LinkedIn OAuth URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: LINKEDIN_CONFIG.clientId,
            redirect_uri: LINKEDIN_CONFIG.redirectUri,
            scope: LINKEDIN_CONFIG.scope,
            state: state
        });

        const authUrl = `${LINKEDIN_CONFIG.authUrl}?${params.toString()}`;

        console.log('🔵 Redirecting to LinkedIn:', authUrl);

        // Redirect user to LinkedIn authorization page
        res.redirect(authUrl);
    } catch (error) {
        console.error('❌ LinkedIn OAuth initiation failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Handle LinkedIn OAuth callback
 * ALWAYS redirects to frontend (never returns JSON)
 */
exports.handleLinkedInCallback = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        const { code, state, error, error_description } = req.query;

        console.log('🔵 LinkedIn Callback received:', {
            code: code ? 'present' : 'missing',
            state: state ? 'present' : 'missing',
            error,
            fullUrl: req.originalUrl
        });

        // Handle OAuth errors from LinkedIn
        if (error) {
            console.error('❌ LinkedIn OAuth error:', error, error_description);
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(error_description || error)}`);
        }

        // Missing code or state - redirect with error
        if (!code || !state) {
            console.error('❌ Missing code or state in callback');
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent('Missing authorization code or state')}`);
        }

        // Validate state parameter (CSRF protection)
        let stateData;
        try {
            stateData = validateState(state);
        } catch (stateError) {
            console.error('❌ State validation failed:', stateError.message);
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent('Invalid or expired state parameter')}`);
        }

        const { tenantId, userId } = stateData;
        console.log('🔵 State validated:', { tenantId, userId });

        // Exchange authorization code for access token
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: LINKEDIN_CONFIG.clientId,
            client_secret: LINKEDIN_CONFIG.clientSecret,
            redirect_uri: LINKEDIN_CONFIG.redirectUri
        });

        console.log('🔵 Exchanging code for token...', {
            redirect_uri: LINKEDIN_CONFIG.redirectUri,
            client_id: LINKEDIN_CONFIG.clientId
        });

        const tokenResponse = await axios.post(LINKEDIN_CONFIG.tokenUrl, tokenParams.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, expires_in, refresh_token } = tokenResponse.data;
        console.log('✅ Access token received');

        // Get user profile
        const profileResponse = await axios.get(LINKEDIN_CONFIG.profileUrl, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const profile = profileResponse.data;
        console.log('✅ Profile fetched:', profile.name || profile.sub);

        // Try to get organizations (company pages)
        let organizationName = profile.name || 'LinkedIn User';
        let organizationId = profile.sub;

        try {
            const orgsResponse = await axios.get(LINKEDIN_CONFIG.organizationsUrl, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            if (orgsResponse.data?.elements && orgsResponse.data.elements.length > 0) {
                const firstOrg = orgsResponse.data.elements[0];
                if (firstOrg['organization~']) {
                    organizationName = firstOrg['organization~'].localizedName;
                    organizationId = firstOrg['organization~'].id;
                }
            }
        } catch (orgError) {
            console.warn('⚠️ Could not fetch organizations, using profile:', orgError.message);
        }

        // Calculate expiration date
        const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

        // Store or update account in database
        const account = await SocialAccount.findOneAndUpdate(
            { tenantId, platform: 'linkedin' },
            {
                accessToken: encrypt(access_token),
                refreshToken: refresh_token ? encrypt(refresh_token) : null,
                expiresAt: expiresAt,
                platformUserId: profile.sub,
                platformUserName: profile.name || organizationName,
                pageId: organizationId,
                pageName: organizationName,
                isConnected: true,
                status: 'connected',
                connectedBy: userId || null
            },
            { upsert: true, new: true }
        );

        console.log('✅ LinkedIn account saved to database');

        // Redirect back to frontend with success message
        res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=success&platform=linkedin`);
    } catch (error) {
        console.error('❌ LinkedIn callback failed:', error.response?.data || error.message);
        console.error('Full error:', error);

        // ALWAYS redirect to frontend, even on error
        const errorMessage = error.response?.data?.error_description || error.message || 'OAuth callback failed';
        res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(errorMessage)}`);
    }
};

/**
 * Initiate Facebook OAuth flow
 */
exports.initiateFacebookOAuth = async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
        const userId = req.query.userId;

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID is required.' });
        }

        console.log('🔵 Facebook OAuth Initiation:', { tenantId, userId });
        const state = generateState(tenantId, userId, '/hr/settings/social-media');

        const params = new URLSearchParams({
            client_id: FACEBOOK_CONFIG.clientId,
            redirect_uri: FACEBOOK_CONFIG.redirectUri,
            state: state,
            scope: FACEBOOK_CONFIG.scope,
            response_type: 'code'
        });

        const authUrl = `${FACEBOOK_CONFIG.authUrl}?${params.toString()}`;
        console.log('🔵 Redirecting to Facebook:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('❌ Facebook OAuth initiation failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Handle Facebook OAuth callback
 */
exports.handleFacebookCallback = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../../../../DEBUG_SOCIAL.log');

    const logSocial = (msg, data = null) => {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${msg} ${data ? JSON.stringify(data) : ''}\n`;
            fs.appendFileSync(logFile, logEntry);
        } catch (e) { /* ignore */ }
    };

    try {
        const { code, state, error, error_description } = req.query;

        logSocial('Facebook Callback Params:', { code: !!code, state: !!state, error });

        if (error) {
            logSocial('Callback Error:', error);
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(error_description || error)}`);
        }
        if (!code || !state) {
            logSocial('Missing code or state');
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=Missing code or state`);
        }

        let stateData;
        try {
            stateData = validateState(state);
            logSocial('State Validated', { tenantId: stateData.tenantId });
        } catch (e) {
            logSocial('State Validation Failed:', e.message);
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(e.message)}`);
        }

        const { tenantId, userId } = stateData;

        // Exchange code for User Access Token
        const tokenResponse = await axios.get(FACEBOOK_CONFIG.tokenUrl, {
            params: {
                client_id: FACEBOOK_CONFIG.clientId,
                client_secret: FACEBOOK_CONFIG.clientSecret,
                redirect_uri: FACEBOOK_CONFIG.redirectUri,
                code: code
            }
        });

        const userAccessToken = tokenResponse.data.access_token;
        console.log('✅ User Access Token received');
        logSocial('Token Received');

        // DEBUG: Check permissions
        try {
            const debugToken = await axios.get('https://graph.facebook.com/debug_token', {
                params: {
                    input_token: userAccessToken,
                    access_token: `${FACEBOOK_CONFIG.clientId}|${FACEBOOK_CONFIG.clientSecret}`
                }
            });
            console.log('🔍 Token Permissions:', debugToken.data.data.scopes);
            logSocial('Token Permissions:', debugToken.data.data.scopes);
        } catch (e) {
            console.warn('⚠️ Could not debug token:', e.message);
            logSocial('Token Debug Warning:', e.message);
        }

        // Fetch User's Pages
        // We request: name, access_token, id, instagram_business_account
        console.log('📡 Fetching Facebook Pages...');
        const accountsResponse = await axios.get(FACEBOOK_CONFIG.userAccountsUrl, {
            params: {
                access_token: userAccessToken,
                fields: 'name,access_token,id,instagram_business_account,picture{url}'
            }
        });

        console.log('📦 Raw Accounts Response:', JSON.stringify(accountsResponse.data, null, 2));
        logSocial('Raw Accounts Response:', accountsResponse.data);

        const pages = accountsResponse.data.data;
        if (!pages || pages.length === 0) {
            logSocial('No Pages Found');
            console.warn('⚠️ No Facebook Pages found for user. Possible reasons: User has no pages, or permissions (pages_show_list) not granted.');
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent('No Facebook Pages found. Make sure you granted "Pages" access.')}`);
        }

        // AUTO-SELECT STRATEGY: Pick the first page
        // In a more complex app, we might ask the user to select one.
        // But adhering to "DO NOT change UI", we auto-select.
        const page = pages[0];
        console.log(`✅ Selected Page: ${page.name} (${page.id})`);

        // 1. Upsert Facebook Account
        // We use the PAGE ACCESS TOKEN for operations
        const fbExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Long-lived usually 60 days

        await SocialAccount.findOneAndUpdate(
            { tenantId, platform: 'facebook' },
            {
                accessToken: encrypt(page.access_token),
                // Facebook doesn't provide refresh token for Page Tokens in the same way, 
                // but the Page Token is long-lived if User Token is long-lived.
                // We encrypt the page token as 'accessToken'.
                expiresAt: fbExpiresAt,
                platformUserId: page.id, // This is Page ID for posting
                platformUserName: page.name,
                pageId: page.id,
                pageName: page.name,
                isConnected: true,
                status: 'connected',
                connectedBy: userId || null
            },
            { upsert: true, new: true }
        );
        console.log('✅ Facebook account connected');

        // 2. Check for Instagram Business Account
        if (page.instagram_business_account && page.instagram_business_account.id) {
            const igId = page.instagram_business_account.id;
            console.log(`✅ Found Linked Instagram Business Account: ${igId}`);

            await SocialAccount.findOneAndUpdate(
                { tenantId, platform: 'instagram' },
                {
                    accessToken: encrypt(page.access_token), // IG Graph API uses FB Page Token
                    expiresAt: fbExpiresAt,
                    platformUserId: igId, // IG Business ID
                    platformUserName: page.name + ' (Instagram)', // We don't have IG handle here easily without another call
                    pageId: page.id,
                    pageName: page.name, // Linked Page
                    isConnected: true,
                    status: 'connected',
                    connectedBy: userId || null
                },
                { upsert: true, new: true }
            );
            console.log('✅ Instagram account connected');
        } else {
            console.log('ℹ️ No Instagram Business Account linked to this Page.');
            // Optionally disconnect old instagram if it existed?
            // Maybe better to leave it or mark disconnected.
        }

        res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=success&platform=facebook`);

    } catch (error) {
        console.error('❌ Facebook callback failed:', error.response?.data || error.message);
        const msg = error.response?.data?.error?.message || error.message || 'Facebook connection failed';
        res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(msg)}`);
    }
};


/**
 * Instagram OAuth Configuration
 */
const INSTAGRAM_CONFIG = {
    clientId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.META_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social-media/instagram/callback`,
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management,instagram_basic,instagram_content_publish',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userAccountsUrl: 'https://graph.facebook.com/v19.0/me/accounts'
};

/**
 * Initiate Instagram OAuth flow (via Facebook)
 */
exports.initiateInstagramOAuth = async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
        const userId = req.query.userId;

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID is required.' });
        }

        console.log('🔵 Instagram OAuth Initiation:', { tenantId, userId });
        const state = generateState(tenantId, userId, '/hr/settings/social-media');

        const params = new URLSearchParams({
            client_id: INSTAGRAM_CONFIG.clientId,
            redirect_uri: INSTAGRAM_CONFIG.redirectUri,
            state: state,
            scope: INSTAGRAM_CONFIG.scope,
            response_type: 'code'
        });

        const authUrl = `${INSTAGRAM_CONFIG.authUrl}?${params.toString()}`;
        console.log('🔵 Redirecting to Meta/Facebook for Instagram:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('❌ Instagram OAuth initiation failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Handle Instagram OAuth callback
 */
exports.handleInstagramCallback = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        const { code, state, error, error_description } = req.query;

        console.log('🔵 Instagram Callback Params:', { code: !!code, state: !!state, error });

        if (error) {
            console.error('❌ Instagram Callback Error:', error);
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(error_description || error)}`);
        }
        if (!code || !state) {
            console.error('❌ Missing code or state');
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=Missing code or state`);
        }

        let stateData;
        try {
            stateData = validateState(state);
            console.log('🔵 State Validated:', { tenantId: stateData.tenantId });
        } catch (e) {
            console.error('❌ State Validation Failed:', e.message);
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(e.message)}`);
        }

        const { tenantId, userId } = stateData;

        // Exchange code for Access Token
        const tokenResponse = await axios.get(INSTAGRAM_CONFIG.tokenUrl, {
            params: {
                client_id: INSTAGRAM_CONFIG.clientId,
                client_secret: INSTAGRAM_CONFIG.clientSecret,
                redirect_uri: INSTAGRAM_CONFIG.redirectUri,
                code: code
            }
        });

        const shortLivedToken = tokenResponse.data.access_token;
        console.log('✅ Short-lived User Token received');

        // Exchange for Long-lived User Access Token (Required for multi-tenant mapping)
        console.log('🔄 Exchanging for long-lived User Access Token...');
        const longLivedResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: INSTAGRAM_CONFIG.clientId,
                client_secret: INSTAGRAM_CONFIG.clientSecret,
                fb_exchange_token: shortLivedToken
            }
        });
        const longLivedUserToken = longLivedResponse.data.access_token;
        console.log('✅ Long-lived User Access Token obtained');

        // Fetch User's Pages to find connected Instagram Business Account
        console.log('📡 Fetching Pages to find Instagram Business Account...');
        const accountsResponse = await axios.get(INSTAGRAM_CONFIG.userAccountsUrl, {
            params: {
                access_token: longLivedUserToken,
                fields: 'name,access_token,id,instagram_business_account,picture{url}'
            }
        });

        const pages = accountsResponse.data.data;
        if (!pages || pages.length === 0) {
            console.warn('⚠️ No Facebook Pages found.');
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent('No Facebook Pages found. You need a Page to connect Instagram.')}`);
        }

        let connected = false;

        // Iterate through pages to find one with instagram_business_account
        for (const page of pages) {
            if (page.instagram_business_account && page.instagram_business_account.id) {
                const igId = page.instagram_business_account.id;
                console.log(`✅ Found Instagram Business Account: ${igId} on Page: ${page.name}`);

                // Upsert SocialAccount for Instagram
                // accessToken: The Page Access Token (PAT) for the first found page (current behavior)
                // refreshToken: The Long-lived USER Access Token (Essential for finding correct PAT later)
                const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // ~60 days

                await SocialAccount.findOneAndUpdate(
                    { tenantId, platform: 'instagram' },
                    {
                        accessToken: encrypt(page.access_token),
                        refreshToken: encrypt(longLivedUserToken), // Store User Token here
                        expiresAt: expiresAt,
                        platformUserId: igId,
                        instagramUserId: igId,
                        platformUserName: page.name + ' (IG)',
                        pageId: page.id,
                        pageName: page.name,
                        facebookPageId: page.id,
                        isConnected: true,
                        isActive: true,
                        status: 'connected',
                        connectedBy: userId || null
                    },
                    { upsert: true, new: true }
                );

                connected = true;
                // We only connect the first one found for now as per requirements
                break;
            }
        }

        if (!connected) {
            console.warn('⚠️ No Instagram Business Account found linked to any Page.');
            return res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent('No Instagram Business Account found linked to your Facebook Pages.')}`);
        }

        console.log('✅ Instagram account connected successfully');
        res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=success&platform=instagram`);

    } catch (error) {
        console.error('❌ Instagram callback failed:', error.response?.data || error.message);
        const msg = error.response?.data?.error?.message || error.message || 'Instagram connection failed';
        res.redirect(`${frontendUrl}/hr/settings/social-media?oauth=error&message=${encodeURIComponent(msg)}`);
    }
};

/**
 * Generic OAuth initiation (for other platforms)
 */
exports.initiateOAuth = async (req, res) => {
    try {
        const { platform } = req.params;

        // 1. Try to get tenantId from authenticated user (if middleware ran)
        let tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || req.tenantId;

        // 2. Fallback to query parameter (Critical for public redirects)
        if (!tenantId && req.query.tenantId) {
            tenantId = req.query.tenantId;
        }

        if (!tenantId) {
            console.error(`❌ OAuth Initiation Failed: Tenant ID missing for ${platform}`);
            return res.status(400).json({ message: 'Tenant ID is required. Please log in again.' });
        }

        // Ensure downstream functions have access to tenantId
        req.query.tenantId = tenantId;

        if (platform === 'linkedin') {
            return exports.initiateLinkedInOAuth(req, res);
        } else if (platform === 'facebook') {
            return exports.initiateFacebookOAuth(req, res);
        } else if (platform === 'instagram') {
            return exports.initiateInstagramOAuth(req, res);
        }

        // For now, return not implemented for other platforms
        res.status(501).json({ message: `OAuth for ${platform} not yet implemented.` });
    } catch (error) {
        console.error('OAuth initiation failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Generic OAuth callback (for other platforms)
 */
exports.handleOAuthCallback = async (req, res) => {
    try {
        const { platform } = req.params;
        if (platform === 'linkedin') {
            return exports.handleLinkedInCallback(req, res);
        } else if (platform === 'facebook') {
            return exports.handleFacebookCallback(req, res);
        } else if (platform === 'instagram') {
            return exports.handleInstagramCallback(req, res);
        }

        res.status(501).json({ message: `OAuth callback for ${platform} not yet implemented` });
    } catch (error) {
        console.error('OAuth callback failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all connected accounts for tenant
 */
exports.getAccounts = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenantId;

        if (!tenantId) {
            // Return empty array instead of error for missing tenant
            console.warn('⚠️ No tenantId provided for getAccounts');
            return res.json([]);
        }

        const accounts = await SocialAccount.find({ tenantId }).select('-accessToken -refreshToken');

        console.log(`📊 Fetched ${accounts.length} social accounts for tenant ${tenantId}`);

        // Always return 200 with array (empty or populated)
        res.json(accounts || []);
    } catch (error) {
        console.error('Failed to get accounts:', error);
        // Return empty array instead of 500 error
        res.json([]);
    }
};

/**
 * Disconnect account
 */
exports.disconnect = async (req, res) => {
    try {
        const { platform } = req.params;
        const tenantId = req.headers['x-tenant-id'] || req.tenantId;
        await SocialAccount.findOneAndDelete({ tenantId, platform });
        console.log(`🗑️ Disconnected ${platform} for tenant ${tenantId}`);
        res.json({ message: 'Disconnected successfully' });
    } catch (error) {
        console.error('Disconnect failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new post
 */
exports.createPost = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenantId;
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'User authentication required to create posts' });
        }

        const { content, imageUrl, imageUrls, link, platforms, scheduledAt } = req.body;

        console.log('📝 Create post request:', {
            tenantId,
            userId,
            posts: platforms,
            hasImages: !!(imageUrl || (imageUrls && imageUrls.length > 0)),
            bodyImageUrl: imageUrl,
            bodyImageUrls: imageUrls
        });

        // Handle images: ensure imageUrls is array, and imageUrl is set (for backward compat)
        const finalImageUrls = imageUrls || (imageUrl ? [imageUrl] : []);
        const finalMainImage = imageUrl || (finalImageUrls.length > 0 ? finalImageUrls[0] : null);

        // Convert relative paths to absolute public URLs
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5003}`;
        const convertToPublicUrl = (url) => {
            if (!url) return null;
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            return url.startsWith('/') ? `${backendUrl}${url}` : `${backendUrl}/${url}`;
        };

        const publicImageUrls = finalImageUrls.map(url => convertToPublicUrl(url)).filter(Boolean);
        const publicMainImage = convertToPublicUrl(finalMainImage);

        // Instagram-specific validation warning
        if (platforms.includes('instagram')) {
            const hasLocalhost = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
            const isHttps = backendUrl.startsWith('https://');

            if (hasLocalhost || !isHttps) {
                console.warn('⚠️ Instagram post with localhost or HTTP URL detected. This will likely fail.');
                console.warn(`   Backend URL: ${backendUrl}`);
                console.warn('   💡 TIP: Use ngrok or deploy to a public HTTPS server for Instagram posts.');
            }
        }

        // Create post with initial status
        // If scheduledAt is provided → 'scheduled'
        // If NO scheduledAt → 'publishing' (immediate)
        const initialStatus = scheduledAt ? 'scheduled' : 'publishing';

        const post = new SocialPost({
            tenantId,
            content,
            imageUrl: publicMainImage,
            imageUrls: publicImageUrls,
            link,
            platforms,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            createdBy: userId,
            status: initialStatus
        });

        await post.save();

        console.log('✅ Post saved to DB (Async Init):', post._id);

        // ---------------------------------------------------------
        // ASYNC PROCESSING STRATEGY
        // 1. Send Immediate Response
        // 2. Process in background
        // ---------------------------------------------------------

        // Return immediate success to client
        res.json({
            ...post.toObject(),
            message: scheduledAt
                ? 'Post scheduled successfully'
                : 'Post accepted for publishing. It will be live shortly.',
            status: 'processing_background' // Virtual status for frontend
        });

        // Background Processing
        if (!scheduledAt) {
            // Use setImmediate to detach from current event loop tick
            setImmediate(async () => {
                try {
                    console.log(`🚀 [Background] Starting publish for post ${post._id}...`);

                    const accounts = await SocialAccount.find({
                        tenantId,
                        platform: { $in: platforms },
                        isConnected: true
                    });

                    const platformResponses = {};

                    for (const account of accounts) {
                        try {
                            console.log(`🚀 [Background] Publishing to ${account.platform}...`);
                            const service = getService(account);
                            if (service) {
                                const response = await service.createPost({
                                    content,
                                    imageUrl: publicMainImage,
                                    imageUrls: publicImageUrls,
                                    link
                                });

                                if (response.success) {
                                    // Store response directly (it already has success, platform, id, etc.)
                                    platformResponses[account.platform] = response;
                                    console.log(`✅ [Background] Published to ${account.platform}`);
                                    console.log(`   Response:`, response);
                                } else {
                                    console.error(`❌ [Background] Failed to publish to ${account.platform}:`, response.error);
                                    platformResponses[account.platform] = { success: false, error: response.error };
                                }
                            }
                        } catch (error) {
                            console.error(`❌ [Background] Failed to publish to ${account.platform}:`, error);
                            platformResponses[account.platform] = { success: false, error: error.message };
                        }
                    }

                    // Update Post Status based on results
                    const allFailed = Object.values(platformResponses).every(r => !r.success);
                    const someFailed = Object.values(platformResponses).some(r => !r.success);

                    let finalStatus = 'published';
                    if (allFailed && accounts.length > 0) finalStatus = 'failed';
                    else if (someFailed) finalStatus = 'partial_success';

                    await SocialPost.findByIdAndUpdate(post._id, {
                        status: finalStatus,
                        platformResponses: platformResponses,
                        publishedAt: new Date()
                    });

                    console.log(`🏁 [Background] Post ${post._id} processing complete. Status: ${finalStatus}`);

                } catch (bgError) {
                    console.error(`💥 [Background] Critical error processing post ${post._id}:`, bgError);
                    await SocialPost.findByIdAndUpdate(post._id, {
                        status: 'failed',
                        errorLog: bgError.message
                    });
                }
            });
        }

    } catch (error) {
        console.error('Failed to create post:', error);
        // If we haven't sent response yet
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};

/**
 * Get all posts
 */
exports.getPosts = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.tenantId;

        if (!tenantId) {
            return res.json([]);
        }

        // Filter out deleted posts
        const posts = await SocialPost.find({
            tenantId,
            isDeleted: { $ne: true }
        }).sort({ createdAt: -1 });
        res.json(posts || []);
    } catch (error) {
        console.error('Failed to get posts:', error);
        // Return empty array instead of error
        res.json([]);
    }
};

/**
 * Upload image for social media post
 */
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        // Get backend URL from environment
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

        // Return fully qualified public URL for the uploaded image
        const imageUrl = `${backendUrl}/uploads/social-posts/${req.file.filename}`;

        console.log('✅ Image uploaded successfully:', imageUrl);

        res.json({
            success: true,
            imageUrl: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('❌ Image upload failed:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image'
        });
    }
};

/**
 * Upload multiple images for social media post
 */
exports.uploadImages = async (req, res) => {
    try {
        console.log('📤 Multiple image upload request received');

        if (!req.files || req.files.length === 0) {
            console.log('❌ No image files provided');
            return res.status(400).json({
                success: false,
                message: 'No image files provided'
            });
        }

        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5003}`;

        // Generate URLs for all uploaded images
        const imageUrls = req.files.map(file =>
            `${backendUrl}/uploads/social-posts/${file.filename}`
        );

        console.log(`✅ ${req.files.length} images uploaded successfully:`, imageUrls);

        res.json({
            success: true,
            imageUrls: imageUrls,
            count: req.files.length
        });
    } catch (error) {
        console.error('❌ Multiple image upload failed:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload images'
        });
    }
};

/**
 * Update an existing post
 */
exports.updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.headers['x-tenant-id'] || req.tenantId;
        const { content, imageUrl, imageUrls, link, platforms } = req.body;

        console.log('📝 Update post request:', {
            postId: id,
            tenantId,
            hasContent: !!content,
            hasImages: !!(imageUrl || (imageUrls && imageUrls.length > 0))
        });

        // Find post and verify ownership
        const post = await SocialPost.findOne({ _id: id, tenantId });

        if (!post) {
            console.log('❌ Post not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        console.log('✅ Post found, updating fields...');

        // Update post fields
        if (content !== undefined) post.content = content;
        if (imageUrl !== undefined) post.imageUrl = imageUrl;
        if (imageUrls !== undefined) post.imageUrls = imageUrls;
        if (link !== undefined) post.link = link;
        if (platforms !== undefined) post.platforms = platforms;

        // Mark as edited (initially)
        // We keep it as 'edited' or maybe 'processing_edit' if we had that status
        // But 'edited' is fine, we just update the effective content in DB immediately
        post.status = 'edited';
        post.editedAt = new Date();

        await post.save();

        console.log('✅ Post updated in DB (Async Init):', id);

        // Return immediate success to client
        res.json({
            success: true,
            post: post,
            message: 'Post updated successfully. Changes will be reflected on social platforms shortly.'
        });

        // ---------------------------------------------------------
        // ASYNC BACKGROUND PROCESSING
        // ---------------------------------------------------------
        setImmediate(async () => {
            try {
                // Buffer to re-fetch post if needed, but we have the object 'post'
                // However, 'post' properties were updated in memory and saved.

                // Handle Platform Updates (Delete + Repost logic for LinkedIn/others)
                if (post.platformResponses && post.platformResponses.size > 0) {
                    console.log(`🔄 [Background] Starting background update for post ${post._id}...`);

                    const accounts = await SocialAccount.find({
                        tenantId,
                        platform: { $in: post.platforms },
                        isConnected: true
                    });

                    // We need to track if we need to save the post again with new platform IDs
                    let needsSave = false;

                    for (const account of accounts) {
                        try {
                            const service = getService(account);
                            const platformResponse = post.platformResponses.get(account.platform);

                            // Check if previously successful - look for ID in multiple possible locations
                            const hasExistingPost = platformResponse?.success &&
                                (platformResponse?.id || platformResponse?.igMediaId ||
                                    platformResponse?.data?.id || platformResponse?.data?.igMediaId);

                            if (service && hasExistingPost) {
                                const oldUrn = platformResponse?.id || platformResponse?.igMediaId ||
                                    platformResponse?.data?.id || platformResponse?.data?.igMediaId;
                                console.log(`🔄 [Background] Updating on ${account.platform} (Delete + Repost)...`);
                                console.log(`   Old ID:`, oldUrn);

                                // 1. Delete old post
                                if (service.deletePost) {
                                    await service.deletePost(oldUrn);
                                }

                                // 2. Create new post
                                // Prepare data (use new values or fallback to existing)
                                const postData = {
                                    content: content !== undefined ? content : post.content,
                                    // Use updated images or fallback to existing
                                    imageUrl: imageUrl !== undefined ? imageUrl : post.imageUrl,
                                    imageUrls: imageUrls !== undefined ? imageUrls : post.imageUrls,
                                    link: link !== undefined ? link : post.link
                                };

                                const newResponse = await service.createPost(postData);

                                // 3. Update platform response with NEW ID - store response directly
                                if (newResponse.success) {
                                    post.platformResponses.set(account.platform, newResponse);
                                    needsSave = true;
                                    console.log(`✅ [Background] Successfully reposted to ${account.platform}. New ID:`, newResponse.id || newResponse.igMediaId);
                                } else {
                                    console.error(`❌ [Background] Failed to repost to ${account.platform}:`, newResponse.error);
                                    post.platformResponses.set(account.platform, {
                                        success: false,
                                        error: 'Update failed: ' + newResponse.error
                                    });
                                    needsSave = true;
                                }
                            }
                        } catch (bgError) {
                            console.error(`❌ [Background] Error updating on ${account.platform}:`, bgError);
                        }
                    }

                    if (needsSave) {
                        await post.save();
                        console.log(`💾 [Background] Post ${post._id} platform data updated.`);
                    }
                }

                console.log(`🏁 [Background] Post ${post._id} update processing complete.`);

            } catch (criticalError) {
                console.error(`💥 [Background] Critical error updating post ${post._id}:`, criticalError);
            }
        });

    } catch (error) {
        console.error('❌ Failed to update post:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

/**
 * Delete a post (soft delete)
 */
exports.deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.headers['x-tenant-id'] || req.tenantId;

        console.log('🗑️ Post deletion request:', { postId: id, tenantId });

        // 1. Find the post
        const post = await SocialPost.findOne({ _id: id, tenantId });
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const results = {};
        const platformsToDelete = [...post.platforms];
        const successfulPlatforms = [];
        const failedPlatforms = [];

        // 2. Platform-wise deletion
        for (const platform of platformsToDelete) {
            try {
                console.log(`🗑️ Attempting to delete from ${platform}...`);

                // Find platform account
                const account = await SocialAccount.findOne({
                    tenantId,
                    platform,
                    isConnected: true
                });

                if (!account) {
                    console.warn(`⚠️ Account for ${platform} missing or disconnected.`);
                    results[platform] = { success: false, message: 'Account disconnected' };
                    failedPlatforms.push(platform);
                    continue;
                }

                // Initialize Platform Service
                const service = getService(account);
                if (!service || !service.deletePost) {
                    console.warn(`⚠️ No delete capability for ${platform} service.`);
                    results[platform] = { success: false, message: 'Platform does not support deletion via API' };
                    failedPlatforms.push(platform);
                    continue;
                }

                // Get Media ID for this platform
                // platformResponses is a Map in Mongoose
                const platformResponse = post.platformResponses?.get?.(platform) || post.platformResponses?.[platform];
                const platformPostId = platformResponse?.igMediaId || platformResponse?.id ||
                    platformResponse?.data?.igMediaId || platformResponse?.data?.id;

                if (!platformPostId) {
                    console.warn(`⚠️ No platform Post ID found for ${platform}. Marking as success to allow DB cleanup.`);
                    results[platform] = { success: true, message: 'Not found on platform, record cleaned' };
                    successfulPlatforms.push(platform);
                } else {
                    // Call Service Delete API
                    const delResult = await service.deletePost(platformPostId);

                    if (delResult.success) {
                        console.log(`✅ ${platform} deletion successful`);
                        results[platform] = { success: true };
                        successfulPlatforms.push(platform);
                    } else {
                        console.error(`❌ ${platform} deletion failed:`, delResult.error);
                        results[platform] = {
                            success: false,
                            message: delResult.error || 'Platform error',
                            code: delResult.code
                        };
                        failedPlatforms.push(platform);
                    }
                }
            } catch (error) {
                console.error(`❌ Unexpected error deleting from ${platform}:`, error);
                results[platform] = { success: false, message: error.message };
                failedPlatforms.push(platform);
            }
        }

        // 3. Update Database based on results
        // Remove successful platforms from the post record
        for (const platform of successfulPlatforms) {
            post.platforms = post.platforms.filter(p => p !== platform);
            if (post.platformResponses && post.platformResponses.delete) {
                post.platformResponses.delete(platform);
            } else if (post.platformResponses) {
                delete post.platformResponses[platform];
            }
        }

        // Determine final status
        if (post.platforms.length === 0) {
            // ALL deleted or no platforms were left
            post.status = 'deleted';
            post.isDeleted = true;
            post.deletedAt = new Date();
            console.log('✅ Post fully deleted from all platforms and database');
        } else {
            // Some platforms still remain
            post.status = 'partially_deleted';
            console.log(`⚠️ Post partially deleted. Remaining platforms: ${post.platforms.join(', ')}`);
        }

        // Save changes to DB
        await post.save();

        // 4. Return success response with platform details
        // As per requirements: return 200 with platform-wise results
        return res.json({
            success: true,
            results: results,
            isFullyDeleted: post.platforms.length === 0
        });

    } catch (error) {
        console.error('❌ Fatal Error in deletePost:', error);
        res.status(500).json({
            success: false,
            message: 'An internal error occurred during deletion',
            error: error.message
        });
    }
};

// Add other controller exports below if needed
