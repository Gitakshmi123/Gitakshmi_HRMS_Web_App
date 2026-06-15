import React from 'react';
import { Building2, ChevronRight, MapPin, MoreVertical } from 'lucide-react';

export default function BranchCard({ item, onClick }) {
  return (
    <button type="button" className="org-card" onClick={() => onClick(item)}>
      <div className="org-card-menu"><MoreVertical size={18} /></div>
      <div className="org-card-main">
        <div className="org-card-icon"><Building2 size={28} /></div>
        <div className="org-card-copy">
          <span className="org-code-pill">{item.code || item.branchCode || 'BR'}</span>
          <div className="org-card-title">{item.name}</div>
          <div className="org-card-subtitle"><MapPin size={12} /> {[item.city, item.state].filter(Boolean).join(', ') || item.address || 'No location'}</div>
        </div>
      </div>
      <div className="org-metric-grid">
        <div><span>Divisions</span><strong>{item.divisionCount || 0}</strong></div>
        <div><span>Created At</span><strong>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</strong></div>
      </div>
      <div className="org-card-footer">
        <span><i /> Branch</span>
        <span className={`org-status ${item.isActive === false ? 'inactive' : ''}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span>
      </div>
    </button>
  );
}
