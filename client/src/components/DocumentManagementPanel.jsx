import React, { useState, useCallback } from 'react';
import LetterStatusBadge from './LetterStatusBadge';
import RevokeLetterModal from './RevokeLetterModal';
import DocumentAuditTrail from './DocumentAuditTrail';
import useDocumentManagement from '../hooks/useDocumentManagement';
import './DocumentManagementPanel.css';

function DocumentManagementPanel({
    letter,
    onLetterUpdated,
    showAuditTrail = true,
    userRole = 'employee'
}) {
    const [showRevokeModal, setShowRevokeModal] = useState(false);
    const [showAuditTab, setShowAuditTab] = useState(false);
    const [showRevocationHistory, setShowRevocationHistory] = useState(false);

    const {
        status,
        auditTrail,
        revocationHistory,
        loading,
        error,
        hasAccess,
        fetchAuditTrail,
        fetchRevocationHistory,
        revoke,
        reinstate,
        isRevoked,
        canRevoke,
        canReinstate,
        clearError
    } = useDocumentManagement(letter?._id);

    const handleRevoke = useCallback(async ({ reason, reasonDetails }) => {
        const result = await revoke(reason, reasonDetails || '');
        setShowRevokeModal(false);
        if (onLetterUpdated) onLetterUpdated(letter);
        return result;
    }, [letter, onLetterUpdated, revoke]);

    const handleFetchAuditTrail = useCallback(async () => {
        await fetchAuditTrail();
    }, [fetchAuditTrail]);

    const handleFetchRevocationHistory = useCallback(async () => {
        await fetchRevocationHistory();
    }, [fetchRevocationHistory]);

    const normalizedRole = (userRole || '').toLowerCase().replace('-', '_');
    const canPerformActions = ['hr', 'admin', 'super_admin'].includes(normalizedRole);
    const canPerformReinstate = normalizedRole === 'super_admin';

    if (!hasAccess) {
        return (
            <div className="document-panel access-denied">
                <div className="access-denied-icon">Access Denied</div>
                <h3>Access Denied</h3>
                <p>{error || 'You do not have permission to view this document.'}</p>
            </div>
        );
    }

    const revokedByLabel =
        status?.revokedBy?.name ||
        status?.revokedBy?.email ||
        status?.revokedBy ||
        'N/A';

    return (
        <div className="document-management-panel">
            <div className="document-header">
                <div className="document-info">
                    <h2>{letter?.letterType || 'Letter'}</h2>
                    <p className="document-reference">{letter?.refNo || 'N/A'}</p>
                </div>

                <div className="document-status">
                    {status && (
                        <LetterStatusBadge
                            status={status.status}
                            isRevoked={status.isRevoked}
                            revokedReason={status.revocationReason}
                            onClick={() => setShowAuditTab(true)}
                        />
                    )}
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <span>{error}</span>
                    <button className="error-close" onClick={clearError} aria-label="Close error">X</button>
                </div>
            )}

            {canPerformActions && (
                <div className="document-actions">
                    {canRevoke && (
                        <button
                            className="btn btn-revoke"
                            onClick={() => setShowRevokeModal(true)}
                            disabled={loading || !status}
                            title="Revoke this letter"
                        >
                            {loading ? 'Processing...' : 'Revoke Letter'}
                        </button>
                    )}

                    {canPerformReinstate && isRevoked && canReinstate && (
                        <button
                            className="btn btn-reinstate"
                            onClick={() => {
                                const reinstatedReason = window.prompt('Reason for reinstatement:');
                                if (reinstatedReason !== null) {
                                    reinstate(status.revocationId, reinstatedReason).catch(() => null);
                                }
                            }}
                            disabled={loading}
                            title="Reinstate this letter (Super-Admin only)"
                        >
                            {loading ? 'Processing...' : 'Reinstate Letter'}
                        </button>
                    )}

                    {showAuditTrail && (
                        <button
                            className="btn btn-audit"
                            onClick={() => {
                                const nextOpen = !showAuditTab;
                                setShowAuditTab(nextOpen);
                                if (nextOpen && auditTrail.length === 0) handleFetchAuditTrail();
                            }}
                            disabled={loading}
                            title="View audit trail"
                        >
                            {loading ? 'Loading...' : 'Audit Trail'}
                        </button>
                    )}

                    {isRevoked && (
                        <button
                            className="btn btn-history"
                            onClick={() => {
                                const nextOpen = !showRevocationHistory;
                                setShowRevocationHistory(nextOpen);
                                if (nextOpen && revocationHistory.length === 0) handleFetchRevocationHistory();
                            }}
                            disabled={loading}
                            title="View revocation history"
                        >
                            {loading ? 'Loading...' : 'Revocation History'}
                        </button>
                    )}
                </div>
            )}

            <div className="letter-details">
                <div className="detail-row">
                    <span className="detail-label">Candidate Name:</span>
                    <span className="detail-value">{letter?.candidateName || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">Position:</span>
                    <span className="detail-value">{letter?.position || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">{letter?.department || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">Salary:</span>
                    <span className="detail-value">
                        {letter?.salary ? `INR ${parseInt(letter.salary, 10).toLocaleString('en-IN')}` : 'N/A'}
                    </span>
                </div>

                {status?.revokedAt && (
                    <>
                        <div className="detail-row revoked-info">
                            <span className="detail-label">Revoked At:</span>
                            <span className="detail-value">
                                {new Date(status.revokedAt).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>

                        <div className="detail-row revoked-info">
                            <span className="detail-label">Revoked By:</span>
                            <span className="detail-value">{revokedByLabel}</span>
                        </div>

                        {status.revocationReason && (
                            <div className="detail-row revoked-info">
                                <span className="detail-label">Reason:</span>
                                <span className="detail-value">{status.revocationReason}</span>
                            </div>
                        )}

                        {status.revocationDetails && (
                            <div className="detail-row revoked-info">
                                <span className="detail-label">Details:</span>
                                <span className="detail-value">{status.revocationDetails}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showAuditTab && showAuditTrail && (
                <DocumentAuditTrail
                    documentId={letter?._id}
                    auditTrail={auditTrail}
                    loading={loading}
                    onRefresh={handleFetchAuditTrail}
                />
            )}

            {showRevocationHistory && isRevoked && (
                <div className="revocation-history-container">
                    <h3>Revocation History</h3>
                    {loading ? (
                        <div className="loading">Loading...</div>
                    ) : revocationHistory.length === 0 ? (
                        <div className="empty">No revocation history found</div>
                    ) : (
                        <div className="history-list">
                            {revocationHistory.map((event, index) => (
                                <div key={event._id || index} className="history-item">
                                    <div className="history-status">{event.status}</div>
                                    <div className="history-details">
                                        <p>
                                            <strong>By:</strong>{' '}
                                            {event.revokedBy?.name || event.reinstatedBy?.name || event.revokedBy || event.reinstatedBy || 'N/A'}
                                        </p>
                                        <p>
                                            <strong>Date:</strong>{' '}
                                            {new Date(event.createdAt || event.revokedAt).toLocaleDateString('en-IN')}
                                        </p>
                                        {event.reason && <p><strong>Reason:</strong> {event.reason}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showRevokeModal && (
                <RevokeLetterModal
                    isOpen
                    letterData={{
                        recipientName: letter?.candidateName || letter?.employeeId?.firstName || 'N/A',
                        position: letter?.position,
                        letterType: letter?.letterType
                    }}
                    onConfirm={handleRevoke}
                    onClose={() => setShowRevokeModal(false)}
                />
            )}
        </div>
    );
}

export default DocumentManagementPanel;
