import React from 'react';
import {
    FileText, Clock, CheckCircle2, XCircle, ThumbsUp,
    Search, Timer, ShieldCheck, IndianRupee, BookOpen, UserX
} from 'lucide-react';

const SUMMARY_CARDS = [
    { key: 'total', label: 'Total', icon: FileText, from: 'from-blue-500', to: 'to-indigo-600', shadow: 'shadow-blue-500/20' },
    { key: 'pending', label: 'Pending', icon: Clock, from: 'from-amber-400', to: 'to-orange-500', shadow: 'shadow-amber-500/20' },
    { key: 'approved', label: 'In Progress', icon: ThumbsUp, from: 'from-indigo-400', to: 'to-cyan-500', shadow: 'shadow-indigo-500/20' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, from: 'from-emerald-400', to: 'to-green-500', shadow: 'shadow-emerald-500/20' },
    { key: 'rejected', label: 'Rejected', icon: XCircle, from: 'from-rose-500', to: 'to-red-600', shadow: 'shadow-rose-500/20' },
];

const STAGE_CARDS = [
    { key: 'Requested', label: 'Requested', Icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
    { key: 'HR Review', label: 'HR Review', Icon: Search, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { key: 'Notice Period', label: 'Notice', Icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { key: 'Clearance', label: 'Clearance', Icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { key: 'FNF', label: 'FNF', Icon: IndianRupee, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
    { key: 'Letters Generated', label: 'Letters', Icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { key: 'Deactivated', label: 'Done', Icon: UserX, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
];

export default function ExitAnalytics({ analytics }) {
    if (!analytics) return null;
    const { stageBreakdown = {} } = analytics;

    return (
        <div className="space-y-4">
            {/* Status summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {SUMMARY_CARDS.map(({ key, label, icon: Icon, from, to, shadow }) => (
                    <div key={key}
                        className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                    >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center text-white mb-3 shadow-md ${shadow} group-hover:rotate-6 transition-transform`}>
                            <Icon size={18} />
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{analytics[key] ?? 0}</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Stage pipeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Live Stage Pipeline</p>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {STAGE_CARDS.map(({ key, label, Icon, color, bg }) => (
                        <div key={key} className={`rounded-xl ${bg} px-2 py-3 text-center`}>
                            <Icon size={16} className={`${color} mx-auto mb-1`} />
                            <p className={`text-xl font-black ${color}`}>{stageBreakdown[key] ?? 0}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide leading-tight mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
