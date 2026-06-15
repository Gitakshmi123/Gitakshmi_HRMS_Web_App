function isRealtimeAnalyticsEnabled() {
  const configured = String(process.env.ENABLE_REALTIME_SOCIAL_ANALYTICS || '').trim().toLowerCase();
  if (configured === 'false') return false;
  if (configured === 'true') return true;
  return false;
}

async function initializeRealtimeSocialAnalytics() {
  if (!isRealtimeAnalyticsEnabled()) {
    console.log('[RealtimeSocialAnalytics] Disabled. Set ENABLE_REALTIME_SOCIAL_ANALYTICS=true to start Mongo-backed streaming and the worker.');
    return;
  }

  const { initializeSocialAnalyticsSocketGateway } = require('./services/SocialAnalyticsSocketGateway');
  const { startMetricsWorker } = require('./workers/MetricsWorker');

  await initializeSocialAnalyticsSocketGateway();
  startMetricsWorker();
}

module.exports = {
  initializeRealtimeSocialAnalytics,
  isRealtimeAnalyticsEnabled
};
