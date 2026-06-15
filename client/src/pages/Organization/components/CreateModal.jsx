import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import orgService from '../../../services/organizationService';

const LABELS = {
  subcompany: 'Sub Company',
  branch: 'Branch',
  division: 'Division',
  department: 'Department',
  designation: 'Designation',
  employee: 'Employee',
};

function suggestCode(name) {
  return String(name || '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 8);
}

export default function CreateModal({ modalConfig, selectedIds, onClose }) {
  const [form, setForm] = useState({});
  const [designations, setDesignations] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const type = modalConfig.type;
  const label = LABELS[type] || 'Item';

  useEffect(() => {
    if (type === 'employee' && selectedIds.departmentId) {
      orgService.getDesignations(selectedIds.departmentId)
        .then((res) => setDesignations(res?.data || []))
        .catch(() => setDesignations([]));
    }
  }, [type, selectedIds.departmentId]);

  const fields = useMemo(() => {
    if (type === 'subcompany') {
      return [
        ['companyName', 'Company Name', 'text', true],
        ['companyCode', 'Company Code', 'text', true],
        ['adminEmail', 'Admin Email', 'email', true],
        ['adminName', 'Admin Name', 'text', true],
        ['adminPassword', 'Admin Password', 'password', true],
      ];
    }
    if (type === 'branch') return [['name', 'Branch Name', 'text', true], ['city', 'City', 'text', true]];
    if (type === 'division') return [['name', 'Division Name', 'text', true], ['description', 'Description', 'text', false]];
    if (type === 'department') return [['name', 'Department Name', 'text', true], ['description', 'Description', 'text', false]];
    if (type === 'designation') return [['title', 'Designation Title', 'text', true], ['grade', 'Level/Grade', 'text', false]];
    return [['fullName', 'Full Name', 'text', true], ['email', 'Email', 'email', true], ['password', 'Password', 'password', true], ['phone', 'Phone', 'text', false]];
  }, [type]);

  const setValue = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'companyName' && !current.companyCode) next.companyCode = suggestCode(value);
      return next;
    });
    setError('');
  };

  const validate = () => {
    for (const [key, labelText, , required] of fields) {
      if (required && !String(form[key] || '').trim()) return `${labelText} is required`;
    }
    if (type === 'employee') {
      if (String(form.password || '').length < 8) return 'Password must be at least 8 characters';
      if (!form.designationId && designations.length > 0) return 'Designation is required';
    }
    return '';
  };

  const payload = () => {
    const base = { ...form };
    if (type === 'branch') base.subCompanyId = selectedIds.subCompanyId;
    if (type === 'division') Object.assign(base, { subCompanyId: selectedIds.subCompanyId, branchId: selectedIds.branchId });
    if (type === 'department') Object.assign(base, { subCompanyId: selectedIds.subCompanyId, branchId: selectedIds.branchId, divisionId: selectedIds.divisionId });
    if (type === 'designation') Object.assign(base, { subCompanyId: selectedIds.subCompanyId, branchId: selectedIds.branchId, divisionId: selectedIds.divisionId, departmentId: selectedIds.departmentId });
    if (type === 'employee') Object.assign(base, { subCompanyId: selectedIds.subCompanyId, branchId: selectedIds.branchId, divisionId: selectedIds.divisionId, departmentId: selectedIds.departmentId, designationId: form.designationId || designations[0]?._id });
    return base;
  };

  const submit = async (event) => {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    try {
      const method = `create${type === 'subcompany' ? 'SubCompany' : label.replace(/\s/g, '')}`;
      const res = await orgService[method](payload());
      modalConfig.onSuccess?.(res?.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || `Failed to create ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="org-modal-shell">
      <form className="org-modal-card" onSubmit={submit}>
        <button type="button" className="org-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>Create {label}</h2>
        <p>Under: {modalConfig.parentLabel}</p>

        <div className="org-modal-fields">
          {fields.map(([key, labelText, inputType, required]) => (
            <label key={key}>
              <span>{labelText}{required ? '*' : ''}</span>
              {key === 'address' ? (
                <textarea rows={2} value={form[key] || ''} onChange={(event) => setValue(key, event.target.value)} />
              ) : (
                <input type={inputType} value={form[key] || ''} onChange={(event) => setValue(key, event.target.value)} />
              )}
            </label>
          ))}
          {type === 'branch' && (
            <label>
              <span>Address</span>
              <textarea rows={2} value={form.address || ''} onChange={(event) => setValue('address', event.target.value)} />
            </label>
          )}
          {type === 'employee' && (
            <label>
              <span>Designation*</span>
              <select value={form.designationId || ''} onChange={(event) => setValue('designationId', event.target.value)}>
                <option value="">Select designation</option>
                {designations.map((designation) => (
                  <option key={designation._id} value={designation._id}>{designation.title || designation.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && <div className="org-modal-error">{error}</div>}
        <button type="submit" className="org-primary-button" disabled={saving}>
          {saving ? 'Creating...' : `Create ${label}`}
        </button>
      </form>
    </div>
  );
}
