const CHANNEL = process.env.SOCIAL_ANALYTICS_REDIS_CHANNEL || 'social:analytics:metrics';

function createRedisClient(role) {
  if (!process.env.REDIS_URL) return null;
  const IORedis = require('ioredis');
  const client = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
  });

  client.on('error', (error) => {
    console.warn(`[RealtimeSocialAnalytics][Redis:${role}] ${error.message}`);
  });

  client.connect().catch((error) => {
    console.warn(`[RealtimeSocialAnalytics][Redis:${role}] connect failed: ${error.message}`);
  });

  return client;
}

class RedisEventBus {
  constructor() {
    this.publisher = createRedisClient('publisher');
    this.subscriber = createRedisClient('subscriber');
    this.localHandlers = new Set();
  }

  getCacheClient() {
    return this.publisher;
  }

  async publishMetrics(payload) {
    const event = {
      type: 'social.metrics.updated',
      payload,
      emittedAt: new Date().toISOString()
    };

    if (this.publisher?.status === 'ready') {
      await this.publisher.publish(CHANNEL, JSON.stringify(event));
      return;
    }

    this.localHandlers.forEach((handler) => handler(event));
  }

  async subscribe(handler) {
    this.localHandlers.add(handler);

    if (!this.subscriber) return;
    this.subscriber.on('message', (_channel, message) => {
      try {
        handler(JSON.parse(message));
      } catch (error) {
        console.warn('[RealtimeSocialAnalytics][Redis] Invalid message:', error.message);
      }
    });

    if (this.subscriber.status === 'ready') {
      await this.subscriber.subscribe(CHANNEL);
      return;
    }

    this.subscriber.once('ready', () => {
      this.subscriber.subscribe(CHANNEL).catch((error) => {
        console.warn('[RealtimeSocialAnalytics][Redis] subscribe failed:', error.message);
      });
    });
  }
}

module.exports = new RedisEventBus();
