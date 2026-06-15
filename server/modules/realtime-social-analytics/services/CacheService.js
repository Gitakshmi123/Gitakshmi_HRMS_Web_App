class CacheService {
  constructor(redisClient = null, ttlSeconds = 25) {
    this.redis = redisClient;
    this.ttlSeconds = ttlSeconds;
    this.memory = new Map();
  }

  async get(key) {
    if (this.redis?.status === 'ready') {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    }

    const item = this.memory.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = this.ttlSeconds) {
    if (this.redis?.status === 'ready') {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    }

    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }
}

module.exports = CacheService;
