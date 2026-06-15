import React, { useEffect, useState, useCallback } from 'react';
import {
    RefreshCw, CalendarDays, Clock, User2,
    AlignLeft, Building2, PackageCheck, ShieldCheck, MessageSquare
} from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import ExitAnalytics from '../../components/exit/ExitAnalytics';
import ExitRequestsTable from '../../components/exit/ExitRequestsTable';
import ExitStatusTracker from '../../components/exit/ExitStatusTracker';
import ExitApprovalPanel from '../../components/exit/ExitApprovalPanel';
import NoticePeriodPanel from '../../components/exit/NoticePeriodPanel';
import AssetClearancePanel from '../../components/exit/AssetClearancePanel';
import DepartmentTasksPanel from '../../components/exit/DepartmentTasksPanel';
import FNFSettlementPanel from '../../components/exit/FNFSettlementPanel';
import LetterGenerationPanel from '../../components/exit/LetterGenerationPanel';

export default function ExitManagement() {
    const [requests, setRequests] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true); else setRefreshing(true);
            const [reqRes, anlRes] = await Promise.all([
                exitAPI.getAllRequests(),
                exitAPI.getAnalytics()
            ]);
            const newRequests = reqRes.data || [];
            setRequests(newRequests);
            setAnalytics(anlRes.data || null);
            if (selected) {
                const updated = newRequests.find(r => r._id === selected._id);
                setSelected(updated || null);
            }
        } catch (err) {
            console.error('[ExitManagement] fetchData:', err);
        } finally {
            setLoading(false); setRefreshing(false);
        }
    }, [selected]);

    useEffect(() => { fetchData(); }, []); // eslint-disable-line

    const handleRefresh = () => fetchData(true);

    /* ── Detail view ──────────────────────────────────────────────────────── */
    if (selected) {
        const r = selected;
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
                {/* Back + header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <button onClick={() => setSelected(null)}
                            className="text-sm text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1 mb-1.5"
                        >
                            ← Back to all requests
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                            {r.employee?.firstName} {r.employee?.lastName}
                            <span className="text-sm font-normal text-slate-400">— Offboarding</span>
                            <StagePill stage={r.stage} />
                        </h1>
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-medium border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 hover:border-indigo-300 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* 8-step workflow tracker (full width) */}
                <ExitStatusTracker stage={r.stage} status={r.status} rejectionReason={r.rejectionReason} />

                {/* Notice period summary — start, end, remaining days */}
                <NoticePeriodPanel request={r} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: actions + stage-specific panels */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* HR action panel — always visible */}
                        <ExitApprovalPanel request={r} onUpdate={handleRefresh} />

                        {/* Clearance stage panels — tasks, assets, knowledge transfer */}
                        {r.stage === 'Clearance' && (
                            <>
                                <AssetClearancePanel request={r} onUpdate={handleRefresh} />
                                <DepartmentTasksPanel request={r} onUpdate={handleRefresh} />

                                {/* Clearance form read-only if submitted */}
                                {r.clearanceFormSubmitted && r.clearanceForm && (
                                    <ClearanceFormSummary form={r.clearanceForm} />
                                )}
                            </>
                        )}

                        {/* Exit Interview — read-only summary when completed */}
                        {r.stage === 'Exit Interview' && r.exitInterviewCompleted && r.exitInterview && (
                            <ExitInterviewSummary interview={r.exitInterview} />
                        )}

                        {/* FNF stage panel */}
                        {r.stage === 'FNF' && (
                            <FNFSettlementPanel request={r} onUpdate={handleRefresh} />
                        )}

                        {/* Letters panel — show from Letters Generated onwards */}
                        {(r.stage === 'Letters Generated' || r.stage === 'Deactivated') && r.lettersGenerated && (
                            <LetterGenerationPanel request={r} />
                        )}
                    </div>

                    {/* Right: employee info + exit details + checklist summary */}
                    <div className="space-y-4">
                        <InfoCard title="Employee">
                            <InfoRow icon={<User2 size={13} />} label="Name" value={`${r.employee?.firstName} ${r.employee?.lastName}`} />
                            <InfoRow icon={<User2 size={13} />} label="Employee ID" value={r.employee?.employeeId || '—'} />
                            <InfoRow icon={<Building2 size={13} />} label="Department" value={r.employee?.department || '—'} />
                            <InfoRow icon={<AlignLeft size={13} />} label="Designation" value={r.employee?.designation || r.employee?.jobTitle || '—'} />
                            <InfoRow icon={<User2 size={13} />} label="Email" value={r.employee?.email || '—'} />
                        </InfoCard>

                        <InfoCard title="Exit Details">
                            <InfoRow icon={<AlignLeft size={13} />} label="Exit Type" value={r.exitType} />
                            <InfoRow icon={<AlignLeft size={13} />} label="Reason" value={r.reason} />
                            <InfoRow icon={<Clock size={13} />} label="Notice" value={`${r.noticePeriodDays} days`} />
                            <InfoRow icon={<CalendarDays size={13} />} label="Last Working" value={r.lastWorkingDate ? new Date(r.lastWorkingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'} />
                            <InfoRow icon={<CalendarDays size={13} />} label="Submitted" value={new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                        </InfoCard>

                        {r.hrRemarks && (
                            <InfoCard title="HR Remarks">
                                <p className="text-sm text-slate-600 dark:text-slate-400">{r.hrRemarks}</p>
                            </InfoCard>
                        )}

                        {r.comments && (
                            <InfoCard title="Employee Comments">
                                <p className="text-sm text-slate-600 dark:text-slate-400">{r.comments}</p>
                            </InfoCard>
                        )}

                        {/* Asset progress when in clearance */}
                        {r.stage === 'Clearance' && (
                            <InfoCard title="Clearance Progress">
                                <div className="space-y-1.5 text-sm">
                                    <ProgressRow label="Clearance Form" ok={r.clearanceFormSubmitted} />
                                    <ProgressRow label="Assets Returned" ok={r.allAssetsReturned}
                                        note={`${r.assetChecklist?.filter(a => a.returned).length ?? 0}/${r.assetChecklist?.length ?? 0}`} />
                                    <ProgressRow label="Dept. Tasks"
                                        ok={r.departmentTasks?.every(t => t.status !== 'Pending')}
                                        note={`${r.departmentTasks?.filter(t => t.status !== 'Pending').length ?? 0}/${r.departmentTasks?.length ?? 0}`}
                                    />
                                </div>
                            </InfoCard>
                        )}

                        {/* FNF summary in sidebar */}
                        {r.fnfProcessed && r.fnfSettlement?.netPayable !== undefined && (
                            <InfoCard title="FNF Settlement">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Net Payable</span>
                                    <span className={`text-xl font-black ${r.fnfSettlement.netPayable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ₹{Number(r.fnfSettlement.netPayable).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </InfoCard>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ── List view ────────────────────────────────────────────────────────── */
    return (
        <div className="w-full p-1 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div />
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-300 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-9 h-9 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                </div>
            ) : (
                <>
                    <ExitAnalytics analytics={analytics} />
                    <ExitRequestsTable requests={requests} onView={req => setSelected(req)} />
                </>
            )}
        </div>
    );
}

/* ── Shared sub-components ───────────────────────────────────────────────── */

function InfoCard({ title, children }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{title}</h4>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function InfoRow({ icon, label, value }) {
    return (
        <div className="flex items-start gap-2 text-sm">
            <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>
            <span className="text-slate-500 flex-shrink-0 w-24">{label}</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium break-all">{value}</span>
        </div>
    );
}

function ProgressRow({ label, ok, note }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-white text-xs flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-amber-400'}`}>
                {ok ? '✓' : '…'}
            </span>
            <span className={`flex-1 ${ok ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500'}`}>{label}</span>
            {note && <span className="text-xs text-slate-400">{note}</span>}
        </div>
    );
}

function ClearanceFormSummary({ form }) {
    if (!form?.handoverTo) return null;
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-orange-200 dark:border-orange-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                    <ShieldCheck size={15} className="text-orange-600" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Employee Clearance Form</h3>
            </div>
            <div className="space-y-3 text-sm">
                {form.handoverTo && <QA q="Handover To" a={form.handoverTo} />}
                {form.pendingTasks && <QA q="Pending Tasks" a={form.pendingTasks} />}
                {form.projectsStatus && <QA q="Projects Status" a={form.projectsStatus} />}
                {form.knowledgeTransferNotes && <QA q="Knowledge Transfer" a={form.knowledgeTransferNotes} />}
                {form.systemCredentials && <QA q="System Credentials" a={form.systemCredentials} />}
                {form.otherNotes && <QA q="Other Notes" a={form.otherNotes} />}
            </div>
        </div>
    );
}

function QA({ q, a }) {
    return (
        <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-0.5">{q}</p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{a}</p>
        </div>
    );
}

function ExitInterviewSummary({ interview }) {
    if (!interview?.submittedAt) return null;
    const satisfaction = ['', 'Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'][interview.jobSatisfaction] || '—';
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <MessageSquare size={15} className="text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Exit Interview (Employee Feedback)</h3>
            </div>
            <div className="space-y-3 text-sm">
                {interview.reasonForLeaving && <QA q="Reason for leaving" a={interview.reasonForLeaving} />}
                {interview.jobSatisfaction && <QA q="Job satisfaction" a={satisfaction} />}
                {interview.companyFeedback && <QA q="Company experience" a={interview.companyFeedback} />}
                {interview.managementFeedback && <QA q="Management feedback" a={interview.managementFeedback} />}
                {interview.suggestions && <QA q="Suggestions" a={interview.suggestions} />}
                {interview.wouldRecommend !== undefined && (
                    <QA q="Would recommend company" a={interview.wouldRecommend ? 'Yes' : 'No'} />
                )}
            </div>
        </div>
    );
}

const STAGE_COLORS = {
    'Requested': 'bg-slate-100 text-slate-600',
    'HR Review': 'bg-violet-50 text-violet-700',
    'Notice Period': 'bg-amber-50 text-amber-700',
    'Clearance': 'bg-orange-50 text-orange-700',
    'Exit Interview': 'bg-blue-50 text-blue-700',
    'FNF': 'bg-cyan-50 text-cyan-700',
    'Letters Generated': 'bg-indigo-50 text-indigo-700',
    'Deactivated': 'bg-emerald-50 text-emerald-700',
};
function StagePill({ stage }) {
    return (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[stage] || STAGE_COLORS['Requested']}`}>
            {stage}
        </span>
    );
}
