import React, { useState, useRef, useEffect } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
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
export default function FamilyBackgroundTab({
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

  const addFatherField = (scope) => {
    const label = window.prompt('Custom field name (e.g. Occupation, Phone):', 'NEW FIELD');
    if (label == null || !String(label).trim()) { setFatherAddMenuOpen(false); return; }
    const trimmed = String(label).trim();
    if (scope === 'global' && onAddGlobalField) {
      onAddGlobalField('father', trimmed);
    } else {
      setFatherCustomFields?.([...(fatherCustomFields || []), { label: trimmed, value: '' }]);
    }
    setFatherAddMenuOpen(false);
  };

  const addMotherField = (scope) => {
    const label = window.prompt('Custom field name (e.g. Occupation, Phone):', 'NEW FIELD');
    if (label == null || !String(label).trim()) { setMotherAddMenuOpen(false); return; }
    const trimmed = String(label).trim();
    if (scope === 'global' && onAddGlobalField) {
      onAddGlobalField('mother', trimmed);
    } else {
      setMotherCustomFields?.([...(motherCustomFields || []), { label: trimmed, value: '' }]);
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
    <div className="family-background-tab space-y-3 animate-in fade-in duration-300">
      {/* PARENTAL RECORD AREA - Simplified to remove double-box effect */}
      <div className="relative group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-slate-500/10 transition-colors"></div>

        <div className="flex flex-wrap gap-4 relative z-10 w-full">
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Father's First Name</label>
            <input
              value={fatherFirstName ?? ''}
              onChange={(e) => setFatherFirstName?.(e.target.value)}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="First name"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Father's Last Name</label>
            <input
              value={fatherLastName ?? ''}
              onChange={(e) => setFatherLastName?.(e.target.value)}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="Last name"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Father's Blood Group</label>
            <select
              value={fatherBloodGroup ?? ''}
              onChange={(e) => setFatherBloodGroup?.(e.target.value)}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all"
            >
              <option value="">Select</option>
              {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Father's Aadhaar Number</label>
            <input
              value={fatherAadhaar ?? ''}
              onChange={(e) => setFatherAadhaar?.(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="12 digits"
              maxLength={12}
            />
          </div>
          {(fatherCustomFields || []).map((field, idx) => (
            <div key={idx} className="flex-1 flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 truncate pr-6">{field.label}</label>
              <div className="relative flex items-center gap-2">
                <input
                  value={field.value}
                  onChange={(e) => {
                    const updated = [...(fatherCustomFields || [])];
                    updated[idx] = { ...updated[idx], value: e.target.value };
                    setFatherCustomFields?.(updated);
                  }}
                  className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
                  placeholder={`Enter ${field.label}`}
                />
                <button
                  type="button"
                  onClick={() => setFatherCustomFields?.(fatherCustomFields.filter((_, i) => i !== idx))}
                  className="shrink-0 w-9 h-[40px] rounded-xl bg-white dark:bg-slate-800 border border-slate-100 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                  title="Remove field"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1.5 shrink-0 relative" ref={fatherMenuRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 opacity-0 select-none">Add</label>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFatherAddMenuOpen((o) => !o); }}
              className="h-[40px] w-[40px] shrink-0 rounded-xl bg-slate-50 dark:bg-indigo-900/30 border-2 border-indigo-100 dark:border-indigo-800 text-slate-600 dark:text-indigo-400 flex items-center justify-center hover:bg-slate-500 hover:text-white hover:border-indigo-500 transition-all active:scale-95"
              title="Add custom field for Father"
            >
              <Plus size={18} />
            </button>
            {fatherAddMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150">
                <button type="button" onClick={() => addFatherField('global')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Global</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800" />
                <button type="button" onClick={() => addFatherField('onlyUser')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Only user</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 relative z-10 mt-2 w-full">
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mother's First Name</label>
            <input
              value={motherFirstName ?? ''}
              onChange={(e) => setMotherFirstName?.(e.target.value)}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="First name"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mother's Last Name</label>
            <input
              value={motherLastName ?? ''}
              onChange={(e) => setMotherLastName?.(e.target.value)}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="Last name"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mother's Blood Group</label>
            <select
              value={motherBloodGroup ?? ''}
              onChange={(e) => setMotherBloodGroup?.(e.target.value)}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all"
            >
              <option value="">Select</option>
              {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1 w-full">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mother's Aadhaar Number</label>
            <input
              value={motherAadhaar ?? ''}
              onChange={(e) => setMotherAadhaar?.(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="12 digits"
              maxLength={12}
            />
            {errors.motherName && <p className="text-[9px] font-bold text-rose-500 px-2 mt-1 uppercase tracking-widest leading-none">{errors.motherName}</p>}
          </div>
          {(motherCustomFields || []).map((field, idx) => (
            <div key={idx} className="flex-1 flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 truncate pr-6">{field.label}</label>
              <div className="relative flex items-center gap-2">
                <input
                  value={field.value}
                  onChange={(e) => {
                    const updated = [...(motherCustomFields || [])];
                    updated[idx] = { ...updated[idx], value: e.target.value };
                    setMotherCustomFields?.(updated);
                  }}
                  className="w-full h-[40px] px-4 bg-slate-50/50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-xs font-bold text-slate-700 transition-all placeholder:text-slate-300"
                  placeholder={`Enter ${field.label}`}
                />
                <button
                  type="button"
                  onClick={() => setMotherCustomFields?.(motherCustomFields.filter((_, i) => i !== idx))}
                  className="shrink-0 w-9 h-[40px] rounded-xl bg-white dark:bg-slate-800 border border-slate-100 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                  title="Remove field"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1 shrink-0 relative" ref={motherMenuRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 opacity-0 select-none">Add</label>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMotherAddMenuOpen((o) => !o); }}
              className="h-[40px] w-[40px] shrink-0 rounded-xl bg-slate-50 dark:bg-indigo-900/30 border-2 border-indigo-100 dark:border-indigo-800 text-slate-600 dark:text-indigo-400 flex items-center justify-center hover:bg-slate-500 hover:text-white hover:border-indigo-500 transition-all active:scale-95"
              title="Add custom field for Mother"
            >
              <Plus size={18} />
            </button>
            {motherAddMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150">
                <button type="button" onClick={() => addMotherField('global')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Global</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800" />
                <button type="button" onClick={() => addMotherField('onlyUser')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">Only user</button>
              </div>
            )}
          </div>
        </div>

      {/* Add Spouse / Child / Brother / Sister - always visible */}
        <div className="space-y-2 mt-3">

          {/* RELATIONS ACTION BAR - Unified Control Center */}
          <div className="flex flex-wrap items-center gap-3 mb-1">
            {!showSpouse && (
              <>
                <button
                  type="button"
                  onClick={() => { setShowSpouse(true); setSpouseDetails({ ...spouseDetails, relation: 'Husband' }); }}
                  className="bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
                >
                  <Plus size={16} className="text-indigo-500" /> Add Husband
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSpouse(true); setSpouseDetails({ ...spouseDetails, relation: 'Wife' }); }}
                  className="bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
                >
                  <Plus size={16} className="text-indigo-500" /> Add Wife
                </button>
              </>
            )}
            <button
              type="button"
              onClick={addChild}
              className="bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
            >
              <Plus size={16} className="text-indigo-500" /> Add Child
            </button>
            <button
              type="button"
              onClick={addBrother}
              className="bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
            >
              <Plus size={16} className="text-indigo-500" /> Add Brother
            </button>
            <button
              type="button"
              onClick={addSister}
              className="bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200 shadow-sm"
            >
              <Plus size={16} className="text-indigo-500" /> Add Sister
            </button>
          </div>

          {/* SPOUSE REPOSITORY - Now Conditional (no background box) */}
          {showSpouse && (
            <div className="relative group py-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                    <Heart size={10} /> {spouseDetails.relation || 'Husband/Wife'} Name
                  </label>
                  <input
                    required
                    value={spouseDetails.spouseName}
                    onChange={(e) => setSpouseDetails({ ...spouseDetails, spouseName: e.target.value })}
                    className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700"
                    placeholder="Full name"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Blood Group</label>
                  <select
                    value={spouseDetails.bloodGroup}
                    onChange={(e) => setSpouseDetails({ ...spouseDetails, bloodGroup: e.target.value })}
                    className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Select</option>
                    {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">DOB</label>
                  <MaskedDateInput
                    value={spouseDetails.dob}
                    onChange={(val) => setSpouseDetails({ ...spouseDetails, dob: val })}
                    className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Contact</label>
                  <div className="relative flex items-center gap-2">
                    <input
                      value={spouseDetails.contactNo}
                      onChange={(e) => setSpouseDetails({ ...spouseDetails, contactNo: e.target.value })}
                      className="flex-1 h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700"
                      placeholder="+91..."
                    />
                    <button
                      type="button"
                      title="Add Custom Detail"
                      onClick={() => {
                        const label = prompt("Enter field name (e.g. Husband's Name, Work Contact):");
                        if (label) {
                          const updatedFields = [...(spouseDetails.additionalFields || []), { label, value: '' }];
                          setSpouseDetails({ ...spouseDetails, additionalFields: updatedFields });
                        }
                      }}
                      className="shrink-0 w-9 h-[38px] bg-slate-50 border-2 border-indigo-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-500 hover:text-white hover:border-indigo-500 transition-all active:scale-95 group/add"
                    >
                      <Plus size={16} className="group-hover/add:rotate-90 transition-transform" />
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
                      className="shrink-0 w-9 h-[38px] rounded-lg bg-white border border-slate-100 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Render Additional Custom Fields */}
              {spouseDetails.additionalFields && spouseDetails.additionalFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {spouseDetails.additionalFields.map((field, idx) => (
                    <div key={idx} className="flex flex-col gap-1 relative group/field">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 truncate pr-6">{field.label}</label>
                      <div className="relative">
                        <input
                          value={field.value}
                          onChange={(e) => {
                            const updated = [...spouseDetails.additionalFields];
                            updated[idx].value = e.target.value;
                            setSpouseDetails({ ...spouseDetails, additionalFields: updated });
                          }}
                          className="w-full h-[38px] px-3 bg-white border-2 border-indigo-50 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700"
                          placeholder={`Enter ${field.label}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = spouseDetails.additionalFields.filter((_, i) => i !== idx);
                            setSpouseDetails({ ...spouseDetails, additionalFields: updated });
                          }}
                          className="absolute -top-6 right-0 text-slate-300 hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* CHILDREN HIERARCHY - Boxless & Professional */}
          <div className="relative">
            {children.length > 0 && (
              <div className="pl-1 mb-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Lineage Records
                </h4>
              </div>
            )}

            <div className="space-y-3">
              {children.map((child, index) => (
                <React.Fragment key={index}>
                  <div className="flex items-center gap-4 py-2 px-1 transition-all group animate-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white text-[10px] font-black text-slate-600 shadow-sm border border-slate-50 shrink-0">
                      {index + 1}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Name</label>
                        <input
                          value={child.name}
                          onChange={(e) => updateChild(index, 'name', e.target.value)}
                          className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all"
                          placeholder="Child name"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Blood Group</label>
                        <select
                          value={child.bloodGroup}
                          onChange={(e) => updateChild(index, 'bloodGroup', e.target.value)}
                          className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Select</option>
                          {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">DOB</label>
                        <div className="flex items-center gap-2">
                          <MaskedDateInput
                            value={child.dob}
                            onChange={(val) => updateChild(index, 'dob', val)}
                            className="flex-1 h-[38px] bg-slate-50/30 rounded-lg border-2 border-slate-100 focus:outline-none focus:border-slate-400 text-[11px] font-bold px-3"
                          />
                          <button
                            type="button"
                            title="Add Custom Detail"
                            onClick={() => {
                              const label = prompt("Enter extra info name (e.g. School, Hobby, Medical):");
                              if (label) {
                                const updated = [...children];
                                updated[index].additionalFields = [...(updated[index].additionalFields || []), { label, value: '' }];
                                setChildren(updated);
                              }
                            }}
                            className="shrink-0 w-9 h-[38px] bg-slate-50 border-2 border-indigo-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-500 hover:text-white hover:border-indigo-500 transition-all active:scale-95 group/add"
                          >
                            <Plus size={16} className="group-hover/add:rotate-90 transition-transform" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeChild(index)}
                            className="shrink-0 w-9 h-[38px] rounded-lg bg-white border border-slate-100 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Custom Fields for this Child */}
                  {child.additionalFields && child.additionalFields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 ml-12 mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
                      {child.additionalFields.map((field, fIdx) => (
                        <div key={fIdx} className="flex flex-col gap-1 relative group/field">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 truncate pr-6">{field.label}</label>
                          <div className="relative">
                            <input
                              value={field.value}
                              onChange={(e) => {
                                const updated = [...children];
                                updated[index].additionalFields[fIdx].value = e.target.value;
                                setChildren(updated);
                              }}
                              className="w-full h-[38px] px-3 bg-white border-2 border-indigo-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all"
                              placeholder={`Enter ${field.label}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...children];
                                updated[index].additionalFields = updated[index].additionalFields.filter((_, i) => i !== fIdx);
                                setChildren(updated);
                              }}
                              className="absolute -top-6 right-0 text-slate-300 hover:text-rose-500 transition-colors p-1"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* BROTHERS HIERARCHY - Boxless & Professional */}
          {brothers.length > 0 && (
            <div className="relative mt-4">
              <div className="pl-1 mb-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Brothers
                </h4>
              </div>

              <div className="space-y-3">
                {brothers.map((brother, index) => (
                <React.Fragment key={index}>
                  <div className="flex items-center gap-4 py-2 px-1 transition-all group animate-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white text-[10px] font-black text-slate-600 shadow-sm border border-slate-50 shrink-0">
                      {index + 1}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Brother Name</label>
                        <input
                          value={brother.name}
                          onChange={(e) => updateBrother(index, 'name', e.target.value)}
                          className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all"
                          placeholder="Brother name"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Blood Group</label>
                        <select
                          value={brother.bloodGroup}
                          onChange={(e) => updateBrother(index, 'bloodGroup', e.target.value)}
                          className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Select</option>
                          {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">DOB</label>
                        <div className="flex items-center gap-2">
                          <MaskedDateInput
                            value={brother.dob}
                            onChange={(val) => updateBrother(index, 'dob', val)}
                            className="flex-1 h-[38px] bg-slate-50/30 rounded-lg border-2 border-slate-100 focus:outline-none focus:border-slate-400 text-[11px] font-bold px-3"
                          />
                          <button
                            type="button"
                            title="Add Custom Detail"
                            onClick={() => {
                              const label = prompt("Enter extra info name (e.g. Work, Qualification, Location):");
                              if (label) {
                                const updated = [...brothers];
                                updated[index].additionalFields = [...(updated[index].additionalFields || []), { label, value: '' }];
                                setBrothers(updated);
                              }
                            }}
                            className="shrink-0 w-9 h-[38px] bg-slate-50 border-2 border-indigo-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-500 hover:text-white hover:border-indigo-500 transition-all active:scale-95 group/add"
                          >
                            <Plus size={16} className="group-hover/add:rotate-90 transition-transform" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBrother(index)}
                            className="shrink-0 w-9 h-[38px] rounded-lg bg-white border border-slate-100 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Custom Fields for this Brother */}
                  {brother.additionalFields && brother.additionalFields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 ml-12 mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
                      {brother.additionalFields.map((field, fIdx) => (
                        <div key={fIdx} className="flex flex-col gap-1 relative group/field">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 truncate pr-6">{field.label}</label>
                          <div className="relative">
                            <input
                              value={field.value}
                              onChange={(e) => {
                                const updated = [...brothers];
                                updated[index].additionalFields[fIdx].value = e.target.value;
                                setBrothers(updated);
                              }}
                              className="w-full h-[38px] px-3 bg-white border-2 border-indigo-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all"
                              placeholder={`Enter ${field.label}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...brothers];
                                updated[index].additionalFields = updated[index].additionalFields.filter((_, i) => i !== fIdx);
                                setBrothers(updated);
                              }}
                              className="absolute -top-6 right-0 text-slate-300 hover:text-rose-500 transition-colors p-1"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* SISTERS HIERARCHY - Boxless & Professional */}
          {sisters.length > 0 && (
            <div className="relative mt-4">
              <div className="pl-1 mb-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Sisters
                </h4>
              </div>

              <div className="space-y-3">
                {sisters.map((sister, index) => (
                <React.Fragment key={index}>
                  <div className="flex items-center gap-4 py-2 px-1 transition-all group animate-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white text-[10px] font-black text-slate-600 shadow-sm border border-slate-50 shrink-0">
                      {index + 1}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Sister Name</label>
                        <input
                          value={sister.name}
                          onChange={(e) => updateSister(index, 'name', e.target.value)}
                          className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all"
                          placeholder="Sister name"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Blood Group</label>
                        <select
                          value={sister.bloodGroup}
                          onChange={(e) => updateSister(index, 'bloodGroup', e.target.value)}
                          className="w-full h-[38px] px-3 bg-slate-50/30 border-2 border-slate-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Select</option>
                          {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">DOB</label>
                        <div className="flex items-center gap-2">
                          <MaskedDateInput
                            value={sister.dob}
                            onChange={(val) => updateSister(index, 'dob', val)}
                            className="flex-1 h-[38px] bg-slate-50/30 rounded-lg border-2 border-slate-100 focus:outline-none focus:border-slate-400 text-[11px] font-bold px-3"
                          />
                          <button
                            type="button"
                            title="Add Custom Detail"
                            onClick={() => {
                              const label = prompt("Enter extra info name (e.g. Work, Qualification, Location):");
                              if (label) {
                                const updated = [...sisters];
                                updated[index].additionalFields = [...(updated[index].additionalFields || []), { label, value: '' }];
                                setSisters(updated);
                              }
                            }}
                            className="shrink-0 w-9 h-[38px] bg-slate-50 border-2 border-indigo-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-500 hover:text-white hover:border-indigo-500 transition-all active:scale-95 group/add"
                          >
                            <Plus size={16} className="group-hover/add:rotate-90 transition-transform" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSister(index)}
                            className="shrink-0 w-9 h-[38px] rounded-lg bg-white border border-slate-100 text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Custom Fields for this Sister */}
                  {sister.additionalFields && sister.additionalFields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 ml-12 mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
                      {sister.additionalFields.map((field, fIdx) => (
                        <div key={fIdx} className="flex flex-col gap-1 relative group/field">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 truncate pr-6">{field.label}</label>
                          <div className="relative">
                            <input
                              value={field.value}
                              onChange={(e) => {
                                const updated = [...sisters];
                                updated[index].additionalFields[fIdx].value = e.target.value;
                                setSisters(updated);
                              }}
                              className="w-full h-[38px] px-3 bg-white border-2 border-indigo-100 rounded-lg outline-none focus:border-slate-400 text-[11px] font-bold text-slate-700 transition-all"
                              placeholder={`Enter ${field.label}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...sisters];
                                updated[index].additionalFields = updated[index].additionalFields.filter((_, i) => i !== fIdx);
                                setSisters(updated);
                              }}
                              className="absolute -top-6 right-0 text-slate-300 hover:text-rose-500 transition-colors p-1"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
    </div>
  );
}
