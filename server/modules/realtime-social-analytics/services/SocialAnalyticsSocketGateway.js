const RedisEventBus = require('./RedisEventBus');
const { emitSocialAnalyticsUpdate } = require('../../../services/socket.service');

let initialized = false;

async function initializeSocialAnalyticsSocketGateway() {
  if (initialized) return;
  initialized = true;

  await RedisEventBus.subscribe((event) => {
    if (event?.type !== 'social.metrics.updated') return;
    const payload = event.payload || {};
    emitSocialAnalyticsUpdate(payload.tenantId, {
      ...payload,
      eventType: event.type,
      emittedAt: event.emittedAt
    });
  });
}

module.exports = {
  initializeSocialAnalyticsSocketGateway
};
