import { create } from 'zustand';
import socialApi from '../services/social.api';

const METRIC_FIELDS = ['likes', 'comments', 'shares', 'reach', 'impressions'];

const numberOrZero = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizePost = (post = {}) => {
  const metrics = post.metrics || post.latestMetrics || post;

  return {
    id: String(post.id || post.postId || post._id || ''),
    platform: String(post.platform || '').toLowerCase(),
    title: post.title || post.caption || post.message || post.external_post_id || 'Untitled post',
    permalink: post.permalink || post.url || '',
    externalPostId: post.externalPostId || post.external_post_id || '',
    platformAccountId: post.platformAccountId || post.platform_account_id || '',
    accountName: post.accountName || post.account_name || '',
    handle: post.handle || '',
    lastSyncedAt: post.lastSyncedAt || post.last_synced_at || post.metrics_collected_at || null,
    collectedAt: post.collectedAt || post.metrics_collected_at || metrics.collected_at || null,
    metrics: METRIC_FIELDS.reduce((acc, field) => {
      acc[field] = numberOrZero(metrics[field]);
      return acc;
    }, {})
  };
};

const mergeMetricEvent = (posts, event = {}) => {
  const postId = String(event.postId || event.id || '');
  const externalPostId = String(event.externalPostId || event.external_post_id || '');
  const platform = String(event.platform || '').toLowerCase();
  const incomingMetrics = event.metrics || {};
  let matched = false;

  const nextPosts = posts.map((post) => {
    const isMatch =
      (postId && post.id === postId) ||
      (externalPostId && post.externalPostId === externalPostId && post.platform === platform);

    if (!isMatch) return post;
    matched = true;

    return {
      ...post,
      platform: platform || post.platform,
      collectedAt: event.emittedAt || event.collectedAt || new Date().toISOString(),
      lastSyncedAt: event.emittedAt || event.collectedAt || post.lastSyncedAt,
      metrics: {
        ...post.metrics,
        ...METRIC_FIELDS.reduce((acc, field) => {
          if (incomingMetrics[field] !== undefined) acc[field] = numberOrZero(incomingMetrics[field]);
          return acc;
        }, {})
      }
    };
  });

  if (matched || !postId) return nextPosts;

  return [
    normalizePost({
      id: postId,
      platform,
      externalPostId,
      title: externalPostId || 'Live post',
      metrics: incomingMetrics,
      collectedAt: event.emittedAt || new Date().toISOString()
    }),
    ...nextPosts
  ];
};

const buildSummary = (posts = []) => {
  const totals = METRIC_FIELDS.reduce((acc, field) => ({ ...acc, [field]: 0 }), {});
  const platformCounts = {};
  const platformEngagement = {};

  posts.forEach((post) => {
    const platform = post.platform || 'unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;

    METRIC_FIELDS.forEach((field) => {
      totals[field] += numberOrZero(post.metrics?.[field]);
    });

    platformEngagement[platform] =
      (platformEngagement[platform] || 0) +
      numberOrZero(post.metrics?.likes) +
      numberOrZero(post.metrics?.comments) +
      numberOrZero(post.metrics?.shares);
  });

  const totalEngagement = totals.likes + totals.comments + totals.shares;
  return {
    totals,
    totalPosts: posts.length,
    totalEngagement,
    platformCounts,
    platformEngagement
  };
};

export const useSocialAnalyticsStore = create((set, get) => ({
  posts: [],
  loading: false,
  error: '',
  socketConnected: false,
  lastUpdatedAt: null,

  setSocketConnected: (socketConnected) => set({ socketConnected }),

  fetchPosts: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: '' });

    try {
      const response = await socialApi.getRealtimePosts();
      const posts = Array.isArray(response?.data) ? response.data.map(normalizePost) : [];
      set({
        posts,
        loading: false,
        error: '',
        lastUpdatedAt: new Date().toISOString()
      });
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          'Unable to load real-time social metrics.'
      });
    }
  },

  applyMetricEvent: (event) => {
    set((state) => ({
      posts: mergeMetricEvent(state.posts, event),
      lastUpdatedAt: new Date().toISOString(),
      error: ''
    }));
  },

  getFilteredPosts: (platform) => {
    const posts = get().posts;
    if (!platform || platform === 'all') return posts;
    return posts.filter((post) => post.platform === platform);
  },

  getSummary: (platform) => buildSummary(get().getFilteredPosts(platform))
}));

export { buildSummary, normalizePost };
