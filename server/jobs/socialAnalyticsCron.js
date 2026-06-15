const cron = require('node-cron');
const SocialAnalyticsService = require('../modules/social-media-enterprise/services/SocialAnalyticsService');

function startAnalyticsCronJob() {
    cron.schedule('*/10 * * * *', async () => {
        // console.log('[CRON] Starting Social Analytics Sync...');
        try {
            await SocialAnalyticsService.syncAllMetrics();
            // console.log('[CRON] Social Analytics Sync completed.');
        } catch (err) {
            console.error('[CRON] Social Analytics Sync Error:', err.message);
        }
    });
    // console.log('[CRON] Social Analytics Sync scheduled (every 10 minutes)');
}

module.exports = startAnalyticsCronJob;
