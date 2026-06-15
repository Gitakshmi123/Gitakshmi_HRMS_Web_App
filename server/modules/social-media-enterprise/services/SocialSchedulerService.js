/**
 * SocialSchedulerService — Production Background Job System
 *
 * FEATURES:
 *  • Polls every 60s for scheduled posts (node-cron)
 *  • State machine: scheduled → publishing → published | failed
 *  • Retry up to 3 times with exponential back-off per post
 *  • Syncs platform metrics for published posts every 30 min
 *  • Recovery on restart: any post stuck in "publishing" is reset to "scheduled"
 *  • Structured logging to console (mirrored to terminal.log via app.js override)
 *  • isProcessing guard prevents overlapping cron ticks
 *
 * BOOTSTRAPPED IN: server.js
 *   require('./modules/social-media-enterprise/services/SocialSchedulerService');
 */

'use strict';

const cron = require('node-cron');
const mongoose = require('mongoose');
const { enqueueInstagramPublishJob } = require('../queues/InstagramPublishQueue');

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const MAX_RETRIES = 3;           // maximum publish attempts per post
const BASE_BACKOFF_MS = 2000;    // 2 s → 4 s → 6 s (linear; posts are not retried within the same tick)
const SCHEDULER_TAG = '[SocialScheduler]';
const METRICS_TAG   = '[SocialMetrics]';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(tag, msg)  { /* console.log(`${tag} ${msg}`); */ }
function err(tag, msg)  { console.error(`${tag} ❌ ${msg}`); }
function warn(tag, msg) { /* console.warn(`${tag} ⚠️  ${msg}`); */ }

// ─────────────────────────────────────────────────────────
// Class
// ─────────────────────────────────────────────────────────
class SocialSchedulerService {
    constructor() {
        this.isProcessing = false;

        // Start jobs after a short delay so DB connections settle
        setTimeout(() => {
            this._recoverStuckPosts();
            this._initCronJobs();
        }, 5000);
    }

    // ──────────────────────────────────────────────────────
    // CRON JOBS
    // ──────────────────────────────────────────────────────

    _initCronJobs() {
        // Job 1: Publish scheduled posts — runs every minute
        cron.schedule('* * * * *', () => {
            log(SCHEDULER_TAG, '⏰ Tick: checking for due scheduled posts...');
            this.processAllTenants().catch((e) =>
                err(SCHEDULER_TAG, `processAllTenants crash: ${e?.message}`)
            );
        });

        // Job 2: Sync platform engagement metrics — runs every 30 minutes
        cron.schedule('*/30 * * * *', () => {
            log(METRICS_TAG, '⏰ Tick: syncing platform metrics...');
            this.syncAllTenantsMetrics().catch((e) =>
                err(METRICS_TAG, `syncAllTenantsMetrics crash: ${e?.message}`)
            );
        });

        log(SCHEDULER_TAG, '✅ Background job system started (cron active)');
    }

    // ──────────────────────────────────────────────────────
    // RECOVERY on restart
    // ──────────────────────────────────────────────────────

    /**
     * On every server boot, reset any posts stuck in "publishing"
     * back to "scheduled" so the cron picks them up immediately.
     *
     * A post is stuck if the server crashed while it was mid-flight.
     */
    async _recoverStuckPosts() {
        try {
            const getTenantDB = require('../../../utils/tenantDB');
            const Tenant = mongoose.model('Tenant');
            const activeTenants = await Tenant.find({ status: 'active' }).lean();

            let totalRecovered = 0;

            for (const tenant of activeTenants) {
                try {
                    const db = await getTenantDB(tenant._id);
                    const SocialPost = db.model(
                        'SocialPostEnterprise',
                        require('../../../models/social/SocialPost')
                    );

                    const result = await SocialPost.updateMany(
                        { status: 'publishing' },
                        { $set: { status: 'scheduled', error: 'Recovered after server restart', error_message: 'Recovered after server restart' } }
                    );

                    if (result.modifiedCount > 0) {
                        warn(SCHEDULER_TAG, `Tenant ${tenant._id}: recovered ${result.modifiedCount} stuck post(s) → scheduled`);
                        totalRecovered += result.modifiedCount;
                    }
                } catch (tenantErr) {
                    warn(SCHEDULER_TAG, `Recovery failed for tenant ${tenant._id}: ${tenantErr.message}`);
                }
            }

            if (totalRecovered > 0) {
                log(SCHEDULER_TAG, `✅ Recovery complete — ${totalRecovered} post(s) re-queued`);
            } else {
                log(SCHEDULER_TAG, '✅ Recovery check complete — no stuck posts found');
            }
        } catch (e) {
            warn(SCHEDULER_TAG, `Recovery step failed: ${e?.message}`);
        }
    }

    // ──────────────────────────────────────────────────────
    // PUBLISH PIPELINE
    // ──────────────────────────────────────────────────────

    /**
     * Iterate over every active tenant and dispatch due posts.
     * isProcessing guard ensures concurrent cron ticks don't overlap.
     */
    async processAllTenants() {
        if (this.isProcessing) {
            warn(SCHEDULER_TAG, 'Previous tick is still running — skipping this tick');
            return;
        }
        this.isProcessing = true;

        try {
            const Tenant = mongoose.model('Tenant');
            const activeTenants = await Tenant.find({ status: 'active' }).lean();

            for (const tenant of activeTenants) {
                try {
                    await this.processScheduledPostsForTenant(tenant._id);
                } catch (tenantErr) {
                    err(SCHEDULER_TAG, `Tenant ${tenant._id} processing error: ${tenantErr.message}`);
                }
            }
        } catch (e) {
            err(SCHEDULER_TAG, `Critical error in processAllTenants: ${e?.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Find all scheduled posts for a tenant that are now due and publish them.
     */
    async processScheduledPostsForTenant(tenantId) {
        const getTenantDB = require('../../../utils/tenantDB');
        const db = await getTenantDB(tenantId);

        const SocialPost = db.model(
            'SocialPostEnterprise',
            require('../../../models/social/SocialPost')
        );

        const now = new Date();
        const pendingPosts = await SocialPost.find({
            status: 'scheduled',
            scheduledAt: { $lte: now }
        }).populate('account').populate('campaign');

        if (pendingPosts.length === 0) return;

        log(SCHEDULER_TAG, `Tenant ${tenantId}: ${pendingPosts.length} post(s) due for publishing`);

        for (const post of pendingPosts) {
            if (post.platform === 'instagram') {
                await SocialPost.findByIdAndUpdate(post._id, { $set: { status: 'pending' } });
                await enqueueInstagramPublishJob({
                    tenantId: tenantId.toString(),
                    branchId: post.branch.toString(),
                    accountId: post.account?._id?.toString(),
                    postId: post._id.toString(),
                    campaignId: post.campaign?._id?.toString()
                });
                log(SCHEDULER_TAG, `Queued scheduled Instagram post ${post._id}`);
                continue;
            }
            await this._publishWithRetry(db, post);
        }
    }

    /**
     * Attempt to publish a single post with up to MAX_RETRIES tries.
     * Status transitions:  scheduled → publishing → published
     *                                             └→ failed (after all retries exhausted)
     */
    async _publishWithRetry(db, post) {
        const tag = `${SCHEDULER_TAG} [Post:${post._id}] [${post.platform}]`;

        if (['deleted', 'cancelled'].includes(post.status) || ['deleted', 'cancelled'].includes(post.campaign?.status)) {
            log(tag, 'Skipping publish because post or campaign was cancelled/deleted.');
            return;
        }

        // Mark as publishing immediately so no other tick picks it up
        post.status = 'publishing';
        await post.save();

        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const latestPost = await db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'))
                    .findById(post._id)
                    .populate('campaign');
                if (!latestPost || ['deleted', 'cancelled'].includes(latestPost.status) || ['deleted', 'cancelled'].includes(latestPost.campaign?.status)) {
                    log(tag, 'Stopping scheduled publish because post or campaign was cancelled/deleted.');
                    return;
                }

                log(tag, `Attempt ${attempt}/${MAX_RETRIES} — publishing...`);

                const SocialPostService = require('./SocialPostService');
                const postService = new SocialPostService(db);

                // Build postData from the populated campaign
                const postData = {
                    content: post.caption || post.campaign?.content || '',
                    media:   post.campaign?.media   || [],
                    postType: post.postType || post.campaign?.postType || 'post'
                };

                // Call the modular publish routing method
                const platformPostId = await postService.publishToPlatform(post.account, postData);

                // ✅ SUCCESS
                post.platformPostId   = platformPostId;
                post.platform_media_id = platformPostId;
                post.status           = 'completed';
                post.publishedAt      = new Date();
                post.error            = undefined;
                await post.save();

                log(tag, `✅ Published successfully (platformPostId: ${platformPostId})`);

                // Update parent campaign status
                if (post.campaign?._id) {
                    await this._updateCampaignStatus(db, post.campaign._id);
                }

                return; // Done — exit retry loop

            } catch (e) {
                lastError = e;
                err(tag, `Attempt ${attempt} failed: ${e.message}`);

                const isClientError = /40[0134]/.test(e.message);
                if (isClientError) {
                    warn(tag, 'Client-side error detected — aborting retries immediately');
                    break;
                }

                if (attempt < MAX_RETRIES) {
                    const delay = BASE_BACKOFF_MS * attempt;
                    log(tag, `Retrying in ${delay}ms...`);
                    await sleep(delay);
                }
            }
        }

        // ❌ All attempts exhausted
        err(tag, `Failed after ${MAX_RETRIES} attempt(s): ${lastError?.message}`);
        post.status = 'failed';
        post.error  = lastError?.message || 'Unknown error';
        await post.save();

        if (post.campaign?._id) {
            await this._updateCampaignStatus(db, post.campaign._id);
        }
    }

    // ──────────────────────────────────────────────────────
    // CAMPAIGN STATUS ROLLUP
    // ──────────────────────────────────────────────────────

    /**
     * After every post finishes, check if the parent campaign is fully resolved.
     * Campaign becomes 'completed' when every post is published or failed.
     */
    async _updateCampaignStatus(db, campaignId) {
        const SocialPost     = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));
        const SocialCampaign = db.model('SocialCampaign',        require('../../../models/social/SocialCampaign'));

        const posts = await SocialPost.find({ campaign: campaignId });
        if (posts.length === 0) return;

        const TERMINAL = ['published', 'completed', 'failed', 'cancelled', 'deleted'];
        const allDone  = posts.every((p) => TERMINAL.includes(p.status));

        if (!allDone) return; // still in flight

        const hasPublished = posts.some((p) => ['published', 'completed'].includes(p.status));
        const hasFailed    = posts.some((p) => p.status === 'failed');
        const newStatus    = hasFailed ? (hasPublished ? 'completed' : 'failed') : 'completed';

        await SocialCampaign.findByIdAndUpdate(campaignId, {
            status: newStatus,
            'meta.publishedPosts': posts.filter((p) => ['published', 'completed'].includes(p.status)).length,
            'meta.failedPosts':    posts.filter((p) => p.status === 'failed').length,
            'meta.completedAt':    new Date()
        });

        log(SCHEDULER_TAG, `Campaign ${campaignId} → status: ${newStatus}`);
    }

    // ──────────────────────────────────────────────────────
    // METRICS SYNC
    // ──────────────────────────────────────────────────────

    async syncAllTenantsMetrics() {
        try {
            const Tenant = mongoose.model('Tenant');
            const activeTenants = await Tenant.find({ status: 'active' }).lean();

            for (const tenant of activeTenants) {
                try {
                    await this._syncMetricsForTenant(tenant._id);
                } catch (tenantErr) {
                    err(METRICS_TAG, `Tenant ${tenant._id} metrics sync error: ${tenantErr.message}`);
                }
            }
        } catch (e) {
            err(METRICS_TAG, `Critical error in syncAllTenantsMetrics: ${e?.message}`);
        }
    }

    async _syncMetricsForTenant(tenantId) {
        const getTenantDB = require('../../../utils/tenantDB');
        const db = await getTenantDB(tenantId);

        const SocialPost = db.model(
            'SocialPostEnterprise',
            require('../../../models/social/SocialPost')
        );

        const activePosts = await SocialPost.find({
            status: { $in: ['published', 'completed'] },
            platformPostId: { $exists: true, $ne: null }
        }).populate('account');

        if (activePosts.length === 0) return;

        log(METRICS_TAG, `Tenant ${tenantId}: syncing metrics for ${activePosts.length} post(s)`);

        const SocialPostService = require('./SocialPostService');
        const postService = new SocialPostService(db);

        for (const post of activePosts) {
            try {
                const adapter = postService._getAdapter(
                    post.account.platform,
                    await postService._getToken(post.account),
                    post.account.platformAccountId
                );
                const rawMetrics = await adapter.getMetrics(post.platformPostId);

                if (rawMetrics) {
                    const normalized = this._normalizePlatformMetrics(post.platform, rawMetrics);
                    post.metrics     = { ...post.metrics, ...normalized };
                    post.lastUpdated = new Date();
                    await post.save();
                    log(METRICS_TAG, `Post ${post._id} metrics updated`);
                }
            } catch (postErr) {
                warn(METRICS_TAG, `Post ${post._id} metrics fetch failed: ${postErr.message}`);
            }
        }
    }

    /**
     * Normalize raw platform metrics into a canonical shape.
     */
    _normalizePlatformMetrics(platform, raw) {
        if (platform === 'facebook') {
            const data = raw.data || [];
            const get  = (name) => data.find((m) => m.name === name)?.values?.[0]?.value || 0;
            return {
                impressions: get('post_impressions'),
                likes:       get('post_reactions_by_type_total')?.like || 0,
                comments:    0,
                shares:      0,
                views:       get('post_impressions')
            };
        }

        if (platform === 'instagram') {
            const data = raw.data || [];
            const get  = (name) => data.find((m) => m.name === name)?.values?.[0]?.value || 0;
            return {
                impressions:  get('impressions'),
                reach:        get('reach'),
                engagements:  get('engagement'),
                views:        get('impressions')
            };
        }

        if (platform === 'linkedin') {
            if (raw.source === 'socialActions') {
                return {
                    likes:       raw.likes    || 0,
                    comments:    raw.comments || 0,
                    shares:      0,
                    views:       0,
                    impressions: 0
                };
            }
            const stats = raw.elements?.[0]?.totalShareStatistics || {};
            return {
                likes:       stats.likeCount       || 0,
                comments:    stats.commentCount     || 0,
                shares:      stats.shareCount       || 0,
                views:       stats.viewCount        || 0,
                impressions: stats.impressionCount  || 0
            };
        }

        return {};
    }
}

// ─────────────────────────────────────────────────────────
// Singleton export — safe to require multiple times
// ─────────────────────────────────────────────────────────
module.exports = new SocialSchedulerService();
