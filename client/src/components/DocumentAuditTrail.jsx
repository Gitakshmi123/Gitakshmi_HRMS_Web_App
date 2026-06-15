import React, { useMemo, useState } from 'react';
import './DocumentAuditTrail.css';

function DocumentAuditTrail({ auditTrail = [], loading = false, onRefresh }) {
    const [sortBy, setSortBy] = useState('newest');
    const [filterAction, setFilterAction] = useState('all');
    const sortedTrail = useMemo(() => {
        let filtered = [...auditTrail];

        if (filterAction !== 'all') {
            filtered = filtered.filter((event) => event.action === filterAction);
        }

        filtered.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
        });

        return filtered;
    }, [auditTrail, sortBy, filterAction]);

    const getActionColor = (action) => {
        const colors = {
            created: '#3b82f6',
            viewed: '#10b981',
            downloaded: '#f59e0b',
            revoked: '#ef4444',
            reinstated: '#8b5cf6',
            status_changed: '#06b6d4',
            access_denied: '#6b7280'
        };
        return colors[action] || '#6b7280';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const uniqueActions = [...new Set(auditTrail.map((e) => e.action))];

    return (
        <div className="audit-trail-container">
            <div className="audit-trail-header">
                <h3>Document Audit Trail</h3>
                <button
                    className="btn-refresh"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Refresh audit trail"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            <div className="audit-filters">
                <div className="filter-group">
                    <label>Action:</label>
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Actions</option>
                        {uniqueActions.map((action) => (
                            <option key={action} value={action}>
                                {action.charAt(0).toUpperCase() + action.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Sort:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="filter-select"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>

            <div className="audit-trail-list">
                {loading ? (
                    <div className="audit-loading">
                        <div className="spinner"></div>
                        <p>Loading audit trail...</p>
                    </div>
                ) : sortedTrail.length === 0 ? (
                    <div className="audit-empty">
                        <p>No audit events found</p>
                    </div>
                ) : (
                    sortedTrail.map((event, index) => (
                        <div
                            key={event._id || index}
                            className="audit-event"
                            style={{ borderLeftColor: getActionColor(event.action) }}
                        >
                            <div className="event-content">
                                <div className="event-header">
                                    <span className="event-action">
                                        {event.action?.charAt(0).toUpperCase() + event.action?.slice(1)}
                                    </span>
                                    <span className="event-time">{formatDate(event.timestamp)}</span>
                                </div>

                                <div className="event-details">
                                    <p>
                                        <strong>By:</strong>{' '}
                                        {event.performedBy?.name || event.performedBy?.email || event.performedBy || 'System'}
                                    </p>
                                    {event.performedByRole && (
                                        <p>
                                            <strong>Role:</strong>{' '}
                                            <span className="role-badge">{event.performedByRole}</span>
                                        </p>
                                    )}
                                    {event.reason && <p><strong>Reason:</strong> {event.reason}</p>}
                                    {event.oldStatus && event.newStatus && (
                                        <p><strong>Status Change:</strong> {event.oldStatus} to {event.newStatus}</p>
                                    )}
                                </div>

                                <div className="event-footer">
                                    {event.ipAddress && (
                                        <span className="event-ip" title="IP Address">
                                            {event.ipAddress}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {sortedTrail.length > 0 && (
                <div className="audit-summary">
                    <p>Total Events: <strong>{sortedTrail.length}</strong></p>
                </div>
            )}
        </div>
    );
}

export default DocumentAuditTrail;
