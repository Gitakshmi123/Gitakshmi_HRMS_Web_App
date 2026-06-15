import api from '../utils/api';

class DocumentManagementService {
    constructor(baseURL = '/letters/documents') {
        this.baseURL = baseURL;
    }

    async getDocumentStatus(documentId) {
        const response = await api.get(`${this.baseURL}/${documentId}/status`);
        return response?.data?.data || response?.data || null;
    }

    async revokeLetter(documentId, reason, reasonDetails = '') {
        const response = await api.post(`${this.baseURL}/${documentId}/revoke`, {
            reason,
            reasonDetails
        });
        return response?.data || null;
    }

    async reinstateLetter(revocationId, reinstatedReason = '') {
        const response = await api.post(`/letters/revocations/${revocationId}/reinstate`, {
            reinstatedReason
        });
        return response?.data || null;
    }

    async getAuditTrail(documentId, filters = {}) {
        const response = await api.get(`${this.baseURL}/${documentId}/audit-trail`, {
            params: filters
        });
        return response?.data?.data?.auditTrail || [];
    }

    async getRevocationHistory(documentId) {
        const response = await api.get(`${this.baseURL}/${documentId}/revocation-history`);
        return response?.data?.data?.revocationHistory || [];
    }

    async checkDocumentAccess(documentId) {
        try {
            const response = await api.get(`${this.baseURL}/${documentId}/enforce-access`);
            return {
                hasAccess: true,
                data: response?.data?.data || null
            };
        } catch (error) {
            return {
                hasAccess: false,
                message: error?.response?.data?.message || error?.hrms?.message || error.message || 'Access denied'
            };
        }
    }
}

export default new DocumentManagementService();
