const cron = require('node-cron');
const MetricsSyncService = require('../services/MetricsSyncService');
const mongoose = require('mongoose');

let task = null;
let running = false;

function isEnabled() {
  const configured = String(process.env.ENABLE_REALTIME_SOCIAL_ANALYTICS || '').trim().toLowerCase();
  if (configured === 'false') return false;
  if (configured === 'true') return true;
  return false;
}

function startMetricsWorker() {
  if (task) return task;
  if (!isEnabled()) {
    console.log('[RealtimeSocialAnalytics] Worker disabled. Set ENABLE_REALTIME_SOCIAL_ANALYTICS=true to enable Mongo-backed social metrics sync.');
    return null;
  }

  const interval = Math.max(Number(process.env.SOCIAL_ANALYTICS_WORKER_INTERVAL_SECONDS || 30), 5);
  const expression = `*/${interval} * * * * *`;
  const service = new MetricsSyncService();

  task = cron.schedule(expression, async () => {
    if (running) return;
    running = true;

    try {
      if (mongoose.connection.readyState !== 1) {
        return;
      }
      const summary = await service.syncOnce();
      if (summary.synced || summary.errors.length) {
        console.log('[RealtimeSocialAnalytics] sync summary', summary);
      }
    } catch (error) {
      console.error('[RealtimeSocialAnalytics] worker tick failed:', error.message);
    } finally {
      running = false;
    }
  });

  console.log(`[RealtimeSocialAnalytics] Worker started (${interval}s interval).`);
  return task;
}

function stopMetricsWorker() {
  if (!task) return;
  task.stop();
  task = null;
}

module.exports = {
  startMetricsWorker,
  stopMetricsWorker
};
