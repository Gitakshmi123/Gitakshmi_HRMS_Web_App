import React from 'react';
import dayjs from 'dayjs';

const CUSTOM_DEPARTMENT_VALUE = '__custom_department__';

import { TabularContainer, TabularRow, TabularField } from './TabularForm';
import { User, Briefcase, FileCheck } from 'lucide-react';

/**
 * Tab 4: Official Records — Employee ID (read-only), Department, Manager, Joining Date.
 * Uses existing form state; no logic change.
 */
const OfficialRecordsTab = React.memo(function OfficialRecordsTab({
  employeeCode,
  employeeId,
  setEmployeeId,
  generationMode = 'AUTO',
  employee,
  employeeCategory,
  setEmployeeCategory,
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
  rosterId,
  setRosterId,
  rosters = [],
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
  holidayCalendar,
  setHolidayCalendar,
  leaveGroup,
  setLeaveGroup,
  confirmationPeriod,
  setConfirmationPeriod,
  basic,
  setBasic,
  leaveTravelAllowance,
  setLeaveTravelAllowance,
  designation,
  setDesignation,
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
    <div className="animate-in fade-in duration-300 space-y-6">
      
      {/* Official Details */}
      <TabularContainer>
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 uppercase">
          <FileCheck className="w-4 h-4 text-indigo-500" /> Official Identifiers
        </div>
        
        <TabularRow columns={4}>
          <TabularField label="EMPLOYEE ID" required={generationMode === 'MANUAL'}>
            <input
              type="text"
              value={generationMode === 'MANUAL' ? (employeeId || '') : (employeeId || employeeCode || '—')}
              onChange={(e) => generationMode === 'MANUAL' && setEmployeeId?.(e.target.value.toUpperCase())}
              placeholder={generationMode === 'MANUAL' ? "e.g. EMP001" : "Auto-Generated ID"}
              required={generationMode === 'MANUAL'}
              readOnly={generationMode !== 'MANUAL'}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium ${generationMode !== 'MANUAL' ? 'cursor-not-allowed text-slate-400' : 'text-slate-700 dark:text-slate-200'} placeholder:text-slate-400 ${errors.employeeId ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.employeeId && generationMode === 'MANUAL' && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.employeeId}</p>}
          </TabularField>
          <TabularField label="CATEGORY">
            <select
              value={employeeCategory}
              onChange={(e) => setEmployeeCategory?.(e.target.value)}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.employeeCategory ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Category</option>
              <option value="Unskilled">Unskilled</option>
              <option value="Semi-Skilled">Semi-Skilled</option>
              <option value="Skilled">Skilled</option>
              <option value="Highly Skilled">Highly Skilled</option>
              <option value="General / Management">General / Management</option>
            </select>
            {errors.employeeCategory && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.employeeCategory}</p>}
          </TabularField>
        </TabularRow>
        <TabularRow columns={4}>
          <TabularField label="DOJ (JOINING DATE)" required>
            <input
              type="text"
              placeholder="DD/MM/YYYY"
              maxLength={10}
              value={joiningDateDisplay}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 8);
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
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.joiningDate ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.joiningDate && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.joiningDate}</p>}
          </TabularField>
          <TabularField label="EMPLOYEE TYPE" required>
            <select
              value={jobType}
              onChange={(e) => setJobType?.(e.target.value)}
              required
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.jobType ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Type</option>
              <option value="Permanent">Permanent</option>
              <option value="Consultant">Consultant</option>
              <option value="Contractual">Contractual</option>
              <option value="Internship">Internship</option>
            </select>
            {errors.jobType && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.jobType}</p>}
          </TabularField>
        </TabularRow>
      </TabularContainer>

      {/* Role & Placement */}
      <TabularContainer>
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 uppercase">
          <Briefcase className="w-4 h-4 text-indigo-500" /> Role & Placement
        </div>
        <TabularRow columns={4}>
          <TabularField label="DEPARTMENT" required>
            <select
              value={departmentId || (department ? CUSTOM_DEPARTMENT_VALUE : '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === CUSTOM_DEPARTMENT_VALUE) {
                  setDepartmentId?.('');
                } else {
                  setDepartmentId?.(val);
                  setDepartment?.('');
                }
              }}
              required
              disabled={departmentsLoading}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.departmentId ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
              <option value={CUSTOM_DEPARTMENT_VALUE}>Other (Custom Department)</option>
            </select>
            {errors.departmentId && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.departmentId}</p>}
          </TabularField>

          {(!departmentId && department !== undefined) || departmentId === '' ? (
            <TabularField label="CUSTOM DEPARTMENT" required>
              <input
                type="text"
                placeholder="Enter custom department"
                value={department}
                onChange={(e) => setDepartment?.(e.target.value)}
                required
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.department ? 'border-b-2 border-rose-400' : ''}`}
              />
              {errors.department && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.department}</p>}
            </TabularField>
          ) : <TabularField label="" />}
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="MANAGER">
            <select
              value={manager}
              onChange={(e) => setManager?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Select Manager</option>
              {managers.filter(m => m._id !== employee?._id).map((m) => (
                <option key={m._id} value={m._id}>{m.name || `${m.firstName} ${m.lastName}`} ({m.employeeId || 'No ID'})</option>
              ))}
            </select>
          </TabularField>
          <TabularField label="SHIFT">
            <select
              value={shiftId}
              onChange={(e) => setShiftId?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Default Shift</option>
              {(shifts || []).map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.startTime} - {s.endTime})</option>
              ))}
            </select>
          </TabularField>
          <TabularField label="ROSTER">
            <select
              value={rosterId}
              onChange={(e) => setRosterId?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">No Roster</option>
              {(rosters || []).map((r) => (
                <option key={r._id} value={r._id}>{r.rosterName} {r.shiftCycle ? `(${r.shiftCycle.length} Days)` : ''}</option>
              ))}
            </select>
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="EMPLOYEE GRADE">
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
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.grade ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Grade</option>
              {dropdownGrades.map((g) => (
                <option key={g.code} value={g.code}>
                  Grade {g.code} {!g.isActive ? '[Inactive]' : ''}
                </option>
              ))}
            </select>
            {errors.grade && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.grade}</p>}
          </TabularField>
          <TabularField label="EMPLOYEE BAND">
            <input
              type="text"
              value={band}
              onChange={(e) => setBand?.(e.target.value)}
              placeholder="e.g. L1, L2..."
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.band ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.band && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.band}</p>}
          </TabularField>
        </TabularRow>

        <TabularRow columns={4}>
          <TabularField label="LEAVE CONFIGURATION">
            <select
              value={leavePolicy}
              onChange={(e) => setLeavePolicy?.(e.target.value)}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.leavePolicy ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Leave Policy</option>
              {applicablePolicies.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            {errors.leavePolicy && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.leavePolicy}</p>}
          </TabularField>
          <TabularField label="PAY GRADE">
            <select
              value={gradeId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setGradeId?.(val);
                if (val) {
                  const selected = allGrades.find(g => (g.isCustom ? g.code : g.code) === val);
                  if (selected) {
                    setGrade?.(selected.name);
                    if (selected.band && setBand) {
                      setBand(selected.band);
                    }
                  }
                } else {
                  setGrade?.('');
                  if (setBand) setBand('');
                }
              }}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 ${errors.gradeId ? 'border-b-2 border-rose-400' : ''}`}
            >
              <option value="">Select Pay Grade</option>
              {allGrades.map((g, idx) => (
                <option key={`${g.code}-${idx}`} value={g.code}>
                  {g.code} {g.name ? `- ${g.name}` : ''} {g.band ? `[${g.band}]` : ''} {!g.isActive ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
            {errors.gradeId && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.gradeId}</p>}
          </TabularField>
        </TabularRow>
      </TabularContainer>

      {/* Compensation & Additional */}
      <TabularContainer>
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 uppercase">
          <User className="w-4 h-4 text-indigo-500" /> Compensation & Benefits
        </div>
        <TabularRow columns={4}>
          <TabularField label="HOLIDAY CALENDAR">
            <select
              value={holidayCalendar}
              onChange={(e) => setHolidayCalendar?.(e.target.value)}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Standard Calendar</option>
              <option value="Regional">Regional Calendar</option>
              <option value="Custom">Custom Calendar</option>
            </select>
          </TabularField>
          <TabularField label="" />
        </TabularRow>
        <TabularRow columns={4}>
          <TabularField label="CONFIRMATION PERIOD (MONTHS)">
            <input
              type="number"
              value={confirmationPeriod || ''}
              onChange={(e) => setConfirmationPeriod?.(e.target.value)}
              placeholder="e.g. 6"
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </TabularField>
          <TabularField label="LTA ALLOWANCE (₹)">
            <input
              type="number"
              value={leaveTravelAllowance || ''}
              onChange={(e) => setLeaveTravelAllowance?.(e.target.value)}
              placeholder="Amount per year"
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </TabularField>
        </TabularRow>
        <TabularRow columns={4}>
          <TabularField label="DESIGNATION" required>
            <input
              type="text"
              value={designation || ''}
              onChange={(e) => setDesignation?.(e.target.value)}
              placeholder="e.g. Software Engineer"
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ${errors.designation ? 'border-b-2 border-rose-400' : ''}`}
            />
            {errors.designation && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.designation}</p>}
          </TabularField>
          <TabularField label="BASIC SALARY (₹)">
            <input
              type="number"
              value={basic || ''}
              onChange={(e) => setBasic?.(e.target.value)}
              placeholder="Monthly Basic Salary"
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </TabularField>
        </TabularRow>
      </TabularContainer>

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
});

export default OfficialRecordsTab;
