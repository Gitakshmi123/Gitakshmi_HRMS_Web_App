/**
 * LETTER STATUS BADGE COMPONENT
 * React component for displaying letter status with appropriate styling
 * 
 * ✅ Production-ready, WCAG accessible
 * ✅ Responsive design
 * ✅ Professional styling
 * ✅ Non-intrusive (doesn't modify existing UI)
 */

import React from 'react';
import './LetterStatusBadge.css';

const LetterStatusBadge = ({ status, isRevoked, revokedReason, onClick }) => {
    // Map status to display properties
    const statusConfig = {
        draft: {
            label: 'Draft',
            className: 'status-draft',
            icon: '📝',
            description: 'Document is in draft state'
        },
        generated: {
            label: 'Generated',
            className: 'status-generated',
            icon: '✓',
            description: 'Document has been generated'
        },
        assigned: {
            label: 'Assigned',
            className: 'status-assigned',
            icon: '📨',
            description: 'Document assigned to recipient'
        },
        viewed: {
            label: 'Viewed',
            className: 'status-viewed',
            icon: '👁️',
            description: 'Document has been viewed'
        },
        downloaded: {
            label: 'Downloaded',
            className: 'status-downloaded',
            icon: '⬇️',
            description: 'Document has been downloaded'
        },
        revoked: {
            label: 'Revoked',
            className: 'status-revoked',
            icon: '🚫',
            description: isRevoked ? `Revoked: ${revokedReason || 'No reason provided'}` : 'Document has been revoked'
        },
        expired: {
            label: 'Expired',
            className: 'status-expired',
            icon: '⏰',
            description: 'Document access has expired'
        }
    };

    const config = statusConfig[status] || statusConfig.draft;

    // Override for revoked status
    const displayStatus = isRevoked ? statusConfig.revoked : config;

    return (
        <div
            className={`letter-status-badge ${displayStatus.className}`}
            title={displayStatus.description}
            onClick={onClick}
            role="status"
            aria-label={`Document status: ${displayStatus.label}`}
        >
            <span className="status-icon">{displayStatus.icon}</span>
            <span className="status-label">{displayStatus.label}</span>
            {isRevoked && revokedReason && (
                <span className="status-reason" title={revokedReason}>
                    {revokedReason}
                </span>
            )}
        </div>
    );
};

export default LetterStatusBadge;
