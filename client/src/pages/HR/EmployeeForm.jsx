import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api, { API_ROOT } from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import {
  IndianRupee,
  GraduationCap,
  FileCheck,
  ShieldCheck,
  Fingerprint,
  Lock,
  CreditCard,
  Landmark,
  Briefcase,
  Calendar,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  Search,
  Trash2,
  Edit2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Camera,
  Upload,
  Check,
  X,
  AlertCircle,
  FileText,
  Home,
  Workflow,
  Heart,
  ChevronDown,
  ChevronLeft,
  CheckCircle,
  Cloud,
  Shield,
  Clock,
  PieChart,
  Minus,
  Award,
  BookOpen,
  FileUp,
  ShieldAlert,
  Layers,
  Inbox,
  Eye,
  EyeOff,
  RefreshCcw,
  UserCheck,
  Hash
} from 'lucide-react';
import dayjs from 'dayjs';

import IdentityDetailsTab from '../../components/HR/IdentityDetailsTab';
import FamilyBackgroundTab from '../../components/HR/FamilyBackgroundTab';
import CommunicationTab from '../../components/HR/CommunicationTab';
import OfficialRecordsTab from '../../components/HR/OfficialRecordsTab';

const BACKEND_URL = API_ROOT || '';
const NATIONALITIES = ['Indian', 'American', 'British', 'Canadian', 'Australian', 'Other'];

export default function EmployeeForm({
  employee,
  onClose,
  viewOnly = false,
  onDraftSaved,
}) {
  const [step, setStep] = useState(() => {
    const last = (employee?.status === 'Draft' ? employee?.lastStep : 1) || 1;
    return Math.min(Math.max(1, last), 10); // 10 steps (References = page 7, submit on step 10)
  });


  const [firstName, setFirstName] = useState(employee?.firstName || '');
  const [firstNameCapital, setFirstNameCapital] = useState(employee?.firstNameCapital || '');
  const [middleName, setMiddleName] = useState(employee?.middleName || '');
  const [lastName, setLastName] = useState(employee?.lastName || '');
  const [gender, setGender] = useState(employee?.gender || '');
  const [dob, setDob] = useState(employee?.dob ? new Date(employee.dob).toISOString().slice(0, 10) : '');
  const [contactNo, setContactNo] = useState(employee?.contactNo || '');
  const [email, setEmail] = useState(employee?.email || '');
  // Passwords are stored hashed in DB; existing password cannot be read back for display.
  // For edit flow we only allow setting a NEW password.
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePreview, setProfilePreview] = useState(employee?.profilePic || null);
  const [maritalStatus, setMaritalStatus] = useState(employee?.maritalStatus || '');
  const [bloodGroup, setBloodGroup] = useState(employee?.bloodGroup || '');
  const [nationality, setNationality] = useState(employee?.nationality || '');
  const [placeOfBirth, setPlaceOfBirth] = useState(employee?.placeOfBirth || '');
  const [hobbies, setHobbies] = useState(employee?.hobbies || '');
  const [height, setHeight] = useState(employee?.height || '');
  const [weight, setWeight] = useState(employee?.weight || '');
  const [cast, setCast] = useState(employee?.cast || '');
  const [physicalDisabilityOrSickness, setPhysicalDisabilityOrSickness] = useState(employee?.physicalDisabilityOrSickness ?? '');
  const [physicalDisabilityDetails, setPhysicalDisabilityDetails] = useState(employee?.physicalDisabilityDetails ?? '');
  const [fatherName, setFatherName] = useState(employee?.fatherName || '');
  const [fatherFirstName, setFatherFirstName] = useState(employee?.fatherFirstName || (() => { const n = employee?.fatherName || ''; const p = n.trim().split(/\s+/); return p[0] || ''; })());
  const [fatherLastName, setFatherLastName] = useState(employee?.fatherLastName || (() => { const n = employee?.fatherName || ''; const p = n.trim().split(/\s+/); return p.slice(1).join(' ') || ''; })());
  const [fatherBloodGroup, setFatherBloodGroup] = useState(employee?.fatherBloodGroup || '');
  const [fatherAadhaar, setFatherAadhaar] = useState(employee?.fatherAadhaar || '');
  const [motherName, setMotherName] = useState(employee?.motherName || '');
  const [motherFirstName, setMotherFirstName] = useState(employee?.motherFirstName || (() => { const n = employee?.motherName || ''; const p = n.trim().split(/\s+/); return p[0] || ''; })());
  const [motherLastName, setMotherLastName] = useState(employee?.motherLastName || (() => { const n = employee?.motherName || ''; const p = n.trim().split(/\s+/); return p.slice(1).join(' ') || ''; })());
  const [motherBloodGroup, setMotherBloodGroup] = useState(employee?.motherBloodGroup || '');
  const [motherAadhaar, setMotherAadhaar] = useState(employee?.motherAadhaar || '');
  const [fatherCustomFields, setFatherCustomFields] = useState(employee?.fatherCustomFields || []);
  const [motherCustomFields, setMotherCustomFields] = useState(employee?.motherCustomFields || []);
  const [emergencyContactName, setEmergencyContactName] = useState(employee?.emergencyContactName || '');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState(employee?.emergencyContactNumber || '');
  const [customFields, setCustomFields] = useState(employee?.customFields || []);
  const [aadharNumber, setAadharNumber] = useState(employee?.documents?.aadharNumber || employee?.aadharNumber || '');
  const [panNumber, setPanNumber] = useState(employee?.documents?.panNumber || employee?.panNumber || '');
  const [tenant, setTenant] = useState(null);
  const [employeeId, setEmployeeId] = useState(employee?.employeeId || '');
  const [generationMode, setGenerationMode] = useState('AUTO');
  const lastMergedEmployeeIdRef = useRef(null);

  // Local state for Dependents (Spouse & Children) - Advanced Mode
  const [showDependents, setShowDependents] = useState(true);
  const [spouseDetails, setSpouseDetails] = useState({
    spouseName: employee?.spouseDetails?.spouseName || '',
    relation: employee?.spouseDetails?.relation || '',
    bloodGroup: employee?.spouseDetails?.bloodGroup || '',
    dob: employee?.spouseDetails?.dob || '',
    contactNo: employee?.spouseDetails?.contactNo || '',
    additionalFields: employee?.spouseDetails?.additionalFields || []
  });
  const [children, setChildren] = useState(employee?.children || []);
  const [brothers, setBrothers] = useState(employee?.brothers || []);
  const [sisters, setSisters] = useState(employee?.sisters || []);
  const [showSpouse, setShowSpouse] = useState(employee?.spouseDetails?.spouseName ? true : false);

  const [tempAddress, setTempAddress] = useState(employee?.tempAddress || { line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
  const [permAddress, setPermAddress] = useState(employee?.permAddress || { line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
  const [commAddress, setCommAddress] = useState(employee?.commAddress || { line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
  const [sameAsTemp, setSameAsTemp] = useState(true);
  const [commSameAsTemp, setCommSameAsTemp] = useState(true);

  const [experience, setExperience] = useState(employee?.experience?.length ? employee.experience.map(e => ({
    ...e,
    payslips: e.payslips || (e.payslipUrl ? [e.payslipUrl] : [])
  })) : []);
  // Training entries (optional, same fields as experience - no validation)
  const [trainingEntries, setTrainingEntries] = useState(Array.isArray(employee?.trainingEntries) && employee.trainingEntries.length
    ? employee.trainingEntries.map(t => ({ ...t, payslips: t.payslips || [] }))
    : []);
  const [jobType, setJobType] = useState(employee?.jobType || employee?.employeeType || 'Full-Time');

  const [bankName, setBankName] = useState(employee?.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(employee?.bankDetails?.accountNumber || '');
  const [ifsc, setIfsc] = useState(employee?.bankDetails?.ifsc || '');
  const [branchName, setBranchName] = useState(employee?.bankDetails?.branchName || '');
  const [bankLocation, setBankLocation] = useState(employee?.bankDetails?.location || '');
  const [currentBankProof, setCurrentBankProof] = useState(employee?.bankDetails?.bankProofUrl || null);

  const [role, setRole] = useState(employee?.role || 'Employee');
  const [department, setDepartment] = useState(employee?.department || '');
  const [departmentId, setDepartmentId] = useState(employee?.departmentId?._id || employee?.departmentId || '');
  const [designations, setDesignations] = useState([]);
  const [assignmentPreview, setAssignmentPreview] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [manager, setManager] = useState(employee?.manager?._id || employee?.manager || '');
  const [joiningDate, setJoiningDate] = useState(employee?.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '');
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [managers, setManagers] = useState([]);
  const [_departmentHead, _setDepartmentHead] = useState(employee?.departmentHead || false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [passwordLock, setPasswordLock] = useState(!!employee?._id);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Reset password input whenever switching to an existing employee record
  // (we must not attempt to show hashed password).
  useEffect(() => {
    if (employee?._id) {
      setPassword('');
      setPasswordLock(true);
      setShowPassword(false);
    } else {
      setPasswordLock(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?._id]);

  // Payroll / Compensation State (Step 10)
  const [salaryTemplateId, setSalaryTemplateId] = useState(employee?.salaryTemplateId?._id || employee?.salaryTemplateId || '');
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState(employee?.joiningDate ? dayjs(employee.joiningDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
  const [salaryStatus, setSalaryStatus] = useState('Active');
  const [salaryTemplates, setSalaryTemplates] = useState([]);

  // Sync Salary Effective Date with Joining Date if it's currently earlier
  useEffect(() => {
    if (joiningDate && (!salaryEffectiveDate || dayjs(salaryEffectiveDate).isBefore(dayjs(joiningDate)))) {
      setSalaryEffectiveDate(joiningDate);
    }
  }, [joiningDate, salaryEffectiveDate]);

  // Step 6: Languages & Previous Interview (custom page)
  const defaultLanguageRows = () => [
    { name: 'English', speak: false, read: false, write: false },
    { name: 'Hindi', speak: false, read: false, write: false },
    { name: 'Gujarati', speak: false, read: false, write: false }
  ];
  const [languages, setLanguages] = useState(() => {
    const fromEmp = employee?.languages;
    if (Array.isArray(fromEmp) && fromEmp.length > 0) {
      return fromEmp.map(l => {
        const name = l.name ?? [l.speak, l.read, l.write].find(Boolean) ?? '';
        const speak = typeof l.speak === 'boolean' ? l.speak : !!l.speak;
        const read = typeof l.read === 'boolean' ? l.read : !!l.read;
        const write = typeof l.write === 'boolean' ? l.write : !!l.write;
        return { name: typeof name === 'string' ? name.trim() || 'Language' : 'Language', speak, read, write };
      });
    }
    return defaultLanguageRows();
  });
  const [previousInterview, setPreviousInterview] = useState(employee?.previousInterview ?? ''); // 'yes' | 'no' | ''
  const [previousInterviewDate, setPreviousInterviewDate] = useState(employee?.previousInterviewDate ?? '');
  const [previousInterviewDeptLocation, setPreviousInterviewDeptLocation] = useState(employee?.previousInterviewDeptLocation ?? '');
  const [previousInterviewedBy, setPreviousInterviewedBy] = useState(employee?.previousInterviewedBy ?? '');

  // Step 7: Other Perquisites Details
  const [perquisites, setPerquisites] = useState(() => {
    const p = employee?.perquisites || {};
    return {
      companyCarModel: p.companyCarModel ?? '',
      companyCarMileageKm: p.companyCarMileageKm ?? '',
      companyCarPetrolRsMonth: p.companyCarPetrolRsMonth ?? '',
      leasedAccomSpecify: p.leasedAccomSpecify ?? '',
      leasedAccomFlatInWifeName: p.leasedAccomFlatInWifeName ?? '',
      leasedAccomMonthlyRentRs: p.leasedAccomMonthlyRentRs ?? '',
      leasedAccomDepositRs: p.leasedAccomDepositRs ?? '',
      hardFurnishingLimits: p.hardFurnishingLimits ?? '',
      hardFurnishingPeriod: p.hardFurnishingPeriod ?? '',
      hardFurnishingAnnualCostRs: p.hardFurnishingAnnualCostRs ?? '',
      incentiveParticulars: p.incentiveParticulars ?? '',
      incentiveAvoidDuplication: p.incentiveAvoidDuplication ?? '',
      telephoneCompanyOrPersonal: p.telephoneCompanyOrPersonal ?? '',
      telephoneReimbursementLimit: p.telephoneReimbursementLimit ?? '',
      telephoneLimitAmountRs: p.telephoneLimitAmountRs ?? '',
      taxAtSourceMonthlyRs: p.taxAtSourceMonthlyRs ?? '',
      remarks: p.remarks ?? {},
      customFields: Array.isArray(p.customFields) ? p.customFields.map(f => ({ label: f.label ?? '', value: f.value ?? '', remarks: f.remarks ?? '' })) : []
    };
  });

  // Step 7: Related employee (Section XI) & References
  const [relatedEmployee, setRelatedEmployee] = useState(() => {
    const r = employee?.relatedEmployee || {};
    return {
      hasRelated: r.hasRelated ?? 'no',
      name: r.name ?? '',
      designation: r.designation ?? '',
      location: r.location ?? '',
      company: r.company ?? '',
      relationship: r.relationship ?? '',
      contactNumber: r.contactNumber ?? ''
    };
  });
  const defaultRef = () => ({ name: '', company: '', designation: '', address: '', phone: '', periodKnown: '', email: '' });
  const [references, setReferences] = useState(() => {
    const arr = employee?.references;
    if (Array.isArray(arr) && arr.length >= 2) {
      return [0, 1].map(i => ({
        name: arr[i]?.name ?? '',
        company: arr[i]?.company ?? '',
        designation: arr[i]?.designation ?? '',
        address: arr[i]?.address ?? '',
        phone: arr[i]?.phone ?? '',
        periodKnown: arr[i]?.periodKnown ?? '',
        email: arr[i]?.email ?? ''
      }));
    }
    return [defaultRef(), defaultRef()];
  });

  // Step 8: Job History Annexure (Present Job + Last 2 previous jobs)
  const defaultJobEntry = () => ({ companyName: '', turnoverRs: '', totalEmployees: '', industry: '', designation: '', dutiesResponsibilities: '', organogram: null });
  const [jobHistoryAnnexure, setJobHistoryAnnexure] = useState(() => {
    const arr = employee?.jobHistoryAnnexure;
    if (Array.isArray(arr) && arr.length >= 3) {
      return arr.slice(0, 3).map(j => ({
        companyName: j.companyName ?? '',
        turnoverRs: j.turnoverRs ?? '',
        totalEmployees: j.totalEmployees ?? '',
        industry: j.industry ?? '',
        designation: j.designation ?? '',
        dutiesResponsibilities: j.dutiesResponsibilities ?? '',
        organogram: j.organogramUrl ? j.organogramUrl : null
      }));
    }
    return [defaultJobEntry(), defaultJobEntry(), defaultJobEntry()];
  });



  // Fetch salary templates safely ONLY when on the relevant step
  useEffect(() => {
    if (step === 10) {
      async function loadTemplates() {
        try {
          const res = await api.get('/payroll/salary-templates').catch(() => ({ data: { data: [] } }));
          setSalaryTemplates(res.data?.data || []);
        } catch (err) {
          console.warn("Salary templates fetch skipped or failed", err);
        }
      }
      loadTemplates();
    }
  }, [step]);


  const saveSalaryAssignment = async () => {
    if (!salaryTemplateId) { showToast('error', 'Validation Error', "Please select a Salary Template"); return; }
    if (!employee?._id) { showToast('error', 'Validation Error', "Please save employee draft first"); return; }

    setSaving(true);
    try {
      await api.post(`/hr/employees/${employee._id}/salary-assignment`, {
        salaryTemplateId,
        effectiveFrom: salaryEffectiveDate,
        status: salaryStatus
      });
      showToast('success', 'Success', "Salary assigned successfully!");
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', err.response?.data?.message || "Failed to assign salary");
    } finally {
      setSaving(false);
    }
  };

  // Leave Policy
  const [leavePolicy, setLeavePolicy] = useState(employee?.leavePolicy?._id || employee?.leavePolicy || '');
  const [policies, setPolicies] = useState([]);

  const loadPolicies = useCallback(async () => {
    try {
      const res = await api.get('/hr/leave-policies');
      setPolicies(res.data || []);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) return;
      console.error("Failed to load policies", err); 
    }
  }, []);

  // Shift Assignment (Shift Management)
  const [shiftId, setShiftId] = useState(employee?.shiftId?._id || employee?.shiftId || '');
  const [shifts, setShifts] = useState([]);

  // Grade state
  const [gradeId, setGradeId] = useState(employee?.gradeId?._id || employee?.gradeId || '');
  const [grade, setGrade] = useState(employee?.grade || '');
  const [band, setBand] = useState(employee?.band || '');
  const [grades, setGrades] = useState([]);
  const [mappings, setMappings] = useState([]);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await api.get('/hr/leave-policies/custom/mappings');
      const data = res.data?.data || res.data || [];
      console.log('EmployeeForm - Fetched Mappings:', data);
      setMappings(data);
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    }
  }, []);

  const loadGrades = useCallback(async () => {
    try {
      const res = await api.get('/grades');
      setGrades(res.data?.data || []);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) return;
      console.error("Failed to load grades", err);
    }
  }, []);


  useEffect(() => {
    if (!departmentId) {
      setAssignmentPreview(null);
      setAssignmentError('');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAssignmentLoading(true);
      setAssignmentError('');
      try {
        const res = await api.get('/grade-band/resolve', {
          params: {
            departmentId,
          }
        });
        if (cancelled) return;
        const data = res.data?.data || null;
        setAssignmentPreview(data);
        if (data?.grade) {
          setGradeId(data.grade._id || '');
          setGrade(data.grade.code || data.grade.name || '');
        }
        if (data?.band) {
          setBand(data.band.code || data.band.name || '');
          setSalaryTemplateId(data.payrollTemplate?._id || data.band.payrollTemplateId?._id || data.band.payrollTemplateId || '');
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err.response?.data?.message || 'Grade/Band mapping not found';
        setAssignmentPreview(null);
        setAssignmentError(msg);
      } finally {
        if (!cancelled) setAssignmentLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [departmentId]);

  // Sync state when employee prop changes (crucial for populated fields)
  useEffect(() => {
    if (employee) {
      if (employee.firstName) setFirstName(employee.firstName);
      if (employee.middleName) setMiddleName(employee.middleName);
      if (employee.lastName) setLastName(employee.lastName);
      if (employee.gender) setGender(employee.gender);
      if (employee.dob) setDob(dayjs(employee.dob).format('YYYY-MM-DD'));
      if (employee.contactNo) setContactNo(employee.contactNo);
      if (employee.email) setEmail(employee.email);
      if (employee.maritalStatus) setMaritalStatus(employee.maritalStatus);
      if (employee.bloodGroup) setBloodGroup(employee.bloodGroup);
      if (employee.nationality) setNationality(employee.nationality);
      if (employee.jobType || employee.employeeType) setJobType(employee.jobType || employee.employeeType);

      // Bank Details Sync
      if (employee.bankDetails) {
        setBankName(employee.bankDetails.bankName || '');
        setAccountNumber(employee.bankDetails.accountNumber || '');
        setIfsc(employee.bankDetails.ifsc || '');
        setBranchName(employee.bankDetails.branchName || '');
        setBankLocation(employee.bankDetails.location || '');
        setCurrentBankProof(employee.bankDetails.bankProofUrl || null);
      }

      if (employee.shiftId) {
        setShiftId(employee.shiftId?._id || employee.shiftId);
      }
      if (employee.departmentId) {
        setDepartmentId(employee.departmentId?._id || employee.departmentId);
      }
      if (employee.manager) {
        setManager(employee.manager?._id || employee.manager);
      }
      if (employee.leavePolicy) {
        setLeavePolicy(employee.leavePolicy?._id || employee.leavePolicy);
      }
      if (employee.joiningDate) {
        setJoiningDate(dayjs(employee.joiningDate).format('YYYY-MM-DD'));
      }
      if (employee.salaryTemplateId) {
        setSalaryTemplateId(employee.salaryTemplateId?._id || employee.salaryTemplateId);
      }
      if (employee.gradeId) {
        setGradeId(employee.gradeId?._id || employee.gradeId);
      }
      if (employee.grade) {
        setGrade(employee.grade);
      }
      if (employee.band) {
        setBand(employee.band);
      }
    }
  }, [employee]);

  // Fetch ID config for generation mode
  useEffect(() => {
    const fetchIdConfig = async () => {
      try {
        const res = await api.get('/company-id-config');
        if (res.data.success) {
          const isIntern = jobType && ['Intern', 'Internship'].includes(jobType);
          const targetKey = isIntern ? 'INTN' : 'EMP';
          const config = res.data.data.documentTypes.find(d => d.key === targetKey);
          if (config) setGenerationMode(config.generationMode || 'AUTO');
        }
      } catch (err) {
        console.error("Failed to load ID config mode:", err);
      }
    };
    fetchIdConfig();
  }, [jobType]);

  // Fetch tenant for global custom fields
  useEffect(() => {
    api.get('/tenants/me').then((res) => setTenant(res.data)).catch(() => {});
  }, []);

  // Merge global custom field labels with employee data (when tenant is ready or employee changes)
  useEffect(() => {
    if (!tenant) return;
    const eid = employee?._id ?? 'new';
    if (lastMergedEmployeeIdRef.current === eid) return;
    lastMergedEmployeeIdRef.current = eid;
    const globalPersonal = tenant.meta?.employeeFormGlobalCustomFields?.personal || [];
    const existing = employee?.customFields || [];

    const byLabel = {};
    existing.forEach((f) => { byLabel[f.label] = f.value; });
    const merged = [
      ...globalPersonal.map((l) => ({ label: l, value: byLabel[l] ?? '' })),
      ...existing.filter((f) => !globalPersonal.includes(f.label))
    ];
    setCustomFields(merged);
    const g = tenant.meta?.employeeFormGlobalCustomFields || {};
    const globalFather = g.father || [];
    const existingFather = employee?.fatherCustomFields || [];
    const byLabelF = {};
    existingFather.forEach((f) => { byLabelF[f.label] = f.value; });
    setFatherCustomFields([
      ...globalFather.map((l) => ({ label: l, value: byLabelF[l] ?? '' })),
      ...existingFather.filter((f) => !globalFather.includes(f.label))
    ]);
    const globalMother = g.mother || [];
    const existingMother = employee?.motherCustomFields || [];
    const byLabelM = {};
    existingMother.forEach((f) => { byLabelM[f.label] = f.value; });
    setMotherCustomFields([
      ...globalMother.map((l) => ({ label: l, value: byLabelM[l] ?? '' })),
      ...existingMother.filter((f) => !globalMother.includes(f.label))
    ]);
  }, [tenant, employee]);

  const onAddGlobalField = useCallback(async (section, label) => {
    if (!tenant?._id || !label) return;
    const current = tenant.meta?.employeeFormGlobalCustomFields || {};
    const updated = {
      ...current,
      [section]: [...(current[section] || []), label]
    };
    try {
      await api.put(`/tenants/${tenant._id}`, {
        meta: { ...(tenant.meta || {}), employeeFormGlobalCustomFields: updated }
      });
      setTenant((t) => (t ? { ...t, meta: { ...(t.meta || {}), employeeFormGlobalCustomFields: updated } } : null));
      if (section === 'personal') {
        setCustomFields((prev) => [...prev, { label, value: '' }]);
      }
      if (section === 'father') {
        setFatherCustomFields((prev) => [...prev, { label, value: '' }]);
      }
      if (section === 'mother') {
        setMotherCustomFields((prev) => [...prev, { label, value: '' }]);
      }
      showToast('success', 'Global field added', 'Field will appear for all employees.');
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.message || 'Failed to save global field.');
    }
  }, [tenant]);

  const loadShifts = useCallback(async () => {
    try {
      const res = await api.get('/shift-master?status=Active');
      setShifts(res.data?.data || []);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) return;
       console.error('Failed to load shifts', err); 
    }
  }, []);


  // Education State
  const [eduType, setEduType] = useState(employee?.education?.type || 'Diploma');
  const [class10Marksheet, setClass10Marksheet] = useState(employee?.education?.class10Marksheet || null);
  const [class12Marksheet, setClass12Marksheet] = useState(employee?.education?.class12Marksheet || null);
  const [diplomaCertificate, setDiplomaCertificate] = useState(employee?.education?.diplomaCertificate || null);
  const [bachelorDegree, setBachelorDegree] = useState(employee?.education?.bachelorDegree || null);
  const [masterDegree, setMasterDegree] = useState(employee?.education?.masterDegree || null);

  // Alternative: Last 3 Sem Marksheets
  const [lastSem1, setLastSem1] = useState(employee?.education?.lastSem1Marksheet || null);
  const [lastSem2, setLastSem2] = useState(employee?.education?.lastSem2Marksheet || null);
  const [lastSem3, setLastSem3] = useState(employee?.education?.lastSem3Marksheet || null);

  // Step 6: Identity Documents
  // Step 6: Identity Documents
  const [aadharFront, setAadharFront] = useState(employee?.documents?.aadharFront || null);
  const [aadharBack, setAadharBack] = useState(employee?.documents?.aadharBack || null);
  const [panCard, setPanCard] = useState(employee?.documents?.panCard || null);

  const bankProofRef = useRef(null);
  const c10Ref = useRef(null);
  const c12Ref = useRef(null);
  const diplomaRef = useRef(null);
  const bachelorRef = useRef(null);
  const masterRef = useRef(null);
  const ls1Ref = useRef(null);
  const ls2Ref = useRef(null);
  const ls3Ref = useRef(null);
  const aadharFrontRef = useRef(null);
  const aadharBackRef = useRef(null);
  const panRef = useRef(null);
  const profilePicRef = useRef(null);
  const ignoreAutoFill = useRef(false);


  // Fetch departments for dropdown
  const loadDepartments = useCallback(async () => {
    setDepartmentsLoading(true);
    try {
      let res;
      try {
        res = await api.get('/hr/departments');
      } catch {
        // Backward-compatible fallback for older backend mount shape
        res = await api.get('/hr/hr/departments');
      }
      const deptList = res.data?.data || res.data || [];
      setDepartments(Array.isArray(deptList) ? deptList : []);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        setDepartments([]);
        return;
      }
      console.error('Failed to load departments', err);
      // Keep existing departments (if any) and show a visible error
      const backendMsg = err?.response?.data?.message || err?.response?.data?.error || '';
      const maybeModuleBlocked = /module|access denied|forbidden/i.test(String(backendMsg));
      const errorMsg =
        err?.hrms?.message ||
        (maybeModuleBlocked ? 'HR module is disabled or access is denied for this company.' : backendMsg) ||
        err?.message ||
        'Failed to load departments';
      showToast('error', 'Departments', errorMsg);
    }
    finally {
      setDepartmentsLoading(false);
    }
  }, []);

  const normalizeDepartmentName = useCallback((value) => String(value || '').replace(/\s+/g, ' ').trim(), []);

  const makeDepartmentCode = useCallback((name, existingDepartments = []) => {
    const words = normalizeDepartmentName(name).split(' ').filter(Boolean);
    const initials = words.map((word) => word.replace(/[^a-z0-9]/gi, '').charAt(0)).join('');
    const compact = normalizeDepartmentName(name).replace(/[^a-z0-9]/gi, '');
    let base = (initials.length >= 2 ? initials : compact).toUpperCase().slice(0, 6) || 'DEPT';
    if (base.length < 2) base = `${base}D`.slice(0, 2);

    const usedCodes = new Set(
      (existingDepartments || [])
        .map((dept) => String(dept?.code || dept?.departmentCode || '').trim().toUpperCase())
        .filter(Boolean)
    );
    let code = base;
    let suffix = 1;
    while (usedCodes.has(code)) {
      const nextSuffix = String(suffix);
      code = `${base.slice(0, Math.max(1, 6 - nextSuffix.length))}${nextSuffix}`;
      suffix += 1;
    }
    return code;
  }, [normalizeDepartmentName]);

  const ensureDepartmentForSave = useCallback(async () => {
    const typedName = normalizeDepartmentName(department);
    const existingById = departments.find((dept) => String(dept?._id || dept || '') === String(departmentId || ''));
    const existingByName = departments.find((dept) => {
      const deptName = normalizeDepartmentName(typeof dept === 'string' ? dept : dept?.name);
      return typedName && deptName.toLowerCase() === typedName.toLowerCase();
    });
    const selectedDept = existingById || existingByName;

    if (selectedDept) {
      const selectedId = typeof selectedDept === 'string' ? '' : selectedDept?._id;
      const selectedName = normalizeDepartmentName(typeof selectedDept === 'string' ? selectedDept : selectedDept?.name) || typedName;
      if (selectedId && selectedId !== departmentId) setDepartmentId(selectedId);
      if (selectedName && selectedName !== department) setDepartment(selectedName);
      return { department: selectedName || undefined, departmentId: selectedId || undefined };
    }

    if (!typedName) return { department: undefined, departmentId: undefined };

    try {
      const res = await api.post('/hr/departments', {
        name: typedName,
        code: makeDepartmentCode(typedName, departments),
        description: 'Created from employee form'
      });
      const created = res.data?.data || res.data;
      if (created?._id) {
        setDepartments((prev) => {
          const alreadyExists = prev.some((dept) => String(dept?._id || dept) === String(created._id));
          return alreadyExists ? prev : [...prev, created].sort((a, b) => String(a?.name || a).localeCompare(String(b?.name || b)));
        });
        setDepartmentId(created._id);
        setDepartment(created.name || typedName);
        return { department: created.name || typedName, departmentId: created._id };
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || '';
      if (/already exists/i.test(message)) {
        try {
          const res = await api.get('/hr/departments');
          const freshDepartments = res.data?.data || res.data || [];
          if (Array.isArray(freshDepartments)) {
            setDepartments(freshDepartments);
            const found = freshDepartments.find((dept) => normalizeDepartmentName(dept?.name || dept).toLowerCase() === typedName.toLowerCase());
            if (found?._id) {
              setDepartmentId(found._id);
              setDepartment(found.name || typedName);
              return { department: found.name || typedName, departmentId: found._id };
            }
          }
        } catch (reloadErr) {
          console.warn('Failed to reload departments after duplicate custom department', reloadErr);
        }
      }
      console.warn('Custom department could not be created; saving employee with department name only.', err);
    }

    setDepartmentId('');
    setDepartment(typedName);
    return { department: typedName, departmentId: undefined };
  }, [department, departmentId, departments, makeDepartmentCode, normalizeDepartmentName]);

  // Fetch employees for manager dropdown
  const loadManagers = useCallback(async () => {
    try {
      const res = await api.get('/hr/employees');
      const empList = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setManagers(empList.filter(e => !employee || e._id !== employee._id)); // Exclude self
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        setManagers([]);
        return;
      }
      console.error('Failed to load managers', err);
      setManagers([]);
    }
  }, [employee]);

  // Step 6: Fetch Employee Code Preview
  const loadEmployeeCodePreview = useCallback(async () => {
    if (step !== 6) return;
    try {
      const payload = {
        firstName: firstName,
        firstNameCapital: firstNameCapital,
        middleName: middleName,
        lastName: lastName,
        department: department || 'GEN',
        employeeType: jobType || 'Full-Time'
      };
      console.log('Fetching preview with:', payload);
      const res = await api.post('/hr/employees/preview', payload);
      if (res.data && res.data.preview) {
        setEmployeeCode(res.data.preview);
      } else {
        setEmployeeCode('Error: No ID returned');
      }
    } catch (err) {
      console.error('Failed to load employee code preview', err);
      setEmployeeCode('Error: Failed to generate');
    }
  }, [step, firstName, lastName, department, firstNameCapital, jobType]);

  useEffect(() => {
    loadDepartments();
    loadManagers();
    loadPolicies();
    loadShifts(); // Shift Management
    loadGrades(); // Grade Management
    fetchMappings();
    if (step === 9 && !employee) loadEmployeeCodePreview();
  }, [loadDepartments, loadManagers, loadEmployeeCodePreview, step, employee, loadPolicies, loadShifts, loadGrades, fetchMappings]);

  const [employeeCode, setEmployeeCode] = useState('');

  const phoneRe = /^\d{8,15}$/;
  const pinRe = useMemo(() => /^\d{5,10}$/, []);
  const ifscRe = useMemo(() => /^[A-Z]{4}0[0-9A-Z]{6}$/, []);

  const handlePincodeLookup = useCallback(async (pin, target = 'temp') => {
    try {
      if (!pin || !pinRe.test(pin)) return;
      setPincodeLoading(true);
      const key = 'pincode_cache';
      let cache = {};
      try { cache = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch { cache = {}; }
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const c = cache[pin];
        if (c) {
          if (target === 'temp') setTempAddress(p => {
            const next = { ...p, city: c.city || p.city, state: c.stateVal || p.state, country: c.countryVal || p.country };
            return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
          });
          else if (target === 'perm') setPermAddress(p => {
            const next = { ...p, city: c.city || p.city, state: c.stateVal || p.state, country: c.countryVal || p.country };
            return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
          });
          else setCommAddress(p => {
            const next = { ...p, city: c.city || p.city, state: c.stateVal || p.state, country: c.countryVal || p.country };
            return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
          });
        }
        return;
      }
      const res = await fetch(`/api/security/pincode/${encodeURIComponent(pin)}`, {
        credentials: 'include',
      });
      let city = '', stateVal = '', countryVal = '';
      if (res.ok) {
        const data = await res.json();
        const entry = Array.isArray(data) ? data[0] : null;
        const po = entry && Array.isArray(entry.PostOffice) ? entry.PostOffice[0] : null;
        city = (po && (po.District || po.Name)) || '';
        stateVal = (po && po.State) || '';
        countryVal = (po && po.Country) || '';
      }
      if (city || stateVal || countryVal) {
        if (ignoreAutoFill.current) return; // Prevent overwriting city if triggered by city lookup

        const v = { city, stateVal, countryVal, ts: Date.now() };
        cache[pin] = v;
        try { sessionStorage.setItem(key, JSON.stringify(cache)); } catch { /* ignore sessionStorage errors */ }
        if (target === 'temp') setTempAddress(p => {
          const next = { ...p, city: city || p.city, state: stateVal || p.state, country: countryVal || p.country };
          return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
        });
        else if (target === 'perm') setPermAddress(p => {
          const next = { ...p, city: city || p.city, state: stateVal || p.state, country: countryVal || p.country };
          return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
        });
        else setCommAddress(p => {
          const next = { ...p, city: city || p.city, state: stateVal || p.state, country: countryVal || p.country };
          return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
        });
      }
    } finally {
      setPincodeLoading(false);
    }
  }, [pinRe]);

  const handleIfscLookup = useCallback(async (code) => {
    try {
      if (!code || !ifscRe.test(code)) return;
      setIfscLoading(true);
      const key = 'ifsc_cache';
      let cache = {};
      try { cache = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch { cache = {}; }
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const c = cache[code];
        if (c) {
          setBankName(prev => c.BANK || prev);
          setBranchName(prev => c.BRANCH || prev);
        }
        return;
      }
      const res = await fetch(`/api/security/ifsc/${encodeURIComponent(code)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBankName(prev => data.BANK || prev);
        setBranchName(prev => data.BRANCH || prev);
        setBankLocation(prev => data.CITY || data.DISTRICT || prev); // Auto-populate location
        const v = { ...data, ts: Date.now() };
        cache[code] = v;
        try { sessionStorage.setItem(key, JSON.stringify(cache)); } catch { /* ignore sessionStorage errors */ }
      }
    } finally {
      setIfscLoading(false);
    }
  }, [ifscRe]);

  const handleCityLookup = useCallback(async (city, target = 'temp') => {
    try {
      if (!city || city.length < 3) { setPincodeLoading(false); return; }

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) { setPincodeLoading(false); return; }

      const res = await fetch(`/api/security/postoffice/${encodeURIComponent(city)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const entry = Array.isArray(data) ? data[0] : null;
        if (entry && entry.Status === 'Success' && Array.isArray(entry.PostOffice) && entry.PostOffice.length > 0) {
          const list = entry.PostOffice;
          const inputCity = city.trim().toLowerCase();

          // Priority 1: Exact Match on District
          let po = list.find(item => item.District && item.District.toLowerCase() === inputCity);

          // Priority 2: Exact Match on Region
          if (!po) po = list.find(item => item.Region && item.Region.toLowerCase() === inputCity);

          // Priority 3: Fuzzy Match on Name (Starts with input + space, or exact)
          // e.g. Input "Dhari" matches "Dhari S.O"
          if (!po) {
            const nameRegex = new RegExp(`^${inputCity}( |$|\\.)`, 'i');
            const nameMatches = list.filter(item => item.Name && nameRegex.test(item.Name));

            if (nameMatches.length > 0) {
              // Sort by State (A-Z) -> Gujarat comes before Uttarakhand
              nameMatches.sort((a, b) => (a.State || '').localeCompare(b.State || ''));
              po = nameMatches[0];
            }
          }

          // Fallback: Just take the first one if we can't find a direct match
          if (!po) po = list[0];

          const stateVal = po.State || '';
          const countryVal = po.Country || 'India';
          const pinVal = po.Pincode || '';

          if (target === 'temp') {
            ignoreAutoFill.current = true;
            setTempAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
            setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
          } else if (target === 'perm') {
            ignoreAutoFill.current = true;
            setPermAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
            setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
          } else {
            ignoreAutoFill.current = true;
            setCommAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
            setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
          }
        } else {
          // Fallback to Global Search (Nominatim)
          throw new Error("No Indian match found");
        }

      } else {
        throw new Error("Indian API Failed");
      }
    } catch (e) {
      console.log("Indian API missed, trying global...", e);

      // Clear stale data immediately to prevent wrong info persistence
      if (target === 'temp') setTempAddress(p => ({ ...p, state: '', country: '', pinCode: '' }));
      else if (target === 'perm') setPermAddress(p => ({ ...p, state: '', country: '', pinCode: '' }));
      else setCommAddress(p => ({ ...p, state: '', country: '', pinCode: '' }));

      try {
        const globalRes = await fetch(`/api/security/geo/${encodeURIComponent(city)}`, {
          credentials: 'include',
          headers: { 'Accept-Language': 'en' } // Prefer English results
        });
        if (globalRes.ok) {
          const gData = await globalRes.json();
          const gEntry = Array.isArray(gData) ? gData[0] : null;
          if (gEntry && gEntry.address) {
            const stateVal = gEntry.address.state || gEntry.address.county || '';
            const countryVal = gEntry.address.country || '';
            const pinVal = gEntry.address.postcode || '';

            if (target === 'temp') {
              ignoreAutoFill.current = true;
              setTempAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
              setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
            } else if (target === 'perm') {
              ignoreAutoFill.current = true;
              setPermAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
              setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
            } else {
              ignoreAutoFill.current = true;
              setCommAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
              setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
            }
          }
        }
      } catch (err2) {
        console.error("Global lookup failed", err2);
      }
    } finally {
      setPincodeLoading(false);
    }
  }, []);

  // Debounced Effect for City Lookup - Temp Address
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tempAddress.city && tempAddress.city.length > 2) handleCityLookup(tempAddress.city, 'temp');
    }, 800);
    return () => clearTimeout(timer);
  }, [tempAddress.city, handleCityLookup]);

  // Debounced Effect for City Lookup - Perm Address
  useEffect(() => {
    if (sameAsTemp) return;
    const timer = setTimeout(() => {
      if (permAddress.city && permAddress.city.length > 2) handleCityLookup(permAddress.city, 'perm');
    }, 800);
    return () => clearTimeout(timer);
  }, [permAddress.city, sameAsTemp, handleCityLookup]);

  // Debounced Effect for City Lookup - Comm Address
  useEffect(() => {
    const timer = setTimeout(() => {
      if (commAddress.city && commAddress.city.length > 2) handleCityLookup(commAddress.city, 'comm');
    }, 800);
    return () => clearTimeout(timer);
  }, [commAddress.city, handleCityLookup]);

  // ... (renderFilePreview and validateStep unchanged)

  // ...

  // Helper to render file preview
  const renderFilePreview = (fileOrUrl, altText) => {
    if (!fileOrUrl) return null;
    const isFile = fileOrUrl instanceof File;
    const isPdf = isFile ? (fileOrUrl.type === 'application/pdf') : fileOrUrl.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return <div className="text-red-500 font-bold text-xs p-2 text-center border rounded bg-slate-50">PDF Document</div>;
    }

    let src = '';
    if (isFile) {
      src = URL.createObjectURL(fileOrUrl);
    } else {
      if (fileOrUrl.startsWith('http')) {
        src = fileOrUrl;
      } else {
        // Normalize URL: remove /api from end if present (for static files), remove trailing slash
        const backendUrl = BACKEND_URL || '';
        const baseUrl = backendUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
        const cleanPath = (fileOrUrl || '').replace(/\\/g, '/');
        const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
        src = `${baseUrl}${path}`;
      }
    }

    return <img src={src} alt={altText} className="w-full h-full object-contain" />;
  };

  useEffect(() => {
    if (firstName) {
      setFirstNameCapital(firstName.toUpperCase());
    }
  }, [firstName]);

  const validateStep = (stepNum) => {
    const e = {};
    if (stepNum === 1) {
      if (!firstName || firstName.length < 3 || !/^[A-Za-z\s.]+$/.test(firstName)) e.firstName = 'First name required (min 3 chars, letters, spaces, dots allowed)';
      if (middleName && middleName.length < 3) e.middleName = 'Middle name must be at least 3 chars';
      if (!lastName || lastName.length < 3) e.lastName = 'Last name is required (min 3 chars)';
      if (!gender) e.gender = 'Gender is required';
      if (!dob) e.dob = 'Date of birth required';
      else {
        const birth = new Date(dob); const age = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        if (age < 18) e.dob = 'Employee must be at least 18 years old';
      }
      const cleanContact = String(contactNo ?? '').replace(/\D/g, '');
      if (cleanContact.length < 10 || cleanContact.length > 15 || !phoneRe.test(cleanContact)) e.contactNo = 'Primary contact must be 10-15 digits';
      if (!maritalStatus) e.maritalStatus = 'Marital Status is required';
      const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
      if (!bloodGroup) e.bloodGroup = 'Blood Group is required';
      else if (!validBloodGroups.includes(bloodGroup.toUpperCase())) e.bloodGroup = 'Invalid Blood Group (Allowed: A+, A-, B+, B-, O+, O-, AB+, AB-)';
      if (!nationality) e.nationality = 'Nationality is required';
      if (!emergencyContactName || emergencyContactName.length < 3) e.emergencyContactName = 'Emergency contact name required (min 3 chars)';
      const cleanEmergency = String(emergencyContactNumber ?? '').replace(/\D/g, '');
      if (cleanEmergency.length < 10 || cleanEmergency.length > 15 || !phoneRe.test(cleanEmergency)) e.emergencyContactNumber = 'Emergency phone must be 10-15 digits';
    }

    if (stepNum === 2) {
      if (generationMode === 'MANUAL' && (!employeeId || employeeId.trim().length < 2)) e.employeeId = 'Employee ID is required (min 2 chars)';
      const customDepartmentName = normalizeDepartmentName(department);
      if (!departmentId && !customDepartmentName) e.department = 'Department is required';
      else if (!departmentId && customDepartmentName.length < 2) e.department = 'Department name must be at least 2 characters';
      else if (!departmentId && customDepartmentName.length > 50) e.department = 'Department name must be at most 50 characters';
      if (!joiningDate) e.joiningDate = 'Joining Date is required';
      if (!gradeId && !grade) e.grade = 'Grade is required';
      if (!band) e.band = 'Band is required';
      if (!jobType) e.jobType = 'Employee Type is required';
    }

    if (stepNum === 3) {
      if (!eduType) e.eduType = 'Education Type is required';
      if (!class10Marksheet && !employee?.education?.class10Marksheet) e.class10 = '10th Marksheet is required';
      const hasDegree = !!diplomaCertificate || !!bachelorDegree || !!employee?.education?.diplomaCertificate || !!employee?.education?.bachelorDegree;
      const hasAlt = (lastSem1 && lastSem2 && lastSem3) || (employee?.education?.lastSem1 && employee?.education?.lastSem2 && employee?.education?.lastSem3);
      if (eduType === 'Diploma') {
        if (!hasDegree && !hasAlt) e.diploma = 'Diploma Certificate OR Last 3 Sem Marksheets required';
      } else if (eduType === 'Regular') {
        if (!class12Marksheet && !employee?.education?.class12Marksheet) e.class12 = '12th Marksheet is required';
        if (!hasDegree && !hasAlt) e.bachelor = 'Bachelor Degree OR Last 3 Sem Marksheets required';
      }
    }

    if (stepNum === 4) {
      if (!aadharNumber || aadharNumber.length !== 12) e.aadharNumber = 'Aadhar Number must be exactly 12 digits';
      if (!panNumber || panNumber.length !== 10) e.panNumber = 'PAN Number must be exactly 10 characters';
      if (!aadharFront && !employee?.documents?.aadharFront) e.aadharFront = 'Aadhar Front is required';
      if (!aadharBack && !employee?.documents?.aadharBack) e.aadharBack = 'Aadhar Back is required';
      if (!panCard && !employee?.documents?.panCard) e.panCard = 'PAN Card is required';
    }

    if (stepNum === 5) {
      experience.forEach((exp, idx) => {
        if (exp.from && exp.to) {
          const f = new Date(exp.from); const t = new Date(exp.to);
          if (f > t) e[`exp_${idx}`] = 'From date must be before To date';
        }
        if (exp.companyName && (!exp.reportingPersonName || !exp.reportingPersonEmail)) {
           e[`exp_${idx}`] = 'Reporting details required if company is entered';
        }
      });
    }

    if (stepNum === 6) {
      if (!employee) {
        if (!bankName) e.bankName = 'Bank name required';
        if (!accountNumber || accountNumber.length !== 12) e.accountNumber = 'Account Number must be exactly 12 digits';
        if (!ifsc || !ifscRe.test(ifsc)) e.ifsc = 'IFSC invalid';
        if (!branchName) e.branchName = 'Branch name required';
        if (!currentBankProof) e.bankProof = 'Bank Proof is required';
      }
    }

    if (stepNum === 10) {
      if (!email || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid Email is required';
      if (!employee?._id || !passwordLock) {
        if (password && password.length < 6) e.password = 'Password min 6 chars';
        if (!employee?._id && !password) e.password = 'Password is required';
      }
      if (!salaryEffectiveDate) e.effectiveDate = "Effective Date is required";
      if (joiningDate && salaryEffectiveDate < joiningDate) e.effectiveDate = "Cannot be before Joining Date";
    }

    setErrors(e);
    const valid = Object.keys(e).length === 0;
    return valid ? true : e; // true if valid, else error object for tab switching
  };



  const handleNext = () => {
    const result = validateStep(step);
    if (result === true) {
      setStep(step + 1);
      return;
    }
    // Validation failed: show error message
    const errObj = typeof result === 'object' && result !== null ? result : {};
    const firstMsg = Object.values(errObj)[0] || 'Please fix the highlighted errors before continuing.';
    showToast('error', 'Cannot proceed', firstMsg);
  };


  const handlePrev = () => {
    setStep(step - 1);
  };

  useEffect(() => {
    if (sameAsTemp) setPermAddress({ ...tempAddress });
  }, [sameAsTemp, tempAddress]);

  useEffect(() => {
    const t = setTimeout(() => {
      const pin = tempAddress.pinCode;
      if (pin && pinRe.test(pin)) handlePincodeLookup(pin, 'temp');
    }, 500);
    return () => clearTimeout(t);
  }, [tempAddress.pinCode, handlePincodeLookup, pinRe]);

  useEffect(() => {
    const t = setTimeout(() => {
      const pin = permAddress.pinCode;
      if (pin && pinRe.test(pin) && !sameAsTemp) handlePincodeLookup(pin, 'perm');
    }, 500);
    return () => clearTimeout(t);
  }, [permAddress.pinCode, sameAsTemp, handlePincodeLookup, pinRe]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (ifsc && ifscRe.test(ifsc)) handleIfscLookup(ifsc);
    }, 500);
    return () => clearTimeout(t);
  }, [ifsc, handleIfscLookup, ifscRe]);

  async function submit(e) {
    e.preventDefault();
    const result = validateStep(step);
    if (result !== true) {
      const errObj = typeof result === 'object' && result !== null ? result : {};
      const firstMsg = Object.values(errObj)[0] || 'Please fix the highlighted errors before submitting.';
      showToast('error', 'Cannot submit', firstMsg);
      return;
    }
    setSaving(true);
    try {
      // Upload Current Bank Proof if changed
      let currentBankProofUrl = employee?.bankDetails?.bankProofUrl;
      if (currentBankProof && currentBankProof instanceof File) {
        try {
          const fd = new FormData();
          fd.append('file', currentBankProof);
          const up = await api.post('/uploads/doc', fd);
          if (up?.data?.success) currentBankProofUrl = up.data.url;
        } catch (e) { console.warn('Bank proof upload failed', e) }
      } else if (typeof currentBankProof === 'string') {
        // If UI explicitly clears it, allow removal by sending empty string.
        // Otherwise keep existing URL.
        const trimmed = currentBankProof.trim();
        if (trimmed === '') {
          currentBankProofUrl = '';
        } else {
          currentBankProofUrl = trimmed;
        }
      } else {
        // If user didn't touch it, keep existing URL (do NOT clear on edit).
      }
      /* Profile Pic removed
      let profilePicUrl = employee?.profilePic || undefined;
      if (profilePic && profilePic instanceof File) { ... }
      */

      // Process experience file uploads
      let processedExperience = [];
      if (experience && experience.length > 0) {
        processedExperience = await Promise.all(experience.map(async (exp) => {
          let pSlips = [];
          if (exp.payslips && exp.payslips.length > 0) {
            for (const item of exp.payslips) {
              if (item instanceof File) {
                const fd = new FormData();
                fd.append('file', item);
                try {
                  const up = await api.post('/uploads/doc', fd);
                  if (up?.data?.success) pSlips.push(up.data.url);
                } catch (e) { console.warn('Payslip upload failed', e); }
              } else if (typeof item === 'string') { pSlips.push(item); }
            }
          }
          return { ...exp, payslips: pSlips };
        }));
      }

      // Education File Uploads
      let c10Url = employee?.education?.class10Marksheet;
      let c12Url = employee?.education?.class12Marksheet;
      let diplomaUrl = employee?.education?.diplomaCertificate;
      let bachelorUrl = employee?.education?.bachelorDegree;
      let masterUrl = employee?.education?.masterDegree;
      let ls1Url = employee?.education?.lastSem1Marksheet;
      let ls2Url = employee?.education?.lastSem2Marksheet;
      let ls3Url = employee?.education?.lastSem3Marksheet;

      const uploadFile = async (file) => {
        if (!file || !(file instanceof File)) return null;
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await api.post('/uploads/doc', fd);
          return res?.data?.success ? res.data.url : null;
        } catch (e) {
          console.warn('File upload failed', e);
          return null;
        }
      };

      if (class10Marksheet instanceof File) { c10Url = await uploadFile(class10Marksheet) || c10Url; }
      if (class12Marksheet instanceof File) { c12Url = await uploadFile(class12Marksheet) || c12Url; }
      if (diplomaCertificate instanceof File) { diplomaUrl = await uploadFile(diplomaCertificate) || diplomaUrl; }
      if (bachelorDegree instanceof File) { bachelorUrl = await uploadFile(bachelorDegree) || bachelorUrl; }
      if (masterDegree instanceof File) { masterUrl = await uploadFile(masterDegree) || masterUrl; }

      if (lastSem1 instanceof File) { ls1Url = await uploadFile(lastSem1) || ls1Url; }
      if (lastSem2 instanceof File) { ls2Url = await uploadFile(lastSem2) || ls2Url; }
      if (lastSem3 instanceof File) { ls3Url = await uploadFile(lastSem3) || ls3Url; }

      // Step 6 Documents

      // Step 6 Documents
      let aadharFrontUrl = employee?.documents?.aadharFront;
      let aadharBackUrl = employee?.documents?.aadharBack;
      let panUrl = employee?.documents?.panCard;
      let profilePicUrl = employee?.profilePic; // Existing URL

      if (profilePic instanceof File) { profilePicUrl = await uploadFile(profilePic) || profilePicUrl; }
      if (aadharFront instanceof File) { aadharFrontUrl = await uploadFile(aadharFront) || aadharFrontUrl; }
      if (aadharBack instanceof File) { aadharBackUrl = await uploadFile(aadharBack) || aadharBackUrl; }
      if (panCard instanceof File) { panUrl = await uploadFile(panCard) || panUrl; }

      // Job History Annexure: upload organogram files
      const processedJobHistory = await Promise.all(jobHistoryAnnexure.map(async (j) => {
        let organogramUrl = typeof j.organogram === 'string' ? j.organogram : null;
        if (j.organogram instanceof File) organogramUrl = await uploadFile(j.organogram) || organogramUrl;
        return {
          companyName: j.companyName || undefined,
          turnoverRs: j.turnoverRs || undefined,
          totalEmployees: j.totalEmployees || undefined,
          industry: j.industry || undefined,
          designation: j.designation || undefined,
          dutiesResponsibilities: j.dutiesResponsibilities || undefined,
          organogramUrl: organogramUrl || undefined
        };
      }));
      const resolvedDepartment = await ensureDepartmentForSave();

      const payload = {
        employeeId: generationMode === 'MANUAL' ? (employeeId || undefined) : undefined,
        firstName, middleName, lastName, firstNameCapital,
        gender: gender || undefined,
        dob: dob || undefined,
        contactNo: contactNo || undefined,
        email: email || undefined,
        password: password || undefined,
        maritalStatus: maritalStatus || undefined,
        bloodGroup: bloodGroup || undefined,
        nationality: nationality || undefined,
        placeOfBirth: placeOfBirth || undefined,
        hobbies: hobbies || undefined,
        height: height || undefined,
        weight: weight || undefined,
        cast: cast || undefined,
        physicalDisabilityOrSickness: physicalDisabilityOrSickness || undefined,
        physicalDisabilityDetails: physicalDisabilityOrSickness === 'yes' ? (physicalDisabilityDetails || undefined) : undefined,
        fatherName: (fatherFirstName || fatherLastName) ? [fatherFirstName, fatherLastName].filter(Boolean).join(' ') : fatherName || undefined,
        fatherFirstName: fatherFirstName || undefined,
        fatherLastName: fatherLastName || undefined,
        fatherBloodGroup: fatherBloodGroup || undefined,
        fatherAadhaar: fatherAadhaar || undefined,
        motherName: (motherFirstName || motherLastName) ? [motherFirstName, motherLastName].filter(Boolean).join(' ') : motherName || undefined,
        motherFirstName: motherFirstName || undefined,
        motherLastName: motherLastName || undefined,
        motherBloodGroup: motherBloodGroup || undefined,
        motherAadhaar: motherAadhaar || undefined,
        fatherCustomFields: fatherCustomFields || [],
        motherCustomFields: motherCustomFields || [],
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactNumber: emergencyContactNumber || undefined,
        customFields: customFields || [],
        tempAddress, permAddress: sameAsTemp ? tempAddress : permAddress, commAddress: commSameAsTemp ? tempAddress : commAddress,
        experience: processedExperience,
        employeeType: jobType || 'Full-time',
        bankDetails: {
          bankName: bankName || undefined,
          accountNumber: accountNumber || undefined,
          ifsc: ifsc || undefined,
          branchName: branchName || undefined,
          location: bankLocation || undefined,
          bankProofUrl: currentBankProofUrl || undefined
        },
        education: {
          type: eduType,
          class10Marksheet: c10Url,
          class12Marksheet: c12Url,
          diplomaCertificate: diplomaUrl,
          bachelorDegree: bachelorUrl,
          masterDegree: masterUrl,
          lastSem1Marksheet: ls1Url,
          lastSem2Marksheet: ls2Url,
          lastSem3Marksheet: ls3Url
        },
        documents: {
          aadharFront: aadharFrontUrl,
          aadharBack: aadharBackUrl,
          aadharNumber,
          panCard: panUrl,
          panNumber
        },
        role,
        department: resolvedDepartment.department || undefined,
        departmentId: resolvedDepartment.departmentId || undefined,
        manager: manager || undefined,
        joiningDate: joiningDate || new Date().toISOString(),
        departmentHead: _departmentHead,
        profilePic: profilePicUrl,
        status: 'Active',
        lastStep: 10,
        leavePolicy: leavePolicy || undefined,
        shiftId: shiftId || undefined,
        spouseDetails: showDependents ? spouseDetails : undefined,
        children: showDependents ? children : [],
        brothers: showDependents ? brothers : [],
        sisters: showDependents ? sisters : [],
        languages: languages,
        previousInterview: previousInterview || undefined,
        ...(previousInterview === 'yes' && {
          previousInterviewDate: previousInterviewDate || undefined,
          previousInterviewDeptLocation: previousInterviewDeptLocation || undefined,
          previousInterviewedBy: previousInterviewedBy || undefined
        }),
        perquisites: perquisites,
        relatedEmployee: relatedEmployee.hasRelated === 'yes' ? relatedEmployee : undefined,
        references: references,
        jobHistoryAnnexure: processedJobHistory,
        gradeId: gradeId || undefined,
        grade: grade || undefined,
        band: band || undefined,
        salaryTemplateId: salaryTemplateId || undefined,
        payrollTemplateId: salaryTemplateId || undefined
      };

      let empResult;
      if (employee) {
        empResult = await api.put(`/hr/employees/${employee._id}`, payload);
      } else {
        empResult = await api.post('/hr/employees', payload);
      }

      // If employee is marked as "Dep Head", update the department's head field
      if (role === 'Dep Head' && departmentId) {
        const empId = empResult?.data?.data?._id || empResult?.data?._id || employee?._id;
        if (empId) {
          await api.put(`/hr/departments/${departmentId}`, { head: empId })
            .catch(err => console.error('Failed to update department head', err?.response?.data?.message || err.message));
        }
      }

      onClose();
    } catch (err) {
      console.error('Employee save error:', err);
      const code = err?.response?.data?.error;
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to save employee';
      if (code === 'salary_structure_required') {
        showToast('error', 'Salary structure required', 'Add Basic, HRA, Allowances, Deductions and CTC (Salary Structure or Compensation) before activating the employee. Go to Compensation / Salary Structure for this employee.');
      } else if (code === 'USER_LIMIT_REACHED' || code === 'limit_reached') {
        showToast('error', 'User limit reached', errorMsg, 5);
      } else {
        showToast('error', 'Error', errorMsg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const uploadFile = async (file) => {
        if (!file || !(file instanceof File)) return null;
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await api.post('/uploads/doc', fd);
          return res?.data?.success ? res.data.url : null;
        } catch (e) { console.warn('File upload failed', e); return null; }
      };

      // Bank Proof
      let currentBankProofUrl = employee?.bankDetails?.bankProofUrl;
      if (currentBankProof && currentBankProof instanceof File) {
        currentBankProofUrl = await uploadFile(currentBankProof) || currentBankProofUrl;
      } else if (typeof currentBankProof === 'string') {
        const trimmed = currentBankProof.trim();
        if (trimmed === '') currentBankProofUrl = '';
        else currentBankProofUrl = trimmed;
      }

      // Profile Pic
      let profilePicUrl = employee?.profilePic;
      if (profilePic && profilePic instanceof File) {
        profilePicUrl = await uploadFile(profilePic) || profilePicUrl;
      } else if (profilePic) { profilePicUrl = profilePic; }

      // Payslips
      let processedExperience = [];
      if (experience && experience.length > 0) {
        processedExperience = await Promise.all(experience.map(async (exp) => {
          let pSlips = [];
          if (exp.payslips && exp.payslips.length > 0) {
            for (const item of exp.payslips) {
              if (item instanceof File) {
                const u = await uploadFile(item);
                if (u) pSlips.push(u);
              } else if (typeof item === 'string') { pSlips.push(item); }
            }
          }
          return { ...exp, payslips: pSlips };
        }));
      }

      // Education
      let c10Url = employee?.education?.class10Marksheet;
      let c12Url = employee?.education?.class12Marksheet;
      let diplomaUrl = employee?.education?.diplomaCertificate;
      let bachelorUrl = employee?.education?.bachelorDegree;
      let masterUrl = employee?.education?.masterDegree;
      let ls1Url = employee?.education?.lastSem1Marksheet;
      let ls2Url = employee?.education?.lastSem2Marksheet;
      let ls3Url = employee?.education?.lastSem3Marksheet;

      if (class10Marksheet instanceof File) { c10Url = await uploadFile(class10Marksheet) || c10Url; }
      if (class12Marksheet instanceof File) { c12Url = await uploadFile(class12Marksheet) || c12Url; }
      if (diplomaCertificate instanceof File) { diplomaUrl = await uploadFile(diplomaCertificate) || diplomaUrl; }
      if (bachelorDegree instanceof File) { bachelorUrl = await uploadFile(bachelorDegree) || bachelorUrl; }
      if (masterDegree instanceof File) { masterUrl = await uploadFile(masterDegree) || masterUrl; }

      if (lastSem1 instanceof File) { ls1Url = await uploadFile(lastSem1) || ls1Url; }
      if (lastSem2 instanceof File) { ls2Url = await uploadFile(lastSem2) || ls2Url; }
      if (lastSem3 instanceof File) { ls3Url = await uploadFile(lastSem3) || ls3Url; }

      let aadharFrontUrl = employee?.documents?.aadharFront;
      let aadharBackUrl = employee?.documents?.aadharBack;
      let panUrl = employee?.documents?.panCard;
      if (aadharFront instanceof File) { aadharFrontUrl = await uploadFile(aadharFront) || aadharFrontUrl; }
      if (aadharBack instanceof File) { aadharBackUrl = await uploadFile(aadharBack) || aadharBackUrl; }
      if (panCard instanceof File) { panUrl = await uploadFile(panCard) || panUrl; }

      const processedJobHistoryDraft = await Promise.all(jobHistoryAnnexure.map(async (j) => {
        let organogramUrl = typeof j.organogram === 'string' ? j.organogram : null;
        if (j.organogram instanceof File) organogramUrl = await uploadFile(j.organogram) || organogramUrl;
        return {
          companyName: j.companyName || undefined,
          turnoverRs: j.turnoverRs || undefined,
          totalEmployees: j.totalEmployees || undefined,
          industry: j.industry || undefined,
          designation: j.designation || undefined,
          dutiesResponsibilities: j.dutiesResponsibilities || undefined,
          organogramUrl: organogramUrl || undefined
        };
      }));
      const resolvedDepartment = await ensureDepartmentForSave();

      const payload = {
        employeeId: generationMode === 'MANUAL' ? (employeeId || undefined) : undefined,
        firstName, middleName, lastName, firstNameCapital,
        gender: gender || undefined,
        dob: dob || undefined,
        contactNo: contactNo || undefined,
        email: email || undefined,
        password: password || undefined,
        maritalStatus: maritalStatus || undefined,
        bloodGroup: bloodGroup || undefined,
        nationality: nationality || undefined,
        placeOfBirth: placeOfBirth || undefined,
        hobbies: hobbies || undefined,
        height: height || undefined,
        weight: weight || undefined,
        cast: cast || undefined,
        physicalDisabilityOrSickness: physicalDisabilityOrSickness || undefined,
        physicalDisabilityDetails: physicalDisabilityOrSickness === 'yes' ? (physicalDisabilityDetails || undefined) : undefined,
        fatherName: (fatherFirstName || fatherLastName) ? [fatherFirstName, fatherLastName].filter(Boolean).join(' ') : fatherName || undefined,
        fatherFirstName: fatherFirstName || undefined,
        fatherLastName: fatherLastName || undefined,
        fatherBloodGroup: fatherBloodGroup || undefined,
        fatherAadhaar: fatherAadhaar || undefined,
        motherName: (motherFirstName || motherLastName) ? [motherFirstName, motherLastName].filter(Boolean).join(' ') : motherName || undefined,
        motherFirstName: motherFirstName || undefined,
        motherLastName: motherLastName || undefined,
        motherBloodGroup: motherBloodGroup || undefined,
        motherAadhaar: motherAadhaar || undefined,
        fatherCustomFields: fatherCustomFields || [],
        motherCustomFields: motherCustomFields || [],
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactNumber: emergencyContactNumber || undefined,
        customFields: customFields || [],
        tempAddress, permAddress: sameAsTemp ? tempAddress : permAddress, commAddress: commSameAsTemp ? tempAddress : commAddress,
        experience: processedExperience,
        employeeType: jobType || undefined,
        bankDetails: { bankName, accountNumber, ifsc, branchName, location: bankLocation, bankProofUrl: currentBankProofUrl },
        education: {
          type: eduType || undefined,
          class10Marksheet: c10Url,
          class12Marksheet: c12Url,
          diplomaCertificate: diplomaUrl,
          bachelorDegree: bachelorUrl,
          masterDegree: masterUrl,
          lastSem1Marksheet: ls1Url,
          lastSem2Marksheet: ls2Url,
          lastSem3Marksheet: ls3Url
        },
        documents: {
          aadharFront: aadharFrontUrl,
          aadharBack: aadharBackUrl,
          aadharNumber,
          panCard: panUrl,
          panNumber
        },
        role,
        department: resolvedDepartment.department || undefined,
        departmentId: resolvedDepartment.departmentId || undefined,
        manager: manager || undefined, joiningDate: joiningDate || undefined,
        profilePic: profilePicUrl,
        status: 'Draft',
        lastStep: step,
        leavePolicy: leavePolicy || undefined, // Add Leave Policy
        shiftId: shiftId || undefined, // Shift assignment
        gradeId: gradeId || undefined, // Grade assignment
        grade: grade || undefined, // Custom Grade Name
        band: band || undefined, // Band assignment
        salaryTemplateId: salaryTemplateId || undefined,
        payrollTemplateId: salaryTemplateId || undefined,
        spouseDetails: showDependents ? spouseDetails : undefined,
        children: showDependents ? children : [],
        brothers: showDependents ? brothers : [],
        sisters: showDependents ? sisters : [],
        languages: languages,
        previousInterview: previousInterview || undefined,
        ...(previousInterview === 'yes' && {
          previousInterviewDate: previousInterviewDate || undefined,
          previousInterviewDeptLocation: previousInterviewDeptLocation || undefined,
          previousInterviewedBy: previousInterviewedBy || undefined
        }),
        perquisites: perquisites,
        relatedEmployee: relatedEmployee.hasRelated === 'yes' ? relatedEmployee : undefined,
        references: references,
        jobHistoryAnnexure: processedJobHistoryDraft
      };

      let draftResponse;
      if (employee?._id) {
        draftResponse = await api.put(`/hr/employees/${employee._id}`, payload);
      } else {
        draftResponse = await api.post('/hr/employees', payload);
      }
      const savedDraft = draftResponse?.data?.data || draftResponse?.data || null;
      showToast('success', 'Success', 'Draft saved successfully!');
      if (savedDraft && onDraftSaved) {
        onDraftSaved(savedDraft);
      }
    } catch (err) {
      console.error("Failed to save draft", err);
      showToast('error', 'Error', "Failed to save draft: " + (err.response?.data?.message || err.message));
    } finally { setSaving(false); }
  }

  const stepTitles = ['General Details', 'Official Records', 'Education', 'Identity Documents', 'Experience / Training', 'Bank Details', 'Languages & Interview', 'References & Related', 'Other Perquisites', 'Security'];

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-white">
      <div className="w-full flex-1 flex flex-col overflow-hidden">
        <form onSubmit={submit} className="w-full relative flex flex-col h-full overflow-hidden px-4 md:px-8">
          {/* Employee Onboarding Header */}
          <div className="mb-3 pt-1.5 sticky top-0 bg-white z-30">
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="hidden sm:block text-[10px] md:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest whitespace-nowrap">
                {stepTitles[step - 1]}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 relative overflow-hidden">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(step / stepTitles.length) * 100}%` }}
                ></div>
              </div>
              <div className="text-[10px] md:text-xs font-bold text-slate-900 whitespace-nowrap">
                Step {step} of {stepTitles.length}
              </div>
            </div>
          </div>

          {employee?.status === 'Draft' && (
            <div className="mb-6 px-6 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Draft Mode: Resuming from Step {step}
            </div>
          )}

          {/* Content area gets bottom padding so bar never overlaps */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar pb-10">
            {/* Step 1: Consolidated layout (Identity, Family, Communication, Official) */}
            {step === 1 && (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="space-y-3">
                  {/* Identity Details Section */}
                  <div className="pt-2 sticky top-[-1px] bg-white z-20 pb-2">
                    <div className="flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
                      <User size={20} />
                      <h3 className="text-lg font-bold uppercase tracking-tight">Personal Details</h3>
                    </div>
                  </div>
                  <IdentityDetailsTab
                      backendUrl={BACKEND_URL}
                      profilePreview={profilePreview}
                      profilePic={profilePic}
                      setProfilePic={setProfilePic}
                      setProfilePreview={setProfilePreview}
                      profilePicRef={profilePicRef}
                      firstName={firstName}
                      setFirstName={setFirstName}
                      firstNameCapital={firstNameCapital}
                      setFirstNameCapital={setFirstNameCapital}
                      middleName={middleName}
                      setMiddleName={setMiddleName}
                      lastName={lastName}
                      setLastName={setLastName}
                      gender={gender}
                      setGender={setGender}
                      dob={dob}
                      setDob={setDob}
                      bloodGroup={bloodGroup}
                      setBloodGroup={setBloodGroup}
                      maritalStatus={maritalStatus}
                      setMaritalStatus={setMaritalStatus}
                      nationality={nationality}
                      setNationality={setNationality}
                      placeOfBirth={placeOfBirth}
                      setPlaceOfBirth={setPlaceOfBirth}
                      hobbies={hobbies}
                      setHobbies={setHobbies}
                      height={height}
                      setHeight={setHeight}
                      weight={weight}
                      setWeight={setWeight}
                      cast={cast}
                      setCast={setCast}
                      physicalDisabilityOrSickness={physicalDisabilityOrSickness}
                      setPhysicalDisabilityOrSickness={setPhysicalDisabilityOrSickness}
                      physicalDisabilityDetails={physicalDisabilityDetails}
                      setPhysicalDisabilityDetails={setPhysicalDisabilityDetails}
                      email={email}
                      setEmail={setEmail}
                      contactNo={contactNo}
                      setContactNo={setContactNo}
                      customFields={customFields}
                      setCustomFields={setCustomFields}
                      onAddGlobalField={onAddGlobalField}
                      errors={errors}
                      nationalities={NATIONALITIES}
                      emergencyContactName={emergencyContactName}
                      setEmergencyContactName={setEmergencyContactName}
                      emergencyContactNumber={emergencyContactNumber}
                      setEmergencyContactNumber={setEmergencyContactNumber}
                    />
                  </div>

                  {/* Family Background Section */}
                  <div className="space-y-3">
                    <div className="pt-6 sticky top-[-1px] bg-white z-20 pb-2">
                      <div className="flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
                        <Users size={20} />
                        <h3 className="text-lg font-bold uppercase tracking-tight">Family Details</h3>
                      </div>
                    </div>
                    <FamilyBackgroundTab
                      fatherName={fatherName}
                      setFatherName={setFatherName}
                      fatherFirstName={fatherFirstName}
                      setFatherFirstName={setFatherFirstName}
                      fatherLastName={fatherLastName}
                      setFatherLastName={setFatherLastName}
                      fatherBloodGroup={fatherBloodGroup}
                      setFatherBloodGroup={setFatherBloodGroup}
                      fatherAadhaar={fatherAadhaar}
                      setFatherAadhaar={setFatherAadhaar}
                      motherName={motherName}
                      setMotherName={setMotherName}
                      motherFirstName={motherFirstName}
                      setMotherFirstName={setMotherFirstName}
                      motherLastName={motherLastName}
                      setMotherLastName={setMotherLastName}
                      motherBloodGroup={motherBloodGroup}
                      setMotherBloodGroup={setMotherBloodGroup}
                      motherAadhaar={motherAadhaar}
                      setMotherAadhaar={setMotherAadhaar}
                      fatherCustomFields={fatherCustomFields}
                      setFatherCustomFields={setFatherCustomFields}
                      motherCustomFields={motherCustomFields}
                      setMotherCustomFields={setMotherCustomFields}
                      onAddGlobalField={onAddGlobalField}
                      maritalStatus={maritalStatus}
                      spouseDetails={spouseDetails}
                      setSpouseDetails={setSpouseDetails}
                      children={children}
                      setChildren={setChildren}
                      brothers={brothers}
                      setBrothers={setBrothers}
                      sisters={sisters}
                      setSisters={setSisters}
                      showSpouse={showSpouse}
                      setShowSpouse={setShowSpouse}
                      errors={errors}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="pt-6 sticky top-[-1px] bg-white z-20 pb-2">
                      <div className="flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
                        <MapPin size={20} />
                        <h3 className="text-lg font-bold uppercase tracking-tight">Communication Details</h3>
                      </div>
                    </div>
                    <CommunicationTab
                      contactNo={contactNo}
                      setContactNo={setContactNo}
                      tempAddress={tempAddress}
                      setTempAddress={setTempAddress}
                      permAddress={permAddress}
                      setPermAddress={setPermAddress}
                      commAddress={commAddress}
                      setCommAddress={setCommAddress}
                      sameAsTemp={sameAsTemp}
                      setSameAsTemp={setSameAsTemp}
                      commSameAsTemp={commSameAsTemp}
                      setCommSameAsTemp={setCommSameAsTemp}
                      errors={errors}
                      pincodeLoading={pincodeLoading}
                      handlePincodeLookup={handlePincodeLookup}
                      handleCityLookup={handleCityLookup}
                    />
                  </div>
                </div>
              )}

            {/* Step 2: Official Records (moved from last page) */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                  <div className="pt-2 sticky top-[-1px] bg-white z-20 pb-2">
                    <div className="flex items-center gap-3 mb-1 relative z-10">
                      <div className="w-9 h-9 rounded-lg bg-[#1e293b]/10 flex items-center justify-center text-[#1e293b] shrink-0">
                        <FileCheck size={20} />
                      </div>
                      <h3 className="text-lg font-bold uppercase tracking-tight">Official Records</h3>
                    </div>
                  </div>
                  <div className="relative z-10">
                     <OfficialRecordsTab
                       employeeCode={employeeCode}
                       employeeId={employeeId}
                       setEmployeeId={setEmployeeId}
                       generationMode={generationMode}
                       jobType={jobType}
                       setJobType={setJobType}
                       employee={employee}
                       departmentId={departmentId}
                       setDepartmentId={setDepartmentId}
                       department={department}
                       setDepartment={setDepartment}
                       departments={departments}
                       departmentsLoading={departmentsLoading}
                       designations={designations}
                       assignmentPreview={assignmentPreview}
                       assignmentLoading={assignmentLoading}
                       assignmentError={assignmentError}
                       manager={manager}
                       setManager={setManager}
                       managers={managers}
                       joiningDate={joiningDate}
                       setJoiningDate={setJoiningDate}
                       shiftId={shiftId}
                       setShiftId={setShiftId}
                       shifts={shifts}
                       leavePolicy={leavePolicy}
                       setLeavePolicy={setLeavePolicy}
                       policies={policies}
                       gradeId={gradeId}
                       setGradeId={setGradeId}
                       grade={grade}
                       setGrade={setGrade}
                       band={band}
                       setBand={setBand}
                       grades={grades}
                       mappings={mappings}
                       contactNo={contactNo}
                       setContactNo={setContactNo}
                       errors={errors}
                     />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Experience / Training */}
            {step === 5 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <div className="flex items-center gap-3 border-l-[3px] border-[#1e293b] pl-3">
                    <div className="w-9 h-9 rounded-lg bg-[#1e293b]/10 flex items-center justify-center text-[#1e293b]">
                      <Briefcase size={18} />
                    </div>
                    <div className="flex items-center">
                      <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Professional History</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setTrainingEntries([...trainingEntries, { companyName: '', from: '', to: '', lastDrawnSalary: '', reason: '', reportingPersonName: '', reportingPersonEmail: '', reportingPersonPhone: '', payslips: [], chequebook: null }])}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#0D9488] shadow-md active:scale-95 transition-all"
                    >
                      <GraduationCap size={20} />
                      Training
                    </button>
                    <button
                      type="button"
                      onClick={() => setExperience([...experience, { companyName: '', from: '', to: '', lastDrawnSalary: '', reason: '', reportingPersonName: '', reportingPersonEmail: '', reportingPersonPhone: '', payslips: [], chequebook: null }])}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#0D9488] shadow-md active:scale-95 transition-all"
                    >
                      <Plus size={20} />
                      Add Entry
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {experience.map((exp, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative group/card">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-[9px] font-black text-slate-500">
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Entry #{idx + 1}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExperience(experience.filter((_, i) => i !== idx))}
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2 flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Organization Name <span className="text-rose-500">*</span></label>
                            <input value={exp.companyName} onChange={e => { const copy = [...experience]; copy[idx].companyName = e.target.value; setExperience(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" placeholder="Former employer" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Service Start</label>
                            <input type="date" value={exp.from} onChange={e => { const copy = [...experience]; copy[idx].from = e.target.value; setExperience(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Service End</label>
                            <input type="date" value={exp.to} onChange={e => { const copy = [...experience]; copy[idx].to = e.target.value; setExperience(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" />
                          </div>
                          <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Last Annual Compensation</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                                  <IndianRupee size={20} />
                                </div>
                                <input type="number" value={exp.lastDrawnSalary} onChange={e => { const copy = [...experience]; copy[idx].lastDrawnSalary = e.target.value; setExperience(copy); }} className="w-full pl-8 pr-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" placeholder="0.00" />
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Reason</label>
                              <input value={exp.reason ?? ''} onChange={e => { const copy = [...experience]; copy[idx].reason = e.target.value; setExperience(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" placeholder="e.g. Reason for leaving" />
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-2 space-y-2.5">
                          <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Direct Reporting Contact</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input value={exp.reportingPersonName} onChange={e => { const copy = [...experience]; copy[idx].reportingPersonName = e.target.value; setExperience(copy); }} className="w-full px-2.5 py-2 h-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-700 outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]/30 transition-colors" placeholder="Manager Name" />
                              <input value={exp.reportingPersonEmail} onChange={e => { const copy = [...experience]; copy[idx].reportingPersonEmail = e.target.value; setExperience(copy); }} className="w-full px-2.5 py-2 h-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-700 outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]/30 transition-colors" placeholder="Manager Email" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Historical Payslips (Last 3)</label>
                              <div className="flex gap-1.5">
                                {[0, 1, 2].map(i => (
                                  <label key={i} className={`flex-1 flex items-center justify-center aspect-square min-w-0 border-2 border-dashed rounded-lg cursor-pointer transition-all ${exp.payslips && exp.payslips[i] ? 'bg-indigo-50 border-indigo-500/20 text-[#1e293b]' : 'bg-white border-slate-100 text-slate-300 hover:border-indigo-300'}`}>
                                    {exp.payslips && exp.payslips[i] ? <Check size={20} /> : <Upload size={20} />}
                                    <input type="file" className="hidden" onChange={e => { const copy = [...experience]; if (!copy[idx].payslips) copy[idx].payslips = []; copy[idx].payslips[i] = e.target.files[0]; setExperience(copy); }} />
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Experience Letter</label>
                              <label className={`flex flex-col items-center justify-center py-2 px-2 border-2 border-dashed rounded-lg cursor-pointer transition-all min-h-[36px] ${exp.chequebook ? 'bg-indigo-50 border-indigo-500/20 text-[#1e293b]' : 'bg-white border-slate-100 text-slate-300 hover:border-indigo-300'}`}>
                                <div className="flex items-center gap-1.5">
                                  {exp.chequebook ? <CheckCircle size={20} /> : <Upload size={20} />}
                                  <span className="text-[9px] font-black uppercase tracking-tighter">{exp.chequebook ? 'Uploaded' : 'Upload PDF'}</span>
                                </div>
                                <input type="file" className="hidden" onChange={e => { const copy = [...experience]; copy[idx].chequebook = e.target.files[0]; setExperience(copy); }} />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {errors[`exp_${idx}`] && (
                        <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded-lg text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertCircle size={20} /> {errors[`exp_${idx}`]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Training entries (optional – same fields, no validation) */}
                {trainingEntries.length > 0 && (
                  <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-[#1e293b]">
                        <GraduationCap size={16} />
                      </div>
                      <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Training (Optional)</h3>
                    </div>
                    <div className="space-y-3">
                      {trainingEntries.map((tr, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative group/card">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-[9px] font-black text-slate-900">
                                {String(idx + 1).padStart(2, '0')}
                              </div>
                              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Training #{idx + 1}</h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTrainingEntries(trainingEntries.filter((_, i) => i !== idx))}
                              className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="md:col-span-2 flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Organization / Institution (Optional)</label>
                                <input value={tr.companyName} onChange={e => { const copy = [...trainingEntries]; copy[idx].companyName = e.target.value; setTrainingEntries(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" placeholder="Training provider" />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">From (Optional)</label>
                                <input type="date" value={tr.from} onChange={e => { const copy = [...trainingEntries]; copy[idx].from = e.target.value; setTrainingEntries(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">To (Optional)</label>
                                <input type="date" value={tr.to} onChange={e => { const copy = [...trainingEntries]; copy[idx].to = e.target.value; setTrainingEntries(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" />
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Last Annual Compensation (Optional)</label>
                                  <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                                      <IndianRupee size={20} />
                                    </div>
                                    <input type="number" value={tr.lastDrawnSalary} onChange={e => { const copy = [...trainingEntries]; copy[idx].lastDrawnSalary = e.target.value; setTrainingEntries(copy); }} className="w-full pl-8 pr-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" placeholder="0.00" />
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Reason (Optional)</label>
                                  <input value={tr.reason ?? ''} onChange={e => { const copy = [...trainingEntries]; copy[idx].reason = e.target.value; setTrainingEntries(copy); }} className="w-full px-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#1e293b] transition-all text-xs font-bold text-slate-700" placeholder="e.g. Reason for leaving" />
                                </div>
                              </div>
                            </div>

                            <div className="lg:col-span-2 space-y-2.5">
                              <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Direct Reporting Contact (Optional)</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input value={tr.reportingPersonName} onChange={e => { const copy = [...trainingEntries]; copy[idx].reportingPersonName = e.target.value; setTrainingEntries(copy); }} className="w-full px-2.5 py-2 h-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-700 outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]/30 transition-colors" placeholder="Manager Name" />
                                  <input value={tr.reportingPersonEmail} onChange={e => { const copy = [...trainingEntries]; copy[idx].reportingPersonEmail = e.target.value; setTrainingEntries(copy); }} className="w-full px-2.5 py-2 h-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-700 outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]/30 transition-colors" placeholder="Manager Email" />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Payslips / Proofs (Optional)</label>
                                  <div className="flex gap-1.5">
                                    {[0, 1, 2].map(i => (
                                      <label key={i} className={`flex-1 flex items-center justify-center aspect-square min-w-0 border-2 border-dashed rounded-lg cursor-pointer transition-all ${tr.payslips && tr.payslips[i] ? 'bg-indigo-50 border-indigo-500/20 text-[#1e293b]' : 'bg-white border-slate-100 text-slate-300 hover:border-indigo-300'}`}>
                                        {tr.payslips && tr.payslips[i] ? <Check size={20} /> : <Upload size={20} />}
                                        <input type="file" className="hidden" onChange={e => { const copy = [...trainingEntries]; if (!copy[idx].payslips) copy[idx].payslips = []; copy[idx].payslips[i] = e.target.files[0]; setTrainingEntries(copy); }} />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Certificate / Letter (Optional)</label>
                                  <label className={`flex flex-col items-center justify-center py-2 px-2 border-2 border-dashed rounded-lg cursor-pointer transition-all min-h-[36px] ${tr.chequebook ? 'bg-indigo-50 border-indigo-500/20 text-[#1e293b]' : 'bg-white border-slate-100 text-slate-300 hover:border-indigo-300'}`}>
                                    <div className="flex items-center gap-1.5">
                                      {tr.chequebook ? <CheckCircle size={20} /> : <Upload size={20} />}
                                      <span className="text-[9px] font-black uppercase tracking-tighter">{tr.chequebook ? 'Uploaded' : 'Upload PDF'}</span>
                                    </div>
                                    <input type="file" className="hidden" onChange={e => { const copy = [...trainingEntries]; copy[idx].chequebook = e.target.files[0]; setTrainingEntries(copy); }} />
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Education (Academic Timeline) */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-950 px-4 py-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">


                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 relative z-10">
                    <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Academic Timeline</h3>
                    </div>

                    <div className="flex p-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {['Regular', 'Diploma'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEduType(type)}
                          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-2.5 ${eduType === type ? 'bg-[#1e293b] text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                          {type === 'Regular' ? <GraduationCap size={20} /> : <FileText size={20} />}
                          {type} Track
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Document Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))] gap-2 lg:gap-3 relative z-10 w-full min-w-0 items-start">
                    <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
                      <label className="min-h-[20px] flex items-center text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 truncate">Primary Foundation (10th) <span className="text-rose-500">*</span></label>
                      <label className={`relative group/edu border-2 border-dashed rounded-lg p-2 transition-all duration-500 cursor-pointer min-w-0 ${class10Marksheet ? 'border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/5' : 'border-slate-100 dark:border-slate-800 hover:border-[#1e293b]/40 hover:bg-transparent dark:hover:bg-slate-900/50'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-500 ${class10Marksheet ? 'bg-[#1e293b] text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}>
                            {class10Marksheet ? <FileCheck size={20} /> : <Upload size={20} />}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className={`text-[10px] font-black uppercase tracking-tight truncate ${class10Marksheet ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                              {class10Marksheet ? (class10Marksheet instanceof File ? class10Marksheet.name : '10th') : '10th Marksheet'}
                            </p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Foundation</p>
                          </div>
                        </div>
                        <input ref={c10Ref} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setClass10Marksheet(e.target.files[0])} />
                      </label>
                      {errors.class10 && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest flex items-center gap-1"><AlertCircle size={10} /> {errors.class10}</div>}
                    </div>

                    {eduType === 'Diploma' ? (
                      <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
                        <label className="min-h-[20px] flex items-center text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 truncate">Diploma Proficiency <span className="text-rose-500">*</span></label>
                        <label className={`relative group/edu border-2 border-dashed rounded-lg p-2 transition-all duration-500 cursor-pointer min-w-0 ${diplomaCertificate ? 'border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/5' : 'border-slate-100 dark:border-slate-800 hover:border-[#1e293b]/40 hover:bg-transparent dark:hover:bg-slate-900/50'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-500 ${diplomaCertificate ? 'bg-[#1e293b] text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}>
                              {diplomaCertificate ? <ShieldCheck size={20} /> : <Upload size={20} />}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`text-[10px] font-black uppercase tracking-tight truncate ${diplomaCertificate ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                {diplomaCertificate ? (diplomaCertificate instanceof File ? diplomaCertificate.name : 'Diploma') : 'Diploma Cert'}
                              </p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Specialized</p>
                            </div>
                          </div>
                          <input ref={diplomaRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setDiplomaCertificate(e.target.files[0])} />
                        </label>
                        {errors.diploma && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest flex items-center gap-1"><AlertCircle size={10} /> {errors.diploma}</div>}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
                        <label className="min-h-[20px] flex items-center text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 truncate">Secondary (12th) <span className="text-rose-500">*</span></label>
                        <label className={`relative group/edu border-2 border-dashed rounded-lg p-2 transition-all duration-500 cursor-pointer min-w-0 ${class12Marksheet ? 'border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/5' : 'border-slate-100 dark:border-slate-800 hover:border-[#1e293b]/40 hover:bg-transparent dark:hover:bg-slate-900/50'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-500 ${class12Marksheet ? 'bg-[#1e293b] text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}>
                              {class12Marksheet ? <BookOpen size={20} /> : <Upload size={20} />}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`text-[10px] font-black uppercase tracking-tight truncate ${class12Marksheet ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                {class12Marksheet ? (class12Marksheet instanceof File ? class12Marksheet.name : '12th') : '12th Marksheet'}
                              </p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Academic Core</p>
                            </div>
                          </div>
                          <input ref={c12Ref} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setClass12Marksheet(e.target.files[0])} />
                        </label>
                        {errors.class12 && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest flex items-center gap-1"><AlertCircle size={10} /> {errors.class12}</div>}
                      </div>
                    )}

                    {eduType !== 'Diploma' && (
                      <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
                        <label className="min-h-[20px] flex items-center text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 truncate">Bachelor / Undergrad <span className="text-rose-500">*</span></label>
                        <label className={`relative group/edu border-2 border-dashed rounded-lg p-2 transition-all duration-500 cursor-pointer min-w-0 ${bachelorDegree ? 'border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/5' : 'border-slate-100 dark:border-slate-800 hover:border-[#1e293b]/40 hover:bg-transparent dark:hover:bg-slate-900/50'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-500 ${bachelorDegree ? 'bg-[#1e293b] text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}>
                              {bachelorDegree ? <Award size={20} /> : <Upload size={20} />}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`text-[10px] font-black uppercase tracking-tight truncate ${bachelorDegree ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                {bachelorDegree ? (bachelorDegree instanceof File ? bachelorDegree.name : 'Bachelor') : 'Bachelor'}
                              </p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Professional</p>
                            </div>
                          </div>
                          <input ref={bachelorRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setBachelorDegree(e.target.files[0])} />
                        </label>
                        {errors.bachelor && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest flex items-center gap-1"><AlertCircle size={10} /> {errors.bachelor}</div>}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 min-w-0 max-w-full mt-[3px]">
                      <label className="min-h-[20px] flex items-center text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 truncate">Post Graduate (Optional)</label>
                      <label className={`relative group/edu border-2 border-dashed rounded-lg p-2 transition-all duration-500 cursor-pointer min-w-0 ${masterDegree ? 'border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/5' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 hover:bg-transparent dark:hover:bg-slate-900/50'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-500 ${masterDegree ? 'bg-[#1e293b] text-white shadow-xl shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}>
                            {masterDegree ? <Briefcase size={20} /> : <Upload size={20} />}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className={`text-[10px] font-black uppercase tracking-tight truncate ${masterDegree ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                              {masterDegree ? (masterDegree instanceof File ? masterDegree.name : 'Masters') : 'Master Degree'}
                            </p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Advanced</p>
                          </div>
                        </div>
                        <input ref={masterRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setMasterDegree(e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Supplementary Verification */}
                  <div className="mt-2 pt-2 relative z-10">
                    <div className="flex items-center justify-end gap-4 mb-2">
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={20} className="text-indigo-500" /> Use if main degree is pending
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { state: lastSem1, setter: setLastSem1, ref: ls1Ref, label: 'Semester 01' },
                        { state: lastSem2, setter: setLastSem2, ref: ls2Ref, label: 'Semester 02' },
                        { state: lastSem3, setter: setLastSem3, ref: ls3Ref, label: 'Semester 03' },
                      ].map((sem, i) => (
                        <div key={i} className="flex flex-col gap-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{sem.label} Transcript</label>
                          <label className={`relative group/sem flex items-center gap-4 p-4 border rounded-2xl transition-all duration-300 cursor-pointer ${sem.state ? 'bg-white dark:bg-slate-900 border-[#1e293b]/20' : 'bg-slate-50 dark:bg-slate-950/20 border-transparent hover:border-slate-200 dark:hover:border-slate-800 shadow-inner'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${sem.state ? 'bg-[#1e293b] text-white' : 'bg-white dark:bg-slate-900 text-slate-300 shadow-sm'}`}>
                              {sem.state ? <Check size={18} /> : <FileUp size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-black uppercase truncate ${sem.state ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                {sem.state ? (sem.state instanceof File ? sem.state.name : 'Uploaded') : 'Upload PDF'}
                              </p>
                            </div>
                            <input ref={sem.ref} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => sem.setter(e.target.files[0])} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Bank Details */}
            {step === 6 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Bank Repository Section */}
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center gap-3 mb-4 border-l-[3px] border-emerald-500 pl-3 relative z-10">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Bank Repository</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[repeat(4,minmax(0,1fr))] gap-2 relative z-10 items-start">
                    <div className="flex flex-col gap-1 min-w-0">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 whitespace-nowrap truncate">Bank Name <span className="text-rose-500">*</span></label>
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-emerald-500 transition-colors">
                          <Landmark size={20} />
                        </div>
                        <input value={bankName} onChange={e => setBankName(e.target.value)} className={`w-full pl-9 pr-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border rounded-lg outline-none transition-all text-xs font-bold text-slate-700 dark:text-slate-200 ${errors.bankName ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} placeholder="Ex. HDFC Bank, SBI" />
                      </div>
                      {errors.bankName && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest mt-0.5">{errors.bankName}</div>}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 whitespace-nowrap truncate">IFSC Code <span className="text-rose-500">*</span></label>
                      <div className="relative group/ifsc">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within/ifsc:text-emerald-500 transition-colors">
                          <ShieldCheck size={20} />
                        </div>
                        <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} onBlur={() => handleIfscLookup(ifsc)} className={`w-full pl-9 pr-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border rounded-lg outline-none transition-all text-xs font-bold text-slate-700 dark:text-slate-200 ${errors.ifsc ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} placeholder="Ex. HDFC0001234" />
                        {ifscLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-500 animate-pulse uppercase">Validating...</div>}
                      </div>
                      {errors.ifsc && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest mt-0.5">{errors.ifsc}</div>}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 whitespace-nowrap truncate">Account Number <span className="text-rose-500">*</span></label>
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-emerald-500 transition-colors">
                          <Hash size={20} />
                        </div>
                        <input 
                          type="text"
                          maxLength={12}
                          value={accountNumber} 
                          onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} 
                          className={`w-full pl-9 pr-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border rounded-lg outline-none transition-all text-xs font-bold text-slate-700 dark:text-slate-200 ${errors.accountNumber ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} 
                          placeholder="Standard 12-digit account number" 
                        />
                      </div>
                      {errors.accountNumber && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest mt-0.5">{errors.accountNumber}</div>}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0 mt-[10px]">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 whitespace-nowrap truncate">Branch Location</label>
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-emerald-500 transition-colors">
                          <MapPin size={20} />
                        </div>
                        <input value={branchName} onChange={e => setBranchName(e.target.value)} className={`w-full pl-9 pr-3 py-2 h-9 bg-transparent dark:bg-slate-900/50 border rounded-lg outline-none transition-all text-xs font-bold text-slate-700 dark:text-slate-200 ${errors.branchName ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} placeholder="Main Branch, New York" />
                      </div>
                      {errors.branchName && <div className="text-[8px] font-bold text-rose-500 px-1 uppercase tracking-widest mt-0.5">{errors.branchName}</div>}
                    </div>
                  </div>

                  {/* Secure Document Vault - compact upload passbook */}
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 relative z-10">
                    <div className="mb-3" />
                    <div className="grid grid-cols-1 gap-4">
                      <div className="w-full">
                        {currentBankProof ? (
                          <div className="flex items-center justify-between w-full h-16 border-2 border-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-950/20 rounded-xl px-4 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <FileCheck size={16} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[200px] md:max-w-none">
                                  {currentBankProof instanceof File ? currentBankProof.name : 'Stored Document'}
                                </p>
                                <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Uploaded Successfully</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!(currentBankProof instanceof File) && (
                                <a 
                                  href={String(currentBankProof).startsWith('http') ? currentBankProof : `${BACKEND_URL}${currentBankProof}`} 
                                  target="_blank" 
                                  className="px-3 h-8 bg-white dark:bg-slate-800 text-slate-500 hover:text-emerald-500 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-1.5 transition-all text-[8px] font-black uppercase tracking-widest"
                                >
                                  <Search size={20} /> View
                                </a>
                              )}
                              <button 
                                type="button" 
                                onClick={() => { setCurrentBankProof(null); if (bankProofRef.current) bankProofRef.current.value = ''; }} 
                                className="px-3 h-8 bg-rose-500 text-white rounded-lg flex items-center gap-1.5 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 text-[8px] font-black uppercase tracking-widest"
                              >
                                <Trash2 size={20} /> Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-200 dark:border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-50/30 dark:bg-slate-900/10 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 hover:border-emerald-500/50 transition-all group/upload">
                            <div className="flex flex-col items-center justify-center py-1 text-center">
                              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 group-hover/upload:text-emerald-500 transition-colors mb-0.5">
                                <Upload size={16} />
                              </div>
                              <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight leading-none">Drop Cheque or Passbook</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Max 5MB (PDF, PNG, JPG)</p>
                            </div>
                            <input ref={bankProofRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setCurrentBankProof(e.target.files[0])} />
                          </label>
                        )}
                        {errors.bankProof && <div className="text-[8px] font-bold text-rose-500 px-2 mt-2 uppercase tracking-widest flex items-center gap-1"><AlertCircle size={20} /> {errors.bankProof}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Step 4: Identity Documents */}
            {step === 4 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Primary Identity Section - professional compact */}
                <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 border-l-[3px] border-[#1e293b] pl-2.5 relative z-10">
                    <div className="w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-[#1e293b] shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">Identity Authentication</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 relative z-10">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1">Aadhar Number <span className="text-rose-500">*</span></label>
                      <div className="relative group/num">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300 group-focus-within/num:text-[#1e293b] transition-colors">
                          <Fingerprint size={16} />
                        </div>
                        <input
                          type="text"
                          maxLength={12}
                          value={aadharNumber}
                          onChange={(e) => setAadharNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          required
                          className={`w-full h-10 pl-10 pr-4 bg-transparent border-2 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-200 transition-all ${errors.aadharNumber ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-[#1e293b]'}`}
                          placeholder="XXXX XXXX XXXX"
                        />
                      </div>
                      {errors.aadharNumber && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-0.5">{errors.aadharNumber}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1">PAN Number <span className="text-rose-500">*</span></label>
                      <div className="relative group/num">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300 group-focus-within/num:text-[#1e293b] transition-colors">
                          <Shield size={16} />
                        </div>
                        <input
                          type="text"
                          maxLength={10}
                          value={panNumber}
                          onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                          required
                          className={`w-full h-10 pl-10 pr-4 bg-transparent border-2 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-200 transition-all ${errors.panNumber ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-[#1e293b]'}`}
                          placeholder="ABCDE1234F"
                        />
                      </div>
                      {errors.panNumber && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest pl-1 mt-0.5">{errors.panNumber}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
                    {[
                      { label: 'Aadhar Card (Front)', state: aadharFront, setter: setAadharFront, ref: aadharFrontRef, icon: <Fingerprint size={16} />, id: 'aadharFront' },
                      { label: 'Aadhar Card (Back)', state: aadharBack, setter: setAadharBack, ref: aadharBackRef, icon: <Fingerprint size={16} />, id: 'aadharBack' },
                      { label: 'PAN Card (Front)', state: panCard, setter: setPanCard, ref: panRef, icon: <Shield size={16} />, id: 'panCard' },
                    ].map((doc, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <label className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{doc.label} <span className="text-rose-500">*</span></label>
                        <div className={`relative group/doc border border-dashed rounded-lg p-2 min-h-[72px] flex flex-col transition-all duration-200 ${doc.state ? 'border-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/5' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:bg-transparent dark:hover:bg-slate-900/50'}`}>
                          {doc.state ? (
                            <div className="flex flex-col h-full min-h-[52px] justify-center">
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 truncate flex-1">{doc.state instanceof File ? doc.state.name : 'Verified'}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {!(doc.state instanceof File) && (
                                    <a href={String(doc.state).startsWith('http') ? doc.state : `${BACKEND_URL}${doc.state}`} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors" title="View">
                                      <Search size={20} />
                                    </a>
                                  )}
                                  <button type="button" onClick={(e) => { e.stopPropagation(); doc.setter(null); if (doc.ref.current) doc.ref.current.value = ''; }} className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow hover:bg-rose-600 transition-colors" title="Remove">
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                                  <Check size={10} />
                                </div>
                                <span className="text-[9px] font-semibold text-slate-900 dark:text-white">Uploaded</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-center min-h-[52px]">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/doc:text-indigo-500 transition-colors mb-1">
                                {doc.icon}
                              </div>
                              <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Upload</p>
                            </div>
                          )}
                          <input ref={doc.ref} type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,application/pdf" onChange={e => doc.setter(e.target.files[0])} />
                        </div>
                        {errors[doc.id] && <div className="text-[7px] font-semibold text-rose-500 px-1 flex items-center gap-1"><AlertCircle size={9} /> {errors[doc.id]}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Languages & Interview */}
            {step === 7 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight mb-1 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-slate-900 dark:text-white shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </span>
                    Languages Known (Underline Mother-Tongue)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border-0">
                      <thead>
                        <tr className="bg-white dark:bg-slate-900/50">
                          <th className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-2 w-[200px]">Language</th>
                          <th className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-2 text-center w-24">Speak</th>
                          <th className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-2 text-center w-24">Read</th>
                          <th className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-2 text-center w-24">Write</th>
                          {languages.length > 3 ? <th className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-2 w-12"></th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {languages.map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5">
                              {idx < 3 ? (
                                <span className="px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">{row.name}</span>
                              ) : (
                                <input value={row.name} onChange={e => { const c = [...languages]; c[idx] = { ...c[idx], name: e.target.value }; setLanguages(c); }} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none bg-white dark:bg-slate-900" placeholder="Language" />
                              )}
                            </td>
                            <td className="p-1.5 text-center">
                              <input type="checkbox" checked={!!row.speak} onChange={e => { const c = [...languages]; c[idx] = { ...c[idx], speak: e.target.checked }; setLanguages(c); }} className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-indigo-500" />
                            </td>
                            <td className="p-1.5 text-center">
                              <input type="checkbox" checked={!!row.read} onChange={e => { const c = [...languages]; c[idx] = { ...c[idx], read: e.target.checked }; setLanguages(c); }} className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-indigo-500" />
                            </td>
                            <td className="p-1.5 text-center">
                              <input type="checkbox" checked={!!row.write} onChange={e => { const c = [...languages]; c[idx] = { ...c[idx], write: e.target.checked }; setLanguages(c); }} className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-indigo-500" />
                            </td>
                            {languages.length > 3 ? (
                              <td className="p-1 text-center">
                                {idx >= 3 ? (
                                  <button type="button" onClick={() => setLanguages(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-rose-500 rounded" title="Remove">
                                    <Minus className="w-4 h-4" />
                                  </button>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex justify-start">
                    <button type="button" onClick={() => setLanguages(prev => [...prev, { name: '', speak: false, read: false, write: false }])} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500 text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs font-semibold transition-colors">
                      <Plus className="w-4 h-4" /> Add language
                    </button>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-slate-900 dark:text-white shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                    </span>
                    Have you been previously interviewed in this organization?
                  </h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="previousInterview" checked={previousInterview === 'yes'} onChange={() => setPreviousInterview('yes')} className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="previousInterview" checked={previousInterview === 'no'} onChange={() => setPreviousInterview('no')} className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">No</span>
                    </label>
                  </div>
                  {previousInterview === 'yes' && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                        <input type="date" value={previousInterviewDate} onChange={e => setPreviousInterviewDate(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Department / Location</label>
                        <input type="text" value={previousInterviewDeptLocation} onChange={e => setPreviousInterviewDeptLocation(e.target.value)} placeholder="Dept or location" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Interviewed by</label>
                        <input type="text" value={previousInterviewedBy} onChange={e => setPreviousInterviewedBy(e.target.value)} placeholder="Name" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 8: References & Related */}
            {step === 8 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Related employee: Do you know or are you related to any employee of this company? */}
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3 border-l-[3px] border-indigo-500 pl-2">
                    Do you know or are you related to any employee of this organization? If yes, please provide details:
                  </p>
                  <div className="flex flex-wrap gap-4 items-center mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="hasRelated" checked={relatedEmployee.hasRelated === 'yes'} onChange={() => setRelatedEmployee(r => ({ ...r, hasRelated: 'yes' }))} className="w-4 h-4 text-slate-900" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="hasRelated" checked={relatedEmployee.hasRelated === 'no'} onChange={() => setRelatedEmployee(r => ({ ...r, hasRelated: 'no', name: '', designation: '', location: '', company: '', relationship: '', contactNumber: '' }))} className="w-4 h-4 text-slate-900" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">No</span>
                    </label>
                  </div>
                  {relatedEmployee.hasRelated === 'yes' && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-3 gap-2 min-w-0 md:grid-cols-6">
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Name</label>
                          <input type="text" value={relatedEmployee.name} onChange={e => setRelatedEmployee(r => ({ ...r, name: e.target.value }))} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Full name" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Designation</label>
                          <input type="text" value={relatedEmployee.designation} onChange={e => setRelatedEmployee(r => ({ ...r, designation: e.target.value }))} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Designation" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Location</label>
                          <input type="text" value={relatedEmployee.location} onChange={e => setRelatedEmployee(r => ({ ...r, location: e.target.value }))} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Location" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Company</label>
                          <input type="text" value={relatedEmployee.company} onChange={e => setRelatedEmployee(r => ({ ...r, company: e.target.value }))} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Company" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Relationship</label>
                          <input type="text" value={relatedEmployee.relationship} onChange={e => setRelatedEmployee(r => ({ ...r, relationship: e.target.value }))} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Relationship" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Contact Number</label>
                          <input
                            type="text"
                            maxLength={10}
                            value={relatedEmployee.contactNumber}
                            onChange={e => setRelatedEmployee(r => ({ ...r, contactNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                            className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                            placeholder="10-digit number"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Last two responsible people (References) */}
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white mb-4 border-l-[3px] border-indigo-500 pl-2">
                    Last two responsible people, not related to you, who can comment objectively on your career and capabilities
                  </p>
                  {[0, 1].map((idx) => (
                    <div key={idx} className={`rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${idx === 1 ? 'mt-4' : ''}`}>
                      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3">{idx + 1}.</h4>
                      <div className="grid grid-cols-3 gap-2 min-w-0 mb-2">
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Name</label>
                          <input type="text" value={references[idx]?.name ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], name: e.target.value }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Full name" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Company</label>
                          <input type="text" value={references[idx]?.company ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], company: e.target.value }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Company" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Designation / Occupation</label>
                          <input type="text" value={references[idx]?.designation ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], designation: e.target.value }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Designation / Occupation" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 min-w-0">
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Address</label>
                          <input type="text" value={references[idx]?.address ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], address: e.target.value }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="Address" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">E-mail</label>
                          <input type="email" value={references[idx]?.email ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], email: e.target.value }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="E-mail" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Phone</label>
                          <input type="tel" value={references[idx]?.phone ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], phone: e.target.value.replace(/\D/g, '') }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="e.g. 9876543210" maxLength={15} />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Period for which known</label>
                          <input type="text" value={references[idx]?.periodKnown ?? ''} onChange={e => { const n = [...references]; n[idx] = { ...n[idx], periodKnown: e.target.value }; setReferences(n); }} className="w-full min-w-0 h-[42px] px-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500" placeholder="e.g. 5 years" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 9: Other Perquisites */}
            {step === 9 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight mb-4 border-l-[3px] border-indigo-500 pl-2">OTHER PERQUISITES DETAILS</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-slate-200 dark:border-slate-700 text-sm">
                      <tbody className="text-slate-700 dark:text-slate-300">
                        {/* COMPANY'S CAR */}
                        <tr><td colSpan={4} className="border border-slate-200 dark:border-slate-700 p-2 font-semibold bg-white dark:bg-slate-800/50">COMPANY'S CAR</td></tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">i.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Model</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.companyCarModel} onChange={e => setPerquisites(p => ({ ...p, companyCarModel: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Car model" /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">ii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Any limit in mileage (K.m.)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.companyCarMileageKm} onChange={e => setPerquisites(p => ({ ...p, companyCarMileageKm: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="K.m." /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">iii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Petrol Consumption (Average Rs. per month)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.companyCarPetrolRsMonth} onChange={e => setPerquisites(p => ({ ...p, companyCarPetrolRsMonth: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Rs." /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        {/* COMPANY'S LEASED ACCOM. */}
                        <tr><td colSpan={4} className="border border-slate-200 dark:border-slate-700 p-2 font-semibold bg-white dark:bg-slate-800/50">COMPANY'S LEASED ACCOM.</td></tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">i.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Co.'s leased (Please specify)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.leasedAccomSpecify} onChange={e => setPerquisites(p => ({ ...p, leasedAccomSpecify: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Specify" /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">ii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Whether Flat stand in wife's name</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="leasedWife" checked={perquisites.leasedAccomFlatInWifeName === 'yes'} onChange={() => setPerquisites(p => ({ ...p, leasedAccomFlatInWifeName: 'yes' }))} className="w-3.5 h-3.5 text-slate-900" /> Yes</label>
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="leasedWife" checked={perquisites.leasedAccomFlatInWifeName === 'no'} onChange={() => setPerquisites(p => ({ ...p, leasedAccomFlatInWifeName: 'no' }))} className="w-3.5 h-3.5 text-slate-900" /> No</label>
                            </div>
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">iii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Monthly Rent (Rs.)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.leasedAccomMonthlyRentRs} onChange={e => setPerquisites(p => ({ ...p, leasedAccomMonthlyRentRs: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Rs." /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">iv.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Deposit amount (Rs.)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.leasedAccomDepositRs} onChange={e => setPerquisites(p => ({ ...p, leasedAccomDepositRs: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Rs." /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        {/* HARD FURNISHING */}
                        <tr><td colSpan={4} className="border border-slate-200 dark:border-slate-700 p-2 font-semibold bg-slate-50 dark:bg-slate-800/50">HARD FURNISHING</td></tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">i.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Kindly specify limits</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.hardFurnishingLimits} onChange={e => setPerquisites(p => ({ ...p, hardFurnishingLimits: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">ii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Whether limits annualised basis or some other period (please specify)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.hardFurnishingPeriod} onChange={e => setPerquisites(p => ({ ...p, hardFurnishingPeriod: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="e.g. Annual" /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">iii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">What would be the cost to the company on annual basis</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.hardFurnishingAnnualCostRs} onChange={e => setPerquisites(p => ({ ...p, hardFurnishingAnnualCostRs: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Rs." /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        {/* INCENTIVE IF ANY */}
                        <tr><td colSpan={4} className="border border-slate-200 dark:border-slate-700 p-2 font-semibold bg-slate-50 dark:bg-slate-800/50">INCENTIVE IF ANY</td></tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">i.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Give particulars in whatever form the same is received</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><textarea value={perquisites.incentiveParticulars} onChange={e => setPerquisites(p => ({ ...p, incentiveParticulars: e.target.value }))} rows={2} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm resize-y" placeholder="Particulars" /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">ii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">If these details are already covered above, please specify to avoid duplication</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><textarea value={perquisites.incentiveAvoidDuplication} onChange={e => setPerquisites(p => ({ ...p, incentiveAvoidDuplication: e.target.value }))} rows={2} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm resize-y" placeholder="Specify" /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        {/* TELEPHONE */}
                        <tr><td colSpan={4} className="border border-slate-200 dark:border-slate-700 p-2 font-semibold bg-slate-50 dark:bg-slate-800/50">TELEPHONE</td></tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">i.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Whether it is Company's or your personal</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="telType" checked={perquisites.telephoneCompanyOrPersonal === 'Company'} onChange={() => setPerquisites(p => ({ ...p, telephoneCompanyOrPersonal: 'Company' }))} className="w-3.5 h-3.5 text-slate-900" /> Company</label>
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="telType" checked={perquisites.telephoneCompanyOrPersonal === 'Personal'} onChange={() => setPerquisites(p => ({ ...p, telephoneCompanyOrPersonal: 'Personal' }))} className="w-3.5 h-3.5 text-slate-900" /> Personal</label>
                            </div>
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">ii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Is there any limit of reimbursement</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="telReimb" checked={perquisites.telephoneReimbursementLimit === 'yes'} onChange={() => setPerquisites(p => ({ ...p, telephoneReimbursementLimit: 'yes' }))} className="w-3.5 h-3.5 text-slate-900" /> Yes</label>
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="telReimb" checked={perquisites.telephoneReimbursementLimit === 'no'} onChange={() => setPerquisites(p => ({ ...p, telephoneReimbursementLimit: 'no' }))} className="w-3.5 h-3.5 text-slate-900" /> No</label>
                            </div>
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">iii.</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">If yes, please specify the amount</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.telephoneLimitAmountRs} onChange={e => setPerquisites(p => ({ ...p, telephoneLimitAmountRs: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Rs." disabled={perquisites.telephoneReimbursementLimit !== 'yes'} /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        {/* TAX AT SOURCE */}
                        <tr><td colSpan={4} className="border border-slate-200 dark:border-slate-700 p-2 font-semibold bg-slate-50 dark:bg-slate-800/50">TAX AT SOURCE (MONTHLY AS PER PAY SLIP)</td></tr>
                        <tr>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">-</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-2">Amount (Rs.)</td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={perquisites.taxAtSourceMonthlyRs} onChange={e => setPerquisites(p => ({ ...p, taxAtSourceMonthlyRs: e.target.value }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Rs." /></td>
                          <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" readOnly disabled /></td>
                        </tr>
                        {(perquisites.customFields || []).map((field, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-200 dark:border-slate-700 p-2">{idx + 1}.</td>
                            <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={field.label} onChange={e => setPerquisites(p => ({ ...p, customFields: p.customFields.map((f, i) => i === idx ? { ...f, label: e.target.value } : f) }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Field label" /></td>
                            <td className="border border-slate-200 dark:border-slate-700 p-1"><input type="text" value={field.value} onChange={e => setPerquisites(p => ({ ...p, customFields: p.customFields.map((f, i) => i === idx ? { ...f, value: e.target.value } : f) }))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Value" /></td>
                            <td className="border border-slate-200 dark:border-slate-700 p-1">
                              <div className="flex items-center gap-1">
                                <input type="text" value={field.remarks} onChange={e => setPerquisites(p => ({ ...p, customFields: p.customFields.map((f, i) => i === idx ? { ...f, remarks: e.target.value } : f) }))} className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Remarks" />
                                <button type="button" onClick={() => setPerquisites(p => ({ ...p, customFields: p.customFields.filter((_, i) => i !== idx) }))} className="p-1 text-slate-400 hover:text-rose-500 rounded shrink-0" title="Remove"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-start">
                    <button type="button" onClick={() => setPerquisites(p => ({ ...p, customFields: [...(p.customFields || []), { label: '', value: '', remarks: '' }] }))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500 text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs font-semibold transition-colors">
                      <Plus className="w-4 h-4" /> Add custom field
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 10: Account Credentials */}
            {step === 10 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Account Credentials - High Premium UI */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl relative overflow-hidden group/account">

                  
                  <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-slate-900 shrink-0 shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Security</h3>
                    </div>
                  </div>

                  {/* Credentials Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 font-outfit">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Mail size={20} className="text-indigo-400" />
                        Login Email ID <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative group/field shadow-sm rounded-xl">
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className={`w-full pl-5 pr-4 py-3 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none transition-all text-sm font-bold text-slate-700 dark:text-slate-200 ${errors.email ? 'border-rose-200' : 'border-slate-100 dark:border-slate-800'}`}
                          placeholder="e.g. john.doe@company.com"
                          disabled={viewOnly && step !== 9}
                        />
                      </div>
                      {errors.email && <div className="text-[9px] font-bold text-rose-500 px-1 flex items-center gap-1.5"><AlertCircle size={10} /> {errors.email}</div>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Lock size={20} className="text-indigo-400" />
                        Platform Access Key <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative group/field shadow-sm rounded-xl overflow-hidden">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={passwordLock ? "••••••••••••" : password}
                          onChange={e => !passwordLock && setPassword(e.target.value)}
                          onFocus={() => { if (passwordLock) setShowPasswordConfirm(true); }}
                          readOnly={passwordLock}
                          className={`w-full pl-5 pr-20 py-3 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none transition-all text-sm font-bold tracking-[0.2em] text-slate-700 dark:text-slate-200 ${errors.password ? 'border-rose-200' : 'border-slate-100 dark:border-slate-800'} ${passwordLock ? 'cursor-not-allowed bg-slate-100/50 dark:bg-slate-950/50' : ''}`}
                          placeholder={passwordLock ? "Password is hidden" : "Enter new password"}
                          disabled={viewOnly}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-1.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                          {!passwordLock && (
                            <button 
                              type="button" 
                              onClick={() => setShowPassword(!showPassword)} 
                              className="text-slate-400 hover:text-slate-900 transition-colors p-1.5 focus:outline-none"
                              title={showPassword ? "Hide" : "Show"}
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          )}
                          {passwordLock && !viewOnly && (
                            <button 
                              type="button" 
                              onClick={() => setShowPasswordConfirm(true)} 
                              className="text-indigo-500 hover:text-white hover:bg-indigo-600 transition-all p-1.5 rounded-md" 
                              title="Edit Password"
                            >
                              <Edit2 size={13} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                      {errors.password && <div className="text-[9px] font-bold text-rose-500 px-1 flex items-center gap-1.5"><AlertCircle size={10} /> {errors.password}</div>}
                    </div>
                  </div>

                  {/* Compensation & Salary Assignment */}
                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm border border-emerald-100 dark:border-emerald-900/30">
                        <IndianRupee size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Compensation Setup</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Assign salary structure & effective date</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-outfit">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Layers size={20} className="text-emerald-400" />
                          Salary Template <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={salaryTemplateId}
                          onChange={e => setSalaryTemplateId(e.target.value)}
                          className={`w-full px-5 py-3 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none transition-all text-sm font-bold text-slate-700 dark:text-slate-200 ${errors.salaryTemplateId ? 'border-rose-200' : 'border-slate-100 dark:border-slate-800'}`}
                        >
                          <option value="">Select Structure</option>
                          {salaryTemplates.map(t => (
                            <option key={t._id} value={t._id}>{t.name} (CTC: {t.annualCTC})</option>
                          ))}
                        </select>
                        {errors.salaryTemplateId && <div className="text-[9px] font-bold text-rose-500 px-1 flex items-center gap-1.5"><AlertCircle size={10} /> {errors.salaryTemplateId}</div>}
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={20} className="text-emerald-400" />
                          Effective Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={salaryEffectiveDate}
                          onChange={e => setSalaryEffectiveDate(e.target.value)}
                          className={`w-full px-5 py-3 bg-transparent dark:bg-slate-900/50 border-2 rounded-xl outline-none transition-all text-sm font-bold text-slate-700 dark:text-slate-200 ${errors.effectiveDate ? 'border-rose-200' : 'border-slate-100 dark:border-slate-800'}`}
                        />
                        {errors.effectiveDate && <div className="text-[9px] font-bold text-rose-500 px-1 flex items-center gap-1.5"><AlertCircle size={10} /> {errors.effectiveDate}</div>}
                        <p className="text-[9px] font-medium text-slate-400 px-1">Note: Cannot be before {joiningDate || 'Joining Date'}</p>
                      </div>
                    </div>
                  </div>

                </div>


                {/* Password Change Confirmation Modal */}
                {showPasswordConfirm && (
                   <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-[340px] border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3 text-amber-500 mb-4">
                        <ShieldAlert size={24} />
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Permission Required</h4>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                        Existing password security reasons thi show kari shakata nathi. Tame aa user mate <strong>new password set</strong> karva jao cho?
                      </p>
                      <div className="flex gap-2.5">
                        <button 
                          type="button"
                          onClick={() => { setShowPasswordConfirm(false); setPassword(''); setPasswordLock(false); setShowPassword(false); }}
                          className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                        >
                          Yes, Set New
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowPasswordConfirm(false)}
                          className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM ACTION BAR - sticky at bottom (clean) */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur -mx-4 md:-mx-6 px-4 md:px-6 pt-3 pb-3 border-t border-gray-200 flex items-center justify-end gap-2.5 z-20 shrink-0 shadow-[0_-10px_24px_-18px_rgba(0,0,0,0.35)]">
            <button
              type="button"
              onClick={() => step > 1 ? handlePrev() : onClose()}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-all focus:ring-2 focus:ring-gray-200"
            >
              {step > 1 ? 'Go Back' : (viewOnly ? 'Finish' : 'Cancel')}
            </button>

            {!viewOnly && (
              <button
                type="button"
                onClick={(e) => saveDraft(e)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-transparent transition-all focus:ring-2 focus:ring-indigo-200"
                disabled={saving}
              >
                Save Draft
              </button>
            )}

            {step < stepTitles.length ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleNext(); }}
                className="px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center gap-2"
              >
                Next Step <ArrowRight size={16} />
              </button>
            ) : (
              (!viewOnly) ? (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); submit(e); }}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center gap-2"
                >
                  {saving ? 'Processing...' : 'Complete Setup'}
                  {saving ? <RefreshCcw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                </button>
              ) : null
            )}
          </div>
        </form>
      </div>

      {/* View Only Overlay style for inputs */}
      {viewOnly && (
        <style>{`
          .employee-form input, .employee-form select, .employee-form textarea {
             pointer-events: none;
             background-color: #f8fafc;
             color: #475569;
          }
          .employee-form input[type="file"] {
             display: none;
          }
           /* Keep buttons clickable */
           .employee-form button { pointer-events: auto; }
           .employee-form a { pointer-events: auto; }
        `}</style>
      )}
    </div>
  );
}
