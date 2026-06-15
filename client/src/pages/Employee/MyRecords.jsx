import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar as CalendarIcon, Clock, CheckCircle2, 
    Filter, Search, Download, ChevronLeft, ChevronRight,
    Activity, FileText, AlertCircle, RefreshCw,
    ArrowUpRight, ArrowDownRight, Printer, FileSpreadsheet,
    FilePieChart, MoreVertical, X, CheckCircle, Info,
    UserCircle, Briefcase, Plane, ListTodo
} from 'lucide-react';
import api from '../../utils/api';
import clsx from 'clsx';
import { showToast } from '../../utils/uiNotifications';

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '00:00:00') return '-';
    try {
        const date = new Date(timeStr);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });
    } catch (e) {
        return timeStr;
    }
};

const formatDuration = (hours) => {
    if (!hours) return '0h 0m';
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${h}h ${m}m`;
};

const RecordsSkeleton = () => (
    <div className="animate-pulse space-y-6 p-6 bg-white min-h-screen font-inter">
        <div className="flex justify-between items-center mb-8">
             <div className="space-y-2">
                <div className="h-7 w-48 bg-[#E2E8F0] rounded-lg"></div>
                <div className="h-4 w-64 bg-[#E2E8F0] rounded-lg opacity-60"></div>
             </div>
             <div className="h-10 w-48 bg-[#E2E8F0] rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm"></div>)}
        </div>
        <div className="bg-white rounded-xl h-[500px] border border-[#E2E8F0] p-8 shadow-sm">
            <div className="h-10 w-full bg-slate-50/80 rounded-lg mb-6"></div>
            <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(j => <div key={j} className="h-12 w-full bg-slate-50/30 rounded-lg"></div>)}
            </div>
        </div>
    </div>
);

export default function MyRecords() {
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('attendance');
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [summary, setSummary] = useState({ totalHours: 0, presentDays: 0, leavesTaken: 0 });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const t = new Date().getTime();
            const [attRes, leaveRes] = await Promise.all([
                api.get(`/attendance/my?t=${t}`).catch(() => ({ data: [] })),
                api.get(`/employee/leaves/history?t=${t}`).catch(() => ({ data: [] }))
            ]);

            const attData = Array.isArray(attRes?.data) ? attRes?.data : [];
            const leaveData = Array.isArray(leaveRes?.data) ? leaveRes?.data : [];

            setAttendance(attData.sort((a, b) => new Date(b.date) - new Date(a.date)));
            setLeaves(leaveData.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)));

            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            
            const monthAtt = attData.filter(a => {
                const d = new Date(a.date);
                if (!isNaN(d.getTime())) {
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                }
                return false;
            });

            const totalHrs = monthAtt.reduce((sum, a) => sum + (Math.abs(a.workingHours || 0)), 0);
            const presentCount = monthAtt.filter(a => ['present', 'present (worked)'].includes((a.status || '').toLowerCase())).length;
            const leavesCount = leaveData.filter(l => l.status === 'Approved').length;

            setSummary({
                totalHours: totalHrs.toFixed(1),
                presentDays: presentCount,
                leavesTaken: leavesCount
            });

        } catch (err) {
            showToast('error', 'Sync Failed', 'Could not refresh records');
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = useMemo(() => {
        const source = activeView === 'attendance' ? attendance : leaves;
        return source.filter(record => {
            const dateStr = activeView === 'attendance' ? record.date : record.startDate;
            const statusStr = (record.status || '').toLowerCase();
            const matchesSearch = dateStr.includes(searchTerm) || statusStr.includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || statusStr === statusFilter.toLowerCase();
            const matchesDate = (!dateRange.start || dateStr >= dateRange.start) && (!dateRange.end || dateStr <= dateRange.end);
            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [attendance, leaves, activeView, searchTerm, statusFilter, dateRange]);

    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || 'pending';
        const base = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ";
        
        if (s === 'present' || s === 'approved') return (
            <span className={base + "bg-[#ECFDF5] text-[#16A34A] border-[#ECFDF5]"}>
                Approved
            </span>
        );
        if (s === 'absent' || s === 'rejected') return (
            <span className={base + "bg-[#FEF2F2] text-[#DC2626] border-[#FEF2F2]"}>
                {s === 'absent' ? 'Absent' : 'Rejected'}
            </span>
        );
        return (
            <span className={base + "bg-[#FFFBEB] text-[#F59E0B] border-[#FFFBEB]"}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
        );
    };

    if (loading) return <RecordsSkeleton />;

    return (
        <div className="h-full flex flex-col bg-white font-inter overflow-hidden px-6 py-6 gap-6">
            
            {/* 1. HEADER */}
            <header className="flex items-center justify-between shrink-0">
                <div className="space-y-1">
                    <h1 className="text-[20px] font-semibold text-slate-900 tracking-tight">Employment Records</h1>
                    <p className="text-[12px] text-[#64748B] font-medium leading-none mt-1">Detailed history of your logs and applications</p>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={fetchRecords} 
                        className="w-9 h-9 flex items-center justify-center text-[#64748B] hover:text-[#2563EB] hover:bg-white rounded-lg transition-all border border-transparent hover:border-[#E2E8F0] shadow-sm"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <div className="flex items-center bg-white border border-[#E2E8F0] rounded-lg p-1 shadow-sm">
                         {['attendance', 'leaves'].map(tab => (
                             <button 
                                key={tab}
                                onClick={() => { setActiveView(tab); setCurrentPage(1); }} 
                                className={clsx(
                                    "px-6 py-1.5 rounded-md text-[12px] font-medium capitalize transition-all duration-200 tracking-wide", 
                                    activeView === tab ? "bg-[#2563EB] text-white" : "text-[#64748B] hover:text-[#334155] hover:bg-slate-50"
                                )}
                            >
                                {tab}
                            </button>
                         ))}
                    </div>
                </div>
            </header>

            {/* 2. SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                {[
                    { label: "Total Hours", subtitle: "Monthly accumulated", value: `${summary.totalHours}`, unit: "hrs", icon: <Clock size={20} />, color: "text-[#2563EB]", bg: "bg-blue-50" },
                    { label: "Days Present", subtitle: "Active attendance", value: `${summary.presentDays}`, unit: "days", icon: <CheckCircle2 size={20} />, color: "text-[#16A34A]", bg: "bg-[#ECFDF5]" },
                    { label: "Leaves Taken", subtitle: "Approved history", value: `${summary.leavesTaken}`, unit: "used", icon: <Plane size={20} />, color: "text-violet-500", bg: "bg-violet-50" },
                ].map((card, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between transition-all hover:shadow-md group">
                        <div className="space-y-1">
                             <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">{card.label}</p>
                             <div className="flex items-baseline gap-1.5">
                                <h3 className="text-[24px] font-semibold text-slate-900 tracking-tight">{card.value}</h3>
                                <span className="text-[12px] font-medium text-slate-300 uppercase">{card.unit}</span>
                             </div>
                             <p className="text-[10px] text-slate-400 font-medium">{card.subtitle}</p>
                        </div>
                        <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", card.bg, card.color)}>
                            {card.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. TOOLBAR + TABLE */}
            <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col min-h-0 overflow-hidden mb-2">
                
                {/* TOOLBAR */}
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between gap-4 shrink-0 bg-slate-50/10">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Search records..." 
                                className="h-9 pl-9 pr-4 bg-white border border-[#E2E8F0] rounded-lg text-[13px] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 w-full transition-all text-[#334155] font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="h-9 bg-white border border-[#E2E8F0] rounded-lg text-[12px] px-3 text-[#334155] font-medium outline-none focus:border-blue-500 transition-all cursor-pointer hover:bg-slate-50"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Status</option>
                            <option value="Present">Present Only</option>
                            <option value="Absent">Absent Only</option>
                        </select>
                        <div className="hidden sm:flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-lg px-3 h-9">
                            <input 
                                type="date" 
                                className="bg-transparent text-[11px] text-[#334155] outline-none font-semibold"
                                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                            />
                            <div className="h-3 w-[1px] bg-slate-200"></div>
                            <input 
                                type="date" 
                                className="bg-transparent text-[11px] text-[#334155] outline-none font-semibold"
                                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button className="h-9 px-4 rounded-lg border border-[#E2E8F0] text-[#64748B] text-[12px] font-medium hover:bg-slate-50 flex items-center gap-2 transition-all">
                            <Printer size={14} /> PDF
                        </button>
                        <button className="h-9 px-4 rounded-lg bg-[#2563EB] text-white text-[12px] font-medium hover:bg-blue-600 flex items-center gap-2 transition-all">
                            <FileSpreadsheet size={14} /> EXCEL
                        </button>
                    </div>
                </div>

                {/* TABLE */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white z-20 border-b border-[#E2E8F0]">
                            <tr className="uppercase tracking-wider text-[10px] font-semibold text-[#64748B]">
                                <th className="px-6 py-4">Session Date</th>
                                <th className="px-6 py-4">Status</th>
                                {activeView === 'attendance' ? (
                                    <>
                                        <th className="px-6 py-4">Punch In</th>
                                        <th className="px-6 py-4">Punch Out</th>
                                        <th className="px-6 py-4">Duration</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4">Till Date</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Notes</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedRecords.length > 0 ? paginatedRecords.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="text-[13px] font-bold text-[#334155]">{formatDisplayDate(activeView === 'attendance' ? r.date : r.startDate)}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(r.status)}
                                    </td>
                                    {activeView === 'attendance' ? (
                                        <>
                                            <td className="px-6 py-4 text-[12px] text-[#64748B] font-medium tabular-nums">{formatTime(r.checkIn)}</td>
                                            <td className="px-6 py-4 text-[12px] text-[#64748B] font-medium tabular-nums">{formatTime(r.checkOut)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[12px] font-semibold text-[#334155] min-w-[50px] tabular-nums">
                                                        {formatDuration(r.workingHours)}
                                                    </span>
                                                    <div className="flex-1 max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={clsx("h-full transition-all duration-1000", (Math.abs(r.workingHours || 0)) >= 8 ? "bg-[#16A34A]" : "bg-[#2563EB]")} 
                                                            style={{ width: `${Math.min((Math.abs(r.workingHours || 0)) / 9 * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 text-[12px] text-[#64748B] font-medium tabular-nums">{formatDisplayDate(r.endDate)}</td>
                                            <td className="px-6 py-4 text-[13px] font-bold text-[#334155]">{r.type || 'Leave'}</td>
                                            <td className="px-6 py-4 text-[12px] text-[#64748B] italic truncate max-w-[240px] opacity-70">
                                                {r.reason ? `"${r.reason}"` : '-'}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="py-32 text-center bg-white">
                                         <div className="flex flex-col items-center opacity-40">
                                              <AlertCircle size={32} className="mb-3 text-slate-300" />
                                              <h4 className="text-sm font-medium text-slate-500 uppercase tracking-widest">No matching records</h4>
                                         </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <footer className="px-6 py-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between shrink-0">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Employee Registry Dashboard</p>
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-400 hover:text-[#2563EB] disabled:opacity-30 shadow-sm"
                        >
                            <ChevronLeft size={16} />
                         </button>
                         <div className="text-[12px] font-semibold text-[#334155] tabular-nums">
                            {currentPage} / {totalPages || 1}
                         </div>
                         <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-400 hover:text-[#2563EB] disabled:opacity-30 shadow-sm"
                        >
                            <ChevronRight size={16} />
                         </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
