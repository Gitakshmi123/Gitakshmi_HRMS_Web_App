const CacheService = require('./CacheService');
const PlatformRegistry = require('./PlatformRegistry');
const PostRepository = require('../repositories/PostRepository');
const RedisEventBus = require('./RedisEventBus');
const TokenService = require('./TokenService');

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

class MetricsSyncService {
  constructor({
    repository = new PostRepository(),
    eventBus = RedisEventBus,
    cache = new CacheService(
      RedisEventBus.getCacheClient(),
      Number(process.env.SOCIAL_ANALYTICS_CACHE_TTL_SECONDS || 25)
    )
  } = {}) {
    this.repository = repository;
    this.eventBus = eventBus;
    this.cache = cache;
    this.tokenService = new TokenService(repository);
    this.platforms = new PlatformRegistry(this.tokenService);
    this.batchSize = Number(process.env.SOCIAL_ANALYTICS_BATCH_SIZE || 10);
  }

  cacheKey(post) {
    return `social-analytics:metrics:${post.platform}:${post.external_post_id}`;
  }

  async fetchMetricsWithCache(post) {
    const key = this.cacheKey(post);
    const cached = await this.cache.get(key);
    if (cached) return { metrics: cached, fromCache: true };

    const service = this.platforms.get(post.platform);
    const metrics = await service.fetchMetrics(post);
    await this.cache.set(key, metrics);
    return { metrics, fromCache: false };
  }

  async syncOnce() {
    const posts = await this.repository.listSyncTargets({
      limit: Number(process.env.SOCIAL_ANALYTICS_SYNC_LIMIT || 200)
    });

    let synced = 0;
    let emitted = 0;
    const errors = [];

    for (const batch of chunk(posts, this.batchSize)) {
      const results = await Promise.allSettled(batch.map((post) => this.syncPost(post)));
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          synced += result.value.synced ? 1 : 0;
          emitted += result.value.emitted ? 1 : 0;
        } else {
          errors.push(result.reason?.message || String(result.reason));
        }
      });
    }

    return {
      scanned: posts.length,
      synced,
      emitted,
      errors
    };
  }

  async syncPost(post) {
    const { metrics, fromCache } = await this.fetchMetricsWithCache(post);
    const saved = await this.repository.saveMetrics(post, metrics);
    const shouldEmit = saved.changed && !fromCache;

    if (shouldEmit) {
      await this.eventBus.publishMetrics({
        tenantId: post.tenant_id,
        postId: post.id,
        platform: post.platform,
        externalPostId: post.external_post_id,
        metrics: saved.metrics
      });
    }

    return {
      synced: true,
      emitted: shouldEmit
    };
  }
}

module.exports = MetricsSyncService;
