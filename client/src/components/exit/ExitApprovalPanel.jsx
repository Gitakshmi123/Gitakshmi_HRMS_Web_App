import React, { useState } from 'react';
import {
    Flag, CheckCircle2, XCircle, Search, Timer,
    ShieldCheck, IndianRupee, FileText, UserX, ArrowRight
} from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

/**
 * HR-only action panel — handles all 7 offboarding stages.
 *
 *   Requested        → Start HR Review
 *   HR Review        → Approve (→ Notice Period) | Reject
 *   Notice Period    → Move to Clearance
 *   Clearance        → Mark Clearance Complete (→ FNF) — asset/task panels handle the detail
 *   FNF              → FNF handled by FNFSettlementPanel; this shows summary
 *   Letters Generated→ Deactivate Employee
 *   Deactivated      → Done
 */
export default function ExitApprovalPanel({ request, onUpdate }) {
    const [remarks, setRemarks]                 = useState('');
    const [lastWorkingDate, setLastWorkingDate] = useState(
        request.lastWorkingDate ? new Date(request.lastWorkingDate).toISOString().slice(0, 10) : ''
    );
    const [loading, setLoading] = useState(false);

    const run = async (fn, successMsg) => {
        try {
            setLoading(true);
            await fn();
            toast.success(successMsg);
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const advance = (stage, extra = {}) =>
        run(() => exitAPI.updateStage(request._id, { stage, remarks, lastWorkingDate, ...extra }), `Moved to "${stage}".`);

    const { stage, status } = request;

    if (status === 'Rejected') {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-900/10 p-5 text-sm text-rose-700 font-medium text-center">
                This exit request has been rejected.
            </div>
        );
    }

    if (stage === 'Deactivated') {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 p-5 text-sm text-emerald-700 font-medium text-center">
                ✓ Offboarding complete. Employee account has been deactivated.
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
            <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                <Flag size={16} className="text-indigo-500" />
                HR Actions
                <StageBadge stage={stage} />
            </h3>

            {/* ── Requested ─────────────────────────────────────────────────── */}
            {stage === 'Requested' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        A new resignation request is waiting. Start the review to begin the offboarding process.
                    </p>
                    <Field label="Initial Remarks (optional)">
                        <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
                            placeholder="Add notes..."
                            className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-violet-400 outline-none" />
                    </Field>
                    <div className="flex gap-3">
                        <Btn loading={loading} color="violet" Icon={Search} onClick={() => advance('HR Review')}>
                            Start HR Review
                        </Btn>
                        <RejectBtn loading={loading} remarks={remarks} request={request} onUpdate={onUpdate} />
                    </div>
                </div>
            )}

            {/* ── HR Review ─────────────────────────────────────────────────── */}
            {stage === 'HR Review' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Review the resignation. Set the last working date and approve to begin the notice period.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Last Working Date">
                            <input type="date" value={lastWorkingDate} onChange={e => setLastWorkingDate(e.target.value)}
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400 outline-none" />
                        </Field>
                        <Field label="HR Remarks">
                            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
                                placeholder="Optional remarks..."
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400 outline-none" />
                        </Field>
                    </div>
                    <div className="flex gap-3">
                        <Btn loading={loading} color="indigo" Icon={CheckCircle2} onClick={() => advance('Notice Period')}>
                            Approve & Start Notice Period
                        </Btn>
                        <RejectBtn loading={loading} remarks={remarks} request={request} onUpdate={onUpdate} />
                    </div>
                    <p className="text-[11px] text-slate-400">Rejection reason must be in the remarks field.</p>
                </div>
            )}

            {/* ── Notice Period ──────────────────────────────────────────────── */}
            {stage === 'Notice Period' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        The employee is serving their notice period.
                        {request.lastWorkingDate && (
                            <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                                Last working day: {new Date(request.lastWorkingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        )}
                    </p>
                    <p className="text-sm text-slate-500">When notice is complete, proceed to Exit Clearance to collect assets and complete handover.</p>
                    <Btn loading={loading} color="orange" Icon={ShieldCheck} onClick={() => advance('Clearance')}>
                        Move to Exit Clearance
                    </Btn>
                </div>
            )}

            {/* ── Clearance ─────────────────────────────────────────────────── */}
            {stage === 'Clearance' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Manage asset returns, department tasks, and the employee's handover form below.
                        When clearance is complete, move to Exit Interview.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        <ClearanceStat label="Clearance Form" value={request.clearanceFormSubmitted ? '✓ Submitted' : 'Pending'} ok={request.clearanceFormSubmitted} />
                        <ClearanceStat label="Assets"
                            value={`${request.assetChecklist?.filter(a => a.returned).length ?? 0}/${request.assetChecklist?.length ?? 0} returned`}
                            ok={request.allAssetsReturned} />
                        <ClearanceStat label="Dept. Tasks"
                            value={`${request.departmentTasks?.filter(t => t.status !== 'Pending').length ?? 0}/${request.departmentTasks?.length ?? 0} done`}
                            ok={request.departmentTasks?.every(t => t.status !== 'Pending')} />
                    </div>
                    <Btn loading={loading} color="blue" Icon={ArrowRight} onClick={() => advance('Exit Interview')}>
                        Move to Exit Interview
                    </Btn>
                </div>
            )}

            {/* ── Exit Interview ────────────────────────────────────────────── */}
            {stage === 'Exit Interview' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {request.exitInterviewCompleted
                            ? 'Employee has submitted exit interview feedback. Proceed to F&F Settlement.'
                            : 'Employee can submit exit interview feedback from their portal. You may still proceed to FNF when ready.'}
                    </p>
                    {request.exitInterviewCompleted && request.exitInterview?.reasonForLeaving && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold">Reason for leaving: </span>
                            {request.exitInterview.reasonForLeaving}
                        </div>
                    )}
                    <Btn loading={loading} color="cyan" Icon={IndianRupee} onClick={() => advance('FNF')}>
                        Proceed to F&F Settlement
                    </Btn>
                </div>
            )}

            {/* ── FNF ───────────────────────────────────────────────────────── */}
            {stage === 'FNF' && (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {request.fnfProcessed
                            ? '✓ FNF settlement has been processed. Generate the exit letters below.'
                            : 'Process the Full & Final Settlement using the FNF panel below, then generate letters.'}
                    </p>
                    {request.fnfProcessed && (
                        <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-200 dark:border-cyan-800 px-4 py-3 flex items-center justify-between">
                            <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Net Payable</span>
                            <span className="text-xl font-black text-cyan-700 dark:text-cyan-300">
                                ₹{(request.fnfSettlement?.netPayable ?? 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                    )}
                    {request.fnfProcessed && (
                        <Btn loading={loading} color="blue" Icon={FileText}
                            onClick={() => run(() => exitAPI.generateLetters(request._id), 'Letters generated!')}
                        >
                            Generate Experience & Relieving Letters
                        </Btn>
                    )}
                </div>
            )}

            {/* ── Letters Generated ─────────────────────────────────────────── */}
            {stage === 'Letters Generated' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Both letters have been generated. You can preview them in the Letters panel below.
                        The final step is to deactivate the employee's account.
                    </p>
                    <div className="bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-200 dark:border-rose-800 p-4">
                        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200 mb-1">⚠ Account Deactivation</p>
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                            This action will prevent the employee from logging in. It cannot be undone from this panel.
                        </p>
                    </div>
                    <Btn loading={loading} color="rose" Icon={UserX}
                        onClick={() => run(() => exitAPI.deactivateEmployee(request._id), 'Employee account deactivated.')}
                    >
                        Deactivate Employee Account
                    </Btn>
                </div>
            )}
        </div>
    );
}

/* ── Shared sub-components ───────────────────────────────────────────────── */

const BTN_COLORS = {
    indigo:    'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/25',
    violet:  'bg-violet-500 hover:bg-violet-600 shadow-violet-500/25',
    amber:   'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25',
    orange:  'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25',
    cyan:    'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/25',
    blue:    'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25',
    emerald: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25',
    rose:    'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25',
};

function Btn({ loading, color = 'indigo', Icon, onClick, children }) {
    return (
        <button disabled={loading} onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 ${BTN_COLORS[color]}`}
        >
            <Icon size={15} /> {children}
        </button>
    );
}

function RejectBtn({ loading, remarks, request, onUpdate }) {
    const handle = async () => {
        if (!remarks.trim()) { toast.error('Please enter a rejection reason in the remarks field.'); return; }
        try {
            await exitAPI.rejectRequest(request._id, remarks);
            toast.success('Request rejected.');
            if (onUpdate) onUpdate();
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to reject.'); }
    };
    return (
        <button disabled={loading} onClick={handle}
            className="flex items-center gap-2 px-4 py-2 text-rose-600 text-sm font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-50"
        >
            <XCircle size={15} /> Reject
        </button>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>
            {children}
        </div>
    );
}

function ClearanceStat({ label, value, ok }) {
    return (
        <div className={`rounded-xl px-3 py-2.5 text-center border ${ok ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
            <p className={`text-xs font-bold ${ok ? 'text-emerald-600' : 'text-slate-500'}`}>{label}</p>
            <p className={`text-[11px] mt-0.5 font-semibold ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</p>
        </div>
    );
}

const STAGE_COLORS = {
    'Requested':        'bg-slate-100 text-slate-600',
    'HR Review':        'bg-violet-50 text-violet-700',
    'Notice Period':    'bg-amber-50 text-amber-700',
    'Clearance':        'bg-orange-50 text-orange-700',
    'Exit Interview':   'bg-blue-50 text-blue-700',
    'FNF':              'bg-cyan-50 text-cyan-700',
    'Letters Generated':'bg-indigo-50 text-indigo-700',
    'Deactivated':      'bg-emerald-50 text-emerald-700',
};
function StageBadge({ stage }) {
    return (
        <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[stage] || STAGE_COLORS['Requested']}`}>
            {stage}
        </span>
    );
}
