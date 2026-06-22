import React, { useMemo } from 'react';
import { STATUS } from '../utils/calendarUtils';
import clsx from 'clsx';
import dayjs from 'dayjs';

const LEGEND_LABELS = {
    HOLIDAY: 'Holiday',
    WEEKLY_OFF: 'Weekly Off',
    LEAVE: 'On Leave',
    LEAVE_PENDING: 'Waiting',
    PRESENT: 'Present',
    ABSENT: 'Absent',
    HALF_DAY: 'Half Day',
    ON_DUTY: 'On Duty',
    DEFAULT: '',
};

const getStatusPalette = (status) => {
    switch (status) {
        case STATUS.HOLIDAY:
            return {
                dot: 'bg-violet-400',
                text: 'text-violet-700',
                pill: 'bg-violet-50',
                accent: 'bg-violet-300',
            };
        case STATUS.WEEKLY_OFF:
            return {
                dot: 'bg-slate-300',
                text: 'text-slate-500',
                pill: 'bg-slate-50',
                accent: 'bg-slate-300',
            };
        case STATUS.LEAVE:
            return {
                dot: 'bg-sky-400',
                text: 'text-sky-700',
                pill: 'bg-sky-50',
                accent: 'bg-sky-300',
            };
        case 'LEAVE_PENDING':
            return {
                dot: 'bg-amber-400',
                text: 'text-amber-700',
                pill: 'bg-amber-50',
                accent: 'bg-amber-300',
            };
        case STATUS.PRESENT:
            return {
                dot: 'bg-emerald-400',
                text: 'text-emerald-700',
                pill: 'bg-emerald-50',
                accent: 'bg-emerald-300',
            };
        case STATUS.ON_DUTY:
            return {
                dot: 'bg-indigo-400',
                text: 'text-indigo-700',
                pill: 'bg-indigo-50',
                accent: 'bg-indigo-300',
            };
        case STATUS.ABSENT:
            return {
                dot: 'bg-rose-400',
                text: 'text-rose-700',
                pill: 'bg-rose-50',
                accent: 'bg-rose-300',
            };
        case STATUS.HALF_DAY:
            return {
                dot: 'bg-orange-400',
                text: 'text-orange-700',
                pill: 'bg-orange-50',
                accent: 'bg-orange-300',
            };
        default:
            return {
                dot: 'bg-slate-200',
                text: 'text-slate-400',
                pill: 'bg-transparent',
                accent: 'bg-transparent',
            };
    }
};

export default function AttendanceCalendar({
    data = [],
    holidays = [],
    leaves = [],
    settings = {},
    currentMonth,
    currentYear,
    onDateClick,
    selectedDate,
    headerControls = null
}) {
    const weeklyOffDays = useMemo(() => Array.isArray(settings.weeklyOffDays) ? settings.weeklyOffDays : [0], [settings.weeklyOffDays]);

    const formatDateStr = (year, month, day) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    /**
     * Dynamic Weekly Off Detector
     * Mimics backend logic to decide if a specific date is a weekly off.
     */
    const checkIsWeeklyOff = (date, settingsObj) => {
        const day = date.getDay(); // 0-6
        const baseWeeklyOffDays = Array.isArray(settingsObj.weeklyOffDays) ? settingsObj.weeklyOffDays : [0];
        
        const adv = settingsObj.advancedPolicy || {};
        const weeklyOffCfg = adv.weeklyOff || {};

        // Global weekly off mode
        switch (weeklyOffCfg.mode) {
            case 'sunday':
                return (day === 0);
            case 'saturday_sunday':
                return (day === 0 || day === 6);
            case 'alternate_saturday':
                if (day === 6) {
                    // Week of month: 1-5
                    const week = Math.floor((date.getDate() - 1) / 7) + 1;
                    const offWeeks = Array.isArray(weeklyOffCfg.alternateSaturday?.offWeeks)
                        ? weeklyOffCfg.alternateSaturday.offWeeks
                        : [2, 4]; // Default 2nd & 4th
                    return offWeeks.includes(week);
                }
                return baseWeeklyOffDays.includes(day);
            default:
                return baseWeeklyOffDays.includes(day);
        }
    };

    const today = new Date();
    const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    const calendarArray = useMemo(() => {
        const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
        const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

        const arr = [];
        for (let i = 0; i < firstDay; i++) arr.push({ type: 'empty' });

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = formatDateStr(currentYear, currentMonth, d);
            const date = new Date(currentYear, currentMonth, d);
            const dow = date.getDay();

            arr.push({
                type: 'date',
                dateStr,
                dayNum: d,
                isWeeklyOff: checkIsWeeklyOff(date, settings),
                isToday: todayStr === dateStr,
                isPast: dateStr < todayStr,
            });
        }
        return arr;
    }, [currentMonth, currentYear, todayStr, settings]);

    const attendanceMap = useMemo(() => {
        const map = {};
        data.forEach(item => {
            const raw = item.date || item.dateStr || item._id || '';
            const dStr = (raw && raw.split ? raw.split('T')[0] : raw) || '';
            if (dStr) map[dStr] = item;
        });
        return map;
    }, [data]);

    const holidayMap = useMemo(() => {
        const map = {};
        holidays.forEach(h => {
            const dStr = h.date.split('T')[0];
            map[dStr] = h;
        });
        return map;
    }, [holidays]);

    const leaveMap = useMemo(() => {
        const map = {};
        leaves.forEach(leave => {
            const status = leave.status?.toLowerCase();
            if (status !== 'approved' && status !== 'pending') return;

            let current = dayjs(leave.startDate).startOf('day');
            const end = dayjs(leave.endDate || leave.startDate).endOf('day');
            
            while (current.isBefore(end) || current.isSame(end, 'day')) {
                const dStr = current.format('YYYY-MM-DD');
                if (!map[dStr] || status === 'approved') {
                    map[dStr] = { status, type: leave.leaveType };
                }
                current = current.add(1, 'day');
            }
        });
        return map;
    }, [leaves]);

    const deriveFinalStatus = (dayObj, holidayFlag, weeklyOffFlag, leaveStatus, isPast, isToday) => {
        // 1. Priority: Manual/Server status overrides
        const serverFinal = (dayObj?.finalStatus || '').toString().toUpperCase();
        if (serverFinal === 'HOLIDAY' || holidayFlag) return STATUS.HOLIDAY;
        if (serverFinal === 'WEEKLY_OFF' || weeklyOffFlag) return STATUS.WEEKLY_OFF;
        if (serverFinal === 'LEAVE' || leaveStatus === 'approved') return STATUS.LEAVE;
        if (leaveStatus === 'pending') return 'LEAVE_PENDING';

        // 2. Attendance Record Status
        const attStatus = (dayObj?.status || '').toString().toUpperCase();
        const isWfh = dayObj?.isWFH || attStatus === 'WFH';
        const isOnDuty = dayObj?.isOnDuty || ['ON_DUTY', 'ON-DUTY', 'ONDUTY'].includes(attStatus);

        if (attStatus === 'PRESENT' || isWfh) return STATUS.PRESENT;
        if (isOnDuty) return STATUS.ON_DUTY;
        if (attStatus === 'HALF_DAY') return STATUS.HALF_DAY;
        if (attStatus === 'ABSENT') return STATUS.ABSENT;
        if (attStatus === 'LEAVE') return STATUS.LEAVE;
        if (attStatus === 'WEEKLY_OFF') return STATUS.WEEKLY_OFF;
        if (attStatus === 'HOLIDAY') return STATUS.HOLIDAY;

        // 3. Synthesis for working days (Mon-Sat or whatever is not Weekly Off)
        // If it's a past day or today, and we have no punch/record, and it's not a weekend/holiday
        if (isPast || isToday) {
            // If we are here, it's a working day with no record
            return STATUS.ABSENT;
        }

        return STATUS.DEFAULT;
    };

    return (
        <div className="bg-transparent font-inter">
            <div className="mb-1 flex flex-col gap-2 p-[5px] pr-0 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {Object.entries(LEGEND_LABELS).filter(([key]) => key !== 'DEFAULT').map(([key, label]) => {
                        const palette = getStatusPalette(key === 'LEAVE_PENDING' ? 'LEAVE_PENDING' : STATUS[key]);
                        return (
                            <div key={key} className="flex items-center gap-2">
                                <div className={clsx('h-2.5 w-2.5 rounded-full', palette.dot)} />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
                            </div>
                        );
                    })}
                </div>
                {headerControls && <div className="flex justify-end lg:pr-0">{headerControls}</div>}
            </div>

            <div className="overflow-hidden rounded-none border border-[#E2E8F0] bg-white">
                <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-slate-50/70">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <div
                            key={day}
                            className={clsx(
                                'border-r border-[#E2E8F0] px-2 py-1.5 text-center text-[12px] font-semibold',
                                idx === 6 ? 'border-r-0 text-rose-400' : idx === 5 ? 'text-slate-700' : 'text-slate-700',
                            )}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7">
                {calendarArray.map((cell, i) => {
                    if (cell.type === 'empty') {
                        return <div key={`empty-${i}`} className="min-h-[90px] border-r border-b border-[#E2E8F0] bg-white" />;
                    }

                    const { dateStr, dayNum, isWeeklyOff, isToday, isPast } = cell;
                    const attendance = attendanceMap[dateStr];
                    const holiday = holidayMap[dateStr];
                    const leaveData = leaveMap[dateStr];
                    const finalStatus = deriveFinalStatus(attendance, !!holiday, isWeeklyOff, leaveData?.status, isPast, isToday);
                    const palette = getStatusPalette(finalStatus);
                    const isSelected = selectedDate === dateStr;
                    const statusLabel = LEGEND_LABELS[finalStatus] || '';
                    const hoverTitleParts = [];
                    if (statusLabel) hoverTitleParts.push(statusLabel);
                    if (attendance?.checkIn) hoverTitleParts.push(`In: ${dayjs(attendance.checkIn).format('hh:mm A')}`);
                    if (attendance?.checkOut) hoverTitleParts.push(`Out: ${dayjs(attendance.checkOut).format('hh:mm A')}`);
                    const hoverTitle = hoverTitleParts.join(' • ');

                    return (
                        <div
                            key={dateStr}
                            onClick={() => onDateClick?.(dateStr)}
                            title={hoverTitle || undefined}
                            className={clsx(
                                'relative flex min-h-[90px] cursor-pointer flex-col border-r border-b border-[#E2E8F0] bg-white p-2 transition-all duration-200',
                                isToday && 'bg-emerald-50/40',
                                isSelected && 'shadow-[inset_0_0_0_2px_#2563EB]',
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <span className={clsx(
                                    'text-[14px] font-bold leading-none tracking-tight transition-colors',
                                    isToday ? 'text-emerald-500' : isWeeklyOff && !holiday ? 'text-slate-300' : 'text-[#334155]',
                                )}>
                                    {dayNum}
                                </span>
                                <div className="flex items-start gap-2">
                                    {isToday && (
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">
                                            {dayNum}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-auto">
                                {statusLabel ? (
                                    <div className={clsx('flex min-h-[20px] items-center overflow-hidden rounded-md', palette.pill)}>
                                        <div className={clsx('ml-1.5 h-3.5 w-1 rounded-full', palette.accent)} />
                                        <span className={clsx('px-2 text-[11px] font-medium', palette.text)}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="min-h-[20px]" />
                                )}
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
    );
}
