const axios = require('axios');

class InstagramGraphService {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  async fetchMetrics(post) {
    const accessToken = await this.tokenService.getAccessToken(post);
    const mediaId = post.external_post_id;

    const basic = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      params: {
        fields: 'like_count,comments_count,media_type',
        access_token: accessToken
      }
    });

    const isVideo = basic.data.media_type === 'VIDEO';
    const insightMetric = isVideo ? 'reach,saved,video_view_count' : 'impressions,reach,saved';
    const insights = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}/insights`, {
      params: {
        metric: insightMetric,
        access_token: accessToken
      }
    }).catch(() => ({ data: { data: [] } }));

    const insightRows = insights.data?.data || [];
    const getInsight = (name) => insightRows.find((row) => row.name === name)?.values?.[0]?.value || 0;
    const impressions = getInsight('impressions') || getInsight('video_view_count');
    const reach = getInsight('reach') || impressions;

    return {
      likes: basic.data.like_count || 0,
      comments: basic.data.comments_count || 0,
      shares: 0,
      reach,
      impressions,
      raw: {
        basic: basic.data,
        insights: insightRows
      }
    };
  }
}

module.exports = InstagramGraphService;
