const crypto = require('crypto');

/**
 * OAuth Service for Social Media Platforms
 * Handles OAuth URL generation, token exchange, and refresh logic
 */

class OAuthService {
    constructor() {
        this.platforms = {
            linkedin: {
                authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
                tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
                scope: 'r_liteprofile r_emailaddress w_member_social',
                clientId: process.env.LINKEDIN_CLIENT_ID,
                clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
                redirectUri: process.env.LINKEDIN_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social/linkedin/callback`
            },
            facebook: {
                authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
                tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
                scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management',
                clientId: process.env.FACEBOOK_APP_ID,
                clientSecret: process.env.FACEBOOK_APP_SECRET,
                redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social/facebook/callback`
            },
            instagram: {
                authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
                tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
                scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management,instagram_basic,instagram_content_publish,instagram_manage_content',
                clientId: process.env.FACEBOOK_APP_ID, // Instagram uses Facebook OAuth
                clientSecret: process.env.FACEBOOK_APP_SECRET,
                redirectUri: process.env.INSTAGRAM_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social/instagram/callback`
            },
            twitter: {
                authUrl: 'https://twitter.com/i/oauth2/authorize',
                tokenUrl: 'https://api.twitter.com/2/oauth2/token',
                scope: 'tweet.read tweet.write users.read offline.access',
                clientId: process.env.TWITTER_CLIENT_ID,
                clientSecret: process.env.TWITTER_CLIENT_SECRET,
                redirectUri: process.env.TWITTER_REDIRECT_URI || `${process.env.BACKEND_URL}/api/social/twitter/callback`
            }
        };
    }

    /**
     * Generate OAuth authorization URL
     * @param {string} platform - Platform name (linkedin, facebook, instagram, twitter)
     * @param {string} tenantId - Tenant ID for state parameter
     * @returns {string} OAuth authorization URL
     */
    generateOAuthUrl(platform, tenantId) {
        const config = this.platforms[platform];
        if (!config) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Generate state parameter for CSRF protection
        const state = this.generateState(tenantId, platform);

        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scope,
            response_type: 'code',
            state: state
        });

        // Twitter uses different parameter names
        if (platform === 'twitter') {
            params.set('code_challenge', 'challenge');
            params.set('code_challenge_method', 'plain');
        }

        return `${config.authUrl}?${params.toString()}`;
    }

    /**
     * Generate state parameter for CSRF protection
     * @param {string} tenantId - Tenant ID
     * @param {string} platform - Platform name
     * @returns {string} Base64 encoded state
     */
    generateState(tenantId, platform) {
        const stateObj = {
            tenantId,
            platform,
            timestamp: Date.now(),
            nonce: crypto.randomBytes(16).toString('hex')
        };
        return Buffer.from(JSON.stringify(stateObj)).toString('base64');
    }

    /**
     * Validate state parameter
     * @param {string} state - State parameter from callback
     * @returns {object} Decoded state object
     */
    validateState(state) {
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
     * Exchange authorization code for access token
     * @param {string} platform - Platform name
     * @param {string} code - Authorization code
     * @returns {Promise<object>} Token response
     */
    async exchangeCodeForToken(platform, code) {
        const config = this.platforms[platform];
        if (!config) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        const axios = require('axios');

        const params = {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code'
        };

        try {
            const response = await axios.post(config.tokenUrl, null, {
                params: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
                expiresAt: response.data.expires_in
                    ? new Date(Date.now() + response.data.expires_in * 1000)
                    : null
            };
        } catch (error) {
            console.error(`Token exchange failed for ${platform}:`, error.response?.data || error.message);
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Refresh access token using refresh token
     * @param {string} platform - Platform name
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<object>} New token response
     */
    async refreshAccessToken(platform, refreshToken) {
        const config = this.platforms[platform];
        if (!config) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        const axios = require('axios');

        const params = {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        };

        try {
            const response = await axios.post(config.tokenUrl, null, {
                params: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token || refreshToken,
                expiresIn: response.data.expires_in,
                expiresAt: response.data.expires_in
                    ? new Date(Date.now() + response.data.expires_in * 1000)
                    : null
            };
        } catch (error) {
            console.error(`Token refresh failed for ${platform}:`, error.response?.data || error.message);
            throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Get user profile from platform
     * @param {string} platform - Platform name
     * @param {string} accessToken - Access token
     * @returns {Promise<object>} User profile
     */
    async getUserProfile(platform, accessToken) {
        const axios = require('axios');

        try {
            let response;
            switch (platform) {
                case 'linkedin':
                    response = await axios.get('https://api.linkedin.com/v2/me', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    return {
                        id: response.data.id,
                        name: `${response.data.localizedFirstName} ${response.data.localizedLastName}`
                    };

                case 'facebook':
                case 'instagram':
                    response = await axios.get('https://graph.facebook.com/me', {
                        params: { fields: 'id,name', access_token: accessToken }
                    });
                    return {
                        id: response.data.id,
                        name: response.data.name
                    };

                case 'twitter':
                    response = await axios.get('https://api.twitter.com/2/users/me', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    return {
                        id: response.data.data.id,
                        name: response.data.data.name
                    };

                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        } catch (error) {
            console.error(`Failed to get user profile for ${platform}:`, error.response?.data || error.message);
            throw new Error(`Failed to get user profile: ${error.message}`);
        }
    }
}

module.exports = new OAuthService();
