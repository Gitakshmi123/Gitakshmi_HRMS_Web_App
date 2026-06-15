import React, { useState, useRef, useEffect } from 'react';
import { Camera, Trash2, Plus } from 'lucide-react';
import dayjs from 'dayjs';

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

  const addCustomField = (scope = 'onlyUser') => {
    if (scope === 'global' && onAddGlobalField) {
      const label = window.prompt('Enter field label for global field (will appear for all employees):', 'NEW FIELD');
      if (label != null && String(label).trim()) {
        onAddGlobalField('personal', String(label).trim());
      }
      setAddMenuOpen(false);
      return;
    }
    setCustomFields?.([...customFields, { label: 'NEW FIELD', value: '' }]);
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
    <div className="space-y-2 animate-in fade-in duration-200">
      <div className="w-full">
        {/* Identity fields */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className="relative group cursor-pointer"
              onClick={() => profilePicRef?.current?.click()}
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-center shadow-sm group-hover:border-indigo-400 group-hover:bg-slate-50/30 transition-all duration-300">
                {profilePreview ? (
                  <img
                    src={profilePreview instanceof File ? URL.createObjectURL(profilePreview) : (typeof profilePreview === 'string' && profilePreview.startsWith('http') ? profilePreview : `${backendUrl}${profilePreview}`)}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-white dark:bg-slate-800 shadow-sm text-slate-400 group-hover:text-indigo-500 transition-colors">
                      <Camera size={24} className="sm:w-7 sm:h-7" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest">Upload Photo</span>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-slate-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300 border-2 border-indigo-500/50" />
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
          </div>

          <div className="flex-1 flex flex-col gap-1">
            {/* Row 1: Names */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">FIRST NAME <span className="text-rose-500">*</span></label>
                <input
                  required
                  value={firstName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFirstName?.(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
                  }}
                  placeholder="Name"
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.firstName ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                />
                {errors.firstName && <p className="text-[10px] font-medium text-rose-500">{errors.firstName}</p>}
              </div>

              <div className="flex-1 min-w-[140px] flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">MIDDLE NAME</label>
                <input
                  value={middleName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMiddleName?.(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
                  }}
                  placeholder="Father's name"
                  className="w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>
              
              <div className="flex-1 min-w-[160px] flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">LAST NAME <span className="text-rose-500">*</span></label>
                <input
                  required
                  value={lastName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLastName?.(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
                  }}
                  placeholder="Last name"
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.lastName ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                />
                {errors.lastName && <p className="text-[10px] font-medium text-rose-500">{errors.lastName}</p>}
              </div>

              <div className="flex-1 min-w-[160px] flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Personal Email <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail?.(e.target.value)}
                  placeholder="name@gmail.com"
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.email ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                />
                {errors.email && <p className="text-[10px] font-medium text-rose-500">{errors.email}</p>}
              </div>

              <div className="flex-1 min-w-[160px] flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Contact Number <span className="text-rose-500">*</span></label>
                <input
                  type="tel"
                  minLength={10}
                  maxLength={15}
                  value={contactNo}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setContactNo?.(v);
                  }}
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.contactNo ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                  placeholder="91xxxxxxxxxx"
                />
                {errors.contactNo && <p className="text-[10px] font-medium text-rose-500">{errors.contactNo}</p>}
              </div>

              {/* Dynamic Custom Fields in Row 1 */}
              {customFields.map((field, index) => (
                <div key={index} className="flex-1 min-w-[140px] flex flex-col gap-1 animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center h-4">
                    <input
                      value={field.label}
                      onChange={(e) => updateCustomField(index, 'label', e.target.value.toUpperCase())}
                      className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide bg-transparent outline-none w-full hover:bg-slate-50 rounded px-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      className="text-rose-400 hover:text-rose-600 p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <input
                    value={field.value}
                    onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                    className="w-full h-[42px] px-4 bg-white dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200"
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                </div>
              ))}

              {/* Add Custom Field Button in Row 1 */}
              <div className="flex flex-col gap-1 justify-end relative" ref={addMenuRef}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAddMenuOpen((o) => !o); }}
                  className="h-[42px] w-[42px] flex items-center justify-center bg-slate-50 dark:bg-indigo-900/20 text-slate-600 dark:text-indigo-400 rounded-xl border-2 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors shadow-sm"
                  title="Add Custom Field"
                >
                  <Plus size={20} />
                </button>
                {addMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150">
                    <button type="button" onClick={() => addCustomField('global')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                      Global
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-800" />
                    <button type="button" onClick={() => addCustomField('onlyUser')} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                      Only user
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Personal Details */}
            <div className="w-full flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] flex flex-col gap-1 animate-in zoom-in duration-200">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Marital Status <span className="text-rose-500">*</span></label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus?.(e.target.value)}
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.maritalStatus ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                >
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
                {errors.maritalStatus && <p className="text-[10px] font-medium text-rose-500">{errors.maritalStatus}</p>}
              </div>

              <div className="flex-1 min-w-[140px] flex flex-col gap-1 animate-in zoom-in duration-200">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender?.(e.target.value)}
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.gender ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <p className="text-[10px] font-medium text-rose-500">{errors.gender}</p>}
              </div>

              <div className="flex-1 min-w-[140px] flex flex-col gap-1 animate-in zoom-in duration-200">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Blood Group <span className="text-rose-500">*</span></label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup?.(e.target.value)}
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.bloodGroup ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                >
                  <option value="">Select</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                {errors.bloodGroup && <p className="text-[10px] font-medium text-rose-500">{errors.bloodGroup}</p>}
              </div>

              <div className="flex-1 min-w-[140px] flex flex-col gap-1 animate-in zoom-in duration-200">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Nationality <span className="text-rose-500">*</span></label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality?.(e.target.value)}
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.nationality ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                >
                  <option value="">Select</option>
                  {(nationalities || []).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                {errors.nationality && <p className="text-[10px] font-medium text-rose-500">{errors.nationality}</p>}
              </div>

              <div className="flex-1 min-w-[140px] flex flex-col gap-1 animate-in zoom-in duration-200">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Date of Birth</label>
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
                  className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.dob ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                />
                {errors.dob && <p className="text-[10px] font-medium text-rose-500">{errors.dob}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Place of Birth, Hobbies, Height, Weight, Cast, Emergency Contacts */}
        <div className="w-full flex flex-wrap gap-3 mt-1">
          <div className="flex-1 min-w-[140px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Place of Birth</label>
            <input
              value={placeOfBirth ?? ''}
              onChange={(e) => setPlaceOfBirth?.(e.target.value)}
              className="w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200"
              placeholder="City / Town"
            />
          </div>
          <div className="flex-1 min-w-[140px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Hobbies</label>
            <input
              value={hobbies ?? ''}
              onChange={(e) => setHobbies?.(e.target.value)}
              className="w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200"
              placeholder="Reading, Sports"
            />
          </div>
          <div className="flex-1 min-w-[100px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Height</label>
            <select
              value={height ?? ''}
              onChange={(e) => setHeight?.(e.target.value)}
              className="w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Select</option>
              {['4\'10"', '4\'11"', '5\'0"', '5\'1"', '5\'2"', '5\'3"', '5\'4"', '5\'5"', '5\'6"', '5\'7"', '5\'8"', '5\'9"', '5\'10"', '5\'11"', '6\'0"', '6\'1"', '6\'2"', '6\'3"', '6\'4"', '6\'5"', '6\'6"'].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Weight</label>
            <select
              value={weight ?? ''}
              onChange={(e) => setWeight?.(e.target.value)}
              className="w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Select</option>
              {['40-50 kg', '51-55 kg', '56-60 kg', '61-65 kg', '66-70 kg', '71-75 kg', '76-80 kg', '81-85 kg', '86-90 kg', '91-95 kg', '96-100 kg', '100+ kg'].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Cast</label>
            <select
              value={cast ?? ''}
              onChange={(e) => setCast?.(e.target.value)}
              className="w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Select</option>
              <option value="General (Open)">General (Open)</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Contact Person Name <span className="text-rose-500">*</span></label>
            <input
              value={emergencyContactName}
              onInput={(e) => { e.target.value = e.target.value.replace(/[0-9]/g, ''); }}
              onChange={(e) => setEmergencyContactName?.(e.target.value)}
              className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.emergencyContactName ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
              placeholder="Full name"
            />
            {errors.emergencyContactName && <p className="text-[10px] font-medium text-rose-500">{errors.emergencyContactName}</p>}
          </div>
          <div className="flex-1 min-w-[160px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Emergency Contact <span className="text-rose-500">*</span></label>
            <input
              type="tel"
              minLength={10}
              maxLength={15}
              onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
              value={emergencyContactNumber}
              onChange={(e) => setEmergencyContactNumber?.(e.target.value)}
              className={`w-full h-[42px] px-4 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.emergencyContactNumber ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
              placeholder="91xxxxxxxxxx"
            />
            {errors.emergencyContactNumber && <p className="text-[10px] font-medium text-rose-500">{errors.emergencyContactNumber}</p>}
          </div>
        </div>

        {/* Physical Disability Row */}
        <div className="w-full flex flex-wrap items-start gap-4 mt-4">
          <div className="w-full flex flex-col gap-2">
            <label className="block w-full text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-normal break-words leading-tight">
              Did you have any physical disability or serious sickness during the last two years interrupting your work for over two weeks? If yes, give details.
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="physicalDisabilityOrSickness"
                  value="yes"
                  checked={physicalDisabilityOrSickness === 'yes'}
                  onChange={(e) => setPhysicalDisabilityOrSickness?.(e.target.value)}
                  className="w-4 h-4 text-slate-600 border-slate-300 focus:ring-indigo-500"
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
                  className="w-4 h-4 text-slate-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">No</span>
              </label>
            </div>
            {physicalDisabilityOrSickness === 'yes' && (
              <div className="flex flex-col gap-1 mt-2 w-full animate-in fade-in duration-300">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide h-4">Details / Reason (If yes)</label>
                <input
                  type="text"
                  value={physicalDisabilityDetails ?? ''}
                  onChange={(e) => setPhysicalDisabilityDetails?.(e.target.value)}
                  placeholder="Enter details..."
                  className="w-full h-[42px] px-4 bg-white dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
