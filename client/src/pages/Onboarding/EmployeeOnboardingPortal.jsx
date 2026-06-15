import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Building2, CheckCircle2, FileUp, Landmark, ShieldCheck, UserRound } from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import './OnboardingWorkspace.css';

const IFSC_FORMAT = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function normalizeIfsc(raw) {
  return String(raw || '')
    .replace(/\s/g, '')
    .toUpperCase();
}

const steps = [
  { key: 'personalInfo', label: 'Personal Info', icon: UserRound },
  { key: 'jobDetails', label: 'Job Details', icon: Building2 },
  { key: 'documents', label: 'Documents Upload', icon: FileUp },
  { key: 'bankDetails', label: 'Bank Details', icon: Landmark },
  { key: 'policyAcceptance', label: 'Policy Acceptance', icon: ShieldCheck },
];

const schema = yup.object({
  personalInfo: yup.object({
    firstName: yup.string().required('First name is required'),
    lastName: yup.string().required('Last name is required'),
    email: yup.string().email('Enter a valid email').required('Email is required'),
    mobile: yup.string().min(8, 'Enter a valid mobile number').required('Mobile is required'),
    dob: yup.string().required('Date of birth is required'),
    gender: yup.string().required('Gender is required'),
    fatherName: yup.string().required('Father name is required'),
    emergencyContactName: yup.string().required('Emergency contact name is required'),
    emergencyContactNumber: yup.string().min(8, 'Enter a valid emergency contact').required('Emergency contact is required'),
    currentAddress: yup.string().required('Current address is required'),
    permanentAddress: yup.string().required('Permanent address is required'),
  }),
  jobDetails: yup.object({
    designation: yup.string().required('Designation is required'),
    department: yup.string().required('Department is required'),
    joiningDate: yup.string().required('Joining date is required'),
    workLocation: yup.string().required('Work location is required'),
    employeeType: yup.string().required('Employee type is required'),
    workMode: yup.string().required('Work mode is required'),
  }),
  bankDetails: yup.object({
    bankName: yup.string().required('Bank name is required'),
    accountNumber: yup.string().required('Account number is required'),
    ifsc: yup.string().required('IFSC is required'),
    branchName: yup.string().required('Branch is required'),
  }),
  policyAcceptance: yup.object({
    nda: yup.boolean().oneOf([true], 'Accept NDA'),
    codeOfConduct: yup.boolean().oneOf([true], 'Accept Code of Conduct'),
    dataPrivacy: yup.boolean().oneOf([true], 'Accept Data Privacy policy'),
  }),
});

const docTypes = [
  { type: 'AADHAAR', label: 'Aadhaar Card' },
  { type: 'PAN', label: 'PAN Card' },
  { type: 'BANK_PROOF', label: 'Cancelled Cheque / Passbook' },
  { type: 'EDUCATION', label: 'Highest Education Proof' },
];

function fieldError(errors, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], errors)?.message;
}

function textInput(register, errors, name, placeholder, type = 'text') {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        {placeholder}
      </span>
      <input type={type} className="onb-input" placeholder={placeholder} {...register(name)} />
      {fieldError(errors, name) && (
        <span className="mt-1 block text-[10px] font-bold text-rose-600">
          {fieldError(errors, name)}
        </span>
      )}
    </label>
  );
}

function toEmployeeProfilePatch(values) {
  return {
    contactNo: values.personalInfo?.mobile || '',
    dob: values.personalInfo?.dob || null,
    gender: values.personalInfo?.gender || '',
    fatherName: values.personalInfo?.fatherName || '',
    emergencyContactName: values.personalInfo?.emergencyContactName || '',
    emergencyContactNumber: values.personalInfo?.emergencyContactNumber || '',
    tempAddress: { line1: values.personalInfo?.currentAddress || '' },
    permAddress: { line1: values.personalInfo?.permanentAddress || '' },
    bankDetails: values.bankDetails || {},
  };
}

export default function EmployeeOnboardingPortal({ token: propToken, isEmbedded = false }) {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = propToken || pathToken || searchParams.get('token');
  const [portal, setPortal] = useState(null);
  const [active, setActive] = useState(0);
  const [files, setFiles] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ifscLookup, setIfscLookup] = useState({ status: 'idle', message: '' });

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      personalInfo: {
        firstName: '',
        lastName: '',
        email: '',
        mobile: '',
        dob: '',
        gender: '',
        fatherName: '',
        emergencyContactName: '',
        emergencyContactNumber: '',
        currentAddress: '',
        permanentAddress: '',
      },
      jobDetails: {
        designation: '',
        department: '',
        joiningDate: '',
        workLocation: '',
        employeeType: 'Full-time',
        workMode: 'Work From Office (WFO)',
      },
      bankDetails: {
        bankName: '',
        accountNumber: '',
        ifsc: '',
        branchName: '',
      },
      policyAcceptance: {
        nda: false,
        codeOfConduct: false,
        dataPrivacy: false,
      },
    },
  });

  const isTokenMode = Boolean(token);

  const lookupIfsc = useCallback(
    async (rawIfsc) => {
      const ifsc = normalizeIfsc(rawIfsc);
      if (ifsc.length === 0) {
        setIfscLookup({ status: 'idle', message: '' });
        return;
      }
      if (ifsc.length < 11) {
        setIfscLookup({ status: 'idle', message: '' });
        return;
      }
      if (!IFSC_FORMAT.test(ifsc)) {
        setIfscLookup({
          status: 'error',
          message: 'IFSC format looks wrong (e.g. HDFC0001234 — 4 letters, 0, then 6 characters).',
        });
        return;
      }
      setIfscLookup({ status: 'loading', message: 'Looking up bank…' });
      try {
        const res = await fetch(`/api/security/ifsc/${encodeURIComponent(ifsc)}`);
        if (!res.ok) throw new Error('not_found');
        const data = await res.json();
        const bank = String(data.BANK || '').trim();
        const branch = String(data.BRANCH || '').trim();
        setValue('bankDetails.ifsc', ifsc, { shouldValidate: true, shouldDirty: true });
        setValue('bankDetails.bankName', bank, { shouldValidate: true, shouldDirty: true });
        setValue('bankDetails.branchName', branch, { shouldValidate: true, shouldDirty: true });
        const city = String(data.CITY || data.DISTRICT || '').trim();
        setIfscLookup({
          status: 'ok',
          message: city ? `Loaded: ${bank} (${city})` : `Loaded: ${bank}`,
        });
      } catch {
        setIfscLookup({
          status: 'error',
          message: 'IFSC not found. Check the code or enter bank and branch manually.',
        });
      }
    },
    [setValue]
  );

  useEffect(() => {
    if (active !== 3) setIfscLookup({ status: 'idle', message: '' });
  }, [active]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = isTokenMode
        ? await onboardingService.getPublicPortal(token)
        : await onboardingService.getMyPortal();
      setPortal(data);

      const employee = data.employee || {};
      const instance = data.instance || {};
      reset({
        personalInfo: {
          firstName: instance.personalDetails?.firstName || employee.firstName || '',
          lastName: instance.personalDetails?.lastName || employee.lastName || '',
          email: employee.email || '',
          mobile: instance.personalDetails?.mobile || employee.contactNo || '',
          dob: instance.personalDetails?.dob ? String(instance.personalDetails.dob).slice(0, 10) : '',
          gender: instance.personalDetails?.gender || employee.gender || '',
          fatherName: instance.personalDetails?.fatherName || employee.fatherName || '',
          emergencyContactName: instance.personalDetails?.emergencyContactName || employee.emergencyContactName || '',
          emergencyContactNumber: instance.personalDetails?.emergencyContactNumber || employee.emergencyContactNumber || '',
          currentAddress: instance.personalDetails?.currentAddress || employee.tempAddress?.line1 || '',
          permanentAddress: instance.personalDetails?.permanentAddress || employee.permAddress?.line1 || '',
        },
        jobDetails: {
          designation: instance.jobDetails?.designation || employee.designation || '',
          department: instance.jobDetails?.department || employee.department || '',
          joiningDate: instance.jobDetails?.joiningDate ? String(instance.jobDetails.joiningDate).slice(0, 10) : (employee.joiningDate ? String(employee.joiningDate).slice(0, 10) : ''),
          workLocation: instance.jobDetails?.workLocation || employee.workLocation || '',
          employeeType: instance.jobDetails?.employeeType || employee.employeeType || 'Full-time',
          workMode: instance.jobDetails?.workMode || employee.workMode || 'Work From Office (WFO)',
        },
        bankDetails: {
          bankName: instance.bankDetails?.bankName || employee.bankDetails?.bankName || '',
          accountNumber: instance.bankDetails?.accountNumber || employee.bankDetails?.accountNumber || '',
          ifsc: instance.bankDetails?.ifsc || employee.bankDetails?.ifsc || '',
          branchName: instance.bankDetails?.branchName || employee.bankDetails?.branchName || '',
        },
        policyAcceptance: {
          nda: !!instance.policyAcceptance?.nda,
          codeOfConduct: !!instance.policyAcceptance?.codeOfConduct,
          dataPrivacy: !!instance.policyAcceptance?.dataPrivacy,
        },
      });
    } catch (err) {
      setPortal(null);
      setError(err.response?.data?.message || err.message || 'Unable to open onboarding portal.');
    } finally {
      setLoading(false);
    }
  }, [isTokenMode, reset, token]);

  useEffect(() => { load(); }, [load]);

  const completedSteps = useMemo(() => new Set(portal?.instance?.stepsCompleted || []), [portal]);
  const progress = portal?.instance?.progressPercent || Math.round((completedSteps.size / steps.length) * 100);

  const saveProgress = async () => {
    setSaving(true);
    setError('');
    try {
      if (isTokenMode) {
        const data = await onboardingService.savePublicProgress(token, {
          ...getValues(),
          stepsCompleted: Array.from(completedSteps),
        });
        setPortal(data);
        setMessage('Progress saved securely.');
      } else {
        await onboardingService.updateMyProfile(toEmployeeProfilePatch(getValues()));
        await load();
        setMessage('Profile progress saved.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Progress could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const [submitError, setSubmitError] = useState('');

  const submit = async (values) => {
    setSaving(true);
    setError('');
    setSubmitError('');
    try {
      if (!isTokenMode) {
        await onboardingService.updateMyProfile(toEmployeeProfilePatch(values));
        const instanceId = portal?.instance?._id;
        const employeeId = portal?.employee?._id;
        if (instanceId && employeeId) {
          for (const doc of docTypes) {
            if (files[doc.type]) {
              const formData = new FormData();
              formData.append('instanceId', instanceId);
              formData.append('employeeId', employeeId);
              formData.append('type', doc.type);
              formData.append('label', doc.label);
              formData.append('file', files[doc.type]);
              await onboardingService.uploadDocument(formData);
            }
          }
        }
        await onboardingService.acceptOffer();
        await load();
        setIsSubmitted(true);
        setMessage('Onboarding details submitted through your employee session.');
        return;
      }

      const formData = new FormData();
      formData.append('token', token);
      formData.append('payload', JSON.stringify({
        ...values,
        stepsCompleted: steps.map((step) => step.key),
      }));
      const selectedDocs = [];
      docTypes.forEach((doc) => {
        if (files[doc.type]) {
          formData.append('documents', files[doc.type]);
          selectedDocs.push(doc);
        }
      });
      formData.append('documentTypes', JSON.stringify(selectedDocs));
      const data = await onboardingService.submitPublicPortal(formData);
      setPortal(data);
      setIsSubmitted(true);
      setMessage('Onboarding submitted. HR verification is now pending.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Onboarding could not be submitted.');
    } finally {
      setSaving(false);
    }
  };

  const onInvalid = (errors) => {
    console.warn("Validation failed:", errors);
    setSubmitError("Please fill all required fields in all tabs before submitting.");
    // Optionally switch to the first tab with an error
    const firstError = Object.keys(errors)[0];
    if (firstError) {
        const stepIndex = steps.findIndex(s => s.key === firstError);
        if (stepIndex !== -1) setActive(stepIndex);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">Loading onboarding portal...</div>
      </div>
    );
  }

  if (!portal?.instance) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-black text-slate-900">No onboarding invite found</h2>
          <p className="mt-2 text-sm text-slate-500">{error || 'Please contact HR if your link has expired or was regenerated.'}</p>
        </div>
      </div>
    );
  }

  // Final Success Screen
  if (isSubmitted || portal?.instance?.status === 'submitted' || portal?.instance?.status === 'completed') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-indigo-50">
        <div className="max-w-lg w-full bg-white/80 backdrop-blur-xl rounded-[24px] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-700 border border-white">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-emerald-500/20 rotate-3 transform transition-transform hover:rotate-0">
            <CheckCircle2 size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-1 tracking-tight uppercase">Thank You!</h1>
          <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">Submission Successful</p>
          <h3 className="text-base font-bold text-slate-800 mb-4 leading-tight">Your joining formalities have been submitted successfully.</h3>
          <p className="text-slate-500 text-[13px] font-medium leading-relaxed mb-8 opacity-70">
            We have received your details. Our HR team is now verifying your documents and profile. 
            You will be notified via email regarding the next steps.
          </p>
          <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Onboarding Engine v1.2</p>
            </div>
            <p className="text-[7px] font-bold text-slate-300 uppercase tracking-[0.1em]">Verification: ONB-{String(portal.instance._id).slice(-6).toUpperCase()}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "" : "min-h-screen bg-[#F5F7FA] p-3 md:p-5"}>
      <div className={isEmbedded ? "" : "mx-auto max-w-6xl"}>
        {!isEmbedded && (
          <div className="mb-3 flex flex-col gap-3 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="onb-pill bg-slate-900 text-white">Secure Onboarding Portal</p>
              <h1 className="mt-2 text-[24px] font-black text-slate-950">Complete your joining formalities</h1>
              <p className="text-xs font-semibold text-slate-500">Save anytime. Your final submission goes to HR verification.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Progress</p>
              <p className="text-2xl font-black text-slate-950">{progress}%</p>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{message}</div>
        )}
        {error && (
          <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</div>
        )}

        {submitError && (
          <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{submitError}</div>
        )}

        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 rounded-[18px] border border-slate-200 bg-white p-2 shadow-sm scrollbar-hide">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const done = completedSteps.has(step.key) || portal.instance.status === 'completed';
              return (
                <button
                  type="button"
                  key={step.key}
                  onClick={() => setActive(index)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition whitespace-nowrap lg:whitespace-normal flex-shrink-0 ${active === index ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className={`rounded-xl p-2 ${active === index ? 'bg-white/10' : 'bg-slate-100'}`}>
                    {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </span>
                  <span className="text-[10px] lg:text-xs font-black uppercase tracking-wide">{step.label}</span>
                </button>
              );
            })}
          </aside>

          <form onSubmit={handleSubmit(submit, onInvalid)} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
            {active === 0 && (
              <section>
                <h2 className="mb-3 text-lg font-black text-slate-950">Personal Info</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {textInput(register, errors, 'personalInfo.firstName', 'First name')}
                  {textInput(register, errors, 'personalInfo.lastName', 'Last name')}
                  {textInput(register, errors, 'personalInfo.email', 'Email')}
                  {textInput(register, errors, 'personalInfo.mobile', 'Mobile')}
                  {textInput(register, errors, 'personalInfo.dob', 'Date of birth', 'date')}
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Gender</span>
                    <select className="onb-input" {...register('personalInfo.gender')}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {fieldError(errors, 'personalInfo.gender') && <span className="mt-1 block text-[10px] font-bold text-rose-600">{fieldError(errors, 'personalInfo.gender')}</span>}
                  </label>
                  {textInput(register, errors, 'personalInfo.fatherName', 'Father name')}
                  {textInput(register, errors, 'personalInfo.emergencyContactName', 'Emergency contact name')}
                  {textInput(register, errors, 'personalInfo.emergencyContactNumber', 'Emergency contact number')}
                  {textInput(register, errors, 'personalInfo.currentAddress', 'Current address')}
                  {textInput(register, errors, 'personalInfo.permanentAddress', 'Permanent address')}
                </div>
              </section>
            )}

            {active === 1 && (
              <section>
                <h2 className="mb-3 text-lg font-black text-slate-950">Job Details</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {textInput(register, errors, 'jobDetails.designation', 'Designation')}
                  {textInput(register, errors, 'jobDetails.department', 'Department')}
                  {textInput(register, errors, 'jobDetails.joiningDate', 'Joining date', 'date')}
                  {textInput(register, errors, 'jobDetails.workLocation', 'Work location')}
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Employee Type</span>
                    <select className="onb-input" {...register('jobDetails.employeeType')}>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Intern">Intern</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Work Mode</span>
                    <select className="onb-input" {...register('jobDetails.workMode')}>
                      <option value="Work From Office (WFO)">Work From Office</option>
                      <option value="Work From Home (WFH)">Work From Home</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Field / Onsite">Field / Onsite</option>
                    </select>
                  </label>
                </div>
              </section>
            )}

            {active === 2 && (
              <section>
                <h2 className="mb-3 text-lg font-black text-slate-950">Documents Upload</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {docTypes.map((doc) => (
                    <label key={doc.type} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-600">{doc.label}</p>
                      <input type="file" className="block w-full text-xs font-bold text-slate-500" onChange={(event) => setFiles((prev) => ({ ...prev, [doc.type]: event.target.files?.[0] }))} />
                      {files[doc.type] && <p className="mt-2 text-[11px] font-bold text-emerald-700">{files[doc.type].name}</p>}
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {(portal.documents || []).map((doc) => (
                    <div key={doc._id} className="rounded-2xl border border-slate-100 bg-white p-3">
                      <p className="text-xs font-black text-slate-900">{doc.label || doc.type}</p>
                      <p className="text-[11px] text-slate-500">{doc.originalName}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{doc.status}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {active === 3 && (
              <section>
                <h2 className="mb-3 text-lg font-black text-slate-950">Bank Details</h2>
                <p className="mb-3 text-[11px] font-semibold text-slate-500">
                  Enter your IFSC and tab out (or leave the field) — bank name and branch will fill automatically. Account number is not part of IFSC; enter it manually.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="block">
                    <input
                      type="text"
                      className="onb-input"
                      placeholder="IFSC (e.g. HDFC0001234)"
                      maxLength={11}
                      autoComplete="off"
                      {...register('bankDetails.ifsc', {
                        onChange: (e) => {
                          const v = normalizeIfsc(e.target.value).slice(0, 11);
                          setValue('bankDetails.ifsc', v, { shouldValidate: true });
                        },
                        onBlur: (e) => {
                          const v = normalizeIfsc(e.target.value);
                          setValue('bankDetails.ifsc', v, { shouldValidate: true });
                          void lookupIfsc(v);
                        },
                      })}
                    />
                    {fieldError(errors, 'bankDetails.ifsc') && (
                      <span className="mt-1 block text-[10px] font-bold text-rose-600">{fieldError(errors, 'bankDetails.ifsc')}</span>
                    )}
                    {ifscLookup.status === 'loading' && (
                      <span className="mt-1 block text-[10px] font-bold text-slate-500">{ifscLookup.message}</span>
                    )}
                  </label>
                  {textInput(register, errors, 'bankDetails.accountNumber', 'Account number')}
                  {textInput(register, errors, 'bankDetails.bankName', 'Bank name')}
                  {textInput(register, errors, 'bankDetails.branchName', 'Branch name')}
                </div>
                {ifscLookup.status !== 'loading' && ifscLookup.message && (
                  <p
                    className={`mt-2 text-[11px] font-bold ${
                      ifscLookup.status === 'error' ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {ifscLookup.message}
                  </p>
                )}
              </section>
            )}

            {active === 4 && (
              <section>
                <h2 className="mb-3 text-lg font-black text-slate-950">Policy Acceptance</h2>
                <div className="space-y-2">
                  {[
                    ['policyAcceptance.nda', 'I accept the Non Disclosure Agreement.'],
                    ['policyAcceptance.codeOfConduct', 'I accept the Code of Conduct.'],
                    ['policyAcceptance.dataPrivacy', 'I accept the Data Privacy and IT Usage Policy.'],
                  ].map(([name, label]) => (
                    <label key={name} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register(name)} />
                      {label}
                    </label>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
              <button type="button" disabled={saving} onClick={saveProgress} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-50">Save Progress</button>
              <div className="flex gap-2">
                <button type="button" disabled={active === 0} onClick={() => setActive((value) => Math.max(0, value - 1))} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-40">Back</button>
                {active < steps.length - 1 ? (
                  <button type="button" onClick={() => setActive((value) => Math.min(steps.length - 1, value + 1))} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Next</button>
                ) : (
                  <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">Submit To HR</button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
