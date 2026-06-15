'use strict';

const mongoose = require('mongoose');
const getTenantDB = require('../../../utils/tenantDB');
const InstagramAdapter = require('../adapters/InstagramAdapter');
const { decrypt } = require('../utils/tokenEncryption');

const QUEUE_NAME = 'instagram-publish';
const JOB_NAME = 'instagram-publish-job';
const REQUEST_GAP_MS = 500;
const PUBLISH_WAIT_MS = 1000;
const RATE_LIMIT_DELAY_MS = 2000;
const MAX_ATTEMPTS = 3;

let queueInstance = null;
let workerInstance = null;
let redisConnection = null;
let queueLib = null;
let queueMode = 'memory';
let memoryQueue = [];
let memoryProcessing = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveQueueLib() {
    if (queueLib) return queueLib;
    const { Queue, Worker } = require('bullmq');
    const IORedis = require('ioredis');
    queueLib = { Queue, Worker, IORedis };
    return queueLib;
}

function buildRedisConnection() {
    if (redisConnection) return redisConnection;

    const { IORedis } = resolveQueueLib();
    const redisUrl = process.env.REDIS_URL;
    const baseOptions = {
        maxRetriesPerRequest: 0,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 1000,
        retryStrategy: () => null
    };

    redisConnection = redisUrl
        ? new IORedis(redisUrl, baseOptions)
        : new IORedis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT || 6379),
            password: process.env.REDIS_PASSWORD || undefined,
            ...baseOptions
        });

    redisConnection.on('error', (error) => {
        // console.error('[InstagramQueue] Redis error:', error.message);
    });

    return redisConnection;
}

function normalizeError(error) {
    return {
        message: error?.message || 'Unknown Instagram publishing error',
        metaResponse: error?.metaResponse || error?.response?.data || null,
        code: Number(error?.metaResponse?.error?.code || error?.response?.data?.error?.code || error?.code || 0),
        isRetryable: Boolean(
            error?.isRetryable ||
            error?.metaResponse?.error?.is_transient ||
            error?.response?.data?.error?.is_transient
        )
    };
}

async function updateCampaignStatus(db, campaignId) {
    const SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));
    const SocialCampaign = db.model('SocialCampaign', require('../../../models/social/SocialCampaign'));

    const posts = await SocialPost.find({ campaign: campaignId });
    if (!posts.length) return;

    const terminalStatuses = ['completed', 'failed', 'cancelled', 'deleted'];
    if (!posts.every((post) => terminalStatuses.includes(post.status))) return;

    const completedCount = posts.filter((post) => post.status === 'completed').length;
    const failedCount = posts.filter((post) => post.status === 'failed').length;
    const nextStatus = failedCount > 0 && completedCount === 0 ? 'failed' : 'completed';

    await SocialCampaign.findByIdAndUpdate(campaignId, {
        $set: {
            status: nextStatus,
            'meta.publishedPosts': completedCount,
            'meta.failedPosts': failedCount,
            'meta.completedAt': new Date()
        }
    });
}

async function processInstagramPublishJob(job) {
    await sleep(REQUEST_GAP_MS);

    const { tenantId, postId } = job.data;
    const db = await getTenantDB(tenantId);
    const SocialPost = db.model('SocialPostEnterprise', require('../../../models/social/SocialPost'));

    const post = await SocialPost.findById(postId).populate('account').populate('campaign');
    if (!post) return { skipped: true, reason: 'post_not_found' };
    if (['deleted', 'cancelled'].includes(post.status) || ['deleted', 'cancelled'].includes(post.campaign?.status)) {
        return { skipped: true, reason: 'post_cancelled' };
    }

    if (!post.account) {
        throw new Error('Instagram account not found for queued post');
    }

    const mediaItem = (post.campaign?.media || []).find((item) => item?.url);
    if (!mediaItem?.url) {
        throw new Error('No valid media (image or video) found for Instagram post.');
    }

    const currentToken = decrypt(post.account.accessToken);
    if (!currentToken) {
        throw new Error(`Failed to decrypt access token for account ${post.account._id}`);
    }

    // Use SocialPostService for normalization and platform execution
    const SocialPostService = require('../services/SocialPostService');
    const socialPostService = new SocialPostService(db);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const latestPost = await SocialPost.findById(postId).populate('campaign');
        if (!latestPost) return { skipped: true, reason: 'post_not_found' };
        if (['deleted', 'cancelled'].includes(latestPost.status) || ['deleted', 'cancelled'].includes(latestPost.campaign?.status)) {
            return { skipped: true, reason: 'post_cancelled' };
        }

        await SocialPost.findByIdAndUpdate(postId, {
            $set: {
                status: 'publishing',
                retryCount: attempt - 1,
                error: null,
                error_message: null,
                error_details: null,
                nextRetryAt: null,
                lastErrorAt: null
            }
        });

        try {
            // console.log(`[InstagramQueue][Post:${postId}] Publishing (Attempt ${attempt})...`);
            
            // This now includes FFmpeg normalization, polling, and final publish!
            const platformPostId = await socialPostService.executePost(postId);

            return { success: true, platformPostId };
        } catch (error) {
            const normalized = normalizeError(error);
            const isRateLimit = normalized.code === 4;
            const hasNextAttempt = attempt < MAX_ATTEMPTS;

            if (isRateLimit && hasNextAttempt) {
                await SocialPost.findByIdAndUpdate(postId, {
                    $set: {
                        status: 'pending',
                        retryCount: attempt,
                        error: normalized.message,
                        error_message: normalized.message,
                        error_details: normalized.metaResponse,
                        lastErrorAt: new Date(),
                        nextRetryAt: new Date(Date.now() + RATE_LIMIT_DELAY_MS)
                    }
                });

                await sleep(RATE_LIMIT_DELAY_MS);
                continue;
            }

            await SocialPost.findByIdAndUpdate(postId, {
                $set: {
                    status: 'failed',
                    retryCount: attempt - 1,
                    error: normalized.message,
                    error_message: normalized.message,
                    error_details: normalized.metaResponse,
                    lastErrorAt: new Date(),
                    nextRetryAt: null
                }
            });

            if (post.campaign?._id) {
                await updateCampaignStatus(db, post.campaign._id);
            }

            throw error;
        }
    }

    return { success: false };
}

function getInstagramPublishQueue() {
    if (queueInstance) return queueInstance;

    const { Queue } = resolveQueueLib();
    queueInstance = new Queue(QUEUE_NAME, {
        connection: buildRedisConnection()
    });
    return queueInstance;
}

async function pumpMemoryQueue() {
    if (memoryProcessing || memoryQueue.length === 0) return;
    memoryProcessing = true;

    while (memoryQueue.length > 0) {
        const job = memoryQueue.shift();
        try {
            await processInstagramPublishJob({ id: job.id, data: job.data });
            // console.log(`[InstagramQueue] Memory job completed: ${job.id}`);
        } catch (error) {
            // console.error(`[InstagramQueue] Memory job failed: ${job.id} | ${error.message}`);
        }
    }

    memoryProcessing = false;
}

async function enqueueInstagramPublishJob(data) {
    if (queueMode === 'bullmq') {
        const queue = getInstagramPublishQueue();
        return await queue.add(JOB_NAME, data, {
            removeOnComplete: 100,
            removeOnFail: 200,
            attempts: 1,
            jobId: `instagram:${data.postId}`
        });
    }

    const memoryJob = {
        id: `instagram:${data.postId}`,
        data
    };
    memoryQueue.push(memoryJob);
    setImmediate(() => {
        pumpMemoryQueue().catch((error) => {
            // console.error('[InstagramQueue] Memory queue crash:', error.message);
        });
    });
    return memoryJob;
}

async function initInstagramPublishWorker() {
    if (workerInstance) return workerInstance;

    try {
        const { Worker } = resolveQueueLib();
        const connection = buildRedisConnection();
        await connection.connect();
        await connection.ping();

        queueMode = 'bullmq';
        workerInstance = new Worker(
            QUEUE_NAME,
            processInstagramPublishJob,
            {
                connection,
                concurrency: 1
            }
        );

        workerInstance.on('completed', (job) => {
            // console.log(`[InstagramQueue] Job completed: ${job.id}`);
        });

        workerInstance.on('failed', (job, error) => {
            // console.error(`[InstagramQueue] Job failed: ${job?.id || 'unknown'} | ${error.message}`);
        });

        // console.log('[InstagramQueue] BullMQ worker initialized with concurrency=1');
        return workerInstance;
    } catch (error) {
        queueMode = 'memory';
        workerInstance = {
            mode: 'memory'
        };
        // console.warn('[InstagramQueue] Redis unavailable. Falling back to in-memory serial queue for local runtime.');
        return workerInstance;
    }
}

module.exports = {
    enqueueInstagramPublishJob,
    getInstagramPublishQueue,
    initInstagramPublishWorker
};
