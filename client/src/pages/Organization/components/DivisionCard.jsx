import React from 'react';
import { LayoutGrid, ChevronRight, MoreVertical } from 'lucide-react';

export default function DivisionCard({ item, onClick }) {
  return (
    <button type="button" className="org-card" onClick={() => onClick(item)}>
      <div className="org-card-menu"><MoreVertical size={18} /></div>
      <div className="org-card-main">
        <div className="org-card-icon"><LayoutGrid size={28} /></div>
        <div className="org-card-copy">
          <span className="org-code-pill">{item.code || item.divisionCode || 'DIV'}</span>
          <div className="org-card-title">{item.name}</div>
          <div className="org-card-subtitle">{item.description || 'Division'}</div>
        </div>
      </div>
      <div className="org-metric-grid">
        <div><span>Departments</span><strong>{item.departmentCount || 0}</strong></div>
        <div><span>Created At</span><strong>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</strong></div>
      </div>
      <div className="org-card-footer">
        <span><i /> Division</span>
        <span className={`org-status ${item.isActive === false ? 'inactive' : ''}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span>
      </div>
    </button>
  );
}
