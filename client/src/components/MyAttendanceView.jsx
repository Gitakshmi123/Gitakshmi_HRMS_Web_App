import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import AttendanceCalendar from './AttendanceCalendar';
import { ChevronLeft, ChevronRight, Download, Filter, Calendar as CalendarIcon, Clock, CheckCircle, AlertCircle, Briefcase, TrendingUp } from 'lucide-react';
import { formatDateDDMMYYYY, formatDuration } from '../utils/dateUtils';


export default function MyAttendanceView() {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [summary, setSummary] = useState({ present: 0, absent: 0, leave: 0, late: 0, hours: 0 });
    const [statusFilter, setStatusFilter] = useState('all');
    const [holidays, setHolidays] = useState([]);
    const [settings, setSettings] = useState({});

    useEffect(() => {
        fetchAttendance();
    }, [currentMonth, currentYear]);

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const t = new Date().getTime();
            // Fetch Attendance, Leaves, Holidays, and Settings in parallel
            const [attRes, leaveRes, holidayRes, settingsRes] = await Promise.all([
                api.get(`/attendance/my?month=${currentMonth + 1}&year=${currentYear}&t=${t}`),
                api.get(`/employee/leaves/history?t=${t}`),
                api.get(`/holidays?t=${t}`),
                api.get(`/attendance/settings?t=${t}`)
            ]);

            const rawAttendance = attRes.data || [];
            const leaves = leaveRes.data || [];

            // --- Merge Leaves into Attendance Data (Client-Side Patch) ---
            // This ensures "On Leave" shows up even if backend sync failed or for Pending leaves

            // 1. Create a map of existing attendance dates
            const attendanceMap = new Set(rawAttendance.map(a => new Date(a.date).toDateString()));

            // 2. Identify view range
            const viewStart = new Date(currentYear, currentMonth, 1);
            const viewEnd = new Date(currentYear, currentMonth + 1, 0);

            const mergedAttendance = [...rawAttendance];

            leaves.forEach(leave => {
                // Only consider Active leaves
                if (!['Approved', 'Pending'].includes(leave.status)) return;

                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);

                // Iterate through leave days
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    // Check if date is within current view month
                    if (d < viewStart || d > viewEnd) continue;

                    // If no attendance record exists for this date, create a synthetic one
                    if (!attendanceMap.has(d.toDateString())) {
                        mergedAttendance.push({
                            _id: `synthetic-leave-${d.getTime()}`,
                            date: d.toISOString(),
                            status: 'leave', // Force status to leave for visualization
                            leaveType: leave.leaveType,
                            isSynthetic: true, // Marker
                            checkIn: null,
                            checkOut: null,
                            workingHours: 0,
                            isLate: false
                        });
                        attendanceMap.add(d.toDateString()); // Prevent dupes if overlapping leaves exist (rare)
                    }
                }
            });

            // Sort by date again after merge
            mergedAttendance.sort((a, b) => new Date(a.date) - new Date(b.date));

            setAttendance(mergedAttendance);
            setHolidays(holidayRes.data || []);
            setSettings(settingsRes.data || {});

            // Calculate Summary
            const stats = mergedAttendance.reduce((acc, item) => {
                const s = (item.status || '').toLowerCase();

                if (s === 'present' || s === 'half_day') acc.present++;
                if (s === 'absent') acc.absent++;
                // "On Leave" count now includes synthetic leaves (Applied/Approved but not synced)
                if (s === 'leave') acc.leave++;
                if (item.isLate) acc.late++;
                acc.hours += (item.workingHours || 0);
                return acc;
            }, { present: 0, absent: 0, leave: 0, late: 0, hours: 0 });

            setSummary(stats);
        } catch (err) {
            console.error("Failed to fetch attendance", err);
        } finally {
            setLoading(false);
        }
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const handleExport = async () => {
        if (!attendance.length) return alert("No data to export");

        const headers = ["Employee_id", "Employee_Name", "Date", "Status", "Check In", "Check Out", "Working Hours", "Is Late"];
        const tenant = localStorage.getItem("tenantId");
        console.log(tenant);

        const rows = attendance.map(item => [
            item.employee?.employeeId || '-',
            (item.employee?.firstName + " " + (item.employee?.lastName || '')).trim(),
            formatDateDDMMYYYY(item.date),
            (item.leaveType ? `${item.status} (${item.leaveType})` : item.status).toUpperCase(),
            item.checkIn ? new Date(item.checkIn).toLocaleTimeString() : '-',
            item.checkOut ? new Date(item.checkOut).toLocaleTimeString() : '-',
            item.workingHours || 0,
            item.isLate ? "YES" : "NO"
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Attendance_${currentMonth + 1}_${currentYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredAttendance = attendance.filter(item => {
        if (statusFilter === 'all') return true;
        return (item.status || '').toLowerCase() === statusFilter.toLowerCase();
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-1000 pb-20 relative">
            {/* Background Tactical Grid Overlay */}
            <div className="fixed inset-0 tactical-grid pointer-events-none opacity-20 dark:opacity-40"></div>
            
            {/* Header & Controls - Mission Control Style */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-indigo-500/20 rounded-[32px] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-3 px-6 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-2xl shadow-xl">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center shadow-xl overflow-hidden">
                             <TrendingUp size={18} className="text-white dark:text-slate-900 animate-pulse" />
                             <div className="absolute inset-0 hud-scanline opacity-20"></div>
                          </div>
                          {/* Rotating Status Orbit */}
                          <div className="absolute -inset-2 border border-dashed border-indigo-500/30 rounded-full animate-scan"></div>
                       </div>
                       <div>
                          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] glow-text-indigo">My Attendance</h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Status: Online</p>
                          </div>
                       </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Month Selector - Sleek HUD */}
                        <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-white/5 backdrop-blur-md">
                            <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-500 transition-all shadow-sm"><ChevronLeft size={16} /></button>
                            <div className="px-4 text-[9px] font-black text-slate-900 dark:text-white min-w-[130px] text-center uppercase tracking-[0.2em] font-mono">
                                {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </div>
                            <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-500 transition-all shadow-sm"><ChevronRight size={16} /></button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                className="group relative overflow-hidden flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                <Download size={14} className="group-hover:translate-y-0.5 transition-transform" /> 
                                <span>Export</span>
                            </button>

                            <div className="relative group/select">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="appearance-none pl-4 pr-10 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer shadow-lg backdrop-blur-md"
                                >
                                    <option value="all">All Records</option>
                                    <option value="present">Present Only</option>
                                    <option value="absent">Absent Only</option>
                                    <option value="leave">On Leave</option>
                                    <option value="half_day">Half Day</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/select:text-indigo-500 transition-colors">
                                    <Filter size={12} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Dynamic Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                <SummaryCard label="Present Days" value={summary.present} iconBg="bg-indigo-500/20" iconColor="text-indigo-500" icon={CheckCircle} color="text-indigo-600 dark:text-indigo-400" trend="+12%" />
                <SummaryCard label="Absent Days" value={summary.absent} iconBg="bg-rose-500/20" iconColor="text-rose-500" icon={AlertCircle} color="text-rose-600 dark:text-rose-400" trend="-5%" />
                <SummaryCard label="On Leave" value={summary.leave} iconBg="bg-amber-500/20" iconColor="text-amber-500" icon={CalendarIcon} color="text-amber-600 dark:text-amber-400" trend="0%" />
                <SummaryCard label="Late Marks" value={summary.late} iconBg="bg-indigo-500/20" iconColor="text-indigo-500" icon={Clock} color="text-indigo-600 dark:text-indigo-400" trend="+2%" />
                <SummaryCard label="Total Hours" value={formatDuration(summary.hours)} iconBg="bg-slate-500/20" iconColor="text-slate-500" icon={Briefcase} color="text-slate-900 dark:text-white" unit="Worked Hours" />
            </div>

            {/* Main Calendar Viewport - Tactical Frame */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-indigo-500/20 via-indigo-500/20 to-indigo-500/20 rounded-[40px] blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                <div className="glass-morphism rounded-[32px] shadow-2xl border-slate-200 dark:border-white/5 p-1 overflow-hidden relative">
                    <div className="absolute inset-0 hud-scanline opacity-[0.03] pointer-events-none"></div>
                    <div className="relative z-10 p-4">
                        <AttendanceCalendar
                            data={filteredAttendance}
                            holidays={holidays}
                            settings={settings}
                            currentMonth={currentMonth}
                            currentYear={currentYear}
                        />
                    </div>
                    {/* Decorative Corner Accents */}
                    <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-indigo-500/30"></div>
                    <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-indigo-500/30"></div>
                    <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-indigo-500/30"></div>
                    <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-indigo-500/30"></div>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color, iconBg, iconColor, unit, icon: Icon, trend }) {
    return (
        <div className="glass-morphism p-4 rounded-[24px] border-slate-200 dark:border-white/5 hover:border-indigo-500/30 transition-all duration-700 flex flex-col justify-between min-h-[120px] group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col">
                   <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] font-black">{label}</span>
                   {trend && (
                       <span className={`text-[7px] font-black mt-1.5 px-2 py-0.5 rounded-full inline-block w-fit bg-slate-100 dark:bg-white/5 ${trend.startsWith('+') ? 'text-emerald-500' : trend === '0%' ? 'text-slate-400' : 'text-rose-500'}`}>
                           {trend}
                       </span>
                   )}
                </div>
                <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-xl shadow-black/5 relative overflow-hidden`}>
                    {Icon && <Icon size={14} />}
                    <div className="absolute inset-0 hud-scanline opacity-10"></div>
                </div>
            </div>

            <div className="mt-4 relative z-10 flex flex-col">
                <span className={`text-2xl font-black ${color || 'text-slate-900 dark:text-white'} tracking-tighter leading-none glow-text-indigo`}>
                    {value}
                </span>
                {unit && <span className="text-[7px] font-black text-slate-400 mt-1 uppercase tracking-[0.2em] opacity-60 font-mono">{unit}</span>}
            </div>
        </div>
    );
}
