import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileCheck2,
  KanbanSquare,
  Mail,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  XCircle,
  FileText,
  Check,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import onboardingService from '../../services/onboardingService';
import './OnboardingWorkspace.css';

const columns = [
  { key: 'invited', label: 'Invited', helper: '', tone: 'onb-dot-sky' },
  { key: 'in_progress', label: 'In Progress', helper: '', tone: 'onb-dot-amber' },
  { key: 'docs_pending', label: 'Docs Pending', helper: '', tone: 'onb-dot-rose' },
  { key: 'verification', label: 'Verification', helper: '', tone: 'onb-dot-indigo' },
  { key: 'completed', label: 'Completed', helper: '', tone: 'onb-dot-emerald' },
];

const defaultInvite = {
  applicantId: '',
  name: '',
  email: '',
  mobile: '',
  designation: '',
  department: '',
  joiningDate: '',
  role: 'employee',
  ctcAnnual: '',
};

const stepLabels = {
  offer_acceptance: 'Offer',
  personal_info: 'Personal',
  job_details: 'Job',
  documents: 'Docs',
  bank_details: 'Bank',
  policy_acceptance: 'Policy',
  verification: 'Verify',
  activation: 'Active',
};

function employeeName(instance) {
  const emp = instance?.employee || {};
  const profile = instance?.personalDetails || {};
  const candidate = instance?.candidate || {};
  const applicant = instance?.applicant || {};
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    candidate.name ||
    applicant.name ||
    [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() ||
    profile.email ||
    candidate.email ||
    applicant.email ||
    emp.email ||
    'New Employee'
  );
}

function employeeIdentity(instance) {
  const emp = instance?.employee || {};
  if (emp.employeeId) return emp.employeeId;
  if (emp.email) return emp.email;

  const status = String(instance?.status || '').toLowerCase();
  if (status === 'completed') return 'Employee activated';
  if (status === 'verified') return 'Ready for activation';
  if (status === 'verification' || status === 'form_submitted') return 'Submitted to HR';
  if (status === 'docs_pending') return 'Documents pending';
  if (status === 'in_progress') return 'Profile in progress';
  if (status === 'invited') return 'Invite sent';
  return 'Draft profile';
}

function compactDate(date) {
  if (!date) return 'TBD';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function prettyStatus(status) {
  return String(status || 'pending').replace(/_/g, ' ');
}

export default function OnboardingDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathPrefix = location.pathname.startsWith('/tenant') ? '/tenant' : '/hr';
  const [pipeline, setPipeline] = useState({ grouped: {}, summary: {} });
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState(null);
  const [invite, setInvite] = useState(defaultInvite);
  const [inviteResult, setInviteResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('invited');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await onboardingService.getPipeline();
      setPipeline(data || { grouped: {}, summary: {} });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load onboarding pipeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    onboardingService.getInstance(selectedId)
      .then((data) => setDetail(data.instance))
      .catch(() => setDetail(null));
  }, [selectedId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const applicantId = params.get('applicantId');
    const employeeId = params.get('employeeId');
    if (!applicantId && !employeeId) return;

    const allCards = columns.flatMap((column) => pipeline.grouped?.[column.key] || []);
    const matchedCard = allCards.find((item) => {
      const itemApplicantId = String(item?.applicant || '');
      const itemEmployeeId = String(item?.employee?._id || item?.employee || '');
      return (applicantId && itemApplicantId === String(applicantId)) ||
        (employeeId && itemEmployeeId === String(employeeId));
    });

    if (matchedCard) {
      const matchedStatus = String(matchedCard.status || '').toLowerCase();
      const matchedTab = matchedStatus === 'form_submitted' || matchedStatus === 'verified'
        ? 'verification'
        : matchedStatus;
      if (columns.some((column) => column.key === matchedTab) && activeTab !== matchedTab) setActiveTab(matchedTab);
      if (String(selectedId || '') !== String(matchedCard._id)) setSelectedId(matchedCard._id);
    }
  }, [location.search, pipeline, selectedId, activeTab]);

  const summaryCards = useMemo(() => ([
    { label: 'Invited', value: pipeline.summary?.invited || 0, icon: Mail, tone: 'sky', key: 'invited' },
    { label: 'In Progress', value: pipeline.summary?.inProgress || 0, icon: PlayCircle, tone: 'amber', key: 'in_progress' },
    { label: 'Docs Pending', value: pipeline.summary?.docsPending || 0, icon: KanbanSquare, tone: 'rose', key: 'docs_pending' },
    { label: 'Verification', value: pipeline.summary?.verification || 0, icon: FileCheck2, tone: 'indigo', key: 'verification' },
    { label: 'Completed', value: pipeline.summary?.completed || 0, icon: CheckCircle2, tone: 'emerald', key: 'completed' },
  ]), [pipeline.summary]);

  const selectedDocs = detail?.documents || [];
  const approvedDocs = selectedDocs.filter((doc) => doc.status === 'approved').length;
  const submittedDocs = selectedDocs.length || detail?.documentSummary?.total || 0;
  const completedSteps = detail?.stepsCompleted || [];

  const submitInvite = async () => {
    if (!invite.applicantId && (!invite.name || !invite.email)) return;
    setBusy(true);
    setError('');
    try {
      const result = await onboardingService.inviteCandidate({
        ...invite,
        ctcAnnual: invite.ctcAnnual ? Number(invite.ctcAnnual) : undefined,
      });
      setInviteResult(result);
      setInvite(defaultInvite);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to generate onboarding invite.');
    } finally {
      setBusy(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteResult?.link) return;
    await navigator.clipboard?.writeText(inviteResult.link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const moveCard = async (status) => {
    if (!draggingId) return;
    setBusy(true);
    try {
      await onboardingService.movePipelineCard(draggingId, status);
      setDraggingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const verify = async (status) => {
    if (!detail?._id) return;
    setBusy(true);
    try {
      await onboardingService.verifyOnboarding({
        onboardingId: detail._id,
        status,
        remarks: status === 'approved' ? 'Verified by HR' : 'Please resubmit rejected documents.',
      });
      await load();
      const fresh = await onboardingService.getInstance(detail._id);
      setDetail(fresh.instance);
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!detail?._id) return;
    setBusy(true);
    try {
      await onboardingService.activateOnboarding({
        onboardingId: detail._id,
        role: detail.roleAssignment?.role || 'employee',
        assets: detail.assetAllocation?.items || [],
        payroll: detail.payrollSetup || {},
        verificationRemarks: 'Accepted and activated by HR',
      });
      await load();
      const fresh = await onboardingService.getInstance(detail._id);
      setDetail(fresh.instance);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onb-shell onb-dashboard-shell">
      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg scale-100 rounded-[2rem] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute right-6 top-6 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw size={20} className="rotate-45" />
            </button>

            <div className="mb-6 flex items-center gap-4">
              <div className="rounded-[1.25rem] bg-emerald-100 p-3 text-emerald-700">
                <UserPlus size={24} />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Generate Invite</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Applicant ID</label>
                  <input className="onb-input h-12" placeholder="e.g. APP-001" value={invite.applicantId} onChange={(e) => setInvite((p) => ({ ...p, applicantId: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Joining Date</label>
                  <input className="onb-input h-12" type="date" value={invite.joiningDate} onChange={(e) => setInvite((p) => ({ ...p, joiningDate: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
                <input className="onb-input h-12" placeholder="Ex. John Doe" value={invite.name} onChange={(e) => setInvite((p) => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
                  <input className="onb-input h-12" placeholder="john@example.com" value={invite.email} onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Mobile Number</label>
                  <input className="onb-input h-12" placeholder="+91 00000 00000" value={invite.mobile} onChange={(e) => setInvite((p) => ({ ...p, mobile: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Department</label>
                  <input className="onb-input h-12" placeholder="Engineering" value={invite.department} onChange={(e) => setInvite((p) => ({ ...p, department: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Designation</label>
                  <input className="onb-input h-12" placeholder="Sr. Developer" value={invite.designation} onChange={(e) => setInvite((p) => ({ ...p, designation: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Annual CTC</label>
                  <input className="onb-input h-12" placeholder="9,00,000" value={invite.ctcAnnual} onChange={(e) => setInvite((p) => ({ ...p, ctcAnnual: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">System Role</label>
                  <select className="onb-input h-12" value={invite.role} onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={submitInvite}
                disabled={busy}
                className="w-full rounded-2xl bg-slate-950 h-12 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-200"
              >
                Generate Invite Now
              </button>
            </div>

            {inviteResult?.link && (
              <div className="mt-6 rounded-[1.5rem] border-2 border-dashed border-emerald-200 bg-emerald-50 p-5 text-emerald-800 animate-in slide-in-from-top-4 duration-300">
                <p className="text-[11px] font-black uppercase tracking-[0.2em]">✨ Onboarding link is ready</p>
                <div className="mt-3 flex gap-3">
                  <button type="button" onClick={copyInviteLink} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100">
                    <Copy size={16} />
                    {copied ? 'Copied' : 'Copy Link'}
                  </button>
                  <a href={inviteResult.link} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100">
                    <ExternalLink size={16} />
                    Open Portal
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="onb-toolbar">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex h-11 items-center gap-3 rounded-2xl bg-slate-950 px-6 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:bg-slate-800"
          >
            <UserPlus size={16} />
            Generate Invite
          </button>
          <button
            type="button"
            onClick={() => navigate(`${pathPrefix}/onboarding/templates`)}
            className="inline-flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:bg-slate-50"
          >
            <KanbanSquare size={16} />
            Manage Templates
          </button>
          {error && (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="onb-metrics-grid">
        {summaryCards.map((card) => {
          const CardIcon = card.icon;
          const isActive = activeTab === card.key;
          return (
            <button 
              key={card.label} 
              onClick={() => setActiveTab(card.key)}
              className={`onb-metric-card text-left transition-all duration-300 onb-metric-${card.tone} ${isActive ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                  <p className="mt-1 text-2xl font-black leading-none text-slate-950">{loading ? '--' : card.value}</p>
                </div>
                <span className="onb-metric-icon"><CardIcon size={18} /></span>
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#4F46E5]"></div>
              )}
            </button>
          );
        })}
      </div>

      <div className="onb-work-grid-flat">
        <section className="min-w-0">
          <div className="onb-board-card-flat">
            <div className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loading && [0, 1, 2, 3].map((item) => (
                    <div key={item} className="onb-person-card animate-pulse border-dashed">
                      <div className="h-4 w-32 rounded-lg bg-slate-100" />
                      <div className="mt-4 h-3 w-24 rounded bg-slate-50" />
                      <div className="mt-6 h-2 rounded bg-slate-50" />
                    </div>
                  ))}

                  {!loading && (pipeline.grouped?.[activeTab] || []).length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center grayscale opacity-60">
                      <KanbanSquare size={48} className="text-slate-200 mb-4" />
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No candidates in {columns.find(c => c.key === activeTab)?.label}</p>
                    </div>
                  )}

                  {!loading && (pipeline.grouped?.[activeTab] || []).map((instance) => {
                    const progress = Math.max(0, Math.min(100, instance.progressPercent || 0));
                    return (
                      <button
                        key={instance._id}
                        type="button"
                        onClick={() => setSelectedId(instance._id)}
                        className={`onb-person-card group ${selectedId === instance._id ? 'onb-person-card-active' : 'hover:border-slate-300'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate text-[15px] font-black text-slate-900 group-hover:text-slate-950 transition-colors">{employeeName(instance)}</h4>
                            <p className="truncate text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">{employeeIdentity(instance)}</p>
                          </div>
                          <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm">{progress}%</span>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="h-6 px-2 flex items-center bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider">{instance.jobDetails?.designation || instance.employee?.designation || 'TBD'}</span>
                            <span className="h-6 px-2 flex items-center bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">{instance.jobDetails?.department || instance.employee?.department || 'TBD'}</span>
                          </div>
                          
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full bg-slate-950 transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                          
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">
                            <div className="flex items-center gap-1.5">
                               <RefreshCw size={10} className="text-slate-300" />
                               <span>Updated {compactDate(instance.updatedAt)}</span>
                            </div>
                            <span className="text-slate-600">{compactDate(instance.jobDetails?.joiningDate || instance.employee?.joiningDate)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="mt-6 w-full min-w-0">
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <div className="onb-card min-w-0 w-full rounded-[1.25rem] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-950 p-2 text-white shadow-md shadow-slate-200">
                        <ClipboardCheck size={18} />
                      </div>
                      <h3 className="text-base font-black tracking-tight text-slate-950 uppercase">Active Candidate Info</h3>
                    </div>
                  </div>

                  {!detail ? (
                    <div className="onb-soft-empty h-40 flex items-center justify-center bg-slate-50/50 rounded-3xl">
                      Select a candidate card above to view timeline & status.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate</p>
                          <p className="mt-2 text-base font-black text-slate-950">{employeeName(detail)}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Phase</p>
                          <div className="mt-2 flex items-center gap-2">
                            <p className={`text-base font-black capitalize ${['verified', 'completed'].includes(String(detail.status).toLowerCase()) ? 'text-emerald-600' : 'text-indigo-600'}`}>
                              {prettyStatus(detail.status)}
                            </p>
                            {['verified', 'completed'].includes(String(detail.status).toLowerCase()) && (
                              <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                                <Check size={12} /> VERIFIED
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compliance</p>
                          <p className="mt-2 text-base font-black text-emerald-600">{approvedDocs}/{submittedDocs} Approved</p>
                        </div>
                      </div>

                      {/* Digital Form Responses */}
                      {detail.personalDetails && Object.keys(detail.personalDetails).length > 0 && (
                        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <FileText size={14} /> Digital Form Responses
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {Object.entries({
                              ...detail.personalDetails,
                              ...detail.bankDetails
                            }).map(([key, value]) => (
                              value && typeof value !== 'object' && (
                                <div key={key} className="flex justify-between items-center py-1 border-b border-slate-50">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <span className="text-xs font-black text-slate-700">{String(value)}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                         <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Milestone Progress</p>
                         <div className="flex flex-wrap gap-2">
                           {Object.entries(stepLabels).map(([key, label]) => (
                             <div
                               key={key}
                               className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${completedSteps.includes(key) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400 border border-slate-100'}`}
                             >
                               {label}
                             </div>
                           ))}
                         </div>
                      </div>
                    </div>
                  )}
                </div>

                <aside className="onb-card min-w-0 w-full rounded-[1.25rem] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-md shadow-indigo-100">
                        <ShieldCheck size={18} />
                      </div>
                      <h3 className="text-base font-black tracking-tight text-slate-950 uppercase">Verification</h3>
                    </div>
                  </div>

                  {!detail ? (
                    <div className="onb-soft-empty h-40 flex items-center justify-center bg-slate-50/50 rounded-3xl">
                      Verification controls will unlock once a candidate is selected.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="onb-doc-list space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {selectedDocs.length > 0 && (
                          <div className="space-y-3">
                            {selectedDocs.map((doc) => (
                              <a
                                key={doc._id}
                                href={doc.secureUrl || doc.path || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all group lg:min-h-[72px]"
                              >
                                <div className="min-w-0 pr-4">
                                  <span className="block truncate text-sm font-black text-slate-950 uppercase">{doc.label || doc.type || 'Document'}</span>
                                  <span className="block truncate text-[11px] font-bold text-slate-400 mt-1">{doc.originalName || 'Attached file'}</span>
                                </div>
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : doc.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {doc.status || 'pending'}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}

                        {selectedDocs.length === 0 && !['verified', 'completed'].includes(detail.status?.toLowerCase()) && (
                          <div className="text-center py-10">
                            <RefreshCw size={32} className="text-slate-100 mx-auto mb-3" />
                            <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Awaiting digital submissions...</p>
                          </div>
                        )}

                        {['verified', 'completed'].includes(detail.status?.toLowerCase()) && (
                          <div className="text-center py-6 bg-emerald-50/30 rounded-3xl border border-dashed border-emerald-100 mt-3">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                              <ShieldCheck size={20} />
                            </div>
                            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Verification Successful</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                        <button 
                          type="button" 
                          disabled={busy || ['verified', 'completed'].includes(detail.status?.toLowerCase())} 
                          onClick={() => verify('rejected')} 
                          className="h-14 inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-100 bg-rose-50 text-xs font-black uppercase tracking-widest text-rose-700 transition hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <XCircle size={18} />
                          Reject
                        </button>
                        <button 
                          type="button" 
                          disabled={busy || !['verification', 'form_submitted', 'docs_pending', 'verified'].includes(detail.status?.toLowerCase())} 
                          onClick={activate} 
                          className="h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-100"
                        >
                          <CheckCircle2 size={18} />
                          {detail.status?.toLowerCase() === 'completed' ? 'Activated' : 'Accept & Activate'}
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
