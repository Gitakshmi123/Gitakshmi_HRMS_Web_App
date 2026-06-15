import React from 'react';
import { Building2, ChevronRight, Globe, MoreVertical } from 'lucide-react';

export default function SubCompanyCard({ item, onClick }) {
  return (
    <button type="button" className="org-card" onClick={() => onClick(item)}>
      <div className="org-card-menu"><MoreVertical size={18} /></div>
      <div className="org-card-main">
        <div className="org-card-icon"><Building2 size={28} /></div>
        <div className="org-card-copy">
          <span className="org-code-pill">{item.code || item.subCompanyCode || 'SUB'}</span>
          <div className="org-card-title">{item.name || item.companyName}</div>
          <div className="org-card-subtitle"><Globe size={12} /> {item.adminEmail || item.email || 'No admin email'}</div>
        </div>
      </div>
      <div className="org-metric-grid">
        <div>
          <span>Branches</span>
          <strong>{item.branchCount || 0}</strong>
        </div>
        <div>
          <span>Created At</span>
          <strong>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</strong>
        </div>
      </div>
      <div className="org-card-footer">
        <span><i /> Sub-Company</span>
        <span className={`org-status ${item.isActive === false ? 'inactive' : ''}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span>
      </div>
    </button>
  );
}
