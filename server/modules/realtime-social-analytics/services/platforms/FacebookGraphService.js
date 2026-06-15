const axios = require('axios');

class FacebookGraphService {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  async fetchMetrics(post) {
    const accessToken = await this.tokenService.getAccessToken(post);
    const postId = await this.resolveMetricPostId(post, accessToken);

    const [likes, comments, basic, insights] = await Promise.all([
      this.fetchEdgeCount(postId, 'likes', accessToken),
      this.fetchEdgeCount(postId, 'comments', accessToken),
      axios.get(`https://graph.facebook.com/v19.0/${postId}`, {
        params: { fields: 'id,permalink_url,shares,likes.summary(true),comments.summary(true)', access_token: accessToken }
      }).catch(() => ({ data: {} })),
      axios.get(`https://graph.facebook.com/v19.0/${postId}/insights`, {
        params: { metric: 'post_impressions,post_impressions_unique', access_token: accessToken }
      }).catch(() => ({ data: { data: [] } }))
    ]);

    const insightRows = insights.data?.data || [];
    const getInsight = (name) => insightRows.find((row) => row.name === name)?.values?.[0]?.value || 0;

    return {
      likes: likes ?? basic.data.likes?.summary?.total_count ?? 0,
      comments: comments ?? basic.data.comments?.summary?.total_count ?? 0,
      shares: basic.data.shares?.count || 0,
      reach: getInsight('post_impressions_unique'),
      impressions: getInsight('post_impressions'),
      externalPostId: postId,
      raw: {
        basic: basic.data,
        insights: insightRows
      }
    };
  }

  async fetchEdgeCount(postId, edge, accessToken) {
    const response = await axios.get(`https://graph.facebook.com/v19.0/${postId}/${edge}`, {
      params: { summary: true, limit: 0, access_token: accessToken }
    }).catch(() => null);

    return response?.data?.summary?.total_count ?? null;
  }

  async resolveMetricPostId(post, accessToken) {
    const candidates = [
      post.external_post_id,
      post.platform_media_id,
      post.platformAssetUrn
    ].filter(Boolean).map(String);

    for (const candidate of [...new Set(candidates)]) {
      const count = await this.fetchEdgeCount(candidate, 'comments', accessToken);
      if (count !== null) return candidate;
    }

    if (post.platform_account_id) {
      const discovered = await axios.get(`https://graph.facebook.com/v19.0/${post.platform_account_id}/videos`, {
        params: {
          fields: 'id,description,created_time,permalink_url',
          limit: 25,
          access_token: accessToken
        }
      }).catch(() => null);

      const title = String(post.title || '').trim().toLowerCase();
      const match = (discovered?.data?.data || []).find((row) =>
        title && String(row.description || '').trim().toLowerCase() === title
      );
      if (match?.id) return String(match.id);
    }

    return post.external_post_id;
  }
}

module.exports = FacebookGraphService;
