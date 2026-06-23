import React, { useState, useRef, useEffect } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { TabularContainer, TabularRow, TabularField, TabularCustomFieldLabel } from './TabularForm';
import { Plus, Trash2, Heart } from 'lucide-react';
import { showConfirmToast, showToast } from '../../utils/uiNotifications';

const MaskedDateInput = ({ value, onChange, className, placeholder = "DD-MM-YYYY" }) => {
  const [displayValue, setDisplayValue] = useState(value ? dayjs(value).format('DD-MM-YYYY') : '');
  const lastSyncedValue = useRef(value);

  useEffect(() => {
    if (value !== lastSyncedValue.current) {
      setDisplayValue(value ? dayjs(value).format('DD-MM-YYYY') : '');
      lastSyncedValue.current = value;
    }
  }, [value]);

  const handleTextChange = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = v;
    if (v.length > 2) formatted = v.slice(0, 2) + '-' + v.slice(2);
    if (v.length > 4) formatted = v.slice(0, 2) + '-' + v.slice(2, 4) + '-' + v.slice(4);
    
    setDisplayValue(formatted);

    if (v.length === 8) {
      const d = v.slice(0, 2);
      const m = v.slice(2, 4);
      const y = v.slice(4);
      const isoDate = `${y}-${m}-${d}`;
      lastSyncedValue.current = isoDate;
      onChange(isoDate);
    } else if (!v) {
      lastSyncedValue.current = '';
      onChange('');
    }
  };

  return (
    <input
      type="text"
      placeholder={placeholder}
      maxLength={10}
      value={displayValue}
      onChange={handleTextChange}
      className={className}
    />
  );
};

/**
 * Tab 2: Family Background — Advanced Mode with Dependent Details (Spouse & Children)
 */
const FamilyBackgroundTab = React.memo(function FamilyBackgroundTab({
  fatherName,
  setFatherName,
  fatherFirstName,
  setFatherFirstName,
  fatherLastName,
  setFatherLastName,
  fatherBloodGroup,
  setFatherBloodGroup,
  fatherAadhaar,
  setFatherAadhaar,
  motherName,
  setMotherName,
  motherFirstName,
  setMotherFirstName,
  motherLastName,
  setMotherLastName,
  motherBloodGroup,
  setMotherBloodGroup,
  motherAadhaar,
  setMotherAadhaar,
  fatherCustomFields = [],
  setFatherCustomFields,
  motherCustomFields = [],
  setMotherCustomFields,
  maritalStatus,
  spouseDetails,
  setSpouseDetails,
  children,
  setChildren,
  brothers,
  setBrothers,
  sisters,
  setSisters,
  showSpouse,
  setShowSpouse,
  onAddGlobalField,
  errors = {},
}) {
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const [fatherAddMenuOpen, setFatherAddMenuOpen] = useState(false);
  const [motherAddMenuOpen, setMotherAddMenuOpen] = useState(false);
  const fatherMenuRef = useRef(null);
  const motherMenuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (fatherMenuRef.current && !fatherMenuRef.current.contains(e.target)) setFatherAddMenuOpen(false);
      if (motherMenuRef.current && !motherMenuRef.current.contains(e.target)) setMotherAddMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const addFatherField = (scope = 'onlyUser', type = 'text') => {
    let options = [];
    if (type === 'select') {
      const optStr = window.prompt('Enter dropdown options separated by commas (e.g. Option1, Option2):', 'Option 1, Option 2');
      if (!optStr) { setFatherAddMenuOpen(false); return; }
      options = optStr.split(',').map(s => s.trim()).filter(Boolean);
      if (!options.length) { setFatherAddMenuOpen(false); return; }
    }

    if (scope === 'global' && onAddGlobalField) {
      const label = window.prompt('Enter field label for global field (will appear for all employees):', 'NEW FIELD');
      if (label != null && String(label).trim()) {
        onAddGlobalField('father', String(label).trim(), type, options);
      }
      setFatherAddMenuOpen(false);
      return;
    }
    const label = window.prompt('Custom field name (e.g. Occupation, Phone):', 'NEW FIELD');
    if (label != null && String(label).trim()) {
      setFatherCustomFields?.([...(fatherCustomFields || []), { label: String(label).trim(), value: '', type, options }]);
    }
    setFatherAddMenuOpen(false);
  };

  const addMotherField = (scope = 'onlyUser', type = 'text') => {
    let options = [];
    if (type === 'select') {
      const optStr = window.prompt('Enter dropdown options separated by commas (e.g. Option1, Option2):', 'Option 1, Option 2');
      if (!optStr) { setMotherAddMenuOpen(false); return; }
      options = optStr.split(',').map(s => s.trim()).filter(Boolean);
      if (!options.length) { setMotherAddMenuOpen(false); return; }
    }

    if (scope === 'global' && onAddGlobalField) {
      const label = window.prompt('Enter field label for global field (will appear for all employees):', 'NEW FIELD');
      if (label != null && String(label).trim()) {
        onAddGlobalField('mother', String(label).trim(), type, options);
      }
      setMotherAddMenuOpen(false);
      return;
    }
    const label = window.prompt('Custom field name (e.g. Occupation, Phone):', 'NEW FIELD');
    if (label != null && String(label).trim()) {
      setMotherCustomFields?.([...(motherCustomFields || []), { label: String(label).trim(), value: '', type, options }]);
    }
    setMotherAddMenuOpen(false);
  };

  const addChild = () => {
    setChildren([...children, { name: '', bloodGroup: '', dob: '', additionalFields: [] }]);
  };

  const removeChild = (index) => {
    showConfirmToast({
      title: 'Remove Child Record',
      description: 'Are you sure you want to delete this child entry?',
      danger: true,
      onConfirm: () => {
        setChildren(children.filter((_, i) => i !== index));
        showToast('success', 'Record Removed', 'Child record has been deleted.');
      }
    });
  };

  const updateChild = (index, field, value) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  const addBrother = () => {
    setBrothers([...brothers, { name: '', bloodGroup: '', dob: '', additionalFields: [] }]);
  };

  const removeBrother = (index) => {
    showConfirmToast({
      title: 'Remove Brother Record',
      description: 'Are you sure you want to delete this brother entry?',
      danger: true,
      onConfirm: () => {
        setBrothers(brothers.filter((_, i) => i !== index));
        showToast('success', 'Record Removed', 'Brother record has been deleted.');
      }
    });
  };

  const updateBrother = (index, field, value) => {
    const updated = [...brothers];
    updated[index][field] = value;
    setBrothers(updated);
  };

  const addSister = () => {
    setSisters([...sisters, { name: '', bloodGroup: '', dob: '', additionalFields: [] }]);
  };

  const removeSister = (index) => {
    showConfirmToast({
      title: 'Remove Sister Record',
      description: 'Are you sure you want to delete this sister entry?',
      danger: true,
      onConfirm: () => {
        setSisters(sisters.filter((_, i) => i !== index));
        showToast('success', 'Record Removed', 'Sister record has been deleted.');
      }
    });
  };

  const updateSister = (index, field, value) => {
    const updated = [...sisters];
    updated[index][field] = value;
    setSisters(updated);
  };

  // Additional fields logic is now handled via state passed from parent

  return (
    <div className="family-background-tab space-y-6 animate-in fade-in duration-300">
      
      {/* FATHER'S DETAILS */}
      <TabularContainer>
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <span>FATHER'S DETAILS</span>
          <div className="relative" ref={fatherMenuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFatherAddMenuOpen((o) => !o); }}
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-md transition-colors"
            >
              <Plus size={14} /> Add Field
            </button>
            {fatherAddMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150 font-normal">
                <button type="button" onClick={() => addFatherField('global', 'text')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Global Text</button>
                <button type="button" onClick={() => addFatherField('global', 'select')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Global Dropdown</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800" />
                <button type="button" onClick={() => addFatherField('onlyUser', 'text')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Only user Text</button>
                <button type="button" onClick={() => addFatherField('onlyUser', 'select')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Only user Dropdown</button>
              </div>
            )}
          </div>
        </div>
        <TabularRow columns={4}>
          <TabularField label="FIRST NAME">
            <input
              value={fatherFirstName ?? ''}
              onChange={(e) => setFatherFirstName?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="First name"
            />
          </TabularField>
          <TabularField label="LAST NAME">
            <input
              value={fatherLastName ?? ''}
              onChange={(e) => setFatherLastName?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="Last name"
            />
          </TabularField>
        </TabularRow>
        <TabularRow columns={2}>
          <TabularField label="AADHAAR NUMBER">
            <input
              value={fatherAadhaar ?? ''}
              onChange={(e) => setFatherAadhaar?.(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="12 digits"
              maxLength={12}
            />
          </TabularField>
        </TabularRow>

        {/* Father Custom Fields */}
        {(fatherCustomFields || []).reduce((rows, field, i) => {
          if (i % 2 === 0) rows.push([field]);
          else rows[rows.length - 1].push(field);
          return rows;
        }, []).map((pair, rowIndex) => (
          <TabularRow key={`fc-${rowIndex}`} columns={4}>
            {pair.map((field, colIndex) => {
              const idx = rowIndex * 2 + colIndex;
              return (
                <React.Fragment key={`fc-field-${idx}`}>
                  <TabularCustomFieldLabel
                    value={field.label}
                    onChange={(e) => updateFatherCustomField(idx, 'label', e.target.value.toUpperCase())}
                    onRemove={() => setFatherCustomFields?.(fatherCustomFields.filter((_, i) => i !== idx))}
                  />
                  <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                    {field.type === 'select' ? (
                      <select
                        value={field.value}
                        onChange={(e) => updateFatherCustomField(idx, 'value', e.target.value)}
                        className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={field.value}
                        onChange={(e) => updateFatherCustomField(idx, 'value', e.target.value)}
                        className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            {pair.length === 1 && (
              <>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800" />
                <div className="p-3 bg-white dark:bg-slate-950" />
              </>
            )}
          </TabularRow>
        ))}
      </TabularContainer>

      {/* MOTHER'S DETAILS */}
      <TabularContainer>
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <span>MOTHER'S DETAILS</span>
          <div className="relative" ref={motherMenuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMotherAddMenuOpen((o) => !o); }}
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-md transition-colors"
            >
              <Plus size={14} /> Add Field
            </button>
            {motherAddMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150 font-normal">
                <button type="button" onClick={() => addMotherField('global', 'text')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Global Text</button>
                <button type="button" onClick={() => addMotherField('global', 'select')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Global Dropdown</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800" />
                <button type="button" onClick={() => addMotherField('onlyUser', 'text')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Only user Text</button>
                <button type="button" onClick={() => addMotherField('onlyUser', 'select')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Only user Dropdown</button>
              </div>
            )}
          </div>
        </div>
        <TabularRow columns={4}>
          <TabularField label="FIRST NAME">
            <input
              value={motherFirstName ?? ''}
              onChange={(e) => setMotherFirstName?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="First name"
            />
          </TabularField>
          <TabularField label="LAST NAME">
            <input
              value={motherLastName ?? ''}
              onChange={(e) => setMotherLastName?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="Last name"
            />
          </TabularField>
        </TabularRow>
        <TabularRow columns={2}>
          <TabularField label="AADHAAR NUMBER">
            <input
              value={motherAadhaar ?? ''}
              onChange={(e) => setMotherAadhaar?.(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.motherName ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="12 digits"
              maxLength={12}
            />
            {errors.motherName && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.motherName}</p>}
          </TabularField>
        </TabularRow>

        {/* Mother Custom Fields */}
        {(motherCustomFields || []).reduce((rows, field, i) => {
          if (i % 2 === 0) rows.push([field]);
          else rows[rows.length - 1].push(field);
          return rows;
        }, []).map((pair, rowIndex) => (
          <TabularRow key={`mc-${rowIndex}`} columns={4}>
            {pair.map((field, colIndex) => {
              const idx = rowIndex * 2 + colIndex;
              return (
                <React.Fragment key={`mc-field-${idx}`}>
                  <TabularCustomFieldLabel
                    value={field.label}
                    onChange={(e) => updateMotherCustomField(idx, 'label', e.target.value.toUpperCase())}
                    onRemove={() => setMotherCustomFields?.(motherCustomFields.filter((_, i) => i !== idx))}
                  />
                  <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                    {field.type === 'select' ? (
                      <select
                        value={field.value}
                        onChange={(e) => updateMotherCustomField(idx, 'value', e.target.value)}
                        className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={field.value}
                        onChange={(e) => updateMotherCustomField(idx, 'value', e.target.value)}
                        className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            {pair.length === 1 && (
              <>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800" />
                <div className="p-3 bg-white dark:bg-slate-950" />
              </>
            )}
          </TabularRow>
        ))}
      </TabularContainer>


      {/* ACTION BAR */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {!showSpouse && (
          <>
            <button
              type="button"
              onClick={() => { setShowSpouse(true); setSpouseDetails({ ...spouseDetails, relation: 'Husband' }); }}
              className="bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
            >
              <Plus size={16} className="text-indigo-500" /> Add Husband
            </button>
            <button
              type="button"
              onClick={() => { setShowSpouse(true); setSpouseDetails({ ...spouseDetails, relation: 'Wife' }); }}
              className="bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
            >
              <Plus size={16} className="text-indigo-500" /> Add Wife
            </button>
          </>
        )}
        <button
          type="button"
          onClick={addChild}
          className="bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
        >
          <Plus size={16} className="text-indigo-500" /> Add Child
        </button>
        <button
          type="button"
          onClick={addBrother}
          className="bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
        >
          <Plus size={16} className="text-indigo-500" /> Add Brother
        </button>
        <button
          type="button"
          onClick={addSister}
          className="bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
        >
          <Plus size={16} className="text-indigo-500" /> Add Sister
        </button>
      </div>

      {/* SPOUSE DETAILS */}
      {showSpouse && (
        <TabularContainer className="animate-in fade-in duration-300">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span className="flex items-center gap-2"><Heart size={14} className="text-rose-500" /> {spouseDetails.relation ? spouseDetails.relation.toUpperCase() : 'SPOUSE'} DETAILS</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const label = prompt("Enter extra info name (e.g. Work Contact, Hobby):");
                  if (label) {
                    const updatedFields = [...(spouseDetails.additionalFields || []), { label, value: '' }];
                    setSpouseDetails({ ...spouseDetails, additionalFields: updatedFields });
                  }
                }}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-md transition-colors"
              >
                <Plus size={14} /> Add Field
              </button>
              <button
                type="button"
                onClick={() => {
                  showConfirmToast({
                    title: 'Remove Spouse Record',
                    description: 'Reset spouse details and hide section?',
                    danger: true,
                    onConfirm: () => {
                      setSpouseDetails({ spouseName: '', bloodGroup: '', dob: '', contactNo: '', additionalFields: [] });
                      setShowSpouse(false);
                      showToast('success', 'Record Reset', 'Spouse details have been cleared.');
                    }
                  });
                }}
                className="text-rose-600 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-md transition-colors"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
          <TabularRow columns={4}>
            <TabularField label="NAME" required>
              <input
                required
                value={spouseDetails.spouseName}
                onChange={(e) => setSpouseDetails({ ...spouseDetails, spouseName: e.target.value })}
                className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                placeholder="Full name"
              />
            </TabularField>
            <TabularField label="GENDER">
              <select
                value={spouseDetails.relation === 'Husband' ? 'Male' : spouseDetails.relation === 'Wife' ? 'Female' : spouseDetails.gender || ''}
                disabled={spouseDetails.relation === 'Husband' || spouseDetails.relation === 'Wife'}
                onChange={(e) => setSpouseDetails({ ...spouseDetails, gender: e.target.value })}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${(spouseDetails.relation === 'Husband' || spouseDetails.relation === 'Wife') ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </TabularField>
          </TabularRow>
          <TabularRow columns={4}>
            <TabularField label="DOB">
              <MaskedDateInput
                value={spouseDetails.dob}
                onChange={(val) => setSpouseDetails({ ...spouseDetails, dob: val })}
                className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
            </TabularField>
            <TabularField label="CONTACT NO">
              <input
                value={spouseDetails.contactNo}
                onChange={(e) => setSpouseDetails({ ...spouseDetails, contactNo: e.target.value.replace(/\D/g, '') })}
                className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                placeholder="91xxxxxxxxxx"
              />
            </TabularField>
          </TabularRow>

          {/* Spouse Custom Fields */}
          {(spouseDetails.additionalFields || []).reduce((rows, field, i) => {
            if (i % 2 === 0) rows.push([field]);
            else rows[rows.length - 1].push(field);
            return rows;
          }, []).map((pair, rowIndex) => (
            <TabularRow key={`sc-${rowIndex}`} columns={4}>
              {pair.map((field, colIndex) => {
                const idx = rowIndex * 2 + colIndex;
                return (
                  <React.Fragment key={`sc-field-${idx}`}>
                    <TabularCustomFieldLabel
                      value={field.label}
                      onChange={(e) => {
                        const updated = [...spouseDetails.additionalFields];
                        updated[idx].label = e.target.value.toUpperCase();
                        setSpouseDetails({ ...spouseDetails, additionalFields: updated });
                      }}
                      onRemove={() => {
                        const updated = spouseDetails.additionalFields.filter((_, i) => i !== idx);
                        setSpouseDetails({ ...spouseDetails, additionalFields: updated });
                      }}
                    />
                    <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                      <input
                        value={field.value}
                        onChange={(e) => {
                          const updated = [...spouseDetails.additionalFields];
                          updated[idx].value = e.target.value;
                          setSpouseDetails({ ...spouseDetails, additionalFields: updated });
                        }}
                        className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
              {pair.length === 1 && (
                <>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800" />
                  <div className="p-3 bg-white dark:bg-slate-950" />
                </>
              )}
            </TabularRow>
          ))}
        </TabularContainer>
      )}

      {/* CHILDREN HIERARCHY */}
      {children.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Lineage Records (Children)</h4>
          {children.map((child, index) => (
            <TabularContainer key={`child-${index}`} className="animate-in slide-in-from-left-4 duration-300">
              <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span>CHILD {index + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const label = prompt("Enter extra info name (e.g. School, Hobby):");
                      if (label) {
                        const updated = [...children];
                        updated[index].additionalFields = [...(updated[index].additionalFields || []), { label, value: '' }];
                        setChildren(updated);
                      }
                    }}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-md transition-colors"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    className="text-rose-600 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-md transition-colors"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
              <TabularRow columns={4}>
                <TabularField label="NAME">
                  <input
                    value={child.name}
                    onChange={(e) => updateChild(index, 'name', e.target.value)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    placeholder="Child name"
                  />
                </TabularField>
                <TabularField label="GENDER" required>
                  <select
                    value={child.gender || ''}
                    onChange={(e) => updateChild(index, 'gender', e.target.value)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </TabularField>
              </TabularRow>
              <TabularRow columns={2}>
                <TabularField label="DOB">
                  <MaskedDateInput
                    value={child.dob}
                    onChange={(val) => updateChild(index, 'dob', val)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                  />
                </TabularField>
              </TabularRow>

              {/* Child Custom Fields */}
              {(child.additionalFields || []).reduce((rows, field, i) => {
                if (i % 2 === 0) rows.push([field]);
                else rows[rows.length - 1].push(field);
                return rows;
              }, []).map((pair, rowIndex) => (
                <TabularRow key={`child-cf-${rowIndex}`} columns={4}>
                  {pair.map((field, colIndex) => {
                    const fIdx = rowIndex * 2 + colIndex;
                    return (
                      <React.Fragment key={`child-field-${fIdx}`}>
                        <TabularCustomFieldLabel
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...children];
                            updated[index].additionalFields[fIdx].label = e.target.value.toUpperCase();
                            setChildren(updated);
                          }}
                          onRemove={() => {
                            const updated = [...children];
                            updated[index].additionalFields = updated[index].additionalFields.filter((_, i) => i !== fIdx);
                            setChildren(updated);
                          }}
                        />
                        <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                          <input
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...children];
                              updated[index].additionalFields[fIdx].value = e.target.value;
                              setChildren(updated);
                            }}
                            className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {pair.length === 1 && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800" />
                      <div className="p-3 bg-white dark:bg-slate-950" />
                    </>
                  )}
                </TabularRow>
              ))}
            </TabularContainer>
          ))}
        </div>
      )}

      {/* BROTHERS HIERARCHY */}
      {brothers.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Brothers</h4>
          {brothers.map((brother, index) => (
            <TabularContainer key={`brother-${index}`} className="animate-in slide-in-from-left-4 duration-300">
              <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span>BROTHER {index + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const label = prompt("Enter extra info name (e.g. Work, Location):");
                      if (label) {
                        const updated = [...brothers];
                        updated[index].additionalFields = [...(updated[index].additionalFields || []), { label, value: '' }];
                        setBrothers(updated);
                      }
                    }}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-md transition-colors"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBrother(index)}
                    className="text-rose-600 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-md transition-colors"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
              <TabularRow columns={4}>
                <TabularField label="NAME">
                  <input
                    value={brother.name}
                    onChange={(e) => updateBrother(index, 'name', e.target.value)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    placeholder="Brother name"
                  />
                </TabularField>
                <TabularField label="GENDER">
                  <select
                    value="Male"
                    disabled
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 cursor-not-allowed opacity-70"
                  >
                    <option value="Male">Male</option>
                  </select>
                </TabularField>
              </TabularRow>
              <TabularRow columns={2}>
                <TabularField label="DOB">
                  <MaskedDateInput
                    value={brother.dob}
                    onChange={(val) => updateBrother(index, 'dob', val)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                  />
                </TabularField>
              </TabularRow>

              {/* Brother Custom Fields */}
              {(brother.additionalFields || []).reduce((rows, field, i) => {
                if (i % 2 === 0) rows.push([field]);
                else rows[rows.length - 1].push(field);
                return rows;
              }, []).map((pair, rowIndex) => (
                <TabularRow key={`bro-cf-${rowIndex}`} columns={4}>
                  {pair.map((field, colIndex) => {
                    const fIdx = rowIndex * 2 + colIndex;
                    return (
                      <React.Fragment key={`bro-field-${fIdx}`}>
                        <TabularCustomFieldLabel
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...brothers];
                            updated[index].additionalFields[fIdx].label = e.target.value.toUpperCase();
                            setBrothers(updated);
                          }}
                          onRemove={() => {
                            const updated = [...brothers];
                            updated[index].additionalFields = updated[index].additionalFields.filter((_, i) => i !== fIdx);
                            setBrothers(updated);
                          }}
                        />
                        <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                          <input
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...brothers];
                              updated[index].additionalFields[fIdx].value = e.target.value;
                              setBrothers(updated);
                            }}
                            className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {pair.length === 1 && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800" />
                      <div className="p-3 bg-white dark:bg-slate-950" />
                    </>
                  )}
                </TabularRow>
              ))}
            </TabularContainer>
          ))}
        </div>
      )}

      {/* SISTERS HIERARCHY */}
      {sisters.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Sisters</h4>
          {sisters.map((sister, index) => (
            <TabularContainer key={`sister-${index}`} className="animate-in slide-in-from-left-4 duration-300">
              <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span>SISTER {index + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const label = prompt("Enter extra info name (e.g. Work, Location):");
                      if (label) {
                        const updated = [...sisters];
                        updated[index].additionalFields = [...(updated[index].additionalFields || []), { label, value: '' }];
                        setSisters(updated);
                      }
                    }}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-md transition-colors"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSister(index)}
                    className="text-rose-600 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-md transition-colors"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
              <TabularRow columns={4}>
                <TabularField label="NAME">
                  <input
                    value={sister.name}
                    onChange={(e) => updateSister(index, 'name', e.target.value)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    placeholder="Sister name"
                  />
                </TabularField>
                <TabularField label="GENDER">
                  <select
                    value="Female"
                    disabled
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 cursor-not-allowed opacity-70"
                  >
                    <option value="Female">Female</option>
                  </select>
                </TabularField>
              </TabularRow>
              <TabularRow columns={2}>
                <TabularField label="DOB">
                  <MaskedDateInput
                    value={sister.dob}
                    onChange={(val) => updateSister(index, 'dob', val)}
                    className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                  />
                </TabularField>
              </TabularRow>

              {/* Sister Custom Fields */}
              {(sister.additionalFields || []).reduce((rows, field, i) => {
                if (i % 2 === 0) rows.push([field]);
                else rows[rows.length - 1].push(field);
                return rows;
              }, []).map((pair, rowIndex) => (
                <TabularRow key={`sis-cf-${rowIndex}`} columns={4}>
                  {pair.map((field, colIndex) => {
                    const fIdx = rowIndex * 2 + colIndex;
                    return (
                      <React.Fragment key={`sis-field-${fIdx}`}>
                        <TabularCustomFieldLabel
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...sisters];
                            updated[index].additionalFields[fIdx].label = e.target.value.toUpperCase();
                            setSisters(updated);
                          }}
                          onRemove={() => {
                            const updated = [...sisters];
                            updated[index].additionalFields = updated[index].additionalFields.filter((_, i) => i !== fIdx);
                            setSisters(updated);
                          }}
                        />
                        <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                          <input
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...sisters];
                              updated[index].additionalFields[fIdx].value = e.target.value;
                              setSisters(updated);
                            }}
                            className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {pair.length === 1 && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800" />
                      <div className="p-3 bg-white dark:bg-slate-950" />
                    </>
                  )}
                </TabularRow>
              ))}
            </TabularContainer>
          ))}
        </div>
      )}
    </div>
  );
});

export default FamilyBackgroundTab;
