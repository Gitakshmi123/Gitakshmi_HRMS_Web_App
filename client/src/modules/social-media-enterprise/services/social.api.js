import api from '../../../utils/api';

/**
 * Social Media Enterprise API Service
 */
const socialApi = {
    // --- OAUTH ---
    initiateOAuth: async (platform) => {
        const response = await api.get(`/social-media-enterprise/oauth/initiate`, {
            params: { platform, returnUrl: window.location.origin }
        });
        return response.data;
    },

    // --- DASHBOARD ---
    getDashboardStats: async (platform) => {
        const response = await api.get(`/social-media-enterprise/dashboard/stats`, {
            params: { platform }
        });
        return response.data;
    },

    getAnalytics: async (platform, range) => {
        const response = await api.get(`/social-media-enterprise/analytics`, {
            params: { platform, range }
        });
        return response.data;
    },

    getAnalyticsDashboard: async (platform) => {
        const response = await api.get('/social-media-enterprise/analytics/dashboard', {
            params: { platform }
        });
        return response.data;
    },

    syncAnalytics: async () => {
        const response = await api.post('/social-media-enterprise/analytics/sync');
        return response.data;
    },

    // --- REAL-TIME ANALYTICS ---
    getRealtimePosts: async () => {
        const response = await api.get('/posts');
        return response.data;
    },

    getRealtimePostMetrics: async (postId, limit = 100) => {
        const response = await api.get(`/posts/${postId}/metrics`, {
            params: { limit }
        });
        return response.data;
    },

    // --- ACCOUNTS ---
    getAccounts: async () => {
        const response = await api.get(`/social-media-enterprise/accounts`);
        return response.data;
    },

    disconnectAccount: async (platform) => {
        const response = await api.delete(`/social-media-enterprise/disconnect/${platform}`);
        return response.data;
    },

    // --- CAMPAIGNS & POSTS ---
    createCampaign: async (campaignData) => {
        const response = await api.post(`/social-media-enterprise/post`, campaignData);
        return response.data;
    },

    createInstagramPost: async (payload) => {
        const response = await api.post('/social-media-enterprise/instagram/post', payload);
        return response.data;
    },

    updateCampaign: async (id, data) => {
        const response = await api.put(`/social-media-enterprise/post/${id}`, data);
        return response.data;
    },

    deleteCampaign: async (id) => {
        const response = await api.delete(`/social-media-enterprise/post/${id}`);
        return response.data;
    },

    deletePost: async (id) => {
        const response = await api.delete(`/social-media-enterprise/single-post/${id}`);
        return response.data;
    },

    /**
     * Retry a single failed SocialPost.
     * @param {string} postId - The _id of the SocialPost document
     */
    retryPost: async (postId) => {
        const response = await api.post(`/social-media-enterprise/post/${postId}/retry`);
        return response.data;
    },

    getHistory: async () => {
        const response = await api.get(`/social-media-enterprise/history`);
        return response.data;
    },

    // --- MEDIA ---
    uploadMedia: async (formData) => {
        const response = await api.post(`/social-media-enterprise/upload-media`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    processMedia: async (formData) => {
        const response = await api.post(`/social-media-enterprise/process-media`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // --- MUSIC ---
    getMusic: async (searchQuery = '') => {
        const url = searchQuery ? `/music?search=${encodeURIComponent(searchQuery)}` : '/music';
        const response = await api.get(url);
        return response.data;
    },

    uploadMusic: async (formData) => {
        const response = await api.post('/music/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // --- TEMPLATES (CANVA EDITOR) ---
    getTemplates: async (category = '') => {
        const response = await api.get('/social-templates', { params: { category } });
        return response.data;
    },

    getTemplateById: async (id) => {
        const response = await api.get(`/social-templates/${id}`);
        return response.data;
    },

    saveTemplate: async (templateData) => {
        const response = await api.post('/social-templates', templateData);
        return response.data;
    }
};

export default socialApi;
