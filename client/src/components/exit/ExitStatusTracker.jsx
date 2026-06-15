import React from 'react';
import {
    Check, ClipboardList, Search, Timer,
    ShieldCheck, MessageSquare, IndianRupee, FileText, UserX, XCircle
} from 'lucide-react';

/**
 * 8-step workflow progress tracker for the HRMS resignation lifecycle.
 * Resignation → HR Review → Notice Period → Tasks & Clearance → Exit Interview → F&F → Letters → Deactivation
 */
const STEPS = [
    { key: 'Requested',         label: 'Resignation',     Icon: ClipboardList, color: 'slate'   },
    { key: 'HR Review',         label: 'HR Review',      Icon: Search,        color: 'violet'  },
    { key: 'Notice Period',     label: 'Notice Period',  Icon: Timer,         color: 'amber'   },
    { key: 'Clearance',         label: 'Tasks & Clear.', Icon: ShieldCheck,   color: 'orange'  },
    { key: 'Exit Interview',    label: 'Exit Interview', Icon: MessageSquare, color: 'blue'    },
    { key: 'FNF',               label: 'F&F Settlement', Icon: IndianRupee,   color: 'cyan'    },
    { key: 'Letters Generated', label: 'Letters',         Icon: FileText,      color: 'indigo' },
    { key: 'Deactivated',       label: 'Deactivated',    Icon: UserX,         color: 'emerald' },
];

const STAGE_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

const ACTIVE_RING  = { slate:'border-slate-500 text-slate-600', violet:'border-violet-500 text-violet-600', amber:'border-amber-500 text-amber-600', orange:'border-orange-500 text-orange-600', blue:'border-blue-500 text-blue-600', cyan:'border-cyan-500 text-cyan-600', indigo:'border-indigo-500 text-indigo-600', emerald:'border-emerald-500 text-emerald-600' };
const ACTIVE_TEXT  = { slate:'text-slate-600', violet:'text-violet-600', amber:'text-amber-600', orange:'text-orange-600', blue:'text-blue-600', cyan:'text-cyan-600', indigo:'text-indigo-600', emerald:'text-emerald-600' };
const ACTIVE_DESC  = { slate:'bg-slate-50 border-slate-200 text-slate-700', violet:'bg-violet-50 border-violet-200 text-violet-700', amber:'bg-amber-50 border-amber-200 text-amber-700', orange:'bg-orange-50 border-orange-200 text-orange-700', blue:'bg-blue-50 border-blue-200 text-blue-700', cyan:'bg-cyan-50 border-cyan-200 text-cyan-700', indigo:'bg-indigo-50 border-indigo-200 text-indigo-700', emerald:'bg-emerald-50 border-emerald-200 text-emerald-700' };

const STEP_DESCRIPTION = {
    'Requested':         'Your resignation has been received and is awaiting HR review.',
    'HR Review':         'HR is reviewing your resignation request.',
    'Notice Period':     'You are serving your notice period. Complete tasks and handover before last working day.',
    'Clearance':         'Complete knowledge transfer, asset returns, and department tasks.',
    'Exit Interview':    'Share your feedback in the exit interview (confidential).',
    'FNF':               'Finance is processing your Full & Final settlement.',
    'Letters Generated': 'Your Experience & Relieving letters have been generated.',
    'Deactivated':       'Resignation complete. Your account has been deactivated.',
};

export default function ExitStatusTracker({ stage, status, rejectionReason }) {
    if (status === 'Rejected') {
        return (
            <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-2xl border border-rose-200 dark:border-rose-800">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-rose-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-rose-500/25">
                        <XCircle size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-rose-800 dark:text-rose-200">Exit Request Rejected</h3>
                        <p className="text-sm text-rose-600 dark:text-rose-400 mt-1 leading-relaxed">
                            {rejectionReason || 'No reason provided.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const currentIdx  = STAGE_INDEX[stage] ?? 0;
    const isCompleted = status === 'Completed';
    const activeStep  = isCompleted ? null : STEPS[currentIdx];
    const progressPct = isCompleted ? 100 : (currentIdx / (STEPS.length - 1)) * 100;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Resignation Progress</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isCompleted ? 'All stages completed.' : `Current: ${stage}`}
                    </p>
                </div>
                {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-bold border border-emerald-200">
                        <Check size={11} strokeWidth={3} /> Completed
                    </span>
                ) : (
                    <span className="text-xs font-semibold text-slate-400">
                        Step {currentIdx + 1} / {STEPS.length}
                    </span>
                )}
            </div>

            <div className="px-6 py-6">
                {/* Progress bar */}
                <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-6">
                    <div
                        className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-violet-400 via-amber-400 to-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                {/* Steps — scrollable on small screens */}
                <div className="flex justify-between gap-0.5 overflow-x-auto pb-2">
                    {STEPS.map((step, idx) => {
                        const done   = idx < currentIdx || isCompleted;
                        const active = idx === currentIdx && !isCompleted;
                        const { Icon, color } = step;
                        const ring = ACTIVE_RING[color] || ACTIVE_RING.slate;
                        const text = ACTIVE_TEXT[color] || ACTIVE_TEXT.slate;

                        return (
                            <div key={step.key} className="flex flex-col items-center gap-1.5 min-w-[48px]">
                                <div className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-500 z-10
                                    ${done
                                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                                        : active
                                            ? `border-2 shadow-lg scale-110 bg-white dark:bg-slate-900 ${ring}`
                                            : 'bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400'
                                    }`}
                                >
                                    {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                                    {active && <span className="absolute inset-0 rounded-lg bg-current opacity-10 animate-pulse scale-125" />}
                                </div>
                                <p className={`text-center text-[8px] font-bold uppercase tracking-wide leading-tight truncate max-w-[56px]
                                    ${active ? text : done ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'}`}
                                >
                                    {step.label}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Active step description */}
                {activeStep && (
                    <div className={`mt-5 px-4 py-3 rounded-xl border text-sm font-medium dark:bg-opacity-20 dark:border-opacity-40 ${ACTIVE_DESC[activeStep.color]}`}>
                        <span className="font-bold">Now: </span>{STEP_DESCRIPTION[activeStep.key]}
                    </div>
                )}
            </div>
        </div>
    );
}
