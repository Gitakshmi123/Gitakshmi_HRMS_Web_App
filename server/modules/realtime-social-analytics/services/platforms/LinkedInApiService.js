const axios = require('axios');

class LinkedInApiService {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  encodeUrn(value) {
    return encodeURIComponent(String(value || ''));
  }

  async fetchMetrics(post) {
    const accessToken = await this.tokenService.getAccessToken(post);
    const encodedUrn = this.encodeUrn(post.external_post_id);

    const socialActions = await axios.get(`https://api.linkedin.com/v2/socialActions/${encodedUrn}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202401'
      }
    }).catch(() => null);

    const socialLikes = socialActions?.data?.likesSummary?.totalLikes || 0;
    const socialComments = socialActions?.data?.commentsSummary?.totalFirstLevelComments || 0;

    const stats = await axios.get('https://api.linkedin.com/v2/organizationalEntityShareStatistics', {
      params: {
        q: 'organizationalEntity',
        shares: `List(${post.external_post_id})`
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202401'
      }
    }).catch(() => ({ data: { elements: [] } }));

    const shareStats = stats.data?.elements?.[0]?.totalShareStatistics || {};

    return {
      likes: shareStats.likeCount || socialLikes || 0,
      comments: shareStats.commentCount || socialComments || 0,
      shares: shareStats.shareCount || 0,
      reach: shareStats.impressionCount || 0,
      impressions: shareStats.impressionCount || 0,
      raw: {
        socialActions: socialActions?.data || null,
        shareStatistics: stats.data
      }
    };
  }
}

module.exports = LinkedInApiService;
