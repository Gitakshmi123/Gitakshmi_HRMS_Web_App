/**
 * SocialAnalyticsService: Fetches real engagement metrics from Facebook & Instagram Graph API
 * and updates SocialPost documents in the database.
 */
const axios = require('axios');
const mongoose = require('mongoose');
const { decrypt } = require('../utils/tokenEncryption');
const getTenantDB = require('../../../utils/tenantDB');

const LinkedInAdapter = require('../adapters/LinkedInAdapter');

class SocialAnalyticsService {
    constructor(db) {
        this.db = db;
        this.SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));
        this.SocialAccount = db.model('SocialAccountEnterprise', require('../../../models/social/SocialAccount'));
    }

    /**
     * Fetch Instagram engagement for a single media ID.
     */
    async fetchInstagramMetrics(mediaId, accessToken) {
        try {
            // 1. Fetch basic counts
            const basic = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
                params: { fields: 'like_count,comments_count,media_type', access_token: accessToken }
            });

            let impressions = 0, reach = 0, engagement = 0;
            // 2. Fetch insights
            try {
                const isVideo = basic.data.media_type === 'VIDEO';
                const metrics = isVideo ? 'reach,saved,video_view_count' : 'impressions,reach,saved';

                const insights = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}/insights`, {
                    params: { metric: metrics, access_token: accessToken }
                });

                impressions = insights.data.data.find(i => i.name === 'impressions')?.values[0]?.value || 0;
                reach = insights.data.data.find(i => i.name === 'reach')?.values[0]?.value || 0;
                engagement = basic.data.like_count + basic.data.comments_count;

                if (isVideo) {
                    impressions = insights.data.data.find(i => i.name === 'video_view_count')?.values[0]?.value || impressions;
                }
            } catch (ignore) {
                // Meta API restricts insights sometimes
            }

            return {
                likes: basic.data.like_count || 0,
                comments: basic.data.comments_count || 0,
                shares: 0,
                views: impressions || reach || 0,
                impressions,
                reach: reach || impressions
            };
        } catch (err) {
            // console.error(`[AnalyticsService] Instagram fetch failed for ${mediaId}:`, err?.response?.data?.error?.message || err.message);
            return null;
        }
    }

    /**
     * Fetch Facebook engagement for a single post ID.
     */
    async fetchFacebookMetrics(post, accessToken) {
        const candidates = [
            post.platform_media_id,
            post.platformPostId,
            post.platformAssetUrn,
            post.lastPlatformResponse?.videoId,
            post.lastPlatformResponse?.id,
            post.lastPlatformResponse?.platformPostId
        ].filter(Boolean).map(String);

        const uniqueCandidates = [...new Set(candidates)];

        if (post.postType === 'reel' && post.account?.platformAccountId) {
            const discovered = await this.discoverFacebookVideoId(post, accessToken);
            if (discovered?.id && !uniqueCandidates.includes(String(discovered.id))) {
                uniqueCandidates.unshift(String(discovered.id));
            }
        }

        for (const candidateId of uniqueCandidates) {
            const metrics = await this.fetchFacebookMetricsById(candidateId, accessToken);
            if (metrics) return metrics;
        }

        return null;
    }

    async discoverFacebookVideoId(post, accessToken) {
        try {
            const res = await axios.get(`https://graph.facebook.com/v19.0/${post.account.platformAccountId}/videos`, {
                params: {
                    fields: 'id,permalink_url,description,created_time',
                    limit: 25,
                    access_token: accessToken
                }
            });

            const caption = String(post.caption || '').trim().toLowerCase();
            const createdAt = new Date(post.publishedAt || post.createdAt || 0).getTime();
            const rows = res.data?.data || [];
            const match = rows.find((row) => {
                const sameCaption = caption && String(row.description || '').trim().toLowerCase() === caption;
                const rowTime = new Date(row.created_time || 0).getTime();
                const closeTime = createdAt && rowTime && Math.abs(rowTime - createdAt) < 10 * 60 * 1000;
                return sameCaption || closeTime;
            });

            return match || null;
        } catch (_error) {
            return null;
        }
    }

    async fetchFacebookMetricsById(postId, accessToken) {
        try {
            const [likesRes, commentsRes, basicRes, insightsRes] = await Promise.all([
                axios.get(`https://graph.facebook.com/v19.0/${postId}/likes`, {
                    params: { summary: true, limit: 0, access_token: accessToken }
                }).catch(() => null),
                axios.get(`https://graph.facebook.com/v19.0/${postId}/comments`, {
                    params: { summary: true, limit: 0, access_token: accessToken }
                }).catch(() => null),
                axios.get(`https://graph.facebook.com/v19.0/${postId}`, {
                    params: { fields: 'id,permalink_url,shares,likes.summary(true),comments.summary(true)', access_token: accessToken }
                }).catch(() => null),
                axios.get(`https://graph.facebook.com/v19.0/${postId}/insights`, {
                    params: { metric: 'post_impressions,post_impressions_unique,post_engaged_users', access_token: accessToken }
                }).catch(() => null)
            ]);

            const likes =
                likesRes?.data?.summary?.total_count ??
                basicRes?.data?.likes?.summary?.total_count ??
                0;
            const comments =
                commentsRes?.data?.summary?.total_count ??
                basicRes?.data?.comments?.summary?.total_count ??
                0;

            if (!likesRes && !commentsRes && !basicRes) return null;

            const insightRows = insightsRes?.data?.data || [];
            const getInsight = (name) => insightRows.find(i => i.name === name)?.values?.[0]?.value || 0;
            const impressions = getInsight('post_impressions');
            const reach = getInsight('post_impressions_unique');
            const engagedUsers = getInsight('post_engaged_users');

            return {
                likes,
                comments,
                shares: basicRes?.data?.shares?.count || 0,
                views: impressions || reach || engagedUsers || 0,
                impressions,
                reach,
                canonicalPostId: postId,
                permalink: basicRes?.data?.permalink_url || null
            };
        } catch (_err) {
            return null;
        }
    }

    /**
     * Fetch LinkedIn engagement for a single post URN.
     */
    async fetchLinkedInMetrics(postUrn, account) {
        try {
            const accessToken = decrypt(account.accessToken);
            const adapter = new LinkedInAdapter(accessToken, account.platformAccountId);
            const data = await adapter.getMetrics(postUrn);

            if (!data) return null;

            if (data.source === 'socialActions') {
                return {
                    likes: data.likes || 0,
                    comments: data.comments || 0,
                    shares: 0,
                    views: 0,
                    impressions: 0,
                    reach: 0
                };
            } else if (data.elements) {
                const stats = data.elements[0] || {};
                const totalLikes = stats.totalShareStatistics?.likeCount || 0;
                const totalComments = stats.totalShareStatistics?.commentCount || 0;
                const impressions = stats.totalShareStatistics?.impressionCount || 0;
                const shares = stats.totalShareStatistics?.shareCount || 0;

                return {
                    likes: totalLikes,
                    comments: totalComments,
                    shares: shares,
                    views: impressions,
                    impressions,
                    reach: impressions
                };
            }
            return null;
        } catch (err) {
            // console.error(`[AnalyticsService] LinkedIn fetch failed for ${postUrn}:`, err.message);
            return null;
        }
    }

    /**
     * Sync metrics for all published posts for THIS tenant DB instance.
     * Also saves a snapshot to the SocialAnalytics collection.
     */
    async syncMetricsForTenant() {
        const SocialAnalytics = this.db.model('SocialAnalytics', require('../../../models/social/SocialAnalytics'));

        const posts = await this.SocialPost.find({
            status: { $in: ['published', 'completed'] },
            platformPostId: { $ne: null },
            platform: { $in: ['instagram', 'facebook', 'linkedin'] }
        }).populate('account');

        let synced = 0;
        const accountTotals = {};

        for (const post of posts) {
            if (!post.account || !post.account.accessToken) continue;

            const accId = post.account._id.toString();
            if (!accountTotals[accId]) {
                accountTotals[accId] = {
                    account: post.account,
                    likes: 0, comments: 0, shares: 0, views: 0, impressions: 0, reach: 0
                };
            }

            try {
                let metrics = null;

                if (post.platform === 'instagram') {
                    const accessToken = decrypt(post.account.accessToken);
                    metrics = await this.fetchInstagramMetrics(post.platform_media_id || post.platformPostId, accessToken);
                } else if (post.platform === 'facebook') {
                    const accessToken = decrypt(post.account.accessToken);
                    metrics = await this.fetchFacebookMetrics(post, accessToken);
                } else if (post.platform === 'linkedin') {
                    metrics = await this.fetchLinkedInMetrics(post.platformPostId, post.account);
                }

                if (metrics) {
                    await this.SocialPost.updateOne(
                        { _id: post._id },
                        {
                            $set: {
                                likes: metrics.likes,
                                comments: metrics.comments,
                                shares: metrics.shares,
                                views: metrics.views,
                                'metrics.impressions': metrics.impressions,
                                'metrics.reach': metrics.reach,
                                'metrics.likes': metrics.likes,
                                'metrics.comments': metrics.comments,
                                'metrics.shares': metrics.shares,
                                'metrics.views': metrics.views,
                                lastUpdated: new Date(),
                                lastSynced: new Date(),
                                ...(metrics.canonicalPostId ? { platform_media_id: metrics.canonicalPostId } : {}),
                                ...(metrics.permalink ? { permalink: metrics.permalink } : {})
                            }
                        }
                    );

                    accountTotals[accId].likes += metrics.likes;
                    accountTotals[accId].comments += metrics.comments;
                    accountTotals[accId].shares += metrics.shares;
                    accountTotals[accId].views += metrics.views;
                    accountTotals[accId].impressions += metrics.impressions;
                    accountTotals[accId].reach += metrics.reach;

                    synced++;
                }
            } catch (err) {
                // console.error(`[AnalyticsService] Post ${post._id} sync error:`, err.message);
                if (err.message.includes('expired') || err.message.includes('invalid')) {
                    // Add error handling for expired access tokens
                    await this.SocialAccount.updateOne({ _id: post.account._id }, { status: 'expired' });
                }
            }
        }

        // [NEW] Save snapshots to SocialAnalytics collection
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const accId in accountTotals) {
            const totals = accountTotals[accId];
            try {
                await SocialAnalytics.findOneAndUpdate(
                    {
                        account: totals.account._id,
                        snapshotDate: today
                    },
                    {
                        tenant: totals.account.tenant,
                        branch: totals.account.branch,
                        platform: totals.account.platform,
                        snapshotDate: today,
                        'metrics.totalImpressions': totals.impressions,
                        'metrics.totalReach': totals.reach,
                        'metrics.totalEngagements': totals.likes + totals.comments + totals.shares,
                        'metrics.totalFollowers': 0, // Profile-level metric not fetched here
                    },
                    { upsert: true, new: true }
                );
            } catch (snapErr) {
                // console.error(`[AnalyticsService] Failed to save snapshot for account ${accId}:`, snapErr.message);
            }
        }

        return synced;
    }

    /**
     * Get aggregated analytics data grouped by date range.
     */
    async getAggregatedAnalytics(tenantId, branchId, platform, range) {
        const query = { tenant: new mongoose.Types.ObjectId(tenantId) };
        if (branchId) query.branch = new mongoose.Types.ObjectId(branchId);
        if (platform && platform !== 'all') query.platform = platform;

        let format = '%Y-%m-%d';
        if (range === 'monthly') format = '%Y-%m';
        if (range === 'yearly') format = '%Y';

        // Prefer SocialAnalytics snapshots for charts if possible, falls back to Post aggregation
        // This makes the chart "sticky" even if posts are deleted later
        const results = await this.SocialPost.aggregate([
            { $match: query },
            {
                $group: {
                    _id: { $dateToString: { format: format, date: '$createdAt' } },
                    likes: { $sum: '$likes' },
                    comments: { $sum: '$comments' },
                    shares: { $sum: '$shares' },
                    views: { $sum: '$views' },
                    reach: { $sum: '$reach' },
                    impressions: { $sum: '$impressions' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return {
            labels: results.map(r => r._id),
            likes: results.map(r => r.likes),
            comments: results.map(r => r.comments),
            shares: results.map(r => r.shares),
            views: results.map(r => r.views),
            reach: results.map(r => r.reach),
            impressions: results.map(r => r.impressions)
        };
    }

    /**
     * Get dashboard summary totals.
     */
    async getDashboardSummary(tenantId, branchId, platform) {
        const query = { tenant: new mongoose.Types.ObjectId(tenantId) };
        if (branchId) query.branch = new mongoose.Types.ObjectId(branchId);
        if (platform && platform !== 'all') query.platform = platform;

        const posts = await this.SocialPost.find(query);

        return {
            likes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
            comments: posts.reduce((sum, p) => sum + (p.comments || 0), 0),
            shares: posts.reduce((sum, p) => sum + (p.shares || 0), 0),
            views: posts.reduce((sum, p) => sum + (p.views || 0), 0),
            reach: posts.reduce((sum, p) => sum + (p.reach || 0), 0),
            impressions: posts.reduce((sum, p) => sum + (p.impressions || 0), 0),
            draftPosts: posts.filter(p => p.status === 'draft').length,
            publishedPosts: posts.filter(p => ['published', 'completed'].includes(p.status)).length,
            failedPosts: posts.filter(p => p.status === 'failed').length,
            scheduledPosts: posts.filter(p => p.status === 'scheduled').length
        };
    }
}

/**
 * Static method: sync metrics across ALL active tenants.
 * Called by the cron job.
 */
SocialAnalyticsService.syncAllMetrics = async function () {
    const Tenant = mongoose.model('Tenant');
    const tenants = await Tenant.find({ status: 'active' });

    for (const t of tenants) {
        try {
            const tDb = await getTenantDB(t._id.toString());
            const service = new SocialAnalyticsService(tDb);
            const count = await service.syncMetricsForTenant();
            if (count > 0) {
                // console.log(`[AnalyticsCron] Tenant ${t.code}: synced ${count} posts`);
            }
        } catch (err) {
            // console.error(`[AnalyticsCron] Tenant ${t.code} error:`, err.message);
        }
    }
};

module.exports = SocialAnalyticsService;
