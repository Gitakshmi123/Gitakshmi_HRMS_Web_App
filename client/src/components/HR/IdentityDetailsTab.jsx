import React, { useState, useRef, useEffect } from 'react';
import { Camera, Trash2, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { TabularContainer, TabularRow, TabularField, TabularCustomFieldLabel } from './TabularForm';

/**
 * Tab 1: Identity Details — Profile Photo, Name, Gender, DOB, Blood Group, Nationality.
 * Two-column responsive grid. Receives form state/setters from parent; no logic change.
 */
export default function IdentityDetailsTab({
  profilePreview,
  profilePic,
  setProfilePic,
  setProfilePreview,
  profilePicRef,
  backendUrl = '',
  firstName,
  setFirstName,
  firstNameCapital,
  setFirstNameCapital,
  middleName,
  setMiddleName,
  lastName,
  setLastName,
  gender,
  setGender,
  dob,
  setDob,
  bloodGroup,
  setBloodGroup,
  maritalStatus,
  setMaritalStatus,
  nationality,
  setNationality,
  placeOfBirth,
  setPlaceOfBirth,
  hobbies,
  setHobbies,
  height,
  setHeight,
  weight,
  setWeight,
  cast,
  setCast,
  physicalDisabilityOrSickness,
  setPhysicalDisabilityOrSickness,
  physicalDisabilityDetails,
  setPhysicalDisabilityDetails,
  email,
  setEmail,
  contactNo,
  setContactNo,
  customFields = [],
  setCustomFields,
  onAddGlobalField,
  errors = {},
  nationalities = [],
  emergencyContactName,
  setEmergencyContactName,
  emergencyContactNumber,
  setEmergencyContactNumber,
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setAddMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const addCustomField = (scope = 'onlyUser', type = 'text') => {
    let options = [];
    if (type === 'select') {
      const optStr = window.prompt('Enter dropdown options separated by commas (e.g. Option1, Option2):', 'Option 1, Option 2');
      if (!optStr) { setAddMenuOpen(false); return; }
      options = optStr.split(',').map(s => s.trim()).filter(Boolean);
      if (!options.length) { setAddMenuOpen(false); return; }
    }

    if (scope === 'global' && onAddGlobalField) {
      const label = window.prompt('Enter field label for global field (will appear for all employees):', 'NEW FIELD');
      if (label != null && String(label).trim()) {
        onAddGlobalField('personal', String(label).trim(), type, options);
      }
      setAddMenuOpen(false);
      return;
    }
    const label = window.prompt('Enter field label:', 'NEW FIELD');
    if (label != null && String(label).trim()) {
      setCustomFields?.([...customFields, { label: String(label).trim(), value: '', type, options }]);
    }
    setAddMenuOpen(false);
  };

  const updateCustomField = (index, field, value) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields?.(updated);
  };

  const removeCustomField = (index) => {
    setCustomFields?.(customFields.filter((_, i) => i !== index));
  };

  // Local state for DOB input to allow typing
  const [dobDisplay, setDobDisplay] = useState(dob ? dayjs(dob).format('DD/MM/YYYY') : '');
  const lastSyncedDob = useRef(dob);

  useEffect(() => {
    if (dob !== lastSyncedDob.current) {
      setDobDisplay(dob ? dayjs(dob).format('DD/MM/YYYY') : '');
      lastSyncedDob.current = dob;
    }
  }, [dob]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <TabularContainer>
        {/* Row 1: Profile Photo (Spans full width for visibility) */}
        <TabularRow columns={2}>
          <TabularField label="PROFILE PHOTO" className="flex justify-center sm:justify-start">
            <div
              className="relative group cursor-pointer"
              onClick={() => profilePicRef?.current?.click()}
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-center shadow-sm group-hover:border-indigo-400 group-hover:bg-slate-50/30 transition-all duration-300">
                {profilePreview ? (
                  <img
                    src={profilePreview instanceof File ? URL.createObjectURL(profilePreview) : (typeof profilePreview === 'string' && profilePreview.startsWith('http') ? profilePreview : `${backendUrl}${profilePreview}`)}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-white dark:bg-slate-800 shadow-sm text-slate-400 group-hover:text-indigo-500 transition-colors">
                      <Camera size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload</span>
                  </div>
                )}
              </div>
              <input
                ref={profilePicRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProfilePic?.(file);
                    setProfilePreview?.(file);
                  }
                }}
              />
            </div>
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="FIRST NAME" required>
            <input
              required
              value={firstName}
              onChange={(e) => {
                const v = e.target.value;
                setFirstName?.(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
              }}
              placeholder="Name"
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.firstName ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.firstName && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.firstName}</p>}
          </TabularField>
          <TabularField label="MIDDLE NAME">
            <input
              value={middleName}
              onChange={(e) => {
                const v = e.target.value;
                setMiddleName?.(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
              }}
              placeholder="Father's name"
              className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="LAST NAME" required>
            <input
              required
              value={lastName}
              onChange={(e) => {
                const v = e.target.value;
                setLastName?.(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
              }}
              placeholder="Last name"
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.lastName ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.lastName && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.lastName}</p>}
          </TabularField>
          <TabularField label="PERSONAL EMAIL" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail?.(e.target.value)}
              placeholder="name@gmail.com"
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.email ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.email && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.email}</p>}
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="CONTACT NUMBER" required>
            <input
              type="tel"
              minLength={10}
              maxLength={15}
              value={contactNo}
              onChange={(e) => setContactNo?.(e.target.value.replace(/\D/g, ''))}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.contactNo ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="91xxxxxxxxxx"
            />
            {errors.contactNo && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.contactNo}</p>}
          </TabularField>
          <TabularField label="MARITAL STATUS" required>
            <select
              value={maritalStatus}
              onChange={(e) => setMaritalStatus?.(e.target.value)}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.maritalStatus ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
            {errors.maritalStatus && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.maritalStatus}</p>}
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="GENDER">
            <select
              value={gender}
              onChange={(e) => setGender?.(e.target.value)}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.gender ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {errors.gender && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.gender}</p>}
          </TabularField>
          <TabularField label="BLOOD GROUP" required>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup?.(e.target.value)}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.bloodGroup ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
            {errors.bloodGroup && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.bloodGroup}</p>}
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="NATIONALITY" required>
            <select
              value={nationality}
              onChange={(e) => setNationality?.(e.target.value)}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.nationality ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select</option>
              {(nationalities || []).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {errors.nationality && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.nationality}</p>}
          </TabularField>
          <TabularField label="DATE OF BIRTH">
            <input
              type="text"
              placeholder="DD-MM-YYYY"
              maxLength={10}
              value={dobDisplay}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 8);
                let formatted = v;
                if (v.length > 2) formatted = v.slice(0, 2) + '/' + v.slice(2);
                if (v.length > 4) formatted = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
                setDobDisplay(formatted);
                if (v.length === 8) {
                  const d = v.slice(0, 2);
                  const m = v.slice(2, 4);
                  const y = v.slice(4);
                  setDob?.(`${y}-${m}-${d}`);
                } else if (!v) {
                  setDob?.('');
                }
              }}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.dob ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.dob && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.dob}</p>}
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="PLACE OF BIRTH">
            <input
              value={placeOfBirth ?? ''}
              onChange={(e) => setPlaceOfBirth?.(e.target.value)}
              className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
              placeholder="City / Town"
            />
          </TabularField>
          <TabularField label="HOBBIES">
            <input
              value={hobbies ?? ''}
              onChange={(e) => setHobbies?.(e.target.value)}
              className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
              placeholder="Reading, Sports"
            />
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="HEIGHT">
            <select
              value={height ?? ''}
              onChange={(e) => setHeight?.(e.target.value)}
              className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Select</option>
              {['4\'10"', '4\'11"', '5\'0"', '5\'1"', '5\'2"', '5\'3"', '5\'4"', '5\'5"', '5\'6"', '5\'7"', '5\'8"', '5\'9"', '5\'10"', '5\'11"', '6\'0"', '6\'1"', '6\'2"', '6\'3"', '6\'4"', '6\'5"', '6\'6"'].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </TabularField>
          <TabularField label="WEIGHT">
            <select
              value={weight ?? ''}
              onChange={(e) => setWeight?.(e.target.value)}
              className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Select</option>
              {['40-50 kg', '51-55 kg', '56-60 kg', '61-65 kg', '66-70 kg', '71-75 kg', '76-80 kg', '81-85 kg', '86-90 kg', '91-95 kg', '96-100 kg', '100+ kg'].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="CONTACT PERSON NAME" required>
            <input
              value={emergencyContactName}
              onInput={(e) => { e.target.value = e.target.value.replace(/[0-9]/g, ''); }}
              onChange={(e) => setEmergencyContactName?.(e.target.value)}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.emergencyContactName ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="Full name"
            />
            {errors.emergencyContactName && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.emergencyContactName}</p>}
          </TabularField>
          <TabularField label="EMERGENCY CONTACT" required>
            <input
              type="tel"
              minLength={10}
              maxLength={15}
              onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
              value={emergencyContactNumber}
              onChange={(e) => setEmergencyContactNumber?.(e.target.value)}
              className={`w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.emergencyContactNumber ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="91xxxxxxxxxx"
            />
            {errors.emergencyContactNumber && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.emergencyContactNumber}</p>}
          </TabularField>
        </TabularRow>

        {/* Custom Fields Mapping */}
        {customFields.reduce((rows, field, i) => {
          if (i % 2 === 0) rows.push([field]);
          else rows[rows.length - 1].push(field);
          return rows;
        }, []).map((pair, rowIndex) => (
          <TabularRow key={`cf-row-${rowIndex}`} columns={4}>
            {pair.map((field, colIndex) => {
              const index = rowIndex * 2 + colIndex;
              return (
                <React.Fragment key={`cf-${index}`}>
                  <TabularCustomFieldLabel
                    value={field.label}
                    onChange={(e) => updateCustomField(index, 'label', e.target.value.toUpperCase())}
                    onRemove={() => removeCustomField(index)}
                  />
                  <div className="p-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center bg-white dark:bg-slate-950">
                    {field.type === 'select' ? (
                      <select
                        value={field.value}
                        onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                        className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={field.value}
                        onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                        className="w-full h-[40px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
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

        <TabularRow columns={2}>
          <TabularField label="PHYSICAL DISABILITY (LAST 2 YRS)?">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="physicalDisabilityOrSickness"
                    value="yes"
                    checked={physicalDisabilityOrSickness === 'yes'}
                    onChange={(e) => setPhysicalDisabilityOrSickness?.(e.target.value)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="physicalDisabilityOrSickness"
                    value="no"
                    checked={physicalDisabilityOrSickness === 'no'}
                    onChange={(e) => {
                      setPhysicalDisabilityOrSickness?.(e.target.value);
                      setPhysicalDisabilityDetails?.('');
                    }}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">No</span>
                </label>
              </div>
              {physicalDisabilityOrSickness === 'yes' && (
                <input
                  type="text"
                  value={physicalDisabilityDetails ?? ''}
                  onChange={(e) => setPhysicalDisabilityDetails?.(e.target.value)}
                  placeholder="Enter details / reason..."
                  className="w-full h-[40px] px-3 bg-transparent border-b-2 border-indigo-200 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 transition-colors"
                />
              )}
            </div>
          </TabularField>
        </TabularRow>

      </TabularContainer>

      {/* Add Custom Field Button (Outside the table) */}
      <div className="flex justify-end pt-2">
        <div className="flex flex-col gap-1 justify-end relative" ref={addMenuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAddMenuOpen((o) => !o); }}
            className="h-[38px] px-4 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm text-sm font-semibold"
          >
            <Plus size={16} /> Add Custom Field
          </button>
          {addMenuOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150">
              <button type="button" onClick={() => addCustomField('global', 'text')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                Global Text
              </button>
              <button type="button" onClick={() => addCustomField('global', 'select')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                Global Dropdown
              </button>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <button type="button" onClick={() => addCustomField('onlyUser', 'text')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                Only user Text
              </button>
              <button type="button" onClick={() => addCustomField('onlyUser', 'select')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                Only user Dropdown
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
