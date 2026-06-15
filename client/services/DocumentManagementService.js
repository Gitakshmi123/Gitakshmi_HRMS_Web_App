/**
 * Document Management Service
 * Frontend API client for document management operations
 */

class DocumentManagementService {
    constructor(baseURL = '/api/documents') {
        this.baseURL = baseURL;
    }

    /**
     * Get document status (public endpoint)
     */
    async getDocumentStatus(documentId) {
        try {
            const response = await fetch(`${this.baseURL}/${documentId}/status`);
            if (!response.ok) {
                throw new Error(`Status ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching document status:', error);
            throw error;
        }
    }

    /**
     * Revoke a letter (HR/Admin only)
     */
    async revokeLetter(documentId, reason, details = '') {
        try {
            const response = await fetch(`${this.baseURL}/${documentId}/revoke`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    reason,
                    details,
                    notifyCandidate: true
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to revoke: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error revoking letter:', error);
            throw error;
        }
    }

    /**
     * Reinstate a revoked letter (Super-Admin only)
     */
    async reinstateLetter(revocationId, reason = '') {
        try {
            const response = await fetch(`${this.baseURL.replace('/documents', '/revocations')}/${revocationId}/reinstate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ reason })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to reinstate: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error reinstating letter:', error);
            throw error;
        }
    }

    /**
     * Get complete audit trail for a document (HR/Admin only)
     */
    async getAuditTrail(documentId, filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`${this.baseURL}/${documentId}/audit-trail?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch audit trail: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching audit trail:', error);
            throw error;
        }
    }

    /**
     * Get revocation history for a document (HR/Admin only)
     */
    async getRevocationHistory(documentId) {
        try {
            const response = await fetch(`${this.baseURL}/${documentId}/revocation-history`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch revocation history: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching revocation history:', error);
            throw error;
        }
    }

    /**
     * Check access permission before serving document
     */
    async checkDocumentAccess(documentId) {
        try {
            const response = await fetch(`${this.baseURL}/${documentId}/enforce-access`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                return {
                    hasAccess: false,
                    message: `Access denied: ${response.statusText}`
                };
            }

            return await response.json();
        } catch (error) {
            console.error('Error checking document access:', error);
            return {
                hasAccess: false,
                message: error.message
            };
        }
    }

    /**
     * Get auth token from localStorage
     * Adjust based on your authentication implementation
     */
    getAuthToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
    }

    /**
     * Handle error response
     */
    static handleError(error) {
        if (error.response) {
            // Server responded with error status
            return {
                status: error.response.status,
                message: error.response.data?.message || error.response.statusText,
                code: error.response.data?.code
            };
        } else if (error.request) {
            // Request made but no response
            return {
                status: 0,
                message: 'No response from server',
                code: 'NO_RESPONSE'
            };
        } else {
            // Error in request setup
            return {
                status: 0,
                message: error.message,
                code: 'REQUEST_ERROR'
            };
        }
    }
}

export default new DocumentManagementService();
