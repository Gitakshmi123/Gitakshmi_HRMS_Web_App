import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, Calendar as CalendarIcon, CheckCircle, Layers, 
    MapPin, Activity, AlertCircle, TrendingUp,
    Bell, User, ChevronRight, Info, LogIn, LogOut,
    CheckCircle2, Clock3, LayoutDashboard, Target,
    MousePointer2, ArrowRight, Plane, MoreVertical, RefreshCcw,
    CheckSquare, Crosshair, HelpCircle, Search, ListTodo, Plus, ChevronLeft,
    Send, Users, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal, message, Tag } from 'antd';
import clsx from 'clsx';
import api from '../../utils/api';
import { Can } from "../../components/rbac/PermissionGate";
import { useAuth } from "../../context/AuthContext";
import { getScopedStorageKey } from '../../utils/sidebarStorage';

const getGreetingInfo = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
};

export default function DashboardTab({
    profile,
    stats,
    isCheckedIn,
    isCheckedOut,
    todayRecord,
    todaySummary,
    attendance = [],
    balances = [],
    handleClockInOut,
    clocking,
    lastUpdated,
    isSidebarCollapsed,
    setActiveTab,
    isActive,
    settings,
    projects = [],
    refreshTasks,
    tasksLastUpdated,
    birthdays = []
}) {
    const { user } = useAuth();
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [taskQuery, setTaskQuery] = useState('');
    const [taskStatusFilter, setTaskStatusFilter] = useState('pending'); // all | pending | done
    const [taskPage, setTaskPage] = useState(1);
    const [taskPageSize, setTaskPageSize] = useState(6);
    const [expandedTaskKey, setExpandedTaskKey] = useState(null);

    const [logPage, setLogPage] = useState(1);
    const [logPageSize, setLogPageSize] = useState(5);

    // Birthday States
    const [selectedBday, setSelectedBday] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [newWish, setNewWish] = useState('');
    const [currentWishes, setCurrentWishes] = useState([]);
    const [loadingWishes, setLoadingWishes] = useState(false);
    const [metricStyles, setMetricStyles] = useState({ bg: '', text: '' });

    useEffect(() => {
        const loadMetricStyles = () => {
            try {
                const scopedKey = getScopedStorageKey('hrms:sidebar:advanced-config:v1', { user, panel: 'employee' });
                const cfg = JSON.parse(localStorage.getItem(scopedKey) || '{}');
                if (cfg?.appearance) {
                    setMetricStyles({
                        bg: cfg.appearance.metricBgColor || '',
                        text: cfg.appearance.metricTextColor || ''
                    });
                } else {
                    setMetricStyles({ bg: '', text: '' });
                }
            } catch (e) { }
        };

        loadMetricStyles();
        window.addEventListener('hrms:appearance:changed', loadMetricStyles);
        return () => window.removeEventListener('hrms:appearance:changed', loadMetricStyles);
    }, [user]);

    const handleSendWish = async () => {
        if (!newWish.trim() || !selectedBday) return;
        const empId = selectedBday._id;
        
        try {
            const res = await api.post(`/employee/birthdays/${empId}/wish`, { message: newWish });
            if (res.data.success) {
                const w = res.data.data;
                setCurrentWishes(prev => [...prev, {
                    _id: w._id,
                    from: w.commenterName,
                    text: w.message,
                    time: new Date(w.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
                    color: 'rose'
                }]);
                setNewWish('');
                message.success('Wish posted! 🎈');
            }
        } catch (err) {
            console.error("Post wish error:", err);
            message.error("Failed to post wish");
        }
    };

    const fetchWishes = async (empId) => {
        setLoadingWishes(true);
        try {
            const res = await api.get(`/employee/birthdays/${empId}/wishes`);
            if (res.data.success) {
                const formatted = res.data.data.map(w => ({
                    _id: w._id,
                    from: w.commenterName,
                    text: w.message,
                    time: new Date(w.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
                    color: w.commentedByRole === 'hr' ? 'purple' : 'blue'
                }));
                setCurrentWishes(formatted);
            }
        } catch (err) {
            console.error("Fetch wishes error:", err);
        } finally {
            setLoadingWishes(false);
        }
    };

    const triggerCelebration = (emp) => {
        setSelectedBday(emp);
        fetchWishes(emp._id);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    };

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    const Confetti = ({ active }) => {
        if (!active) return null;
        return (
            <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center overflow-hidden">
                {[...Array(60)].map((_, i) => {
                    const angle = Math.random() * Math.PI * 2;
                    const velocity = 400 + Math.random() * 600;
                    const xDir = Math.cos(angle) * velocity;
                    const yDir = Math.sin(angle) * velocity;
                    
                    return (
                        <motion.div
                            key={i}
                            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                            animate={{
                                x: xDir,
                                y: [0, yDir - 200, yDir + 400],
                                scale: [0, 1, 1, 0],
                                opacity: [1, 1, 0.8, 0],
                                rotate: Math.random() * 720,
                            }}
                            transition={{ duration: 2.5, ease: "easeOut" }}
                            style={{
                                position: 'absolute',
                                width: Math.random() * 10 + 6 + 'px',
                                height: Math.random() * 10 + 6 + 'px',
                                backgroundColor: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                            }}
                        />
                    );
                })}
            </div>
        );
    };

    // Auto-select first project if none selected
    useEffect(() => {
        if (!activeProjectId && projects.length > 0) {
            setActiveProjectId(projects[0].id);
        }
    }, [projects, activeProjectId]);

    const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
    const tasks = activeProject?.tasks || [];

    // Reset pagination when switching project / filters
    useEffect(() => {
        setTaskPage(1);
        setExpandedTaskKey(null);
    }, [activeProjectId, taskStatusFilter, taskPageSize, taskQuery]);

    const filteredTasks = useMemo(() => {
        const q = String(taskQuery || '').trim().toLowerCase();
        return (Array.isArray(tasks) ? tasks : [])
            .filter((t) => {
                const st = String(t?.status || '').toLowerCase();
                const isDone = st === 'completed';
                if (taskStatusFilter === 'done' && !isDone) return false;
                if (taskStatusFilter === 'pending' && isDone) return false;
                if (!q) return true;
                return String(t?.title || '').toLowerCase().includes(q);
            });
    }, [tasks, taskQuery, taskStatusFilter]);

    const taskTotal = filteredTasks.length;
    const taskTotalPages = Math.max(1, Math.ceil(taskTotal / taskPageSize));
    const safeTaskPage = Math.min(taskPage, taskTotalPages);
    const taskStartIdx = (safeTaskPage - 1) * taskPageSize;
    const pagedTasks = filteredTasks.slice(taskStartIdx, taskStartIdx + taskPageSize);

    // Timer Logic
    const baseHours = todaySummary?.workingHours || 0;

    // Correctly find the start of the current session
    const lastPunchIn = useMemo(() => {
        if (!isActive || !todayRecord) return null;
        const logs = todayRecord.logs || [];
        if (logs.length > 0) {
            const lastInLog = [...logs].reverse().find(l => l.type === 'IN');
            return lastInLog ? lastInLog.time : todayRecord.checkIn;
        }
        return todayRecord.checkIn;
    }, [isActive, todayRecord]);

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

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [baseHours, lastPunchIn, isActive]);

    // -- Shift OT Config --
    // Checks per-shift overtimeCfg OR legacy attendanceRules OR global attendance settings
    const shiftInfo = useMemo(() => {
        const sh = profile?.shiftId;
        let shiftHours = 8;
        let shiftOtEnabled = false;

        if (sh && typeof sh === 'object' && sh._id) {
            // Shift is fully populated by backend
            shiftOtEnabled =
                !!(sh.overtimeCfg?.enabled) ||
                !!(sh.attendanceRules?.overtimeAllowed);

            if (sh.startTime && sh.endTime) {
                const toMins = (hhmm) => {
                    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
                    return (h || 0) * 60 + (m || 0);
                };
                let diff = toMins(sh.endTime) - toMins(sh.startTime);
                if (diff <= 0) diff += 24 * 60; // night shift
                const breakMins = Number(sh.breakMinutes || 0);
                const netHours = parseFloat(((diff - breakMins) / 60).toFixed(2));
                shiftHours = netHours > 0 ? netHours : parseFloat((diff / 60).toFixed(2));
            }
        } else if (sh && typeof sh === 'string') {
            // shiftId is just an ObjectId string — not populated
            // Fall through to global settings below
        }

        // Global attendance settings overtime flag:
        // If global overtimeAllowed is true, it overrides per-shift (or fills in when no shift)
        const globalOtEnabled = !!(settings?.overtimeAllowed);
        const globalShiftStart = settings?.shiftStartTime || '09:00';
        const globalShiftEnd   = settings?.shiftEndTime   || '18:00';

        // If no shift populated, derive hours from global settings
        if (!sh || typeof sh === 'string') {
            const toMins = (hhmm) => {
                const [h, m] = String(hhmm || '0:0').split(':').map(Number);
                return (h || 0) * 60 + (m || 0);
            };
            let diff = toMins(globalShiftEnd) - toMins(globalShiftStart);
            if (diff <= 0) diff += 24 * 60;
            shiftHours = parseFloat((diff / 60).toFixed(2));
        }

        const overtimeAllowed = shiftOtEnabled || globalOtEnabled;
        return { shiftHours, overtimeAllowed, globalOtEnabled, shiftOtEnabled };
    }, [profile, settings]);

    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const totalSecsRemaining = Math.floor(totalSeconds % 60);
    const requiredHours = shiftInfo.shiftHours || 8.5;
    
    const totalHoursDec = totalSeconds / 3600;
    const workingHoursDec = Math.min(totalHoursDec, requiredHours);
    const otHoursDec = Math.max(0, totalHoursDec - requiredHours);
    
    // Scale max width of the bar
    const maxScaleHours = Math.max(requiredHours, totalHoursDec || 1); // prevent division by zero
    const regularBarPercent = (workingHoursDec / maxScaleHours) * 100;
    const otBarPercent = (otHoursDec / maxScaleHours) * 100;

    const weeklyData = useMemo(() => {
        return [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dStr = d.toLocaleDateString();
            const record = attendance.find(a => new Date(a.date).toLocaleDateString() === dStr);
            const totalHrs = record ? (record.workingHours || 0) : 0;
            const otHrs = shiftInfo.overtimeAllowed ? parseFloat(Math.max(0, totalHrs - shiftInfo.shiftHours).toFixed(2)) : 0;
            return {
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                hours: totalHrs,
                regularHrs: parseFloat(Math.min(totalHrs, shiftInfo.shiftHours).toFixed(2)),
                otHrs,
                active: d.toLocaleDateString() === new Date().toLocaleDateString()
            };
        });
    }, [attendance, shiftInfo]);

    const maxHours = Math.max(...weeklyData.map(d => d.hours), shiftInfo.shiftHours, requiredHours);
    const weekTotalOT = weeklyData.reduce((s, d) => s + d.otHrs, 0);
    const weekTotalHours = weeklyData.reduce((s, d) => s + d.hours, 0);

    const todayPunches = useMemo(() => {
        const punches = [];
        attendance.forEach((att) => {
            if (att.logs?.length > 0) {
                att.logs.forEach(log => punches.push({ ...log, date: att.date }));
            } else {
                if (att.checkIn) punches.push({ type: 'IN', time: att.checkIn, date: att.date });
                if (att.checkOut) punches.push({ type: 'OUT', time: att.checkOut, date: att.date });
            }
        });
        return punches
            .filter(p => new Date(p.date).toLocaleDateString() === new Date().toLocaleDateString())
            .sort((a, b) => new Date(b.time) - new Date(a.time));
    }, [attendance]);

    const logDays = useMemo(() => {
        const shiftStartTime = settings?.shiftStartTime || "09:00";
        const graceMinutes = Number(settings?.graceTimeMinutes ?? 0);

        const toMinutesFromHHMM = (hhmm) => {
            const [h, m] = String(hhmm || "0:0").split(':').map(n => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) return 0;
            return h * 60 + m;
        };

        const shiftStartMinutes = toMinutesFromHHMM(shiftStartTime);

        const pickFirstIn = (att) => {
            const logs = Array.isArray(att?.logs) ? att.logs : [];
            const inLogs = logs.filter(l => l?.type === 'IN' && l?.time).sort((a, b) => new Date(a.time) - new Date(b.time));
            return inLogs[0]?.time || att?.firstPunch || att?.checkIn || null;
        };

        const pickLastOut = (att) => {
            const logs = Array.isArray(att?.logs) ? att.logs : [];
            const outLogs = logs.filter(l => l?.type === 'OUT' && l?.time).sort((a, b) => new Date(b.time) - new Date(a.time));
            return outLogs[0]?.time || att?.lastPunch || att?.checkOut || null;
        };

        const formatTime = (t) => {
            if (!t) return '-';
            const d = new Date(t);
            if (Number.isNaN(d.getTime())) return '-';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const calcLateMinutes = (dayDate, checkInTime) => {
            if (!checkInTime) return null;
            const d = new Date(dayDate || checkInTime);
            const ci = new Date(checkInTime);
            if (Number.isNaN(d.getTime()) || Number.isNaN(ci.getTime())) return null;

            const shiftStart = new Date(d);
            shiftStart.setHours(Math.floor(shiftStartMinutes / 60), shiftStartMinutes % 60, 0, 0);

            const lateMs = ci - shiftStart - graceMinutes * 60 * 1000;
            if (lateMs <= 0) return 0;
            return Math.round(lateMs / 60000);
        };

        const rows = (Array.isArray(attendance) ? attendance : [])
            .map((att) => {
                const dateObj = new Date(att?.date);
                const checkIn = pickFirstIn(att);
                const checkOut = pickLastOut(att);
                const lateMinutes = calcLateMinutes(att?.date, checkIn);
                return {
                    date: att?.date,
                    dateObj,
                    checkIn,
                    checkOut,
                    lateMinutes,
                };
            })
            .filter(r => r.dateObj instanceof Date && !Number.isNaN(r.dateObj.getTime()))
            .sort((a, b) => b.dateObj - a.dateObj)
            .slice(0, 31);

        return rows.map(r => ({
            ...r,
            dateLabel: r.dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
            dayLabel: r.dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
            checkInLabel: formatTime(r.checkIn),
            checkOutLabel: formatTime(r.checkOut),
        }));
    }, [attendance, settings]);

    const logTotal = logDays.length;
    const logTotalPages = Math.max(1, Math.ceil(logTotal / logPageSize));
    const safeLogPage = Math.min(logPage, logTotalPages);
    const logStartIdx = (safeLogPage - 1) * logPageSize;
    const pagedLogs = logDays.slice(logStartIdx, logStartIdx + logPageSize);

    const myChallenges = useMemo(() => [
        { id: 1, text: `Finish today's ${requiredHours}h requirement`, completed: totalHoursDec >= requiredHours },
        { id: 2, text: "Verify shift attendance log", completed: !!todayRecord },
        { id: 3, text: "Check upcoming leave policy", completed: false }
    ], [totalHoursDec, requiredHours, todayRecord]);

    const greeting = getGreetingInfo();
    const balanceDays = balances?.[0]?.available || balances?.[0]?.remaining || 0;

    return (
        <div className="h-full flex flex-col bg-white font-inter overflow-hidden gap-3 px-4 pb-4">
            
            {/* HEADER SECTION */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 pt-4 pb-1 gap-3">
                <div className="space-y-0.5">
                    <h1 className="text-slate-900 font-semibold tracking-tight" style={{ fontSize: '22px', lineHeight: '1.4' }}>
                        {greeting} {(() => {
                          const isGeneric = (val) => {
                            const v = String(val || '').trim().toLowerCase();
                            return !v || v === 'user' || v === 'admin' || v === 'employee' || v === 'null' || v === 'undefined';
                          };

                          const first = String(profile?.firstName || '').trim();
                          const last = String(profile?.lastName || '').trim();
                          const full = (first && last) ? `${first} ${last}`.trim() : (first || last);
                          
                          let resolved = 'Employee';
                          if (full && !isGeneric(full)) resolved = full;
                          else if (profile?.name && !isGeneric(profile.name)) resolved = profile.name;
                          else if (profile?.fullName && !isGeneric(profile.fullName)) resolved = profile.fullName;
                          else if (user?.fullName && !isGeneric(user.fullName)) resolved = user.fullName;
                          else if (user?.name && !isGeneric(user.name)) resolved = user.name;
                          else if (user?.email) resolved = user.email.split('@')[0];

                          return resolved.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                        })()}
                    </h1>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleClockInOut?.()}
                        disabled={clocking}
                        className={clsx(
                            "flex-1 sm:flex-none h-8 sm:h-9 px-4 sm:px-5 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-widest shadow-md transition-all active:scale-95",
                            clocking
                                ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                                : (isCheckedIn && !isCheckedOut)
                                    ? "bg-[#0F172A] text-white hover:bg-slate-900"
                                    : "bg-[#2563EB] text-white hover:bg-blue-700"
                        )}
                    >
                        {isCheckedIn && !isCheckedOut ? 'Check Out' : 'Check In'}
                    </button>
                </div>
            </header>

            {/* ROW 1: EQUAL STATS CARDS (REPLICA OF ORIGINAL) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                {[
                    { label: "Total Runtime", value: `${totalHours}h ${totalMinutes}m`, icon: <Clock3 size={16} />, color: 'text-[#2563EB] bg-blue-50' },
                    { label: "Live Status", value: isActive ? 'Active Now' : (isCheckedOut ? 'Off-duty' : 'Awaiting'), badge: isActive ? 'Online' : (isCheckedOut ? 'Finalized' : 'Inactive'), icon: <CheckCircle2 size={16} />, color: isActive ? 'text-[#16A34A] bg-[#ECFDF5]' : 'text-[#DC2626] bg-[#FEF2F2]' },
                    { label: "Leave Credit", value: `${balanceDays} days`, icon: <Plane size={16} />, color: 'text-violet-500 bg-violet-50' },
                    { label: "Internal Roles", value: `${stats.activeApplications || 0} applications`, icon: <Target size={16} />, color: 'text-orange-500 bg-orange-50' },
                ].map((card, i) => (
                    <div 
                        key={i} 
                        className="metric-card p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between min-h-[90px] hover:shadow-md transition-all group"
                        style={{
                            backgroundColor: 'var(--hr-metric-bg)',
                            borderColor: 'rgba(0,0,0,0.05)'
                        }}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</span>
                            <div className={clsx("p-2 rounded-lg", card.color)}>{card.icon}</div>
                        </div>
                        <div className="flex items-end justify-between">
                            <h3 className="text-lg font-bold text-slate-800 leading-none">{card.value}</h3>
                            {card.badge && <span className={clsx("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", card.color)}>{card.badge}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* ROW 2: MIDDLE SECTION (3 CARDS) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0 h-auto lg:h-[200px]">
                
                {/* TIME TRACKER (col-3) */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between relative group overflow-hidden hover:border-blue-200 transition-all">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <Clock size={80} />
                    </div>
                    <div className="flex justify-between items-center mb-4 lg:mb-0">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-[#64748B]">Active Session</h2>
                        <span className={clsx("text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full", isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>{isActive ? 'Counting' : 'Paused'}</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-3xl font-bold text-slate-800 tabular-nums tracking-tighter drop-shadow-sm">
                            {totalHours}<span className="text-blue-500 mx-0.5 animate-pulse">:</span>{totalMinutes.toString().padStart(2, '0')}<span className="text-blue-500 mx-0.5 animate-pulse">:</span><span className="text-xl text-slate-400">{totalSecsRemaining.toString().padStart(2, '0')}</span>
                        </div>
                    </div>

                    <div className="space-y-2 mt-4 lg:mt-0">
                        <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
                            <div className="flex items-center gap-2">
                                <span className="text-[#2563EB] text-[10px]">Work: {workingHoursDec.toFixed(1)}h</span>
                                {shiftInfo.overtimeAllowed && otHoursDec > 0 && (
                                    <span className="text-emerald-600 text-[10px]">OT: {otHoursDec.toFixed(1)}h</span>
                                )}
                            </div>
                        </div>
                        <div className="h-2.5 bg-slate-50 border border-[#E2E8F0] rounded-full overflow-hidden flex">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000" style={{ width: `${regularBarPercent}%` }}></div>
                            {shiftInfo.overtimeAllowed && otHoursDec > 0 && (
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000" style={{ width: `${otBarPercent}%` }}></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* WEEKLY CHART (col-6) */}
                <div className="lg:col-span-6 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col min-h-[200px] lg:min-h-0 hover:border-blue-100 transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><TrendingUp size={14} /></div>
                            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Weekly Performance</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Weekly: <span className="text-slate-800">{weekTotalHours.toFixed(1)}h</span></span>
                            </div>
                            {shiftInfo.overtimeAllowed && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">OT: <span className="text-emerald-600">+{weekTotalOT.toFixed(1)}h</span></span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex items-end justify-between gap-1 px-1">
                        {weeklyData.map((d, i) => {
                            const totalPct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0;
                            const hasOT = d.otHrs > 0 && shiftInfo.overtimeAllowed;
                            const barH = Math.max(totalPct, d.hours > 0 ? 5 : 0);
                            const otFrac = barH > 0 ? (d.otHrs / maxHours * 100) / barH * 100 : 0;
                            const regFrac = 100 - otFrac;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center group max-w-[40px]">
                                    <div className="relative w-6 h-[80px] flex flex-col justify-end group/bar">
                                        {/* Floating hour label on hover */}
                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 pointer-events-none z-20">
                                            <div className="bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md shadow-xl whitespace-nowrap">
                                                {d.hours}h
                                            </div>
                                        </div>

                                        {hasOT ? (
                                            <div className="w-full rounded-t-lg overflow-hidden transition-all duration-500 flex flex-col shadow-sm"
                                                style={{ height: `${barH}%` }}
                                            >
                                                <div className="w-full bg-emerald-400" style={{ flex: `${otFrac} 0 0` }} />
                                                <div className={clsx("w-full transition-all duration-500", d.active ? "bg-blue-600" : "bg-blue-400")} style={{ flex: `${regFrac} 0 0` }} />
                                            </div>
                                        ) : (
                                            <div
                                                className={clsx("w-full rounded-t-lg transition-all duration-500 shadow-sm",
                                                    d.active ? "bg-gradient-to-b from-blue-500 to-blue-600" : (d.hours > 0 ? "bg-blue-50 group-hover:bg-blue-100" : "bg-slate-50/50"))}
                                                style={{ height: `${barH}%` }}
                                            />
                                        )}
                                    </div>
                                    
                                    <div className="mt-3 flex flex-col items-center gap-1">
                                        <span className={clsx("text-[9px] font-bold tracking-tight", d.active ? "text-blue-600" : "text-slate-400")}>
                                            {d.hours > 0 ? `${d.hours}h` : '-'}
                                        </span>
                                        <span className={clsx("text-[9px] font-black uppercase tracking-wider", d.active ? "text-blue-600" : "text-slate-300")}>
                                            {d.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* BIRTHDAY CARD (col-3) */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-rose-100 shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group hover:border-rose-200 transition-all bg-gradient-to-br from-white to-rose-50/30">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-rose-500 text-white shadow-md">
                                <Zap size={14} fill="white" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Celebrations</span>
                        </div>
                        {birthdays.length > 0 && <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
                    </div>

                    <div className="mt-4 flex-1 flex flex-col justify-center relative z-10">
                        {birthdays.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex -space-x-2.5 justify-center">
                                    {birthdays.slice(0, 3).map((emp, i) => (
                                        <div key={emp._id || i} className="h-10 w-10 rounded-xl ring-4 ring-white bg-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                            {emp.firstName[0]}
                                        </div>
                                    ))}
                                    {birthdays.length > 3 && (
                                        <div className="h-10 w-10 rounded-xl ring-4 ring-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-lg">
                                            +{birthdays.length - 3}
                                        </div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-bold text-slate-800 truncate">
                                        {birthdays.length === 1 ? `${birthdays[0].firstName}'s Bday` : `${birthdays.length} Birthdays Today`}
                                    </p>
                                    <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">Send a wish!</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-40">
                                <Users size={24} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Birthdays</p>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => birthdays.length > 0 && triggerCelebration(birthdays[0])}
                        disabled={birthdays.length === 0}
                        className="mt-3 w-full h-8 rounded-lg bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-rose-600 disabled:opacity-30 shadow-md shadow-rose-100 transition-all flex items-center justify-center gap-2"
                    >
                        <Send size={12} />
                        Wish Them
                    </button>
                </div>
            </div>

            {/* ROW 3: BOTTOM SECTION */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-y-auto lg:overflow-hidden mb-2">
                
                {/* RECENT ACTIVITY */}
                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col min-h-[400px] lg:min-h-0 overflow-hidden">
                    <div className="p-5 border-b border-slate-50 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-slate-50 text-slate-400">
                                <Activity size={18} />
                            </div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-[#334155]">Log Timeline</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                                {[2, 5, 10].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => { setLogPageSize(size); setLogPage(1); }}
                                        className={clsx(
                                            "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                                            logPageSize === size 
                                                ? "bg-white text-blue-600 shadow-sm" 
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {logDays.length > 0 ? (
                            <div className="w-full">
                                <div className="grid grid-cols-12 gap-2 px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                    <div className="col-span-5 sm:col-span-4">Date</div>
                                    <div className="col-span-4 sm:col-span-3">In</div>
                                    <div className="col-span-3 sm:col-span-3 hidden sm:block">Out</div>
                                    <div className="col-span-3 sm:col-span-2 text-right">Late</div>
                                </div>

                                <div className="space-y-1.5">
                                    {pagedLogs.map((r, idx) => {
                                        const isLate = typeof r.lateMinutes === 'number' && r.lateMinutes > 0;
                                        const lateText = (r.lateMinutes === null || r.lateMinutes === undefined)
                                            ? '-'
                                            : (r.lateMinutes === 0 ? 'On time' : `${r.lateMinutes}m`);

                                        return (
                                            <div
                                                key={`${String(r.date)}-${idx}`}
                                                className="grid grid-cols-12 gap-2 rounded-xl border border-slate-100 bg-white px-3 sm:px-4 py-2 sm:py-2.5 hover:border-blue-200 hover:shadow-md transition-all duration-300 group items-center"
                                            >
                                                <div className="col-span-5 sm:col-span-4 min-w-0">
                                                    <p className="truncate text-[11px] sm:text-xs font-medium text-slate-700 leading-none">
                                                        {r.dateLabel}
                                                    </p>
                                                    <p className="text-[8px] sm:text-[9px] font-medium uppercase tracking-[0.15em] text-slate-400 mt-1">
                                                        {r.dayLabel}
                                                    </p>
                                                </div>
                                                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-slate-600">
                                                    <span className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                                                        <LogIn size={12} />
                                                    </span>
                                                    <span className="tabular-nums">{r.checkInLabel}</span>
                                                </div>
                                                <div className="col-span-3 hidden sm:flex items-center gap-2 text-[11px] sm:text-xs font-medium text-slate-600">
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-slate-100">
                                                        <LogOut size={12} />
                                                    </span>
                                                    <span className="tabular-nums">{r.checkOutLabel}</span>
                                                </div>
                                                <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
                                                    <span className={clsx(
                                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[8px] sm:text-[9px] font-medium uppercase tracking-widest",
                                                        isLate ? "bg-rose-50 text-rose-600 shadow-sm shadow-rose-100" : "bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100"
                                                    )}>
                                                        {lateText}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Log Pagination Footer */}
                                {logTotalPages > 1 && (
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setLogPage(p => Math.max(1, p - 1))}
                                                disabled={safeLogPage <= 1}
                                                className={clsx(
                                                    "h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-all",
                                                    safeLogPage <= 1 ? "border-slate-50 text-slate-200 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                                                )}
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest tabular-nums">
                                                {safeLogPage} <span className="text-slate-300 mx-1">/</span> {logTotalPages}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))}
                                                disabled={safeLogPage >= logTotalPages}
                                                className={clsx(
                                                    "h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-all",
                                                    safeLogPage >= logTotalPages ? "border-slate-50 text-slate-200 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                                                )}
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            Total {logTotal} records
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                                <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                    <Clock3 size={32} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No records yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* USER TASKS */}
                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col min-h-[400px] lg:min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9]">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-[#EFF6FF] text-[#3B82F6]">
                                <LayoutDashboard size={18} />
                            </span>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1E293B]">Daily Tasks</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => refreshTasks?.()}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm transition-all"
                                title={tasksLastUpdated ? `Last synced: ${tasksLastUpdated.toLocaleTimeString()}` : 'Refresh tasks'}
                                aria-label="Refresh tasks"
                            >
                                <RefreshCcw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Filters & Tabs Wrapper for Mobile */}
                    <div className="shrink-0 bg-white">
                        {/* Project Tabs */}
                        {projects.length > 0 && (
                            <div className="flex items-center gap-1 p-2.5 bg-slate-50/50 border-b border-slate-100 overflow-x-auto scrollbar-hide">
                                {projects.map(project => (
                                    <button
                                        key={project.id}
                                        onClick={() => setActiveProjectId(project.id)}
                                        className={clsx(
                                            "px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2",
                                            activeProjectId === project.id 
                                                ? "bg-white text-[#2563EB] shadow-md shadow-slate-200 border border-slate-100" 
                                                : "text-slate-400 hover:bg-white/50"
                                        )}
                                    >
                                        <span 
                                            className="w-2 h-2 rounded-full" 
                                            style={{ backgroundColor: project.color || '#3B82F6' }}
                                        ></span>
                                        {project.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Filters */}
                        <div className="p-4 border-b border-slate-100">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="relative flex-1">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={taskQuery}
                                        onChange={(e) => setTaskQuery(e.target.value)}
                                        placeholder="Search tasks..."
                                        className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'pending', label: 'Pending' },
                                        { id: 'done', label: 'Done' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setTaskStatusFilter(opt.id)}
                                            className={clsx(
                                                "h-11 px-5 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all border whitespace-nowrap",
                                                taskStatusFilter === opt.id
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200"
                                                    : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Task list */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="space-y-3">
                            {pagedTasks.length > 0 ? pagedTasks.map((task, i) => {
                                const statusConfig = {
                                    'new_task':    { label: 'New',         color: 'bg-slate-50 text-slate-500',   dot: 'bg-slate-300',    ring: 'border-slate-100' },
                                    'scheduled':   { label: 'Plan',        color: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-400',     ring: 'border-blue-100' },
                                    'in_progress': { label: 'Live',        color: 'bg-amber-50 text-amber-600',    dot: 'bg-amber-400',    ring: 'border-amber-200' },
                                    'in_review':   { label: 'Review',      color: 'bg-purple-50 text-purple-600',  dot: 'bg-purple-400',   ring: 'border-purple-200' },
                                    'completed':   { label: 'Done',        color: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500', ring: 'border-emerald-200' },
                                };
                                const st = statusConfig[task.status] || statusConfig['new_task'];
                                const isDone = task.status === 'completed';

                                const taskKey = String(task?.id || `${activeProject?.id || 'p'}-${taskStartIdx + i}`);
                                const isExpanded = expandedTaskKey === taskKey;

                                const statusRaw = String(task?.status || '').replace(/_/g, ' ');
                                const dueLabel = task?.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) : null;
                                const priorityLabel = task?.priority ? String(task.priority).replace(/_/g, ' ') : null;

                                return (
                                <button
                                    key={taskKey}
                                    type="button"
                                    onClick={() => setExpandedTaskKey((prev) => prev === taskKey ? null : taskKey)}
                                    className={clsx(
                                        "w-full text-left group rounded-2xl border transition-all duration-300",
                                        isDone
                                            ? "bg-slate-50/50 border-slate-100 opacity-70"
                                            : "bg-white border-slate-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5"
                                    )}
                                >
                                    <div className="p-4 flex items-start gap-4">
                                        <div className={clsx(
                                            "mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all duration-500",
                                            isDone ? "bg-emerald-500 border-emerald-500 rotate-[360deg] shadow-sm shadow-emerald-200" : `bg-white ${st.ring}`
                                        )}>
                                            {isDone ? <CheckCircle2 size={14} className="text-white" /> : <div className={clsx("w-2 h-2 rounded-full", st.dot)} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className={clsx(
                                                    "text-sm font-bold leading-snug truncate",
                                                    isDone ? "text-slate-400 line-through" : "text-[#1E293B]"
                                                )}>
                                                    {task.title}
                                                </p>
                                            </div>
                                            <div className="mt-2 flex items-center gap-3">
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full",
                                                    st.color
                                                )}>
                                                    {st.label}
                                                </span>
                                                {dueLabel && (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        <CalendarIcon size={12} className="text-slate-300" />
                                                        <span>{dueLabel}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "h-8 w-8 rounded-xl border flex items-center justify-center transition-all duration-300 shrink-0",
                                            isExpanded ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm shadow-blue-50" : "border-slate-100 bg-white text-slate-400 group-hover:border-slate-200"
                                        )}>
                                            <ChevronRight size={16} className={clsx("transition-transform duration-300", isExpanded && "rotate-90")} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4">
                                            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="grid grid-cols-2 gap-4 text-[11px]">
                                                    <div>
                                                        <span className="font-bold uppercase tracking-widest text-slate-400">Status</span>
                                                        <div className="mt-1.5 font-bold text-slate-700 uppercase tracking-wider">{statusRaw || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold uppercase tracking-widest text-slate-400">Priority</span>
                                                        <div className="mt-1.5 font-bold text-slate-700 uppercase tracking-wider">{priorityLabel || '-'}</div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="font-bold uppercase tracking-widest text-slate-400">Project</span>
                                                        <div className="mt-1.5 font-bold text-slate-700 truncate">{activeProject?.name || 'Unassigned'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </button>
                                );
                            }) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                                    <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                        <ListTodo size={32} />
                                    </div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-loose">
                                        {taskQuery || taskStatusFilter !== 'all'
                                            ? 'No matches found'
                                            : 'All tasks completed'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-5 mt-auto border-t border-slate-50 bg-white flex items-center justify-between shrink-0">
                        {/* Pagination */}
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                                    disabled={safeTaskPage <= 1}
                                    className={clsx(
                                        "h-9 w-9 inline-flex items-center justify-center rounded-xl border transition-all",
                                        safeTaskPage <= 1 ? "border-slate-100 text-slate-200 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                                    )}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest tabular-nums">
                                    {safeTaskPage} <span className="text-slate-300 mx-1">/</span> {taskTotalPages}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTaskPage((p) => Math.min(taskTotalPages, p + 1))}
                                    disabled={safeTaskPage >= taskTotalPages}
                                    className={clsx(
                                        "h-9 w-9 inline-flex items-center justify-center rounded-xl border transition-all",
                                        safeTaskPage >= taskTotalPages ? "border-slate-100 text-slate-200 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                                    )}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            <select
                                value={taskPageSize}
                                onChange={(e) => setTaskPageSize(Number(e.target.value) || 6)}
                                className="h-9 rounded-xl border border-slate-100 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                            >
                                {[4, 6, 10, 15].map((n) => (
                                    <option key={n} value={n}>{n} / Page</option>
                                ))}
                            </select>
                        </div>
                    </div>
            </div>
            </div>


            <Confetti active={showConfetti} />
            
            <Modal
                open={!!selectedBday}
                onCancel={() => setSelectedBday(null)}
                footer={null}
                centered
                width={750}
                closeIcon={null}
                className="birthday-celebration-modal-wide"
                modalRender={(modal) => (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {modal}
                    </motion.div>
                )}
            >
                {selectedBday && (
                    <div className="relative flex min-h-[450px] overflow-hidden rounded-[32px] bg-white shadow-2xl">
                        {/* Left Side: Profile & Details */}
                        <div className="relative w-[40%] bg-gradient-to-br from-rose-500 to-pink-600 p-8 text-center text-white flex flex-col justify-center items-center">
                            {/* Decorative particles */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none">
                                <div className="absolute top-10 left-10 h-20 w-20 rounded-full bg-white blur-2xl" />
                                <div className="absolute bottom-10 right-10 h-20 w-20 rounded-full bg-rose-200 blur-2xl" />
                            </div>

                            <div className="relative z-10 w-full">
                                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border-4 border-white/30 shadow-2xl">
                                    <Zap size={44} fill="white" className="animate-pulse" />
                                </div>

                                <h2 className="text-2xl font-bold tracking-tight leading-none mb-1">Happy Birthday!</h2>
                                <p className="text-lg font-semibold text-rose-100 mb-6">{selectedBday.firstName} {selectedBday.lastName}</p>
                                
                                <div className="space-y-2.5 w-full max-w-[180px] mx-auto text-left">
                                    <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-1">Department</p>
                                        <p className="text-xs font-semibold truncate">{(selectedBday.departmentId?.name || selectedBday.department) || 'General'}</p>
                                    </div>
                                    
                                    <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-1">Birth Date</p>
                                        <p className="text-xs font-semibold">{formatDate(selectedBday.dob)}</p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedBday(null)}
                                    className="mt-8 h-10 w-full max-w-[180px] rounded-xl bg-white text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 shadow-lg transition-all hover:bg-rose-50 active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="w-[60%] flex flex-col p-6 bg-slate-50/30">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Wish Wall</h3>
                                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Team Celebration</p>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-500 border border-rose-100">
                                    <Users size={12} />
                                    <span className="text-[11px] font-bold">{currentWishes.length} wishes</span>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 overflow-y-auto mb-5 pr-2 custom-scrollbar min-h-[200px]">
                                <AnimatePresence mode="popLayout">
                                    {currentWishes.map((w, idx) => (
                                        <motion.div 
                                            key={w._id || idx} 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="group"
                                        >
                                            <div className="flex gap-3">
                                                <div className={clsx(
                                                    "h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase text-white shrink-0 shadow-md",
                                                    w.color === 'blue' ? 'bg-blue-500 shadow-blue-50' : 
                                                    w.color === 'purple' ? 'bg-purple-500 shadow-purple-50' : 
                                                    w.color === 'emerald' ? 'bg-emerald-500 shadow-emerald-50' : 'bg-rose-500 shadow-rose-50'
                                                )}>
                                                    {w.from[0]}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className="truncate text-[10px] font-bold text-slate-800 uppercase tracking-wide">{w.from}</p>
                                                        <p className="shrink-0 text-[8px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{w.time}</p>
                                                    </div>
                                                    <div className="rounded-2xl rounded-tl-none bg-white border border-slate-100 p-3 shadow-sm group-hover:border-rose-200 transition-all">
                                                        <p className="text-xs font-medium text-slate-600 leading-relaxed">{w.text}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                {currentWishes.length === 0 && !loadingWishes && (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-6">
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Be the first to wish!</p>
                                    </div>
                                )}
                                {loadingWishes && (
                                    <div className="h-full flex items-center justify-center py-10">
                                        <RefreshCcw size={20} className="animate-spin text-slate-200" />
                                    </div>
                                )}
                            </div>

                            <div className="relative group/input">
                                <input 
                                    type="text"
                                    value={newWish}
                                    onChange={(e) => setNewWish(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendWish()}
                                    placeholder="Type a wish..."
                                    className="w-full h-12 pl-5 pr-14 rounded-2xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all shadow-sm placeholder:text-slate-400"
                                />
                                <button 
                                    onClick={handleSendWish}
                                    disabled={!newWish.trim()}
                                    className="absolute right-1.5 top-1.5 h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-100 disabled:opacity-30 disabled:grayscale transition-all active:scale-90"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
