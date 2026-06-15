/**
 * LETTER REVOCATION MODAL
 * React component for confirming and executing letter revocation
 * 
 * ✅ Confirmation workflow
 * ✅ Reason selection (enum)
 * ✅ Optional details text
 * ✅ Loading state during submission
 * ✅ Success/error notifications
 * ✅ Accessible (ARIA labels, keyboard navigation)
 */

import React, { useState } from 'react';
import './RevokeLetterModal.css';

const RevokeLetterModal = ({ isOpen, letterData, onClose, onConfirm }) => {
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Revocation reasons (from enum in model)
    const reasons = [
        {
            value: 'duplicate_offer',
            label: 'Duplicate Offer',
            description: 'Offer was sent in error or duplicated'
        },
        {
            value: 'candidate_rejected',
            label: 'Candidate Rejected',
            description: 'Candidate rejected the offer'
        },
        {
            value: 'position_cancelled',
            label: 'Position Cancelled',
            description: 'Position has been cancelled'
        },
        {
            value: 'business_decision',
            label: 'Business Decision',
            description: 'Strategic business decision'
        },
        {
            value: 'process_error',
            label: 'Process Error',
            description: 'Error in offer generation or sending'
        },
        {
            value: 'compliance_issue',
            label: 'Compliance Issue',
            description: 'Compliance or regulatory issue'
        },
        {
            value: 'other',
            label: 'Other',
            description: 'Other reason (specify in details)'
        }
    ];

    const handleCancel = () => {
        setSelectedReason('');
        setDetails('');
        setError('');
        onClose();
    };

    const handleConfirm = async () => {
        // Validate
        if (!selectedReason) {
            setError('Please select a reason for revocation');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await onConfirm({
                reason: selectedReason,
                reasonDetails: details
            });

            if (result.success) {
                handleCancel();
            } else {
                setError(result.message || 'Failed to revoke letter');
            }
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div 
                className="modal-overlay" 
                onClick={handleCancel}
                role="presentation"
            />

            {/* Modal */}
            <div 
                className="revoke-modal"
                role="dialog"
                aria-labelledby="revoke-modal-title"
                aria-describedby="revoke-modal-description"
                aria-modal="true"
            >
                <div className="modal-header">
                    <h2 id="revoke-modal-title">🚫 Revoke Letter</h2>
                    <button
                        className="modal-close"
                        onClick={handleCancel}
                        aria-label="Close modal"
                        disabled={isLoading}
                    >
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    <p id="revoke-modal-description" className="modal-description">
                        You are about to revoke the following letter:
                    </p>

                    {/* Letter Summary */}
                    {letterData && (
                        <div className="letter-summary">
                            <div className="summary-item">
                                <span className="summary-label">Recipient:</span>
                                <span className="summary-value">{letterData.recipientName}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Position:</span>
                                <span className="summary-value">{letterData.position || 'N/A'}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Letter Type:</span>
                                <span className="summary-value">{letterData.letterType}</span>
                            </div>
                        </div>
                    )}

                    {/* Revocation Reason */}
                    <div className="form-group">
                        <label htmlFor="reason-select" className="form-label">
                            Reason for Revocation <span className="required">*</span>
                        </label>
                        <select
                            id="reason-select"
                            value={selectedReason}
                            onChange={(e) => setSelectedReason(e.target.value)}
                            className="form-control"
                            disabled={isLoading}
                            required
                        >
                            <option value="">-- Select Reason --</option>
                            {reasons.map(reason => (
                                <option key={reason.value} value={reason.value}>
                                    {reason.label}
                                </option>
                            ))}
                        </select>
                        {selectedReason && (
                            <p className="reason-description">
                                {reasons.find(r => r.value === selectedReason)?.description}
                            </p>
                        )}
                    </div>

                    {/* Additional Details */}
                    <div className="form-group">
                        <label htmlFor="details-textarea" className="form-label">
                            Additional Details (Optional)
                        </label>
                        <textarea
                            id="details-textarea"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="Provide any additional context for the audit trail..."
                            className="form-control"
                            rows="4"
                            disabled={isLoading}
                            maxLength="1000"
                        />
                        <p className="textarea-hint">
                            {details.length}/1000 characters
                        </p>
                    </div>

                    {/* Warnings */}
                    <div className="warning-box">
                        <p className="warning-title">⚠️ Please Note:</p>
                        <ul className="warning-list">
                            <li>The recipient will be notified via email</li>
                            <li>Document access will be immediately disabled</li>
                            <li>This action is recorded in the audit trail</li>
                            <li>Only super-admin can reinstate after revocation</li>
                        </ul>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-box" role="alert">
                            <p className="error-message">❌ {error}</p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={isLoading || !selectedReason}
                    >
                        {isLoading ? 'Revoking...' : '🚫 Revoke Letter'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default RevokeLetterModal;
