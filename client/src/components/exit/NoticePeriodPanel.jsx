import React from 'react';
import { CalendarDays, Clock, Timer } from 'lucide-react';

/**
 * Notice Period Management — shows start date, end date, and remaining days.
 * Displayed when stage is Notice Period or later (for reference).
 */
export default function NoticePeriodPanel({ request }) {
    const start = request.noticePeriodStartDate ? new Date(request.noticePeriodStartDate) : null;
    const end = request.lastWorkingDate ? new Date(request.lastWorkingDate) : null;
    const days = request.noticePeriodDays ?? 30;
    const summary = request.workflowSummary;

    const endDate = end || (start && days ? (() => {
        const e = new Date(start);
        e.setDate(e.getDate() + days);
        return e;
    })() : null);

    const fmt = (d) => d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const remaining = summary?.remainingDays ?? (endDate ? (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((e - today) / (1000 * 60 * 60 * 24)));
    })() : null);

    const show = ['Notice Period', 'Clearance', 'Exit Interview', 'FNF', 'Letters Generated', 'Deactivated'].includes(request.stage);
    if (!show) return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                    <Timer size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">Notice Period</h3>
                    <p className="text-xs text-slate-500">Start, end date & remaining days</p>
                </div>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <CalendarDays size={18} className="text-amber-500 flex-shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{fmt(start)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <CalendarDays size={18} className="text-amber-500 flex-shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">End Date (LWD)</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{fmt(endDate)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Clock size={18} className="text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Remaining Days</p>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{remaining != null ? remaining : '—'}</p>
                    </div>
                </div>
            </div>
            {request.stage === 'Notice Period' && (
                <p className="px-6 pb-4 text-xs text-slate-500">
                    Complete knowledge transfer, asset clearance, and department tasks before your last working day.
                </p>
            )}
        </div>
    );
}
