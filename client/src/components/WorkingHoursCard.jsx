import React, { useState, useEffect } from 'react';
import { Clock, Briefcase, Timer } from 'lucide-react';
import { formatDuration } from '../utils/dateUtils';


export default function WorkingHoursCard({
    baseHours = 0, // Closed sessions hours from backend
    lastPunchIn = null, // Time of the LAST punch IN
    isActive = false // If currently working
}) {
    const [totalSeconds, setTotalSeconds] = useState(0);

    useEffect(() => {
        const updateTimer = () => {
            const baseSeconds = baseHours * 3600;

            if (isActive && lastPunchIn) {
                const now = new Date();
                const start = new Date(lastPunchIn);
                const currentSessionSeconds = Math.max(0, (now - start) / 1000);
                setTotalSeconds(baseSeconds + currentSessionSeconds);
            } else {
                setTotalSeconds(baseSeconds);
            }
        };

        updateTimer(); // Initial call

        let interval;
        if (isActive) {
            interval = setInterval(updateTimer, 1000);
        }

        return () => clearInterval(interval);
    }, [baseHours, lastPunchIn, isActive]);

    // Business Logic
    const SHIFT_LIMIT = 8 * 3600; // 8 hours in seconds
    const shiftSeconds = Math.min(totalSeconds, SHIFT_LIMIT);
    const overtimeSeconds = Math.max(0, totalSeconds - SHIFT_LIMIT);

    return (
        <div className="glass-morphism p-6 rounded-[24px] border-slate-100 dark:border-white/5 shadow-2xl flex flex-col justify-between group h-full relative overflow-hidden">
            
            {/* Background Decorative Element */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>

            {/* Header / Total Section */}
            <div className="mb-8 select-none">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Operational Yield</span>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-80">Chronos Monitor</h3>
                    </div>
                    {overtimeSeconds > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Surplus Active</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums drop-shadow-sm">
                        {formatDuration(totalSeconds, true)}
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 mt-1">Total Accumulated Time</div>
                </div>
            </div>

            {/* Shift & Overtime Breakdown Grid */}
            <div className="grid grid-cols-2 gap-4 relative z-10">

                {/* Shift Box - Premium Design */}
                <div className="glass-morphism bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/10 rounded-2xl p-4 hover:border-indigo-500/30 transition-all card-hover-bright">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                           <Briefcase size={12} />
                        </div>
                        <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Base Protocol</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums leading-none mb-2">
                        {formatDuration(shiftSeconds, true)}
                    </div>
                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                       <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                       Threshold: 08:00
                    </div>
                </div>

                {/* Overtime Box - Premium Design */}
                <div className={`glass-morphism border-emerald-500/10 rounded-2xl p-4 transition-all duration-500 card-hover-bright ${overtimeSeconds > 0
                    ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-white/5 opacity-60'
                    }`}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg ${overtimeSeconds > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-200 dark:bg-slate-700 text-slate-400"}`}>
                           <Timer size={12} />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${overtimeSeconds > 0 ? "text-emerald-500" : "text-slate-400"}`}>Surplus</span>
                    </div>
                    <div className={`text-2xl font-black tabular-nums leading-none mb-2 ${overtimeSeconds > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}>
                        {formatDuration(overtimeSeconds, true)}
                    </div>
                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                       <span className={`w-1 h-1 rounded-full ${overtimeSeconds > 0 ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                       {overtimeSeconds > 0 ? "Net Excess" : "Nominal"}
                    </div>
                </div>

            </div>
        </div>
    );
}
