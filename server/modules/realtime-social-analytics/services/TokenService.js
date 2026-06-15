const axios = require('axios');

const REFRESH_WINDOW_MS = 10 * 60 * 1000;

class TokenService {
  constructor(repository) {
    this.repository = repository;
  }

  shouldRefresh(post) {
    if (!post.token_expires_at) return false;
    return new Date(post.token_expires_at).getTime() - Date.now() < REFRESH_WINDOW_MS;
  }

  async getAccessToken(post) {
    if (!this.shouldRefresh(post)) return post.access_token;

    if (post.platform === 'facebook' || post.platform === 'instagram') {
      return this.refreshMetaToken(post);
    }

    if (post.platform === 'linkedin') {
      return this.refreshLinkedInToken(post);
    }

    return post.access_token;
  }

  async refreshMetaToken(post) {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      return post.access_token;
    }

    const response = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: post.access_token
      }
    });

    const accessToken = response.data.access_token || post.access_token;
    const expiresAt = response.data.expires_in
      ? new Date(Date.now() + Number(response.data.expires_in) * 1000)
      : post.token_expires_at;

    await this.repository.updateToken(post.id, { accessToken, expiresAt });
    post.access_token = accessToken;
    post.token_expires_at = expiresAt;
    return accessToken;
  }

  async refreshLinkedInToken(post) {
    if (!post.refresh_token || !process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return post.access_token;
    }

    const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: post.refresh_token,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = response.data.access_token || post.access_token;
    const refreshToken = response.data.refresh_token || post.refresh_token;
    const expiresAt = response.data.expires_in
      ? new Date(Date.now() + Number(response.data.expires_in) * 1000)
      : post.token_expires_at;

    await this.repository.updateToken(post.id, { accessToken, refreshToken, expiresAt });
    post.access_token = accessToken;
    post.refresh_token = refreshToken;
    post.token_expires_at = expiresAt;
    return accessToken;
  }
}

module.exports = TokenService;
