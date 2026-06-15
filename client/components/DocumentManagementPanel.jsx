/**
 * Document Management Panel
 * Complete UI for managing, viewing, and revoking documents
 */

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

    // Use the custom hook
    const {
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
        isRevoked,
        canRevoke,
        canReinstate,
        clearError
    } = useDocumentManagement(letter._id);

    // Handle revocation
    const handleRevoke = useCallback(async (reason, details) => {
        try {
            await revoke(reason, details);
            setShowRevokeModal(false);
            if (onLetterUpdated) {
                onLetterUpdated(letter._id);
            }
        } catch (err) {
            console.error('Revocation error:', err);
        }
    }, [letter._id, revoke, onLetterUpdated]);

    // Handle audit trail fetch
    const handleFetchAuditTrail = useCallback(async () => {
        try {
            await fetchAuditTrail();
        } catch (err) {
            console.error('Error fetching audit trail:', err);
        }
    }, [fetchAuditTrail]);

    // Handle revocation history fetch
    const handleFetchRevocationHistory = useCallback(async () => {
        try {
            await fetchRevocationHistory();
        } catch (err) {
            console.error('Error fetching revocation history:', err);
        }
    }, [fetchRevocationHistory]);

    // Check if user can perform actions
    const canPerformActions = ['hr', 'admin', 'super-admin'].includes(userRole?.toLowerCase());
    const canPerformReinstate = userRole?.toLowerCase() === 'super-admin';

    if (!hasAccess) {
        return (
            <div className="document-panel access-denied">
                <div className="access-denied-icon">🚫</div>
                <h3>Access Denied</h3>
                <p>{error || 'You do not have permission to view this document.'}</p>
            </div>
        );
    }

    return (
        <div className="document-management-panel">
            {/* Header with Status */}
            <div className="document-header">
                <div className="document-info">
                    <h2>{letter.letterType || 'Letter'}</h2>
                    <p className="document-reference">{letter.refNo || 'N/A'}</p>
                </div>

                <div className="document-status">
                    {status && (
                        <LetterStatusBadge
                            status={status.status}
                            revokedReason={status.revokedReason}
                            onStatusClick={() => setShowAuditTab(true)}
                        />
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="error-banner">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                    <button
                        className="error-close"
                        onClick={clearError}
                        aria-label="Close error"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Actions */}
            {canPerformActions && (
                <div className="document-actions">
                    {canRevoke && (
                        <button
                            className="btn btn-revoke"
                            onClick={() => setShowRevokeModal(true)}
                            disabled={loading || !status}
                            title="Revoke this letter"
                        >
                            {loading ? '⏳ Processing...' : '🚫 Revoke Letter'}
                        </button>
                    )}

                    {canReinstate && isRevoked && (
                        <button
                            className="btn btn-reinstate"
                            onClick={() => {
                                // Show reinstatement confirmation
                                const reason = window.prompt('Reason for reinstatement:');
                                if (reason !== null) {
                                    reinstate(status._id, reason).catch(err => {
                                        alert('Reinstatement failed: ' + err.message);
                                    });
                                }
                            }}
                            disabled={loading}
                            title="Reinstate this letter (Super-Admin only)"
                        >
                            {loading ? '⏳ Processing...' : '✅ Reinstate Letter'}
                        </button>
                    )}

                    {showAuditTrail && (
                        <button
                            className="btn btn-audit"
                            onClick={() => {
                                setShowAuditTab(!showAuditTab);
                                if (!showAuditTab && auditTrail.length === 0) {
                                    handleFetchAuditTrail();
                                }
                            }}
                            disabled={loading}
                            title="View audit trail"
                        >
                            {loading ? '⏳ Loading...' : '📋 Audit Trail'}
                        </button>
                    )}

                    {isRevoked && (
                        <button
                            className="btn btn-history"
                            onClick={() => {
                                setShowRevocationHistory(!showRevocationHistory);
                                if (!showRevocationHistory && revocationHistory.length === 0) {
                                    handleFetchRevocationHistory();
                                }
                            }}
                            disabled={loading}
                            title="View revocation history"
                        >
                            {loading ? '⏳ Loading...' : '⏰ Revocation History'}
                        </button>
                    )}
                </div>
            )}

            {/* Letter Details */}
            <div className="letter-details">
                <div className="detail-row">
                    <span className="detail-label">Candidate Name:</span>
                    <span className="detail-value">{letter.candidateName || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">Position:</span>
                    <span className="detail-value">{letter.position || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">{letter.department || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">Salary:</span>
                    <span className="detail-value">{letter.salary ? `₹${parseInt(letter.salary).toLocaleString('en-IN')}` : 'N/A'}</span>
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
                            <span className="detail-value">{status.revokedBy || 'N/A'}</span>
                        </div>

                        {status.revokedReason && (
                            <div className="detail-row revoked-info">
                                <span className="detail-label">Reason:</span>
                                <span className="detail-value">{status.revokedReason}</span>
                            </div>
                        )}

                        {status.revokedDetails && (
                            <div className="detail-row revoked-info">
                                <span className="detail-label">Details:</span>
                                <span className="detail-value">{status.revokedDetails}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Audit Trail Section */}
            {showAuditTab && showAuditTrail && (
                <DocumentAuditTrail
                    documentId={letter._id}
                    auditTrail={auditTrail}
                    loading={loading}
                    onRefresh={handleFetchAuditTrail}
                />
            )}

            {/* Revocation History Section */}
            {showRevocationHistory && isRevoked && (
                <div className="revocation-history-container">
                    <h3>⏰ Revocation History</h3>
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
                                        <p><strong>By:</strong> {event.revokedBy || event.reinstatedBy || 'N/A'}</p>
                                        <p><strong>Date:</strong> {new Date(event.createdAt).toLocaleDateString('en-IN')}</p>
                                        {event.reason && <p><strong>Reason:</strong> {event.reason}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Revoke Modal */}
            {showRevokeModal && (
                <RevokeLetterModal
                    isOpen={true}
                    letterId={letter._id}
                    letterType={letter.letterType}
                    candidateName={letter.candidateName}
                    onConfirm={handleRevoke}
                    onClose={() => setShowRevokeModal(false)}
                />
            )}
        </div>
    );
}

export default DocumentManagementPanel;
