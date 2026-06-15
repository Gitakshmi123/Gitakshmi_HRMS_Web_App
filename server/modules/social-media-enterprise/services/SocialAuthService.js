const axios = require('axios');
const mongoose = require('mongoose');
const { encrypt } = require('../utils/tokenEncryption');

/**
 * SocialAuthService: Handles OAuth flows and account discovery
 */
class SocialAuthService {
    constructor(db) {
        this.db = db;
        this.SocialAccount = db.model('SocialAccountEnterprise', require('../../../models/social/SocialAccount'));
    }

    /**
     * Meta (Facebook/Instagram) OAuth Flow
     */
    async handleMetaOAuth(code, tenantId, branchId, redirectUri) {
        // 1. Exchange code for User Access Token
        const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                client_id: process.env.FACEBOOK_APP_ID,
                client_secret: process.env.FACEBOOK_APP_SECRET,
                redirect_uri: redirectUri || process.env.FACEBOOK_REDIRECT_URI,
                code
            }
        });

        const userAccessToken = tokenRes.data.access_token;

        // 2. Exchange for Long-Lived Token (60 days)
        const longLivedRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.FACEBOOK_APP_ID,
                client_secret: process.env.FACEBOOK_APP_SECRET,
                fb_exchange_token: userAccessToken
            }
        });

        const longLivedToken = longLivedRes.data.access_token;
        const expiresAt = longLivedRes.data.expires_in
            ? new Date(Date.now() + (Number(longLivedRes.data.expires_in) * 1000))
            : null;

        // 3. Fetch Pages and Linked Instagram Accounts
        const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
            params: {
                fields: 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}',
                access_token: longLivedToken
            }
        });

        const accountsSaved = [];

        for (const page of pagesRes.data.data) {
            // Save Facebook Page
            const fbAccount = await this._saveAccount({
                tenant: tenantId,
                branch: branchId,
                platform: 'facebook',
                accountName: page.name,
                platformAccountId: page.id,
                accessToken: page.access_token, // Page tokens are usually long-lived if exchanged from long-lived user token
                expiresAt,
                status: 'active'
            });
            accountsSaved.push(fbAccount);

            // Save linked Instagram Business Account
            if (page.instagram_business_account) {
                const ig = page.instagram_business_account;
                const igAccount = await this._saveAccount({
                    tenant: tenantId,
                    branch: branchId,
                    platform: 'instagram',
                    accountName: ig.username || ig.name,
                    platformAccountId: ig.id,
                    accessToken: page.access_token, // IG uses the Page token
                    expiresAt,
                    status: 'active',
                    meta: { profile_picture_url: ig.profile_picture_url }
                });
                accountsSaved.push(igAccount);
            }
        }

        return accountsSaved;
    }

    /**
     * LinkedIn OAuth Flow
     */
    async handleLinkedInOAuth(code, tenantId, branchId, redirectUri) {
        // 1. Exchange code for access token
        const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                client_id: process.env.LINKEDIN_CLIENT_ID,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET,
                redirect_uri: redirectUri || process.env.LINKEDIN_REDIRECT_URI
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenRes.data.access_token;

        // 2. Fetch Member Profile (URN) & Additional Info
        let personId;
        let profilePicture = null;
        let profileName = 'LinkedIn User';

        try {
            // Try OIDC UserInfo first as it's more comprehensive in modern flows
            const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            personId = profileRes.data.sub;
            profileName = profileRes.data.name;
            profilePicture = profileRes.data.picture;
        } catch (e) {
            // Fallback to legacy /me
            const meRes = await axios.get('https://api.linkedin.com/v2/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            personId = meRes.data.id;
            profileName = `${meRes.data.localizedFirstName} ${meRes.data.localizedLastName}`;
        }

        const userAccount = await this._saveAccount({
            tenant: tenantId,
            branch: branchId,
            platform: 'linkedin',
            accountName: profileName,
            platformAccountId: `urn:li:person:${personId}`,
            accessToken: accessToken,
            status: 'active',
            meta: { profile_picture: profilePicture }
        });

        // 4. Discover managed Organization Pages (Optional enhancement)
        // This requires 'rw_organization_admin' or 'r_organization_social' scope

        return [userAccount];
    }

    async _saveAccount(data) {
        const encryptedToken = encrypt(data.accessToken);

        // Ensure tenant and branch are ObjectIds (schema uses refs)
        const tenantId = data.tenant ? new mongoose.Types.ObjectId(data.tenant) : null;
        const branchId = data.branch ? new mongoose.Types.ObjectId(data.branch) : null;
        if (!tenantId || !branchId) {
            throw new Error('tenant and branch are required to save a social account');
        }

        // Find existing or create new
        let account = await this.SocialAccount.findOne({
            tenant: tenantId,
            branch: branchId,
            platform: data.platform,
            platformAccountId: data.platformAccountId
        });

        if (account) {
            account.accessToken = encryptedToken;
            account.status = 'active';
            account.accountName = data.accountName;
            account.expiresAt = data.expiresAt || account.expiresAt || null;
            if (data.meta) account.meta = { ...account.meta, ...data.meta };
            await account.save();
        } else {
            account = await this.SocialAccount.create({
                tenant: tenantId,
                branch: branchId,
                platform: data.platform,
                accountName: data.accountName,
                platformAccountId: data.platformAccountId,
                accessToken: encryptedToken,
                expiresAt: data.expiresAt || null,
                status: data.status || 'active',
                meta: data.meta || {}
            });
        }

        return account;
    }

    async getBranchAccounts(branchId) {
        return await this.SocialAccount.find({
            branch: branchId,
            status: { $ne: 'disconnected' }
        });
    }

    async disconnectAccount(accountId) {
        await this.SocialAccount.findByIdAndUpdate(accountId, { status: 'disconnected' });
        return true;
    }

    async upsertManualInstagramAccount({ tenantId, branchId, igUserId, accessToken, accountName, expiresAt }) {
        return await this._saveAccount({
            tenant: tenantId,
            branch: branchId,
            platform: 'instagram',
            accountName: accountName || 'Instagram Business',
            platformAccountId: igUserId,
            accessToken,
            expiresAt: expiresAt || new Date(Date.now() + (55 * 24 * 60 * 60 * 1000)),
            status: 'active'
        });
    }

    async refreshMetaLongLivedToken(account) {
        if (!account || !['facebook', 'instagram'].includes(account.platform)) {
            return account;
        }

        const { decrypt } = require('../utils/tokenEncryption');
        const currentToken = decrypt(account.accessToken);
        if (!currentToken) {
            throw new Error(`Failed to decrypt access token for account ${account._id}`);
        }

        const refreshRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.FACEBOOK_APP_ID,
                client_secret: process.env.FACEBOOK_APP_SECRET,
                fb_exchange_token: currentToken
            }
        });

        const refreshedToken = refreshRes.data.access_token;
        const nextExpiresAt = refreshRes.data.expires_in
            ? new Date(Date.now() + (Number(refreshRes.data.expires_in) * 1000))
            : account.expiresAt || new Date(Date.now() + (55 * 24 * 60 * 60 * 1000));

        account.accessToken = encrypt(refreshedToken);
        account.expiresAt = nextExpiresAt;
        account.status = 'active';
        await account.save();

        return account;
    }
}

module.exports = SocialAuthService;
