import { useState, useCallback, useEffect } from 'react';
import DocumentManagementService from '../services/DocumentManagementService';

export function useDocumentManagement(documentId) {
    const [status, setStatus] = useState(null);
    const [auditTrail, setAuditTrail] = useState([]);
    const [revocationHistory, setRevocationHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasAccess, setHasAccess] = useState(true);

    const fetchStatus = useCallback(async () => {
        if (!documentId) return null;
        setLoading(true);
        setError(null);
        try {
            const data = await DocumentManagementService.getDocumentStatus(documentId);
            setStatus(data);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Failed to fetch document status';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    const fetchAuditTrail = useCallback(async (filters = {}) => {
        if (!documentId) return [];
        setLoading(true);
        setError(null);
        try {
            const data = await DocumentManagementService.getAuditTrail(documentId, filters);
            setAuditTrail(Array.isArray(data) ? data : []);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Failed to fetch audit trail';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    const fetchRevocationHistory = useCallback(async () => {
        if (!documentId) return [];
        setLoading(true);
        setError(null);
        try {
            const data = await DocumentManagementService.getRevocationHistory(documentId);
            setRevocationHistory(Array.isArray(data) ? data : []);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Failed to fetch revocation history';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    const revoke = useCallback(async (reason, reasonDetails = '') => {
        if (!documentId) return null;
        setLoading(true);
        setError(null);
        try {
            const result = await DocumentManagementService.revokeLetter(documentId, reason, reasonDetails);
            await fetchStatus();
            return result;
        } catch (err) {
            const errorMsg = err.message || 'Failed to revoke document';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [documentId, fetchStatus]);

    const reinstate = useCallback(async (revocationId, reinstatedReason = '') => {
        setLoading(true);
        setError(null);
        try {
            const result = await DocumentManagementService.reinstateLetter(revocationId, reinstatedReason);
            await fetchStatus();
            return result;
        } catch (err) {
            const errorMsg = err.message || 'Failed to reinstate document';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchStatus]);

    const checkAccess = useCallback(async () => {
        if (!documentId) return { hasAccess: true };
        const result = await DocumentManagementService.checkDocumentAccess(documentId);
        const allowed = result.hasAccess !== false;
        setHasAccess(allowed);
        if (!allowed) {
            setError(result.message || 'You do not have access to this document');
        }
        return result;
    }, [documentId]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    useEffect(() => {
        if (documentId) {
            Promise.all([fetchStatus(), checkAccess()]).catch(() => null);
        }
    }, [documentId, fetchStatus, checkAccess]);

    return {
        status,
        auditTrail,
        revocationHistory,
        loading,
        error,
        hasAccess,
        fetchStatus,
        fetchAuditTrail,
        fetchRevocationHistory,
        revoke,
        reinstate,
        checkAccess,
        clearError,
        isRevoked: !!status?.isRevoked,
        canRevoke: !!status && !status?.isRevoked,
        canReinstate: !!status?.revocationId
    };
}

export default useDocumentManagement;
