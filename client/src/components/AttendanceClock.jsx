import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, Clock, CheckCircle, AlertOctagon, Timer, MapPin, Activity } from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

// Helper to format seconds into HH:mm:ss
const formatDuration = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function AttendanceClock({
    isCheckedIn,
    isCheckedOut,
    checkInTime,
    lastPunchIn = null, // New: Time of the most recent IN punch
    baseWorkedSeconds = 0, // New: Total seconds from completed sessions
    onAction,
    isLoading,
    location = "Remote",
    settings = {},
    error = null,
    isFinalCheckOut = false,
    shift = null, // New: Assigned shift data
    accountDeactivated = false
}) {
    const [currentTime, setCurrentTime] = useState(new Date());

    // Timer State
    const [workedSeconds, setWorkedSeconds] = useState(0);
    const [isOvertime, setIsOvertime] = useState(false);

    // Constants
    // Dynamic Shift Duration
    const SHIFT_DURATION = (() => {
        if (shift && shift.startTime && shift.endTime) {
            try {
                const [startH, startM] = shift.startTime.split(':').map(Number);
                const [endH, endM] = shift.endTime.split(':').map(Number);

                let startMinutes = startH * 60 + startM;
                let endMinutes = endH * 60 + endM;

                if (endMinutes < startMinutes) {
                    // Next day logic (e.g. 18:00 to 03:00)
                    endMinutes += 24 * 60;
                }

                return (endMinutes - startMinutes) * 60; // in seconds
            } catch (e) {
                console.warn('Failed to calculate shift duration', e);
            }
        }
        return 8 * 60 * 60; // Fallback to 8 Hours in seconds
    })();

    // Live Clock Update
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Work Timer Logic
    useEffect(() => {
        let interval;

        const updateTimer = () => {
            // Worked time = Completed sessions + Current session (if running)
            let total = baseWorkedSeconds;

            if (isCheckedIn && !isCheckedOut && lastPunchIn) {
                const now = new Date();
                const start = new Date(lastPunchIn);
                const currentSessionSeconds = Math.max(0, (now - start) / 1000);
                total += currentSessionSeconds;
            }

            setWorkedSeconds(total);
            setIsOvertime(total > SHIFT_DURATION);
        };

        updateTimer(); // Initial calculation

        if (isCheckedIn && !isCheckedOut) {
            interval = setInterval(updateTimer, 1000);
        }

        return () => clearInterval(interval);
    }, [isCheckedIn, isCheckedOut, lastPunchIn, baseWorkedSeconds]);


    // UI Configuration
    const isMultipleMode = settings?.punchMode === 'multiple';
    
    // Calculate Progress (0 to 1), clamped at 1
    const progress = Math.min(workedSeconds / (SHIFT_DURATION || 8 * 3600), 1);
    const strokeDasharray = 2 * Math.PI * 45; // r=45
    const strokeDashoffset = strokeDasharray * (1 - progress);

    // Simulated Connection Data
    const biometricData = ["SYNCING...", "GPS: 26.9124", "GPS: 75.7873", "SECURE SESSION", "FREQ: 2.4GHZ", "STABLE", "ENCRYPTED"];

    return (
        <div className="w-full flex flex-col items-center justify-center min-h-[420px] relative font-sans">

            {/* Main Clock Container */}
            <div className="relative z-10 flex flex-col items-center w-full">

                {/* Hexagon/Unique Shape Wrapper - Reduced size to 72 (288px) to fit columns better */}
                <div className="relative w-72 h-72 flex items-center justify-center group cursor-default">

                    {/* 1. Holographic Ripple Effect - Only when Active */}
                    {isCheckedIn && !isCheckedOut && (
                        <div className="absolute inset-0 z-0">
                            <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ripple"></div>
                            <div className="absolute inset-0 rounded-full border border-indigo-500/10 animate-ripple [animation-delay:1.5s]"></div>
                        </div>
                    )}

                    {/* 2. Radar/Sonar Rings - Deep Background */}
                    <div className="absolute inset-2 rounded-full border border-indigo-500/5 animate-pulse"></div>
                    <div className="absolute inset-10 rounded-full border border-indigo-500/5 animate-[pulse_4s_infinite]"></div>

                    {/* 3. Outer HUD Notches & Biometric Labels */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
                        {/* Biometric Data Flow (Left side) */}
                        <div className="absolute left-4 top-0 bottom-0 flex flex-col items-start justify-center opacity-30 select-none">
                            <div className="animate-biometric flex flex-col gap-4">
                                {biometricData.concat(biometricData).map((d, i) => (
                                    <span key={i} className="text-[6px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">{d}</span>
                                ))}
                            </div>
                        </div>

                        {/* Satellite Sync Terminal (Right side) */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end gap-1 opacity-40">
                             <div className="flex items-center gap-1">
                                <span className="text-[5px] font-black text-slate-400 uppercase tracking-widest">SAT_LINK</span>
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                             </div>
                             <div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div>
                             <span className="text-[5px] font-black text-slate-400 uppercase tracking-widest">OS_VER 9.2.0</span>
                        </div>
                    </div>

                    {/* 4. Shift Progress Arc (SVG) */}
                    <svg className="absolute inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)] -rotate-90 pointer-events-none drop-shadow-[0_0_8px_rgba(20,184,166,0.3)]" viewBox="0 0 100 100">
                        {/* Gray background track */}
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800/30" strokeWidth="2" />
                        {/* Progress track */}
                        <circle 
                            cx="50" cy="50" r="45" 
                            fill="none" 
                            stroke="currentColor" 
                            className={`${isOvertime ? 'text-amber-500' : 'text-indigo-500'} transition-all duration-1000 ease-out`}
                            strokeWidth="3" 
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* 5. Main Premium Glass Disc - Better padding to prevent bleed */}
                    <div className="absolute inset-10 rounded-full glass-morphism dark:bg-slate-900/90 shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/30 dark:border-white/5 flex flex-col items-center justify-center z-20 overflow-hidden">
                        
                        {/* Heartbeat Visualizer (SVG) */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
                            <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                                <path 
                                    d="M0,50 L40,50 L50,20 L65,80 L75,50 L120,50 L130,10 L145,90 L155,50 L200,50" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="1.5" 
                                    className={`text-indigo-500 ${isCheckedIn && !isCheckedOut ? 'animate-[shimmer_2s_infinite_linear]' : ''}`}
                                />
                            </svg>
                        </div>

                        {/* Scanner Beam Line (Horizontal) */}
                        <div className={`absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent z-40 animate-[shimmer_2s_infinite_linear] opacity-30 ${isCheckedIn && !isCheckedOut ? 'block' : 'hidden'}`}></div>
                        
                        {/* Shimmer Base Overlay */}
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-45 animate-[shimmer_10s_infinite]" />

                        {/* Content Inside Disc */}
                        <div className="relative z-30 flex flex-col items-center">
                            {/* HUD Data Point */}
                            <div className="flex items-center gap-1.5 mb-2 bg-slate-500/5 px-2.5 py-0.5 rounded-full border border-white/10">
                                <Timer size={8} className="text-indigo-500" />
                                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">
                                    {isOvertime ? 'Extra Time' : 'Work Status'}
                                </span>
                            </div>

                            {/* Digital Timer - Massive & Sharp */}
                            <div className={`text-5xl font-black tabular-nums tracking-tighter mb-3 transition-all duration-700 ${isOvertime ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                                }`}>
                                {formatDuration(workedSeconds)}
                            </div>

                            {/* Status Connectivity Pill */}
                            <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-2 ${isCheckedIn && !isCheckedOut
                                ? 'bg-indigo-500 border border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-white/5'
                                }`}>
                                <Activity size={10} className={isCheckedIn && !isCheckedOut ? 'animate-heartbeat' : ''} />
                                {isCheckedIn && !isCheckedOut ? 'Checked In' : 'Checked Out'}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Real-time Digital HUD Below Clock */}
                <div className="mt-8 mb-6 flex flex-col items-center">
                    <div className="relative flex items-center gap-4">
                        <div className="h-px w-10 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800"></div>
                        
                        <div className="flex flex-col items-center">
                             <div className="text-3xl font-black text-slate-900 dark:text-white tracking-widest font-mono">
                                {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                                <span className="text-sm font-bold ml-1 opacity-30">
                                    :{currentTime.toLocaleTimeString('en-US', { hour12: false, second: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        </div>

                        <div className="h-px w-10 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800"></div>
                    </div>
                </div>

                {/* Unique Action Button - High Contrast */}
                <div className="w-full max-w-[280px] relative group button-wrapper z-[100]">
                    <div className={`absolute -inset-1 rounded-[20px] blur-md opacity-20 group-hover:opacity-60 transition duration-700 pointer-events-none ${isCheckedIn && !isCheckedOut 
                        ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]' 
                        : 'bg-indigo-500 shadow-[0_0_20px_rgba(20,184,166,0.3)]'
                        }`}></div>

                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onAction();
                        }}
                        disabled={isLoading || accountDeactivated}
                        className={`relative z-[110] w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all transform active:scale-[0.96] flex items-center justify-center gap-4 shadow-2xl overflow-hidden cursor-pointer disabled:cursor-not-allowed pointer-events-auto ${isCheckedIn && !isCheckedOut
                            ? 'bg-slate-900 text-rose-500 border border-rose-500/30 hover:bg-slate-950'
                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border border-indigo-400/30 hover:shadow-[0_0_30px_rgba(20,184,166,0.4)]'
                            }`}
                    >
                        {/* Button Icon */}
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : isCheckedIn && !isCheckedOut ? (
                            <>
                                <LogOut size={18} className="text-rose-500 animate-pulse" />
                                <span>Check Out</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={18} className="text-indigo-100 animate-float" />
                                <span>Check In</span>
                            </>
                        )}
                    </button>
                    
                    {error && (
                        <div className="absolute top-full left-0 right-0 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[10px] font-bold text-center animate-in fade-in uppercase tracking-wider backdrop-blur-md">
                            {error}
                        </div>
                    )}
                </div>

                {/* Location Tag */}
                <div className="mt-8 flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest hover:text-indigo-400 transition-colors cursor-default">
                    <MapPin size={12} />
                    {location}
                </div>

            </div>
        </div>
    );
}
