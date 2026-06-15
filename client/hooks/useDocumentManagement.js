/**
 * useDocumentManagement Hook
 * Custom React hook for managing document state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import DocumentManagementService from '../services/DocumentManagementService';

export function useDocumentManagement(documentId) {
    const [status, setStatus] = useState(null);
    const [auditTrail, setAuditTrail] = useState([]);
    const [revocationHistory, setRevocationHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasAccess, setHasAccess] = useState(true);

    /**
     * Fetch document status
     */
    const fetchStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await DocumentManagementService.getDocumentStatus(documentId);
            setStatus(data);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Failed to fetch document status';
            setError(errorMsg);
            console.error('Error fetching status:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    /**
     * Fetch audit trail
     */
    const fetchAuditTrail = useCallback(async (filters = {}) => {
        setLoading(true);
        setError(null);
        try {
            const data = await DocumentManagementService.getAuditTrail(documentId, filters);
            setAuditTrail(Array.isArray(data) ? data : []);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Failed to fetch audit trail';
            setError(errorMsg);
            console.error('Error fetching audit trail:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    /**
     * Fetch revocation history
     */
    const fetchRevocationHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await DocumentManagementService.getRevocationHistory(documentId);
            setRevocationHistory(Array.isArray(data) ? data : []);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Failed to fetch revocation history';
            setError(errorMsg);
            console.error('Error fetching revocation history:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    /**
     * Revoke document
     */
    const revoke = useCallback(async (reason, details = '') => {
        setLoading(true);
        setError(null);
        try {
            const result = await DocumentManagementService.revokeLetter(documentId, reason, details);
            // Refresh status after revocation
            await fetchStatus();
            return result;
        } catch (err) {
            const errorMsg = err.message || 'Failed to revoke document';
            setError(errorMsg);
            console.error('Error revoking document:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId, fetchStatus]);

    /**
     * Reinstate document (Super-Admin)
     */
    const reinstate = useCallback(async (revocationId, reason = '') => {
        setLoading(true);
        setError(false);
        try {
            const result = await DocumentManagementService.reinstateLetter(revocationId, reason);
            // Refresh status after reinstatement
            await fetchStatus();
            return result;
        } catch (err) {
            const errorMsg = err.message || 'Failed to reinstate document';
            setError(errorMsg);
            console.error('Error reinstating document:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId, fetchStatus]);

    /**
     * Check access before viewing
     */
    const checkAccess = useCallback(async () => {
        try {
            const result = await DocumentManagementService.checkDocumentAccess(documentId);
            setHasAccess(result.hasAccess);
            if (!result.hasAccess) {
                setError(result.message);
            }
            return result;
        } catch (err) {
            console.error('Error checking access:', err);
            setHasAccess(false);
            setError(err.message || 'Failed to verify access');
            throw err;
        }
    }, [documentId]);

    /**
     * Clear errors
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    /**
     * Initial load: fetch status and check access
     */
    useEffect(() => {
        if (documentId) {
            Promise.all([
                fetchStatus().catch(() => null),
                checkAccess().catch(() => null)
            ]);
        }
    }, [documentId, fetchStatus, checkAccess]);

    return {
        // State
        status,
        auditTrail,
        revocationHistory,
        loading,
        error,
        hasAccess,

        // Methods
        fetchStatus,
        fetchAuditTrail,
        fetchRevocationHistory,
        revoke,
        reinstate,
        checkAccess,
        clearError,

        // Convenience
        isRevoked: status?.isRevoked || false,
        canRevoke: status && !status.isRevoked,
        canReinstate: status?.canBeReinstate || false
    };
}

export default useDocumentManagement;
