import React from 'react';
import dayjs from 'dayjs';

const CUSTOM_DEPARTMENT_VALUE = '__custom_department__';

/**
 * Tab 4: Official Records — Employee ID (read-only), Department, Manager, Joining Date.
 * Uses existing form state; no logic change.
 */
export default function OfficialRecordsTab({
  employeeCode,
  employeeId,
  setEmployeeId,
  generationMode = 'AUTO',
  employee,
  departmentId,
  setDepartmentId,
  department,
  setDepartment,
  departments = [],
  departmentsLoading,
  designations = [],
  assignmentPreview,
  assignmentLoading,
  assignmentError,
  manager,
  setManager,
  managers = [],
  joiningDate,
  setJoiningDate,
  shiftId,
  setShiftId,
  shifts = [],
  jobType,
  setJobType,
  leavePolicy,
  setLeavePolicy,
  policies = [],
  gradeId,
  setGradeId,
  grade,
  setGrade,
  band,
  setBand,
  grades = [],
  mappings = [],
  errors = {},
}) {
  // Local state for joining date to allow typing
  const [joiningDateDisplay, setJoiningDateDisplay] = React.useState(joiningDate ? dayjs(joiningDate).format('DD/MM/YYYY') : '');
  const lastSyncedJoiningDate = React.useRef(joiningDate);
  
  // Combined list of all grades from central system and custom mappings
  const allGrades = React.useMemo(() => {
    const combined = [];
    const seenCodes = new Set();

    // 1. Add grades from mappings (highest priority for band auto-fill)
    (mappings || []).forEach(m => {
      const code = String(m.gradeCode || m.gradeValue || '').trim();
      const name = String(m.gradeName || '').trim();
      if (code && !seenCodes.has(code.toUpperCase())) {
        seenCodes.add(code.toUpperCase());
        combined.push({
          code: code,
          name: name,
          band: m.band,
          isActive: m.isActive !== false,
          isCustom: true
        });
      }
    });

    // 2. Add grades from central system (if not already added)
    (grades || []).forEach(g => {
      const code = String(g.code || g.name || '').trim();
      if (code && !seenCodes.has(code.toUpperCase())) {
        seenCodes.add(code.toUpperCase());
        combined.push({
          code: code,
          name: g.name || '',
          band: g.band || '', // Central grades might have bands too
          isActive: g.isActive !== false,
          isCustom: false
        });
      }
    });

    return combined.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [mappings, grades]);

  // Final list for the dropdown (ensures current grade is always present)
  const dropdownGrades = React.useMemo(() => {
    return [...allGrades];
  }, [allGrades]);

  const [showCustomGrade, setShowCustomGrade] = React.useState(false);
  const [showCustomBand, setShowCustomBand] = React.useState(false);
  const [isCustomDepartment, setIsCustomDepartment] = React.useState(false);
  const normalizedDepartment = String(department || '').trim();
  const selectedDepartmentExists = React.useMemo(() => {
    if (!normalizedDepartment) return true;
    return (departments || []).some((d) => {
      const id = String(d?._id || d || '');
      const name = String(typeof d === 'string' ? d : d?.name || '').trim().toLowerCase();
      return (departmentId && id === String(departmentId)) || name === normalizedDepartment.toLowerCase();
    });
  }, [departmentId, normalizedDepartment, departments]);
  React.useEffect(() => {
    if (departmentId) {
      setIsCustomDepartment(false);
    } else if (normalizedDepartment && !selectedDepartmentExists) {
      setIsCustomDepartment(true);
    }
  }, [departmentId, normalizedDepartment, selectedDepartmentExists]);
  const departmentSelectValue = isCustomDepartment ? CUSTOM_DEPARTMENT_VALUE : (departmentId || '');

  const normalizeScopeText = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase();
  const selectedGrade = React.useMemo(() => {
    return {
      id: gradeId || '',
      name: grade || '',
      code: grade || '',
    };
  }, [gradeId, grade]);
  
  const { validGradeIds, validGradeCodes, gradeToBandMap } = React.useMemo(() => {
    const ids = new Set();
    const codes = new Set();
    const map = new Map();
    
    // Build map from all available grades
    allGrades.forEach(g => {
        if (g.isActive === false) return;
        const gCode = g.code.toUpperCase();
        if (gCode && g.band) map.set(gCode, g.band);
    });

    (policies || []).forEach(p => {
      const pGradeIds = (p.gradeIds || []).map(id => String(id?._id || id));
      const pGradeCodes = (p.gradeCodes || []).map(c => String(c || '').trim().toUpperCase());
      
      pGradeIds.forEach(id => ids.add(id));
      pGradeCodes.forEach(code => codes.add(code));
    });
    
    return { validGradeIds: ids, validGradeCodes: codes, gradeToBandMap: map };
  }, [policies, allGrades]);

  const applicablePolicies = React.useMemo(() => {
    const employeeType = String(jobType || '').trim().toLowerCase();
    const employeeBand = String(band || '').trim().toLowerCase();
    const departmentValue = String(departmentId || department || '').trim().toLowerCase();
    const gradeCodeOrName = normalizeScopeText(selectedGrade.code || selectedGrade.name);
    const selectedPolicyId = String(leavePolicy || '');

    const isApplicable = (policy) => {
      const scope = policy?.applicableTo || 'All';
      if (scope === 'All') return true;
      if (scope === 'Grade') {
        const gradeIds = Array.isArray(policy.gradeIds) ? policy.gradeIds.map((id) => String(id?._id || id)) : [];
        const gradeCodes = Array.isArray(policy.gradeCodes) ? policy.gradeCodes.map(normalizeScopeText) : [];
        return (!!selectedGrade.id && gradeIds.includes(String(selectedGrade.id))) ||
          (!!gradeCodeOrName && gradeCodes.includes(gradeCodeOrName));
      }
      if (scope === 'Band') {
        return Array.isArray(policy.applicableBands) &&
          policy.applicableBands.some((item) => String(item || '').trim().toLowerCase() === employeeBand);
      }
      if (scope === 'Department') {
        return Array.isArray(policy.departmentIds) &&
          policy.departmentIds.some((item) => String(item?._id || item || '').trim().toLowerCase() === departmentValue);
      }
      if (scope === 'Designation') {
        return Array.isArray(policy.designations) &&
          policy.designations.some((item) => String(item || '').trim().toLowerCase() === String(employee?.designation || employee?.role || '').trim().toLowerCase());
      }
      if (scope === 'Specific') {
        const currentEmployeeId = String(employee?._id || employee?.id || '');
        return Array.isArray(policy.specificEmployeeIds) &&
          policy.specificEmployeeIds.some((item) => String(item?._id || item || '') === currentEmployeeId);
      }
      return false;
    };

    return (policies || []).filter((policy) => isApplicable(policy) || String(policy?._id || '') === selectedPolicyId);
  }, [policies, leavePolicy, selectedGrade, jobType, band, departmentId, department, employee]);

  React.useEffect(() => {
    if (joiningDate !== lastSyncedJoiningDate.current) {
      setJoiningDateDisplay(joiningDate ? dayjs(joiningDate).format('DD/MM/YYYY') : '');
      lastSyncedJoiningDate.current = joiningDate;
    }
  }, [joiningDate]);

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 items-start`}>
        {/* Employee ID */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center whitespace-nowrap">
            Employee ID <span className="text-rose-500 ml-1 font-bold">*</span></label>
          <div className="relative group/field shadow-sm rounded-2xl overflow-hidden">
            <input
              type="text"
              value={generationMode === 'MANUAL' ? (employeeId || '') : (employeeId || employeeCode || '—')}
              onChange={(e) => generationMode === 'MANUAL' && setEmployeeId?.(e.target.value.toUpperCase())}
              placeholder={generationMode === 'MANUAL' ? "e.g. EMP001" : "Auto-Generated ID"}
              required={generationMode === 'MANUAL'}
              readOnly={generationMode !== 'MANUAL'}
              className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-600 transition-all ${generationMode !== 'MANUAL' ? 'cursor-not-allowed bg-slate-50/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800' : (errors.employeeId ? 'border-rose-200 focus:border-rose-500 shadow-sm shadow-rose-100' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400')}`}
            />
          </div>
          {errors.employeeId && generationMode === 'MANUAL' && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.employeeId}</p>}
        </div>

        {/* Shift Assignment */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center whitespace-nowrap">
            Shift Assignment</label>
          <select
            value={shiftId}
            onChange={(e) => setShiftId?.(e.target.value)}
            className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.shiftId ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
          >
            <option value="">Select Shift (Optional)</option>
            {(shifts || []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.startTime} - {s.endTime})
              </option>
            ))}
          </select>
          {errors.shiftId && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.shiftId}</p>}
        </div>


        {/* Grade selection */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between pl-1 h-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center whitespace-nowrap">
              Employee Grade <span className="text-rose-500 ml-1 font-bold">*</span>
            </label>
          </div>
          <select
            value={grade}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                setGradeId?.('');
                setGrade?.('');
                setBand?.('');
              } else {
                setGradeId?.('');
                setGrade?.(val);
                
                // Robust Auto-fill Band from Mapping or Central Grade
                const normalizedVal = String(val).trim().toUpperCase();
                const foundGrade = dropdownGrades.find(g => String(g.code).trim().toUpperCase() === normalizedVal);
                
                if (foundGrade && foundGrade.band) {
                  console.log(`[AUTO_BAND] Found via dropdownGrades: ${foundGrade.band}`);
                  setBand?.(foundGrade.band);
                } else {
                  const linkedBand = gradeToBandMap.get(normalizedVal);
                  if (linkedBand) {
                    console.log(`[AUTO_BAND] Found via map: ${linkedBand}`);
                    setBand?.(linkedBand);
                  }
                }
              }
            }}
            className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.grade ? 'border-rose-200 focus:border-rose-500 shadow-sm shadow-rose-100' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
          >
            <option value="">Select Grade</option>
            {dropdownGrades.map((g) => (
              <option key={g.code} value={g.code}>
                Grade {g.code} {!g.isActive ? '[Inactive]' : ''}
              </option>
            ))}
          </select>
          {errors.grade && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.grade}</p>}
        </div>

        {/* Band selection */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center whitespace-nowrap">
            Employee Band <span className="text-rose-500 ml-1 font-bold">*</span></label>
            <input
              type="text"
              list="band-options"
              placeholder="Enter or select a band (e.g. A, B)"
              value={band}
              onChange={(e) => setBand?.(e.target.value)}
              className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.band ? 'border-rose-200 focus:border-rose-500 shadow-sm shadow-rose-100' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
            />
            <datalist id="band-options">
              {[...new Set(mappings.filter(m => m.isActive !== false).map(m => m.band).filter(Boolean))].sort().map(b => (
                <option key={b} value={b} />
              ))}
              {/* Fallback mock bands if no mappings exist */}
              {mappings.length === 0 && (
                <>
                  <option value="A" />
                  <option value="B" />
                  <option value="C" />
                  <option value="D" />
                </>
              )}
            </datalist>
          {errors.band && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.band}</p>}
        </div>

        {/* Department */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center">
            Department <span className="text-rose-500 ml-1">*</span></label>
          <select
            value={departmentSelectValue}
            onChange={(e) => {
              const value = e.target.value;
              if (value === CUSTOM_DEPARTMENT_VALUE) {
                setIsCustomDepartment(true);
                setDepartmentId?.('');
                setDepartment?.('');
                return;
              }
              setIsCustomDepartment(false);
              const selectedDept = departments.find((d) => String(d?._id || d) === value);
              setDepartmentId?.(value);
              setDepartment?.(typeof selectedDept === 'string' ? selectedDept : selectedDept?.name || '');
            }}
            required
            disabled={departmentsLoading}
            className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.department ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
          >
            <option value="">{departmentsLoading ? 'Loading...' : 'Select Dept'}</option>
            {(departments || []).map((d) => (
              <option key={d._id || d} value={d._id || d}>
                {typeof d === 'string' ? d : d.name}
              </option>
            ))}
            <option value={CUSTOM_DEPARTMENT_VALUE}>Custom</option>
          </select>
          {isCustomDepartment && (
            <input
              type="text"
              value={department}
              onChange={(e) => {
                setDepartmentId?.('');
                setDepartment?.(e.target.value);
              }}
              placeholder="Type department name"
              required
              maxLength={50}
              className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.department ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
            />
          )}
          {errors.department && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.department}</p>}
        </div>


        {/* Job Type / Employee Type */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center whitespace-nowrap">
            Employee Type <span className="text-rose-500 ml-1">*</span></label>
          <select
            value={jobType}
            onChange={(e) => setJobType?.(e.target.value)}
            required
            className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.jobType ? 'border-rose-200 focus:border-rose-500 shadow-sm shadow-rose-100' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
          >
            <option value="">Select Type</option>
            <option value="Full-Time">Full-Time</option>
            <option value="Part-Time">Part-Time</option>
            <option value="Internship">Internship</option>
            <option value="Contract">Contract</option>
            <option value="Consultant">Consultant</option>
          </select>
          {errors.jobType && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.jobType}</p>}
        </div>

        {/* Manager */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center">
            Manager Details</label>
          <select
            value={manager}
            onChange={(e) => setManager?.(e.target.value)}
            className="w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:border-slate-400 text-sm font-bold text-slate-700 transition-all"
          >
            <option value="">No Manager</option>
            {(managers || [])
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {[m.firstName, m.lastName].filter(Boolean).join(' ')} ({m.department || 'General'})
                </option>
              ))}
          </select>
        </div>

        {/* Joining Date */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-1 h-4 flex items-center">
            Joining Date <span className="text-rose-500 ml-1">*</span></label>
          <input
            type="text"
            placeholder="DD-MM-YYYY"
            maxLength={10}
            value={joiningDateDisplay}
            onChange={(e) => {
              let v = e.target.value.replace(/\D/g, '').slice(0, 8);
              
              // Apply mask
              let formatted = v;
              if (v.length > 2) formatted = v.slice(0, 2) + '/' + v.slice(2);
              if (v.length > 4) formatted = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
              setJoiningDateDisplay(formatted);

              if (v.length === 8) {
                const d = v.slice(0, 2);
                const m = v.slice(2, 4);
                const y = v.slice(4);
                setJoiningDate?.(`${y}-${m}-${d}`);
              } else if (!v) {
                setJoiningDate?.('');
              }
            }}
            className={`w-full h-[42px] px-4 bg-white dark:bg-slate-900 border-2 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.joiningDate ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
          />
          {errors.joiningDate && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-1">{errors.joiningDate}</p>}
        </div>
      </div>

      {(assignmentPreview?.grade || assignmentPreview?.band || assignmentPreview?.payrollTemplate) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-400">Grade</p>
            <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 shadow-sm">
              {assignmentPreview.grade?.code || assignmentPreview.grade?.name || grade || 'Pending'}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-500">Band</p>
            <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">
              {assignmentPreview.band?.code || assignmentPreview.band?.name || band || 'Enter salary'}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Salary Range</p>
            <p className="mt-1 text-xs font-black text-slate-700">
              {assignmentPreview.salaryRange
                ? `${Number(assignmentPreview.salaryRange.minSalary).toLocaleString('en-IN')} - ${Number(assignmentPreview.salaryRange.maxSalary).toLocaleString('en-IN')}`
                : 'Mapped after salary'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Payroll Template</p>
            <p className="mt-1 truncate text-xs font-black text-slate-700">
              {assignmentPreview.payrollTemplate?.templateName || assignmentPreview.payrollTemplate?.name || 'Not linked'}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
