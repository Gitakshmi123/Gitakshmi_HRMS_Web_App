import React from 'react';
import { IdCard, Plus } from 'lucide-react';

export default function DesignationCard({ item, onAddEmployee, canCreate }) {
  return (
    <div className="org-card org-card-static">
      <div className="org-card-top">
        <div className="org-card-code"><IdCard size={14} /> {item.code || item.designationCode || 'DES'}</div>
      </div>
      <div className="org-card-title">{item.title || item.name}</div>
      <div className="org-card-subtitle">Employees: {item.employeeCount || 0}</div>
      {canCreate && (
        <button type="button" className="org-card-action" onClick={() => onAddEmployee(item)}>
          <Plus size={14} />
          Add Employee
        </button>
      )}
    </div>
  );
}
