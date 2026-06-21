import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import dayjs from 'dayjs';
import { Calendar as CalendarIcon, Users, Building, Globe, ChevronLeft, ChevronRight, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

export default function TeamAvailabilityCalendar({ startDate, endDate, employeeId }) {
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [viewType, setViewType] = useState('team'); // 'team', 'department', 'organization'
    const [data, setData] = useState({
        leaves: [],
        holidays: [],
        teamStrength: 0,
        teamMembers: [],
        departmentStrength: 0,
        departmentMembers: []
    });
    const [loading, setLoading] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [snapshotLoading, setSnapshotLoading] = useState(false);

    const currentMonth = currentDate.month(); // 0-11
    const currentYear = currentDate.year();

    // Fetch calendar data for the entire month
    const fetchCalendarData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/employee/leaves/workforce-visibility', {
                params: {
                    month: currentMonth,
                    year: currentYear,
                    viewType,
                    employeeId
                }
            });
            if (res.data?.success) {
                setData(res.data);
            }
        } catch (err) {
            console.error("Failed to load workforce visibility calendar", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch snapshot details when a specific date range is selected
    const fetchRangeSnapshot = async () => {
        if (!startDate || !endDate) {
            setSnapshot(null);
            return;
        }
        setSnapshotLoading(true);
        try {
            const res = await api.get('/employee/leaves/workforce-visibility', {
                params: {
                    startDate,
                    endDate,
                    employeeId
                }
            });
            if (res.data?.success && res.data?.snapshot) {
                setSnapshot(res.data.snapshot);
            }
        } catch (err) {
            console.error("Failed to load range snapshot", err);
        } finally {
            setSnapshotLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendarData();
    }, [currentDate, viewType, employeeId]);

    useEffect(() => {
        fetchRangeSnapshot();
    }, [startDate, endDate, employeeId]);

    // Build the grid cells for the month
    const cells = useMemo(() => {
        const firstDayOfMonth = currentDate.startOf('month').day(); // 0-6
        const daysInMonth = currentDate.daysInMonth();
        const gridCells = [];

        // Padding empty cells
        for (let i = 0; i < firstDayOfMonth; i++) {
            gridCells.push({ type: 'empty' });
        }

        // Target dates
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = currentDate.date(day).format('YYYY-MM-DD');
            const dayOfWeek = currentDate.date(day).day(); // 0-6
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Find holidays on this day
            const holiday = data.holidays.find(h => {
                const hDate = dayjs(h.date).startOf('day');
                const hEndDate = h.endDate ? dayjs(h.endDate).startOf('day') : hDate;
                const target = dayjs(dateStr).startOf('day');
                return (target.isSame(hDate) || target.isAfter(hDate)) && (target.isSame(hEndDate) || target.isBefore(hEndDate));
            });

            // Find leaves on this day
            const approvedOnLeave = [];
            const pendingOnLeave = [];
            
            data.leaves.forEach(l => {
                const lStart = dayjs(l.startDate).startOf('day');
                const lEnd = dayjs(l.endDate).startOf('day');
                const target = dayjs(dateStr).startOf('day');

                if ((target.isSame(lStart) || target.isAfter(lStart)) && (target.isSame(lEnd) || target.isBefore(lEnd))) {
                    if (l.status === 'Approved') {
                        approvedOnLeave.push(l);
                    } else if (l.status === 'Pending') {
                        pendingOnLeave.push(l);
                    }
                }
            });

            gridCells.push({
                type: 'date',
                dateStr,
                day,
                isWeekend,
                holiday,
                approvedOnLeave,
                pendingOnLeave
            });
        }

        return gridCells;
    }, [currentDate, data.leaves, data.holidays]);

    const handlePrevMonth = () => setCurrentDate(prev => prev.subtract(1, 'month'));
    const handleNextMonth = () => setCurrentDate(prev => prev.add(1, 'month'));

    // Check if a day falls within the selected range in the form
    const isDateSelected = (dateStr) => {
        if (!startDate || !endDate) return false;
        const current = dayjs(dateStr);
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        return (current.isSame(start, 'day') || current.isAfter(start, 'day')) && (current.isSame(end, 'day') || current.isBefore(end, 'day'));
    };

    return (
        <div className="flex flex-col h-full font-inter">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-105">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-indigo-500" />
                    <span className="text-[13px] font-black text-slate-800 uppercase tracking-wide">Workforce Availability</span>
                </div>
                
                {/* View switcher */}
                <div className="flex gap-1 p-0.5 bg-slate-50 border border-slate-200/50 rounded-lg">
                    {[
                        { id: 'team', label: 'My Team', icon: Users },
                        { id: 'department', label: 'Dept', icon: Building },
                        { id: 'organization', label: 'All Org', icon: Globe }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = viewType === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setViewType(tab.id)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all",
                                    active ? "bg-white text-slate-900 shadow-sm border border-slate-200/40" : "text-slate-400 hover:text-slate-700"
                                )}
                            >
                                <Icon size={10} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Calendar Widget */}
            <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 mb-4">
                {/* Navigation */}
                <div className="flex items-center justify-between mb-4">
                    <button type="button" onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-all text-slate-505">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                        {currentDate.format('MMMM YYYY')}
                    </span>
                    <button type="button" onClick={handleNextMonth} className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-all text-slate-505">
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Week headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
                        <div key={w} className="text-[8px] font-black text-slate-400 uppercase tracking-wider py-1">{w}</div>
                    ))}

                    {/* Cells */}
                    {loading ? (
                        <div className="col-span-7 py-16 flex flex-col items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Loading Availability...</p>
                        </div>
                    ) : (
                        cells.map((cell, idx) => {
                            if (cell.type === 'empty') {
                                return <div key={`empty-${idx}`} className="h-10 bg-transparent" />;
                            }

                            const selected = isDateSelected(cell.dateStr);
                            const totalLeaves = cell.approvedOnLeave.length + cell.pendingOnLeave.length;
                            
                            // Capacity colors
                            let statusColor = "border-slate-100 bg-white hover:bg-slate-50 cursor-pointer";
                            if (cell.isWeekend) statusColor = "border-slate-100 bg-slate-100 text-slate-400";
                            if (cell.holiday) statusColor = "border-emerald-100 bg-emerald-50 text-emerald-700 font-bold";

                            // Build tooltip text listing leaves
                            const leavesList = [];
                            cell.approvedOnLeave.forEach(l => {
                                const name = `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim() || 'Someone';
                                leavesList.push(`${name} (${l.leaveType} - Approved)`);
                            });
                            cell.pendingOnLeave.forEach(l => {
                                const name = `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim() || 'Someone';
                                leavesList.push(`${name} (${l.leaveType} - Pending)`);
                            });
                            
                            const tooltipParts = [
                                cell.holiday ? `🎉 Holiday: ${cell.holiday.name}` : null,
                                leavesList.length > 0 ? `👥 Leaves:\n` + leavesList.map(item => `  • ${item}`).join('\n') : null
                            ].filter(Boolean);
                            const cellTitle = tooltipParts.length > 0 ? tooltipParts.join('\n\n') : undefined;

                            return (
                                <div
                                    key={cell.dateStr}
                                    className={clsx(
                                        "h-10 rounded-lg border flex flex-col justify-between p-1 transition-all relative overflow-hidden",
                                        statusColor,
                                        selected && "border-blue-500 ring-2 ring-blue-500/10 z-10 shadow-sm"
                                    )}
                                    title={cellTitle}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        <span className={clsx(
                                            "text-[9px] font-bold",
                                            cell.holiday ? "text-emerald-700" : (cell.isWeekend ? "text-slate-400" : "text-slate-600")
                                        )}>
                                            {cell.day}
                                        </span>
                                        {/* Leave count badge */}
                                        {totalLeaves > 0 && (
                                            <span className={clsx(
                                                "text-[7px] px-1 rounded-sm font-black uppercase shrink-0 leading-none py-0.5",
                                                totalLeaves >= 4 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                            )}>
                                                {totalLeaves}
                                            </span>
                                        )}
                                    </div>

                                    {/* Tiny dot indicators for leaves */}
                                    {totalLeaves > 0 && (
                                        <div className="flex gap-0.5 flex-wrap justify-end max-w-full">
                                            {cell.approvedOnLeave.map((l, i) => (
                                                <div 
                                                    key={`approved-${i}`} 
                                                    className="w-1.5 h-1.5 rounded-full bg-rose-500" 
                                                    title={`${l.employee?.firstName || ''} on leave`}
                                                />
                                            ))}
                                            {cell.pendingOnLeave.map((l, i) => (
                                                <div 
                                                    key={`pending-${i}`} 
                                                    className="w-1.5 h-1.5 rounded-full bg-amber-400" 
                                                    title={`${l.employee?.firstName || ''} leave pending`}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Capacity visual bar at bottom */}
                                    {!cell.isWeekend && !cell.holiday && (
                                        <div className="w-full h-0.5 rounded-full overflow-hidden flex gap-0.5">
                                            {totalLeaves === 0 ? (
                                                <div className="w-full bg-emerald-400" />
                                            ) : totalLeaves <= 2 ? (
                                                <div className="w-full bg-amber-400" />
                                            ) : (
                                                <div className="w-full bg-rose-500" />
                                            )}
                                        </div>
                                    )}

                                    {/* Small red holiday indicator */}
                                    {cell.holiday && (
                                        <div className="w-full h-0.5 bg-emerald-400 rounded-full" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Selected Range Check Summary */}
            {startDate && endDate && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-3 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workforce Impact</span>
                        {snapshotLoading ? (
                            <span className="text-[8px] font-bold text-slate-400 animate-pulse uppercase">Analyzing...</span>
                        ) : (
                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Analysis Complete</span>
                        )}
                    </div>

                    {snapshot && !snapshotLoading && (
                        <div className="space-y-3">
                            {/* Availability numbers */}
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Team Strength</span>
                                    <span className="font-semibold text-slate-700">{snapshot.teamStrength}</span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Overlap Leaves</span>
                                    <span className="font-semibold text-slate-700">
                                        {snapshot.alreadyOnLeave.length + snapshot.pendingLeaves.length}
                                    </span>
                                </div>
                                <div className={clsx(
                                    "p-2 rounded-lg border",
                                    snapshot.available <= 1 ? "bg-rose-50/20 border-rose-100" : "bg-emerald-50/20 border-emerald-100"
                                )}>
                                    <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Available Headcount</span>
                                    <span className={clsx(
                                        "font-bold",
                                        snapshot.available <= 1 ? "text-rose-600" : "text-emerald-600"
                                    )}>
                                        {snapshot.available}
                                    </span>
                                </div>
                            </div>

                            {/* Warnings/Suggestions */}
                            {snapshot.isCritical && (
                                <div className="flex items-start gap-2 bg-rose-50 p-3 rounded-lg border border-rose-100">
                                    <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-rose-700 uppercase tracking-wide leading-none">Critical Resource Alert</p>
                                        <p className="text-[10px] text-rose-600 font-medium mt-1 leading-normal">
                                            You are currently the only active employee in your department with your designation. Applying for leave during this period may require additional review.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {(snapshot.alreadyOnLeave.length > 0 || snapshot.pendingLeaves.length > 0) ? (
                                <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                    <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide leading-none">Overlap Warnings</p>
                                        <div className="text-[10px] text-amber-700 font-medium mt-2 leading-relaxed">
                                            {snapshot.alreadyOnLeave.length > 0 && (
                                                <div>
                                                    Approved Leaves: <span className="font-semibold">{snapshot.alreadyOnLeave.map(l => `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim()).join(', ')}</span>
                                                </div>
                                            )}
                                            {snapshot.pendingLeaves.length > 0 && (
                                                <div className="mt-1">
                                                    Pending: <span className="font-semibold">{snapshot.pendingLeaves.map(l => `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim()).join(', ')}</span>
                                                </div>
                                            )}
                                            <p className="text-[9px] text-amber-650 font-bold uppercase tracking-tight mt-2 italic">
                                                Tip: Consider coordinating with your team members to optimize approval chances!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide leading-none">Safe Period Detected</p>
                                        <p className="text-[10px] text-emerald-600 font-medium mt-1 leading-normal">
                                            No other team members have leaves requested or approved during this range.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Month's Leaves List */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 mt-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {currentDate.format('MMMM YYYY')} Leaves List
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {data.leaves.length} Total
                    </span>
                </div>
                {data.leaves.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-semibold text-center py-2">
                        No leaves recorded in this month.
                    </p>
                ) : (
                    <div className="max-h-[160px] overflow-y-auto divide-y divide-slate-100 pr-1 space-y-2">
                        {data.leaves.map((leave, idx) => {
                            const empName = `${leave.employee?.firstName || ''} ${leave.employee?.lastName || ''}`.trim() || 'Someone';
                            const isCurrentUser = String(leave.employee?._id || leave.employee) === String(employeeId);
                            return (
                                <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: leave.status === 'Approved' ? '#ef4444' : '#f59e0b' }} />
                                        <span className={clsx("font-bold", isCurrentUser ? "text-indigo-600" : "text-slate-700")}>
                                            {empName} {isCurrentUser && "(You)"}
                                        </span>
                                    </div>
                                    <div className="text-slate-500 font-medium text-[11px]">
                                        {dayjs(leave.startDate).format('DD MMM')} {leave.endDate && leave.endDate !== leave.startDate ? `→ ${dayjs(leave.endDate).format('DD MMM')}` : ''}
                                        <span className={clsx(
                                            "ml-2 text-[9px] px-1 rounded-sm font-black uppercase",
                                            leave.status === 'Approved' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                                        )}>
                                            {leave.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
