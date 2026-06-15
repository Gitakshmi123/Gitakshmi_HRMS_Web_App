/**
 * SocialCampaignService — Complete Post Flow
 *
 * FLOW:
 *  createCampaign()
 *    1. Validate per-platform rules
 *    2. Save Campaign as 'draft' (immediate) or 'scheduled'
 *    3. Pre-create SocialPost records (one per account)
 *    4a. Scheduled → return immediately; scheduler picks up at due time
 *    4b. Immediate → fire _publishCampaignInBackground() via setImmediate
 *        (HTTP response is returned FIRST, publish happens after)
 *
 * PUBLISH PIPELINE (_publishCampaignInBackground):
 *    For each post:
 *      - Mark 'publishing'
 *      - Call publishToFacebook / publishToInstagram / publishToLinkedIn
 *      - On success → save platformPostId + 'published'
 *      - On failure → save error + 'failed'
 *    Campaign status = 'completed' or 'failed'
 *
 * RETRY:
 *    retrySinglePost(postId) → re-publishes a 'failed' post
 *    Deduplication: refuses to retry a post already 'publishing' or 'published'
 *
 * ATOMICITY:
 *    Each SocialPost saves its own state. Campaign status is derived from posts.
 *    No partial-failure silently swallowed — every error is logged + stored.
 */

'use strict';

const TAG = '[SocialCampaignService]';
const { enqueueInstagramPublishJob } = require('../queues/InstagramPublishQueue');

class SocialCampaignService {
    constructor(db, socialPostService) {
        this.db = db;
        this.socialPostService = socialPostService;
        this.SocialCampaign = db.model('SocialCampaign',          require('../../../models/social/SocialCampaign'));
        this.SocialPost     = db.model('SocialPostEnterprise',     require('../../../models/social/SocialPost'));
        this.SocialAccount  = db.model('SocialAccountEnterprise',  require('../../../models/social/SocialAccount'));
    }

    _buildErrorUpdate(error) {
        return {
            error: error?.message || 'Unknown publishing error',
            error_message: error?.message || 'Unknown publishing error',
            error_details: error?.metaResponse || error?.response?.data || null,
            lastErrorAt: new Date()
        };
    }

    _isRetryableError(error) {
        const metaError = error?.metaResponse?.error || error?.response?.data?.error || {};
        const errorCode = Number(metaError.code || error?.code || 0);
        return Boolean(metaError.is_transient || error?.isRetryable || [4, 17, 32, 613].includes(errorCode));
    }

    _getDeferredRetryDelayMs(error, retryCount = 0) {
        const metaError = error?.metaResponse?.error || error?.response?.data?.error || {};
        const errorCode = Number(metaError.code || error?.code || 0);
        const rateLimitSchedule = [60000, 180000, 300000];
        const normalSchedule = [30000, 60000, 120000];
        const schedule = [4, 17, 32, 613].includes(errorCode) ? rateLimitSchedule : normalSchedule;
        return schedule[Math.min(retryCount, schedule.length - 1)];
    }

    _scheduleAutoRetry(postId, delayMs) {
        setTimeout(async () => {
            try {
                await this.retrySinglePost(postId, { skipAutoReschedule: false });
            } catch (error) {
                console.error(`${TAG}[AUTO_RETRY][Post:${postId}] Failed: ${error.message}`);
            }
        }, delayMs);
    }

    _isInFlightStatus(status) {
        return ['draft', 'scheduled', 'pending', 'publishing'].includes(status);
    }

    _isCancelableBeforeRemotePublish(status) {
        return ['draft', 'scheduled', 'pending'].includes(status);
    }

    // ─────────────────────────────────────────────────────────
    // 1. CREATE CAMPAIGN
    // ─────────────────────────────────────────────────────────

    /**
     * Step 1 — Validate, persist, then dispatch publish or schedule.
     */
    async createCampaign(campaignData) {
        const { content, media, scheduledAt, accounts, accountIds, postType, userId, tenantId, branchId, musicId } = campaignData;

        // ── Normalize account list ──
        let normalizedAccounts = accounts || [];
        if (!accounts && accountIds) {
            normalizedAccounts = accountIds.map(id => ({ accountId: id, useDefault: true, customCaption: '' }));
        }

        // ── Per-platform validation ──
        const validationErrors = [];
        const validAccounts    = [];

        for (const item of normalizedAccounts) {
            const account = await this.SocialAccount.findById(item.accountId);
            if (!account) {
                validationErrors.push({ accountId: item.accountId, error: 'Account not found' });
                continue;
            }

            const caption = (item.useDefault === false) ? (item.customCaption ?? '') : (content || '');

            if (account.platform === 'linkedin' && !caption.trim()) {
                validationErrors.push({ accountId: item.accountId, platform: 'linkedin', error: 'LinkedIn requires text content' });
                continue;
            }
            if (account.platform === 'instagram' && (!media || media.length === 0)) {
                validationErrors.push({ accountId: item.accountId, platform: 'instagram', error: 'Instagram requires at least one media file' });
                continue;
            }

            validAccounts.push({ accountDocument: account, caption });
        }

        if (validAccounts.length === 0) {
            return {
                success: false,
                message: 'All accounts failed validation',
                results: validationErrors.map(e => ({ ...e, status: 'failed' }))
            };
        }

        // ── Create Campaign record (always start as draft or scheduled) ──
        const initialStatus = scheduledAt ? 'scheduled' : 'draft';
        const campaign = await this.SocialCampaign.create({
            tenant:    tenantId,
            branch:    branchId,
            content:   content || '',
            postType:  postType || 'post',
            media:     media || [],
            scheduledAt,
            createdBy: userId,
            status:    initialStatus,
            meta: {
                platforms:   [...new Set(validAccounts.map(a => a.accountDocument.platform))],
                accountIds:  validAccounts.map(a => a.accountDocument._id),
                totalPosts:  validAccounts.length,
                publishedPosts: 0,
                failedPosts:    0
            }
        });

        // console.log(`${TAG} Campaign ${campaign._id} created — status: ${initialStatus} | accounts: ${validAccounts.length}`);

        // ── Pre-create SocialPost records ──
        const postRecords = [];
        for (const { accountDocument: account, caption } of validAccounts) {
            const postDoc = await this.SocialPost.create({
                tenant:      tenantId,
                branch:      branchId,
                campaign:    campaign._id,
                account:     account._id,
                platform:    account.platform,
                postType:    postType || 'post',
                caption,
                musicId:     musicId || null,
                status:      scheduledAt ? 'scheduled' : 'draft',
                scheduledAt: scheduledAt || null
            });
            postRecords.push({ postDoc, account, caption });
            // console.log(`${TAG} Post ${postDoc._id} created — platform: ${account.platform} | status: ${postDoc.status}`);
        }

        // ── Scheduled: hand off to cron scheduler ──
        if (scheduledAt) {
            return {
                success:    true,
                message:    'Campaign scheduled successfully. Will publish automatically at the selected time.',
                campaignId: campaign._id,
                status:     'scheduled',
                results:    postRecords.map(r => ({ accountId: r.account._id, platform: r.account.platform, status: 'scheduled' }))
            };
        }

        const instagramPosts = postRecords.filter(({ account }) => account.platform === 'instagram');
        const nonInstagramPosts = postRecords.filter(({ account }) => account.platform !== 'instagram');

        if (instagramPosts.length > 0) {
            await this.SocialPost.updateMany(
                { _id: { $in: instagramPosts.map(({ postDoc }) => postDoc._id) } },
                { $set: { status: 'pending' } }
            );

            for (const { postDoc, account } of instagramPosts) {
                await enqueueInstagramPublishJob({
                    tenantId: tenantId.toString(),
                    branchId: branchId.toString(),
                    accountId: account._id.toString(),
                    postId: postDoc._id.toString(),
                    campaignId: campaign._id.toString()
                });
            }
        }

        if (nonInstagramPosts.length > 0) {
            await this.SocialPost.updateMany(
                { _id: { $in: nonInstagramPosts.map(({ postDoc }) => postDoc._id) } },
                { $set: { status: 'publishing' } }
            );

            setImmediate(() =>
                this._publishCampaignInBackground(campaign, nonInstagramPosts).catch(e =>
                    console.error(`${TAG} Background publish crash for campaign ${campaign._id}:`, e.message)
                )
            );
        }

        const campaignDispatchStatus = instagramPosts.length > 0 ? 'pending' : 'publishing';
        await this.SocialCampaign.findByIdAndUpdate(campaign._id, { status: campaignDispatchStatus });

        return {
            success:    true,
            message:    instagramPosts.length > 0
                ? 'Campaign queued successfully. Instagram will publish in the background.'
                : 'Campaign is being published. Check the History page in a moment.',
            campaignId: campaign._id,
            status:     campaignDispatchStatus,
            results:    postRecords.map(r => ({
                accountId: r.account._id,
                platform: r.account.platform,
                status: r.account.platform === 'instagram' ? 'pending' : 'publishing'
            }))
        };
    }

    // ─────────────────────────────────────────────────────────
    // 2. BACKGROUND PUBLISH PIPELINE
    // ─────────────────────────────────────────────────────────

    /**
     * Publishes each SocialPost to its platform, updating status atomically.
     * Called after HTTP response is sent.
     */
    async _publishCampaignInBackground(campaign, postRecords) {
        let publishedCount = 0;
        let failedCount    = 0;

        // Process all non-Instagram posts in parallel for faster "Immediate" publishing
        await Promise.all(postRecords.map(async ({ postDoc, account, caption }) => {
            const platformTag = `${TAG}[${account.platform.toUpperCase()}][Post:${postDoc._id}]`;

            // Deduplication guard
            const freshPost = await this.SocialPost.findById(postDoc._id);
            if (!freshPost || ['deleted', 'cancelled'].includes(freshPost.status)) {
                return;
            }

            if (['published', 'completed'].includes(freshPost?.status)) {
                publishedCount++;
                return;
            }

            try {
                const postData = {
                    content:  caption,
                    media:    campaign.media || [],
                    postType: postDoc.postType || campaign.postType || 'post'
                };

                const platformPostId = await this.socialPostService.publishToPlatform(account, postData);
                const latestPost = await this.SocialPost.findById(postDoc._id).populate('account');

                if (!latestPost || ['deleted', 'cancelled'].includes(latestPost.status)) {
                    const cleanupAccount = latestPost?.account || account;
                    if (cleanupAccount && platformPostId) {
                        try {
                            await this.socialPostService.deleteFromPlatform(cleanupAccount, platformPostId);
                        } catch (cleanupError) {
                            console.error(`${platformTag} Cleanup after cancellation failed: ${cleanupError.message}`);
                        }
                    }
                    return;
                }

                await this.SocialPost.findByIdAndUpdate(postDoc._id, {
                    $set: {
                        status:          'completed',
                        platformPostId,
                        platform_media_id: platformPostId,
                        publishedAt:     new Date(),
                        error:           null,
                        error_message:   null,
                        error_details:   null,
                        lastPlatformResponse: { platformPostId }
                    }
                });

                publishedCount++;

            } catch (error) {
                const currentPost = await this.SocialPost.findById(postDoc._id).select('retryCount');
                if (this._isRetryableError(error) && (currentPost?.retryCount || 0) < 3) {
                    const delayMs = this._getDeferredRetryDelayMs(error, currentPost?.retryCount || 0);
                    await this.SocialPost.findByIdAndUpdate(postDoc._id, {
                        $set: {
                            status: 'pending',
                            nextRetryAt: new Date(Date.now() + delayMs),
                            ...this._buildErrorUpdate(error)
                        }
                    });
                    this._scheduleAutoRetry(postDoc._id, delayMs);
                    return;
                }

                await this.SocialPost.findByIdAndUpdate(postDoc._id, {
                    $set: { status: 'failed', nextRetryAt: null, ...this._buildErrorUpdate(error) }
                });

                failedCount++;
            }
        }));

        // Roll up campaign status
        const finalCampaignStatus = publishedCount > 0 ? 'completed' : 'failed';
        await this.SocialCampaign.findByIdAndUpdate(campaign._id, {
            $set: {
                status: finalCampaignStatus,
                'meta.publishedPosts': publishedCount,
                'meta.failedPosts':    failedCount,
                'meta.completedAt':    new Date()
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    // 3. RETRY FAILED POST
    // ─────────────────────────────────────────────────────────

    async retrySinglePost(postId, options = {}) {
        const post = await this.SocialPost.findById(postId).populate('account').populate('campaign');
        if (!post) throw new Error('Post not found');
        const { skipAutoReschedule = false } = options;

        // Deduplication guard
        if (['published', 'completed'].includes(post.status)) {
            return { success: false, message: 'Post is already published — no retry needed' };
        }
        if (post.status === 'publishing') {
            return { success: false, message: 'Post is currently being published — please wait' };
        }
        if (!['failed', 'draft', 'scheduled', 'pending'].includes(post.status)) {
            return { success: false, message: `Cannot retry a post with status: ${post.status}` };
        }

        if (post.platform === 'instagram') {
            await this.SocialPost.findByIdAndUpdate(postId, {
                $set: {
                    status: 'pending',
                    error: null,
                    error_message: null,
                    error_details: null,
                    nextRetryAt: null
                }
            });

            await enqueueInstagramPublishJob({
                tenantId: post.tenant.toString(),
                branchId: post.branch.toString(),
                accountId: post.account._id.toString(),
                postId: post._id.toString(),
                campaignId: post.campaign._id.toString()
            });

            return { success: true, status: 'pending', message: 'Instagram post queued for background publishing.' };
        }

        const platformTag = `${TAG}[RETRY][${post.platform?.toUpperCase()}][Post:${postId}]`;

        // Mark as publishing
        await this.SocialPost.findByIdAndUpdate(postId, {
            $set: { status: 'publishing', error: null, error_message: null, error_details: null, nextRetryAt: null },
            $inc: { retryCount: 1 }
        });

        try {
            const postData = {
                content:  post.caption || post.campaign?.content || '',
                media:    post.campaign?.media || [],
                postType: post.postType || post.campaign?.postType || 'post'
            };

            const platformPostId = await this.socialPostService.publishToPlatform(post.account, postData);

            await this.SocialPost.findByIdAndUpdate(postId, {
                $set: {
                    status:            'completed',
                    platformPostId,
                    platform_media_id: platformPostId,
                    publishedAt:       new Date(),
                    error:             null,
                    error_message:     null,
                    error_details:     null,
                    nextRetryAt:       null,
                    lastPlatformResponse: { platformPostId }
                }
            });


            // Update parent campaign
            if (post.campaign?._id) {
                await this._reconcileCampaignStatus(post.campaign._id);
            }

            return { success: true, status: 'completed', platformPostId };

        } catch (error) {
            const refreshedPost = await this.SocialPost.findById(postId).select('retryCount');
            if (!skipAutoReschedule && this._isRetryableError(error) && (refreshedPost?.retryCount || 0) < 3) {
                const delayMs = this._getDeferredRetryDelayMs(error, refreshedPost?.retryCount || 0);
                await this.SocialPost.findByIdAndUpdate(postId, {
                    $set: {
                        status: 'pending',
                        nextRetryAt: new Date(Date.now() + delayMs),
                        ...this._buildErrorUpdate(error)
                    }
                });
                this._scheduleAutoRetry(postId, delayMs);
                return {
                    success: true,
                    status: 'pending',
                    message: `Temporary Meta limit reached. Auto retry scheduled in ${Math.round(delayMs / 1000)} seconds.`
                };
            }

            await this.SocialPost.findByIdAndUpdate(postId, { $set: { status: 'failed', nextRetryAt: null, ...this._buildErrorUpdate(error) } });
            console.error(`${platformTag} ❌ Retry failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Reconcile campaign status by reading all its posts.
     */
    async _reconcileCampaignStatus(campaignId) {
        const posts = await this.SocialPost.find({ campaign: campaignId });
        const TERMINAL = ['published', 'completed', 'failed', 'cancelled', 'deleted'];
        const allDone  = posts.every(p => TERMINAL.includes(p.status));
        if (!allDone) return;

        const hasPublished = posts.some(p => ['published', 'completed'].includes(p.status));
        const hasFailed    = posts.some(p => p.status === 'failed');
        const newStatus    = hasFailed ? (hasPublished ? 'completed' : 'failed') : 'completed';

        await this.SocialCampaign.findByIdAndUpdate(campaignId, {
            $set: {
                status:                newStatus,
                'meta.publishedPosts': posts.filter(p => ['published', 'completed'].includes(p.status)).length,
                'meta.failedPosts':    posts.filter(p => p.status === 'failed').length
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    // 4. HISTORY / READ
    // ─────────────────────────────────────────────────────────

    async getBranchHistory(tenantId, branchId) {
        const campaigns = await this.SocialCampaign.find({ 
            tenant: tenantId, 
            branch: branchId,
            status: { $ne: 'deleted' } 
        }).sort({ createdAt: -1 });
        const campaignIds = campaigns.map(c => c._id);

        const posts = await this.SocialPost.find({
            campaign: { $in: campaignIds },
            status:   { $ne: 'deleted' }
        }).populate('account', 'accountName platform meta').populate('musicId');

        return campaigns.map(campaign => {
            const obj = campaign.toObject ? campaign.toObject() : campaign;
            const campaignPosts = posts.filter(p => p.campaign?.toString() === campaign._id.toString());
            obj.posts = campaignPosts;

            // Derive real-time effective status from post statuses
            if (campaignPosts.length > 0) {
                const statuses = campaignPosts.map(p => p.status);
                if (statuses.some(s => s === 'publishing'))     obj.status = 'publishing';
                else if (statuses.some(s => s === 'pending'))   obj.status = 'pending';
                else if (statuses.some(s => s === 'scheduled')) obj.status = 'scheduled';
                else if (statuses.every(s => ['published', 'completed', 'failed', 'cancelled', 'deleted'].includes(s))) {
                    obj.status = statuses.some(s => ['published', 'completed'].includes(s)) ? 'completed' : 'failed';
                }
            }

            return obj;
        });
    }

    async getCampaignWithPosts(campaignId) {
        const campaign = await this.SocialCampaign.findById(campaignId).populate('createdBy', 'firstName lastName');
        const posts    = await this.SocialPost.find({ campaign: campaignId }).populate('account');
        return { campaign, posts };
    }

    _getRemoteDeleteIds(post) {
        if (!post) return null;
        const ids = [];
        const add = (value) => {
            const normalized = String(value || '').trim();
            if (normalized && !ids.includes(normalized)) ids.push(normalized);
        };

        if (post.platform === 'instagram') {
            add(post.platform_media_id);
            add(post.platformPostId);
            return ids;
        }

        if (post.platform === 'facebook') {
            const postType = String(post.postType || '').toLowerCase();
            const mediaFirst = ['reel', 'story', 'video'].includes(postType) || Boolean(post.platform_media_id);
            if (mediaFirst) {
                add(post.platform_media_id);
                add(post.platformPostId);
            } else {
                add(post.platformPostId);
                add(post.platform_media_id);
            }
            return ids;
        }

        add(post.platformPostId);
        add(post.platform_media_id);
        return ids;
    }

    _getRemoteDeleteId(post) {
        return this._getRemoteDeleteIds(post)?.[0] || null;
    }

    async _markPostDeletedForCancellation(postId) {
        await this.SocialPost.findByIdAndUpdate(postId, {
            $set: {
                status: 'deleted',
                nextRetryAt: null,
                error: null,
                error_message: null,
                error_details: null,
                lastErrorAt: null
            }
        });
    }

    async _attemptRemoteDelete(post) {
        const remoteDeleteIds = this._getRemoteDeleteIds(post);
        const remoteDeleteId = remoteDeleteIds?.[0] || null;
        const baseResult = {
            postId: post._id.toString(),
            campaignId: post.campaign?.toString?.() || null,
            platform: post.platform,
            platformPostId: post.platformPostId || null,
            platformMediaId: post.platform_media_id || null,
            remoteDeleteId: remoteDeleteId || null,
            remoteDeleteIds: remoteDeleteIds || []
        };

        if (!remoteDeleteId) {
            if (String(post.status || '').toLowerCase() === 'publishing') {
                return {
                    ...baseResult,
                    success: false,
                    deletedFromPlatform: false,
                    error: 'Post is still publishing and does not have a platform ID yet. Please wait a few seconds, refresh history, and delete again.'
                };
            }

            return {
                ...baseResult,
                success: true,
                deletedFromPlatform: false,
                message: this._isInFlightStatus(post.status)
                    ? 'Post was cancelled before remote publishing completed.'
                    : 'No remote platform reference found. Local delete only.'
            };
        }

        if (!post.account) {
            const error = new Error(`Connected ${post.platform} account is missing for this post.`);
            await this.SocialPost.findByIdAndUpdate(post._id, {
                $set: { ...this._buildErrorUpdate(error) }
            });
            return {
                ...baseResult,
                success: false,
                deletedFromPlatform: false,
                error: error.message
            };
        }

        const errors = [];
        try {
            for (const candidateId of remoteDeleteIds) {
                try {
                    await this.socialPostService.deleteFromPlatform(post.account, candidateId);
                    return {
                        ...baseResult,
                        remoteDeleteId: candidateId,
                        success: true,
                        deletedFromPlatform: true,
                        message: `Deleted from ${post.platform}.`
                    };
                } catch (error) {
                    errors.push({
                        remoteDeleteId: candidateId,
                        message: error.message,
                        details: error.metaResponse || error.response?.data || null
                    });
                }
            }
            throw new Error(errors.map((item) => `${item.remoteDeleteId}: ${item.message}`).join(' | '));
        } catch (error) {
            await this.SocialPost.findByIdAndUpdate(post._id, {
                $set: {
                    ...this._buildErrorUpdate(error),
                    error_details: errors.length > 0 ? { deleteAttempts: errors } : (error.metaResponse || error.response?.data || null)
                }
            });
            return {
                ...baseResult,
                success: false,
                deletedFromPlatform: false,
                error: error.message,
                errors
            };
        }
    }

    async _cleanupCampaignIfEmpty(campaignId) {
        if (!campaignId) return;

        const remainingPosts = await this.SocialPost.countDocuments({ campaign: campaignId });
        if (remainingPosts === 0) {
            await this.SocialCampaign.findByIdAndDelete(campaignId);
            return;
        }

        await this._reconcileCampaignStatus(campaignId);
    }

    // ─────────────────────────────────────────────────────────
    // 5. DELETE
    // ─────────────────────────────────────────────────────────

    async deleteCampaign(campaignId) {
        const campaign = await this.SocialCampaign.findById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        const posts = await this.SocialPost.find({ campaign: campaignId }).populate('account');
        const cancellablePosts = posts.filter((post) => this._isCancelableBeforeRemotePublish(post.status) && !this._getRemoteDeleteId(post));
        if (cancellablePosts.length > 0) {
            await Promise.all(cancellablePosts.map((post) => this._markPostDeletedForCancellation(post._id)));
        }
        const deleteResults = await Promise.all(posts.map((post) => this._attemptRemoteDelete(post)));
        const failedDeletes = deleteResults.filter((result) => !result.success);

        if (failedDeletes.length > 0) {
            const successfulRemoteDeletes = deleteResults.filter((result) => result.success && result.deletedFromPlatform);
            if (successfulRemoteDeletes.length > 0) {
                await this.SocialPost.updateMany(
                    { _id: { $in: successfulRemoteDeletes.map((result) => result.postId) } },
                    {
                        $set: {
                            status: 'deleted',
                            error: null,
                            error_message: null,
                            error_details: null,
                            lastErrorAt: null
                        }
                    }
                );
            }

            return {
                success: false,
                status: 'platform_delete_failed',
                message: `${failedDeletes.length} platform delete request(s) failed. Local records were kept so you can retry safely.`,
                results: deleteResults
            };
        }

        await this.SocialPost.deleteMany({ campaign: campaignId });
        await this.SocialCampaign.findByIdAndDelete(campaignId);

        return {
            success: true,
            status: 'deleted',
            message: 'Campaign deleted from connected platforms and removed from HRMS.',
            results: deleteResults
        };
    }

    async deleteSinglePost(postId) {
        const post = await this.SocialPost.findById(postId).populate('account');
        if (!post) throw new Error('Post not found');

        if (this._isInFlightStatus(post.status) && !this._getRemoteDeleteId(post)) {
            await this._markPostDeletedForCancellation(post._id);
        }

        const deleteResult = await this._attemptRemoteDelete(post);
        if (!deleteResult.success) {
            return {
                success: false,
                status: 'platform_delete_failed',
                message: `Failed to delete the ${post.platform} item from the connected platform. Local record was kept so you can retry safely.`,
                result: deleteResult
            };
        }

        await this.SocialPost.findByIdAndDelete(postId);
        await this._cleanupCampaignIfEmpty(post.campaign);

        return {
            success: true,
            status: 'deleted',
            message: deleteResult.deletedFromPlatform
                ? `Post deleted from ${post.platform} and removed from HRMS.`
                : 'Post removed from HRMS.',
            result: deleteResult
        };
    }

    // ─────────────────────────────────────────────────────────
    // 6. UPDATE
    // ─────────────────────────────────────────────────────────

    async updateCampaignDBOnly(campaignId, updateData) {
        const campaign = await this.SocialCampaign.findById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        const { content, media, scheduledAt, postUpdates } = updateData;
        if (content    !== undefined) campaign.content    = content;
        if (media      !== undefined) campaign.media      = media;
        if (scheduledAt !== undefined) campaign.scheduledAt = scheduledAt;
        await campaign.save();

        const updateFields = {};
        if (scheduledAt !== undefined) updateFields.scheduledAt = campaign.scheduledAt;
        if (content !== undefined)     updateFields.caption = content;

        if (Object.keys(updateFields).length > 0) {
            await this.SocialPost.updateMany(
                { campaign: campaignId, status: { $in: ['scheduled', 'draft', 'publishing'] } },
                { $set: updateFields }
            );
        }

        if (Array.isArray(postUpdates)) {
            for (const { postId, caption } of postUpdates) {
                if (postId && caption !== undefined) {
                    await this.SocialPost.findByIdAndUpdate(postId, { $set: { caption } });
                }
            }
        }

        return { success: true, campaign };
    }

    async syncUpdateToPlatforms(campaignId, content, campaign, postUpdatesMap) {
        if (content === undefined && !postUpdatesMap) return;

        const postsToSync = await this.SocialPost.find({
            campaign: campaignId,
            status:   { $in: ['published', 'completed', 'failed'] }
        }).populate('account');

        for (const post of postsToSync) {
            if (!post.account) continue;

            const captionToUse = postUpdatesMap?.[post._id.toString()] ?? post.caption ?? content ?? '';
            const platformTag  = `${TAG}[${post.platform?.toUpperCase()}_EDIT]`;

            if (!post.platformPostId) {
                try {
                    const newId = await this.socialPostService.publishToPlatform(post.account, {
                        content: captionToUse, media: campaign.media || [], postType: post.postType || 'post'
                    });
                    await this.SocialPost.findByIdAndUpdate(post._id, {
                        $set: {
                            platformPostId: newId,
                            caption: captionToUse,
                            status: 'published',
                            error: null,
                            error_message: null,
                            error_details: null,
                            lastPlatformResponse: { platformPostId: newId },
                            publishedAt: new Date()
                        }
                    });
                    // console.log(`${platformTag} Fresh publish success — ID: ${newId}`);
                } catch (e) {
                    await this.SocialPost.findByIdAndUpdate(post._id, { $set: { status: 'failed', ...this._buildErrorUpdate(e) } });
                    console.error(`${platformTag} Fresh publish failed: ${e.message}`);
                }
                continue;
            }

            try {
                const oldId = post.platformPostId;
                const finalId = await this.socialPostService.updateOnPlatform(
                    post.account, oldId, captionToUse, { media: campaign.media || [] }
                );
                await this.SocialPost.findByIdAndUpdate(post._id, {
                    $set: {
                        caption: captionToUse, platformPostId: finalId, status: 'published', error: null,
                        error_message: null, error_details: null, lastPlatformResponse: { platformPostId: finalId },
                        ...(finalId !== oldId ? { publishedAt: new Date() } : {})
                    }
                });
                // console.log(`${platformTag} Updated — Old: ${oldId} New: ${finalId}`);
            } catch (e) {
                await this.SocialPost.findByIdAndUpdate(post._id, { $set: { status: 'failed', ...this._buildErrorUpdate(e) } });
                console.error(`${platformTag} Update failed: ${e.message}`);
            }
        }
    }

    async updateCampaign(campaignId, updateData) {
        const result = await this.updateCampaignDBOnly(campaignId, updateData);
        if (updateData.content !== undefined || updateData.postUpdates) {
            await this.syncUpdateToPlatforms(campaignId, updateData.content, result.campaign);
        }
        return result;
    }
}

module.exports = SocialCampaignService;
