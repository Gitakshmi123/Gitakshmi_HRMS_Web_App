import React, { useMemo, useState } from 'react';
import hierarchyService from '../../services/hierarchyService';

const TYPE_LABEL = {
  branch: 'Branch',
  division: 'Division',
  department: 'Department',
  designation: 'Designation',
  employee: 'Employee',
};

const CREATE_CALL = {
  branch: hierarchyService.createBranch,
  division: hierarchyService.createDivision,
  department: hierarchyService.createDepartment,
  designation: hierarchyService.createDesignation,
  employee: hierarchyService.createEmployee,
};

function initialState(type) {
  if (type === 'employee') return { fullName: '', email: '', password: '', phone: '' };
  if (type === 'designation') return { title: '' };
  return { name: '', address: '', city: '' };
}

function payloadFor(config, form) {
  if (config.type === 'branch') return { name: form.name, address: form.address, city: form.city };
  if (config.type === 'division') return { name: form.name, branchId: config.parentId };
  if (config.type === 'department') return { name: form.name, divisionId: config.parentId };
  if (config.type === 'designation') return { title: form.title, name: form.title, departmentId: config.parentId };
  return {
    name: form.fullName,
    fullName: form.fullName,
    email: form.email,
    password: form.password,
    phone: form.phone,
    designationId: config.parentId,
  };
}

export default function CreateNodeModal({ modalConfig, onClose }) {
  const [form, setForm] = useState(() => initialState(modalConfig.type));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const label = TYPE_LABEL[modalConfig.type] || 'Node';
  const parentLabel = modalConfig.parentName || 'selected parent';

  const parentFieldLabel = useMemo(() => {
    if (modalConfig.type === 'division') return 'Branch';
    if (modalConfig.type === 'department') return 'Division';
    if (modalConfig.type === 'designation') return 'Department';
    if (modalConfig.type === 'employee') return 'Designation';
    return '';
  }, [modalConfig.type]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const validate = () => {
    if (modalConfig.type === 'employee') {
      if (!form.fullName.trim()) return 'Full name is required';
      if (!form.email.trim()) return 'Email is required';
      if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
      return '';
    }
    if (modalConfig.type === 'designation') return form.title.trim() ? '' : 'Title is required';
    return form.name.trim() ? '' : 'Name is required';
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await CREATE_CALL[modalConfig.type](payloadFor(modalConfig, form));
      modalConfig.onSuccess?.(response?.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || `Failed to create ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 500,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          background: 'var(--color-background-primary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 24,
          width: 420,
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Add {label}</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '6px 0 0' }}>
            Adding {label.toLowerCase()} under {parentLabel}
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          {parentFieldLabel && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{parentFieldLabel}</span>
              <input value={parentLabel} readOnly style={inputStyle} />
            </label>
          )}

          {modalConfig.type === 'employee' ? (
            <>
              <Field label="Full Name" value={form.fullName} onChange={(value) => update('fullName', value)} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} required />
              <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} required />
              <Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} />
            </>
          ) : modalConfig.type === 'designation' ? (
            <Field label="Title" value={form.title} onChange={(value) => update('title', value)} required />
          ) : (
            <>
              <Field label="Name" value={form.name} onChange={(value) => update('name', value)} required />
              {modalConfig.type === 'branch' && (
                <>
                  <Field label="Address" value={form.address} onChange={(value) => update('address', value)} />
                  <Field label="City" value={form.city} onChange={(value) => update('city', value)} />
                </>
              )}
            </>
          )}

          {error && <div style={{ color: '#B42318', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Saving...' : `Create ${label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
        {label}{required ? ' *' : ''}
      </span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
    </label>
  );
}

const inputStyle = {
  height: 38,
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 8,
  padding: '0 10px',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

const primaryButtonStyle = {
  height: 38,
  border: 0,
  borderRadius: 8,
  padding: '0 14px',
  background: '#185FA5',
  color: '#fff',
  fontWeight: 500,
};

const secondaryButtonStyle = {
  height: 38,
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 8,
  padding: '0 14px',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};
