const mongoose = require('mongoose');

class SocialDashboardService {
    async getStats(db, tenantId, branchId, platform) {
        const SocialAccount = db.model('SocialAccountEnterprise', require('../../../models/social/SocialAccount'));
        const SocialCampaign = db.model('SocialCampaign', require('../../../models/social/SocialCampaign'));
        const SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));

        const query = { tenant: new mongoose.Types.ObjectId(String(tenantId)) };
        if (branchId) query.branch = new mongoose.Types.ObjectId(String(branchId));
        if (platform && platform !== 'all') query.platform = platform;

        // console.log(`[SOCIAL_DASHBOARD_SERVICE] getStats START | Tenant: ${tenantId} | Branch: ${branchId}`);
        try {
            // 1. Account counts (Join Accounts)
            const accountQuery = { tenant: tenantId };
            if (branchId) accountQuery.branch = branchId;
            const accountsCount = await SocialAccount.countDocuments(accountQuery);

            // 2. Post status counts
            const posts = await SocialPost.find(query);
            
            const stats = {
                joinAccounts: accountsCount,
                activePost: posts.filter(p => ['publishing', 'pending', 'scheduled'].includes(p.status)).length,
                published: posts.filter(p => ['published', 'completed'].includes(p.status)).length,
                draftPosts: posts.filter(p => p.status === 'draft').length,
                scheduled: posts.filter(p => p.status === 'scheduled').length,
                failures: posts.filter(p => p.status === 'failed').length
            };

            return stats;
        } catch (error) {
            // console.error('[SocialDashboardService] Error fetching stats:', error);
            throw error;
        }
    }
}

module.exports = new SocialDashboardService();
