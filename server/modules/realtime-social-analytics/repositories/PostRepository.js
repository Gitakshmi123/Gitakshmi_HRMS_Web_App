const mongoose = require('mongoose');
const getTenantDB = require('../../../utils/tenantDB');
const { decrypt, encrypt } = require('../../social-media-enterprise/utils/tokenEncryption');

const SocialPostSchema = require('../../../models/social/SocialPost');
const SocialAccountSchema = require('../../../models/social/SocialAccount');
const SocialPostMetricSnapshotSchema = require('../../../models/social/SocialPostMetricSnapshot');

function getModel(db, name, schema) {
  return db.models[name] || db.model(name, schema);
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getPostExternalId(post) {
  return post.platform_media_id || post.platformPostId || post.platformAssetUrn || '';
}

function getPostTitle(post) {
  return post.caption || post.platformPostId || post.platform_media_id || 'Social post';
}

class PostRepository {
  async getTenantContext(tenantId) {
    if (!tenantId) {
      const error = new Error('Tenant is required for Mongo social analytics.');
      error.code = 'TENANT_REQUIRED';
      throw error;
    }

    const db = await getTenantDB(tenantId);
    if (!db) {
      const error = new Error('Tenant database is not available.');
      error.code = 'TENANT_DB_UNAVAILABLE';
      throw error;
    }

    return {
      db,
      SocialPost: getModel(db, 'SocialPostEnterprise', SocialPostSchema),
      SocialAccount: getModel(db, 'SocialAccountEnterprise', SocialAccountSchema),
      SocialPostMetricSnapshot: getModel(db, 'SocialPostMetricSnapshot', SocialPostMetricSnapshotSchema)
    };
  }

  normalizePost(post, db = null) {
    const plain = typeof post.toObject === 'function' ? post.toObject() : post;
    const account = plain.account || {};
    const metrics = plain.metrics || {};

    const normalized = {
      id: String(plain._id),
      _id: plain._id,
      tenant_id: String(plain.tenant || ''),
      branch_id: plain.branch ? String(plain.branch) : null,
      platform: plain.platform,
      external_post_id: getPostExternalId(plain),
      platform_account_id: account.platformAccountId || plain.platformAccountId || '',
      account_name: account.accountName || '',
      handle: account.meta?.handle || '',
      account_id: account._id ? String(account._id) : plain.account ? String(plain.account) : null,
      title: getPostTitle(plain),
      permalink: plain.permalink || plain.url || '',
      sync_enabled: ['published', 'completed'].includes(plain.status) && Boolean(getPostExternalId(plain)),
      last_synced_at: plain.lastSynced || plain.lastUpdated || plain.updatedAt || null,
      created_at: plain.createdAt,
      likes: numberOrZero(plain.likes ?? metrics.likes),
      comments: numberOrZero(plain.comments ?? metrics.comments),
      shares: numberOrZero(plain.shares ?? metrics.shares),
      reach: numberOrZero(plain.reach ?? metrics.reach),
      impressions: numberOrZero(plain.impressions ?? metrics.impressions),
      metrics_collected_at: plain.lastSynced || plain.lastUpdated || plain.updatedAt || null,
      token_expires_at: account.expiresAt || null
    };

    Object.defineProperties(normalized, {
      access_token: {
        value: account.accessToken ? decrypt(account.accessToken) : null,
        enumerable: false,
        writable: true
      },
      refresh_token: {
        value: account.refreshToken ? decrypt(account.refreshToken) : null,
        enumerable: false,
        writable: true
      }
    });

    if (db) {
      Object.defineProperty(normalized, '_mongo', {
        value: { db },
        enumerable: false
      });
    }

    return normalized;
  }

  async listPosts({ tenantId, limit = 100, offset = 0 }) {
    const { db, SocialPost } = await this.getTenantContext(tenantId);
    const query = {};
    if (mongoose.Types.ObjectId.isValid(String(tenantId))) {
      query.tenant = new mongoose.Types.ObjectId(String(tenantId));
    }

    const posts = await SocialPost.find(query)
      .populate('account')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return posts.map((post) => this.normalizePost(post, db));
  }

  async getPostMetrics(postId, { tenantId, limit = 100 } = {}) {
    const { db, SocialPost, SocialPostMetricSnapshot } = await this.getTenantContext(tenantId);
    if (!mongoose.Types.ObjectId.isValid(String(postId))) return null;

    const post = await SocialPost.findById(postId).populate('account').lean();
    if (!post) return null;

    const snapshots = await SocialPostMetricSnapshot.find({ post: post._id })
      .sort({ collectedAt: -1 })
      .limit(limit)
      .lean();

    const normalized = this.normalizePost(post, db);
    return {
      post: normalized,
      metrics: snapshots.length
        ? snapshots.map((snapshot) => ({
          likes: numberOrZero(snapshot.likes),
          comments: numberOrZero(snapshot.comments),
          shares: numberOrZero(snapshot.shares),
          reach: numberOrZero(snapshot.reach),
          impressions: numberOrZero(snapshot.impressions),
          raw: snapshot.raw || {},
          collected_at: snapshot.collectedAt
        }))
        : [{
          likes: normalized.likes,
          comments: normalized.comments,
          shares: normalized.shares,
          reach: normalized.reach,
          impressions: normalized.impressions,
          raw: {},
          collected_at: normalized.metrics_collected_at
        }]
    };
  }

  async listSyncTargets({ limit = 200 } = {}) {
    const Tenant = mongoose.model('Tenant');
    const tenants = await Tenant.find({ status: { $ne: 'inactive' } }).select('_id code databaseName').lean();
    const targets = [];

    for (const tenant of tenants) {
      if (targets.length >= limit) break;

      try {
        const { db, SocialPost } = await this.getTenantContext(tenant._id);
        const remaining = limit - targets.length;
        const posts = await SocialPost.find({
          status: { $in: ['published', 'completed'] },
          platform: { $in: ['facebook', 'instagram', 'linkedin'] },
          $or: [
            { platformPostId: { $nin: [null, ''] } },
            { platform_media_id: { $nin: [null, ''] } },
            { platformAssetUrn: { $nin: [null, ''] } }
          ]
        })
          .populate('account')
          .sort({ lastSynced: 1, lastUpdated: 1, createdAt: 1 })
          .limit(remaining)
          .lean();

        targets.push(...posts.map((post) => this.normalizePost(post, db)).filter((post) => post.access_token));
      } catch (error) {
        console.warn(`[RealtimeSocialAnalytics] tenant ${tenant._id} Mongo sync target load failed: ${error.message}`);
      }
    }

    return targets;
  }

  async saveMetrics(post, metrics) {
    const db = post._mongo?.db || (await this.getTenantContext(post.tenant_id)).db;
    const SocialPost = getModel(db, 'SocialPostEnterprise', SocialPostSchema);
    const SocialPostMetricSnapshot = getModel(db, 'SocialPostMetricSnapshot', SocialPostMetricSnapshotSchema);

    const previous = await SocialPost.findById(post.id).select('likes comments shares reach impressions metrics').lean();
    const changed = !previous ||
      numberOrZero(previous.likes ?? previous.metrics?.likes) !== numberOrZero(metrics.likes) ||
      numberOrZero(previous.comments ?? previous.metrics?.comments) !== numberOrZero(metrics.comments) ||
      numberOrZero(previous.shares ?? previous.metrics?.shares) !== numberOrZero(metrics.shares) ||
      numberOrZero(previous.reach ?? previous.metrics?.reach) !== numberOrZero(metrics.reach) ||
      numberOrZero(previous.impressions ?? previous.metrics?.impressions) !== numberOrZero(metrics.impressions);

    const normalized = {
      likes: numberOrZero(metrics.likes),
      comments: numberOrZero(metrics.comments),
      shares: numberOrZero(metrics.shares),
      reach: numberOrZero(metrics.reach),
      impressions: numberOrZero(metrics.impressions),
      raw: metrics.raw || {},
      collected_at: new Date()
    };

    await SocialPost.findByIdAndUpdate(post.id, {
      $set: {
        likes: normalized.likes,
        comments: normalized.comments,
        shares: normalized.shares,
        reach: normalized.reach,
        impressions: normalized.impressions,
        views: normalized.impressions || normalized.reach,
        'metrics.likes': normalized.likes,
        'metrics.comments': normalized.comments,
        'metrics.shares': normalized.shares,
        'metrics.reach': normalized.reach,
        'metrics.impressions': normalized.impressions,
        'metrics.views': normalized.impressions || normalized.reach,
        'metrics.engagements': normalized.likes + normalized.comments + normalized.shares,
        lastUpdated: normalized.collected_at,
        lastSynced: normalized.collected_at,
        ...(metrics.externalPostId ? { platform_media_id: metrics.externalPostId } : {})
      }
    });

    await SocialPostMetricSnapshot.create({
      tenant: post.tenant_id,
      branch: post.branch_id || null,
      post: post.id,
      account: post.account_id || null,
      platform: post.platform,
      likes: normalized.likes,
      comments: normalized.comments,
      shares: normalized.shares,
      reach: normalized.reach,
      impressions: normalized.impressions,
      raw: normalized.raw,
      collectedAt: normalized.collected_at
    });

    return {
      changed,
      metrics: normalized
    };
  }

  async updateToken(postId, tokenData = {}) {
    if (!postId) return;

    const Tenant = mongoose.model('Tenant');
    const tenants = await Tenant.find({ status: { $ne: 'inactive' } }).select('_id').lean();

    for (const tenant of tenants) {
      const { SocialPost, SocialAccount } = await this.getTenantContext(tenant._id);
      const post = await SocialPost.findById(postId).select('account').lean();
      if (!post?.account) continue;

      const update = {};
      if (tokenData.accessToken) update.accessToken = encrypt(tokenData.accessToken);
      if (tokenData.refreshToken) update.refreshToken = encrypt(tokenData.refreshToken);
      if (tokenData.expiresAt) update.expiresAt = tokenData.expiresAt;

      if (Object.keys(update).length) {
        await SocialAccount.findByIdAndUpdate(post.account, { $set: update });
      }
      return;
    }
  }
}

module.exports = PostRepository;
