import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Clock9,
  FileText,
  UserCheck,
  Coffee,
  SlidersHorizontal,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin,
  CalendarRange
} from 'lucide-react';

// Modern curated palette with soft pastel colors and matching text
const STATUS_STYLES = {
  PRESENT: {
    bg: 'bg-emerald-50/80 border-emerald-100 hover:border-emerald-300',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Present'
  },
  ABSENT: {
    bg: 'bg-rose-50/80 border-rose-100 hover:border-rose-300',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    label: 'Absent'
  },
  LEAVE_APPROVED: {
    bg: 'bg-amber-50/90 border-amber-200 hover:border-amber-400',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    label: 'Leave'
  },
  LEAVE_PENDING: {
    bg: 'bg-amber-50/40 border-amber-200/60 border-dashed hover:border-amber-300',
    text: 'text-amber-600',
    dot: 'bg-amber-400',
    label: 'Pending Leave'
  },
  LEAVE_REJECTED: {
    bg: 'bg-rose-50 border-rose-400/80 border-2 hover:border-rose-500',
    text: 'text-rose-600',
    dot: 'bg-rose-500',
    label: 'Rejected Leave'
  },
  HALF_DAY: {
    bg: 'bg-orange-50/80 border-orange-100 hover:border-orange-300',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    label: 'Half Day'
  },
  WEEKLY_OFF: {
    bg: 'bg-sky-50/70 border-sky-100 hover:border-sky-300',
    text: 'text-sky-600',
    dot: 'bg-sky-500',
    label: 'Weekly Off'
  },
  HOLIDAY: {
    bg: 'bg-purple-50/70 border-purple-100 hover:border-purple-300',
    text: 'text-purple-600',
    dot: 'bg-purple-500',
    label: 'Holiday'
  },
  MISSED_PUNCH: {
    bg: 'bg-slate-900 text-white border-slate-950 hover:bg-slate-800',
    text: 'text-slate-200',
    dot: 'bg-slate-400',
    label: 'Missed Punch'
  },
  DEFAULT: {
    bg: 'bg-slate-50/40 border-slate-100',
    text: 'text-slate-400',
    dot: 'bg-slate-300',
    label: ''
  }
};

const formatDecimalHours = (decimalHours) => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return '00:00';
  const hrs = Math.floor(decimalHours);
  const mins = Math.round((decimalHours - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export default function EmployeeAttendanceCalendar({
  data = [],
  holidays = [],
  leaves = [],
  settings = {},
  currentMonth,
  currentYear,
  setCurrentMonth,
  setCurrentYear,
  requests = [],
  onCancelLeave,
  onApplyRegularization,
  onOpenEarlyReturn
}) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [filters, setFilters] = useState({
    status: 'ALL',
    leaveType: 'ALL',
    missedPunchOnly: false,
    overtimeOnly: false
  });

  // Calculate month values
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayIndex = useMemo(() => {
    const day = new Date(currentYear, currentMonth, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon is 0, Sun is 6
  }, [currentYear, currentMonth]);

  // Map settings
  const weeklyOffDays = useMemo(() => {
    return Array.isArray(settings.weeklyOffDays) ? settings.weeklyOffDays : [0];
  }, [settings.weeklyOffDays]);

  const checkIsWeeklyOff = (date) => {
    const day = date.getDay();
    const adv = settings.advancedPolicy || {};
    const weeklyOffCfg = adv.weeklyOff || {};

    switch (weeklyOffCfg.mode) {
      case 'sunday':
        return day === 0;
      case 'saturday_sunday':
        return day === 0 || day === 6;
      case 'alternate_saturday':
        if (day === 6) {
          const week = Math.floor((date.getDate() - 1) / 7) + 1;
          const offWeeks = Array.isArray(weeklyOffCfg.alternateSaturday?.offWeeks)
            ? weeklyOffCfg.alternateSaturday.offWeeks
            : [2, 4];
          return offWeeks.includes(week);
        }
        return weeklyOffDays.includes(day);
      default:
        return weeklyOffDays.includes(day);
    }
  };

  // Maps for efficient lookups
  const attendanceMap = useMemo(() => {
    const map = {};
    data.forEach(item => {
      const rawDate = item.date || item.dateStr || item._id || '';
      const dStr = (rawDate && rawDate.split ? rawDate.split('T')[0] : rawDate) || '';
      if (dStr) map[dStr] = item;
    });
    return map;
  }, [data]);

  const holidayMap = useMemo(() => {
    const map = {};
    holidays.forEach(h => {
      if (h.date) {
        const dStr = h.date.split('T')[0];
        map[dStr] = h;
      }
    });
    return map;
  }, [holidays]);

  const leaveMap = useMemo(() => {
    const map = {};
    leaves.forEach(leave => {
      const status = leave.status?.toLowerCase();
      if (status !== 'approved' && status !== 'pending' && status !== 'rejected') return;

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

  const requestMap = useMemo(() => {
    const map = {};
    requests.forEach(req => {
      const dStr = dayjs(req.startDate).format('YYYY-MM-DD');
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(req);
    });
    return map;
  }, [requests]);

  // Derive day status helper
  const deriveCellState = (dateStr, date) => {
    const attendance = attendanceMap[dateStr];
    const holiday = holidayMap[dateStr];
    const leaveData = leaveMap[dateStr];
    const isWeeklyOff = checkIsWeeklyOff(date);
    const todayStr = dayjs().format('YYYY-MM-DD');
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;

    // 1. Leave Priority
    if (leaveData) {
      if (leaveData.status === 'approved') return 'LEAVE_APPROVED';
      if (leaveData.status === 'pending') return 'LEAVE_PENDING';
      if (leaveData.status === 'rejected') return 'LEAVE_REJECTED';
    }

    // 2. Holiday & Weekly Off
    const serverFinal = (attendance?.finalStatus || '').toString().toUpperCase();
    if (serverFinal === 'HOLIDAY' || holiday) return 'HOLIDAY';
    if (serverFinal === 'WEEKLY_OFF' || isWeeklyOff) return 'WEEKLY_OFF';

    // 3. Attendance Details
    if (attendance) {
      const hasIn = !!attendance.checkIn;
      const hasOut = !!attendance.checkOut;
      if ((hasIn && !hasOut) || (!hasIn && hasOut)) {
        return 'MISSED_PUNCH';
      }

      const attStatus = (attendance.status || '').toString().toUpperCase();
      const isWfh = attendance.isWFH || attStatus === 'WFH';
      const isOnDuty = attendance.isOnDuty || ['ON_DUTY', 'ON-DUTY', 'ONDUTY'].includes(attStatus);

      if (attStatus === 'PRESENT' || isWfh || isOnDuty) return 'PRESENT';
      if (attStatus === 'HALF_DAY') return 'HALF_DAY';
      if (attStatus === 'ABSENT') return 'ABSENT';
      if (attStatus === 'WEEKLY_OFF') return 'WEEKLY_OFF';
      if (attStatus === 'HOLIDAY') return 'HOLIDAY';
    }

    // 4. Default for past / today
    if (isPast || isToday) {
      return 'ABSENT'; // Unmarked working day is Absent
    }

    return 'DEFAULT';
  };

  // Generate calendar days
  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ type: 'empty' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const dateStr = dayjs(date).format('YYYY-MM-DD');
      const status = deriveCellState(dateStr, date);
      const attendance = attendanceMap[dateStr];
      const leaveData = leaveMap[dateStr];
      const dayReqs = requestMap[dateStr] || [];

      cells.push({
        type: 'day',
        dayNum: d,
        dateStr,
        date,
        status,
        attendance,
        leaveData,
        requests: dayReqs,
        isToday: dayjs().format('YYYY-MM-DD') === dateStr
      });
    }
    return cells;
  }, [currentYear, currentMonth, daysInMonth, firstDayIndex, attendanceMap, holidayMap, leaveMap, requestMap]);

  // Compute stats for current month
  const statsSummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let halfDay = 0;
    let lateIn = 0;
    let earlyOut = 0;
    let overtimeDecimal = 0;
    let missedPunch = 0;

    calendarCells.forEach(cell => {
      if (cell.type !== 'day') return;
      if (cell.status === 'PRESENT') present++;
      if (cell.status === 'ABSENT') absent++;
      if (cell.status === 'LEAVE_APPROVED') leave++;
      if (cell.status === 'HALF_DAY') halfDay++;
      if (cell.status === 'MISSED_PUNCH') missedPunch++;

      if (cell.attendance) {
        if (cell.attendance.isLate || cell.attendance.lateMinutes > 0) lateIn++;
        if (cell.attendance.isEarlyOut || cell.attendance.earlyExitMinutes > 0) earlyOut++;
        if (cell.attendance.overtimeHours) overtimeDecimal += Number(cell.attendance.overtimeHours);
      }
    });

    return {
      present,
      absent,
      leave,
      halfDay,
      lateIn,
      earlyOut,
      overtime: formatDecimalHours(overtimeDecimal),
      missedPunch
    };
  }, [calendarCells]);

  // Filter application
  const filteredCells = useMemo(() => {
    return calendarCells.map(cell => {
      if (cell.type === 'empty') return cell;

      let isFiltered = false;
      if (filters.status !== 'ALL') {
        if (filters.status === 'LEAVE' && !['LEAVE_APPROVED', 'LEAVE_PENDING', 'LEAVE_REJECTED'].includes(cell.status)) {
          isFiltered = true;
        } else if (filters.status !== 'LEAVE' && cell.status !== filters.status) {
          isFiltered = true;
        }
      }

      if (filters.leaveType !== 'ALL') {
        const cellLeaveType = cell.leaveData?.type || cell.attendance?.leaveType || '';
        if (String(cellLeaveType).toUpperCase() !== filters.leaveType.toUpperCase()) {
          isFiltered = true;
        }
      }

      if (filters.missedPunchOnly && cell.status !== 'MISSED_PUNCH') {
        isFiltered = true;
      }

      if (filters.overtimeOnly && (!cell.attendance || !cell.attendance.overtimeHours || cell.attendance.overtimeHours <= 0)) {
        isFiltered = true;
      }

      return { ...cell, isDimmed: isFiltered };
    });
  }, [calendarCells, filters]);

  const activeDetailDay = useMemo(() => {
    if (!selectedDate) return null;
    return calendarCells.find(c => c.dateStr === selectedDate && c.type === 'day') || null;
  }, [selectedDate, calendarCells]);

  const matchedLeave = useMemo(() => {
    if (!activeDetailDay || !activeDetailDay.leaveData) return null;
    return leaves.find(leave => {
      const start = dayjs(leave.startDate).startOf('day');
      const end = dayjs(leave.endDate || leave.startDate).endOf('day');
      const current = dayjs(activeDetailDay.dateStr);
      return (current.isAfter(start) || current.isSame(start, 'day')) && 
             (current.isBefore(end) || current.isSame(end, 'day')) &&
             (leave.status?.toLowerCase() === 'pending' || leave.status?.toLowerCase() === 'approved');
    });
  }, [activeDetailDay, leaves]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const yearsRange = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let i = current - 5; i <= current + 2; i++) {
      list.push(i);
    }
    return list;
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards with Premium Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <SummaryCardItem label="Present Days" value={statsSummary.present} color="emerald" icon={CheckCircle} />
        <SummaryCardItem label="Absent Days" value={statsSummary.absent} color="rose" icon={XCircle} />
        <SummaryCardItem label="Leave Days" value={statsSummary.leave} color="amber" icon={CalendarIcon} />
        <SummaryCardItem label="Half Days" value={statsSummary.halfDay} color="orange" icon={UserCheck} />
        <SummaryCardItem label="Late In" value={statsSummary.lateIn} color="indigo" icon={Clock} />
        <SummaryCardItem label="Early Out" value={statsSummary.earlyOut} color="blue" icon={Clock9} />
        <SummaryCardItem label="Overtime" value={statsSummary.overtime} color="violet" icon={TrendingUp} />
        <SummaryCardItem label="Missed Punch" value={statsSummary.missedPunch} color="slate" icon={AlertCircle} />
      </div>

      {/* 2. Controls & Filters Row */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Month/Year selector */}
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="h-9 w-9 flex items-center justify-center bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-all active:scale-95 shadow-sm">
            <ChevronLeft size={16} />
          </button>
          
          <select 
            value={currentMonth} 
            onChange={(e) => setCurrentMonth(Number(e.target.value))}
            className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
          >
            {dayjs.months().map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>

          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(Number(e.target.value))}
            className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
          >
            {yearsRange.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button onClick={handleNextMonth} className="h-9 w-9 flex items-center justify-center bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-all active:scale-95 shadow-sm">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Legend / Filter controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
            <SlidersHorizontal size={14} className="text-slate-400" />
            <span>Filters:</span>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
          >
            <option value="ALL">All Status</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LEAVE">Leave</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="WEEKLY_OFF">Weekly Off</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="MISSED_PUNCH">Missed Punch</option>
          </select>

          <select
            value={filters.leaveType}
            onChange={(e) => setFilters({ ...filters, leaveType: e.target.value })}
            className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
          >
            <option value="ALL">All Leaves</option>
            <option value="CL">CL (Casual)</option>
            <option value="PL">PL (Privileged)</option>
            <option value="SL">SL (Sick)</option>
            <option value="LWP">LWP (Without Pay)</option>
          </select>

          {/* Toggles */}
          <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={filters.missedPunchOnly}
                onChange={(e) => setFilters({ ...filters, missedPunchOnly: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Missed Punch Only</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={filters.overtimeOnly}
                onChange={(e) => setFilters({ ...filters, overtimeOnly: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Overtime Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Color Legends Row */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
        {Object.entries(STATUS_STYLES).map(([key, item]) => {
          if (!item.label) return null;
          return (
            <div key={key} className="flex items-center gap-2 bg-slate-50/50 border border-slate-100 rounded-full px-2.5 py-1">
              <span className={clsx("h-2 w-2 rounded-full", item.dot)} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* 4. Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-visible">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
            <div
              key={day}
              className={clsx(
                'px-2 py-3 text-center text-xs font-bold uppercase tracking-widest border-r border-slate-200 last:border-r-0',
                idx === 6 ? 'text-rose-500' : 'text-slate-500'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 overflow-visible">
          {filteredCells.map((cell, idx) => {
            if (cell.type === 'empty') {
              return (
                <div 
                  key={`empty-${idx}`} 
                  className="min-h-[110px] border-r border-b border-slate-200 bg-slate-50/10 last:border-r-0" 
                />
              );
            }

            const { dayNum, dateStr, status, attendance, leaveData, isToday, isDimmed } = cell;
            
            // Clean up: If status is DEFAULT (no record), we do NOT show any pill.
            // This prevents cluttering the calendar with repetitive "NO RECORD" pills.
            const hasEvent = status !== 'DEFAULT';
            const itemStyle = STATUS_STYLES[status] || STATUS_STYLES.DEFAULT;

            // Prepare Tooltip details
            const checkInFormatted = attendance?.checkIn ? dayjs(attendance.checkIn).format('hh:mm A') : 'N/A';
            const checkOutFormatted = attendance?.checkOut ? dayjs(attendance.checkOut).format('hh:mm A') : 'N/A';
            const workHrs = attendance?.workingHours ? formatDecimalHours(attendance.workingHours) : 'N/A';
            const otHrs = attendance?.overtimeHours ? formatDecimalHours(attendance.overtimeHours) : 'N/A';
            const lateMin = attendance?.lateMinutes || 0;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={clsx(
                  'relative group flex min-h-[110px] cursor-pointer flex-col border-r border-b border-slate-200 p-2.5 transition-all duration-200 hover:bg-slate-50/50',
                  isToday && 'bg-emerald-50/10',
                  isDimmed && 'opacity-20 grayscale-[50%]'
                )}
              >
                {/* Day Number Header */}
                <div className="flex items-start justify-between">
                  <span className={clsx(
                    'text-xs font-bold leading-none tracking-tight',
                    isToday ? 'bg-emerald-600 text-white h-5 w-5 rounded-full flex items-center justify-center font-extrabold shadow-sm' : 'text-slate-600'
                  )}>
                    {dayNum}
                  </span>

                  {/* Indicators */}
                  <div className="flex gap-1">
                    {status === 'LEAVE_PENDING' && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold px-1 py-0.5 rounded uppercase tracking-wider">
                        Pending
                      </span>
                    )}
                    {status === 'LEAVE_REJECTED' && (
                      <span className="text-[8px] bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold px-1 py-0.5 rounded uppercase tracking-wider">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badge at cell bottom */}
                {hasEvent && (
                  <div className="mt-auto">
                    <div className={clsx(
                      'flex min-h-[22px] items-center rounded-lg border px-2 py-0.5 transition-all shadow-sm',
                      itemStyle.bg
                    )}>
                      <div className={clsx('h-1.5 w-1.5 rounded-full shrink-0 mr-1.5', itemStyle.dot)} />
                      <span className={clsx('text-[9px] font-bold truncate uppercase tracking-widest leading-none', itemStyle.text)}>
                        {leaveData ? `${leaveData.type} Leave` : itemStyle.label}
                      </span>
                    </div>
                  </div>
                )}

                {/* --- Sleek Premium Dark Tooltip (High contrast, glassmorphic dropdown) --- */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[240px] bg-slate-950/95 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md hidden group-hover:block z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {/* Tooltip Header */}
                  <div className="border-b border-slate-800 pb-2 mb-2.5 flex justify-between items-center">
                    <span className="font-extrabold text-[12px] text-slate-100">{dayjs(dateStr).format('DD MMM YYYY')}</span>
                    <span className={clsx(
                      "text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest text-white/90 border border-white/10",
                      status === 'PRESENT' && 'bg-emerald-600',
                      status === 'ABSENT' && 'bg-rose-600',
                      status === 'WEEKLY_OFF' && 'bg-sky-600',
                      status === 'HOLIDAY' && 'bg-purple-600',
                      status === 'MISSED_PUNCH' && 'bg-slate-700',
                      status === 'LEAVE_APPROVED' && 'bg-amber-600',
                      status === 'DEFAULT' && 'bg-slate-800'
                    )}>
                      {leaveData ? `${leaveData.type} Leave` : (itemStyle.label || 'No Record')}
                    </span>
                  </div>
                  
                  {/* Tooltip Details */}
                  {status === 'DEFAULT' || (status === 'ABSENT' && !attendance) ? (
                    <div className="text-center py-2 flex flex-col items-center gap-1">
                      <CalendarRange size={16} className="text-slate-500" />
                      <span className="text-slate-400 text-[10px]">No punch records found.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px] text-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Punch In:</span>
                        <span className="font-bold text-slate-100">{checkInFormatted}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Punch Out:</span>
                        <span className="font-bold text-slate-100">{checkOutFormatted}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800/80 pt-1.5 mt-1.5">
                        <span className="text-slate-400">Working Hours:</span>
                        <span className="font-extrabold text-emerald-400">{workHrs}</span>
                      </div>
                      {attendance?.overtimeHours > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">OT Hours:</span>
                          <span className="font-extrabold text-violet-400">{otHrs}</span>
                        </div>
                      )}
                      {lateMin > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Late By:</span>
                          <span className="font-extrabold text-rose-400">{lateMin} Min</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tooltip Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Date Click Details Modal (Popup) */}
      {activeDetailDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Day Attendance Details</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5 tracking-wider">{dayjs(activeDetailDay.dateStr).format('dddd, DD MMMM YYYY')}</p>
              </div>
              <button 
                onClick={() => setSelectedDate(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Attendance Status" value={STATUS_COLORS_LABEL(activeDetailDay.status)} isStatus statusKey={activeDetailDay.status} />
                <DetailItem label="Half Day Status" value={activeDetailDay.attendance?.status === 'half_day' || activeDetailDay.status === 'HALF_DAY' ? 'Yes' : 'No'} />
                
                <DetailItem label="Punch In Time" value={activeDetailDay.attendance?.checkIn ? dayjs(activeDetailDay.attendance.checkIn).format('hh:mm A') : 'N/A'} icon={Clock} />
                <DetailItem label="Punch Out Time" value={activeDetailDay.attendance?.checkOut ? dayjs(activeDetailDay.attendance.checkOut).format('hh:mm A') : 'N/A'} icon={Clock} />
                
                <DetailItem label="Working Hours" value={activeDetailDay.attendance?.workingHours ? `${formatDecimalHours(activeDetailDay.attendance.workingHours)} Hrs` : 'N/A'} />
                <DetailItem label="Break Hours" value={activeDetailDay.attendance?.workingHours ? '01:00 Hr' : 'N/A'} icon={Coffee} />
                
                <DetailItem label="Overtime Hours" value={activeDetailDay.attendance?.overtimeHours ? `${formatDecimalHours(activeDetailDay.attendance.overtimeHours)} Hrs` : 'N/A'} />
                <DetailItem label="Late In Time" value={activeDetailDay.attendance?.lateMinutes ? `${activeDetailDay.attendance.lateMinutes} Min` : 'N/A'} />
                
                <DetailItem label="Early Out Time" value={activeDetailDay.attendance?.earlyExitMinutes ? `${activeDetailDay.attendance.earlyExitMinutes} Min` : 'N/A'} />
                <DetailItem label="Leave Type" value={activeDetailDay.leaveData?.type || activeDetailDay.attendance?.leaveType || 'N/A'} />
              </div>

              {/* Request Status Subsection */}
              {activeDetailDay.requests.length > 0 && (
                <div className="border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Linked Day Requests</h4>
                  <div className="space-y-2">
                    {activeDetailDay.requests.map((req, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-slate-400" />
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {req.issueType === 'Regularization' ? 'Attendance Regularization' : 'Missed Punch Request'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium max-w-[220px] truncate">Reason: "{req.reason}"</p>
                          </div>
                        </div>
                        <span className={clsx(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                          req.status === 'Approved' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          req.status === 'Pending' && "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
                          req.status === 'Rejected' && "bg-rose-50 text-rose-700 border-rose-200"
                        )}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              {/* Left Side: Leave Cancellation Actions */}
              <div className="flex gap-2">
                {matchedLeave && matchedLeave.status?.toLowerCase() === 'pending' && (
                  <button
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to cancel this leave request?')) {
                        try {
                          await onCancelLeave?.(matchedLeave._id);
                          setSelectedDate(null);
                        } catch (err) {
                          alert('Failed to cancel leave request');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm flex items-center gap-1.5"
                  >
                    <XCircle size={14} />
                    <span>Cancel Leave</span>
                  </button>
                )}

                {matchedLeave && matchedLeave.status?.toLowerCase() === 'approved' && dayjs().isBefore(dayjs(matchedLeave.endDate).endOf('day')) && (
                  <button
                    onClick={() => {
                      onOpenEarlyReturn?.(matchedLeave);
                      setSelectedDate(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm flex items-center gap-1.5"
                  >
                    <Clock size={14} />
                    <span>Early Return / Cancel</span>
                  </button>
                )}
              </div>

              {/* Right Side: Regularization and Close actions */}
              <div className="flex gap-2">
                {activeDetailDay.dateStr <= dayjs().format('YYYY-MM-DD') && (
                  <button
                    onClick={() => {
                      onApplyRegularization?.(
                        activeDetailDay.dateStr,
                        activeDetailDay.attendance?.checkIn,
                        activeDetailDay.attendance?.checkOut
                      );
                      setSelectedDate(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm flex items-center gap-1.5"
                  >
                    <SlidersHorizontal size={14} />
                    <span>Regularize / Missed Punch</span>
                  </button>
                )}

                <button 
                  onClick={() => setSelectedDate(null)} 
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all active:scale-[0.98] shadow-sm"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Calendar Requests Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">My Requests & Regularizations</h3>
            <p className="text-xs text-slate-400 mt-0.5">Summary of your missed punch and correction applications</p>
          </div>
          <span className="text-[11px] font-bold text-[#2563EB] bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {requests.length} Total Requests
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.slice(0, 6).map((req, idx) => {
            const isMissedPunch = req.requestedData?.punchIn || req.requestedData?.punchOut || req.issueType === 'Missed Punch';
            return (
              <div 
                key={idx} 
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 shadow-sm flex items-center justify-between bg-white hover:bg-slate-50/30 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-700 shrink-0">
                    <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider leading-none mb-0.5">{dayjs(req.startDate).format('MMM')}</span>
                    <span className="text-base font-bold leading-none">{dayjs(req.startDate).format('DD')}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-0.5">
                      {isMissedPunch ? 'Missed Punch Request' : 'Attendance Regularization'}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-none">
                      Applied: {dayjs(req.createdAt).format('DD MMM YYYY')}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5">
                  <span className={clsx(
                    "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border",
                    req.status === 'Approved' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    req.status === 'Pending' && "bg-amber-50 text-amber-700 border-amber-200",
                    req.status === 'Rejected' && "bg-rose-50 text-rose-700 border-rose-200"
                  )}>
                    {req.status}
                  </span>
                </div>
              </div>
            );
          })}
          {requests.length === 0 && (
            <div className="col-span-2 text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Info className="mx-auto text-slate-300 mb-1.5" size={24} />
              <p className="text-xs text-slate-400 font-semibold uppercase">No requests logged yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponents for summary cards and details
function SummaryCardItem({ label, value, color, icon: Icon }) {
  const colorMap = {
    emerald: { text: 'text-emerald-700', border: 'border-emerald-100/80', iconBg: 'bg-emerald-100/70', accent: 'bg-emerald-500' },
    rose: { text: 'text-rose-700', border: 'border-rose-100/80', iconBg: 'bg-rose-100/70', accent: 'bg-rose-500' },
    amber: { text: 'text-amber-700', border: 'border-amber-100/80', iconBg: 'bg-amber-100/70', accent: 'bg-amber-500' },
    orange: { text: 'text-orange-700', border: 'border-orange-100/80', iconBg: 'bg-orange-100/70', accent: 'bg-orange-500' },
    indigo: { text: 'text-indigo-700', border: 'border-indigo-100/80', iconBg: 'bg-indigo-100/70', accent: 'bg-indigo-500' },
    blue: { text: 'text-blue-700', border: 'border-blue-100/80', iconBg: 'bg-blue-100/70', accent: 'bg-blue-500' },
    violet: { text: 'text-violet-700', border: 'border-violet-100/80', iconBg: 'bg-violet-100/70', accent: 'bg-violet-500' },
    slate: { text: 'text-slate-700', border: 'border-slate-200/80', iconBg: 'bg-slate-100/70', accent: 'bg-slate-500' }
  };
  const theme = colorMap[color] || colorMap.slate;

  return (
    <div className={clsx("flex-1 bg-white p-3 rounded-2xl border shadow-sm flex items-center justify-between hover:shadow-md transition-all group relative overflow-hidden", theme.border)}>
      {/* Accent strip */}
      <div className={clsx("absolute left-0 top-0 h-full w-1", theme.accent)} />
      <div className="flex flex-col min-w-0 pl-1">
        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider truncate mb-1">{label}</span>
        <span className={clsx("text-[17px] font-black leading-none", theme.text)}>{value}</span>
      </div>
      <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", theme.iconBg, theme.text)}>
        <Icon size={14} />
      </div>
    </div>
  );
}

function DetailItem({ label, value, icon: Icon, isStatus, statusKey }) {
  let style = 'bg-slate-50 border-slate-200 text-slate-700';
  if (isStatus && statusKey) {
    const sColors = STATUS_STYLES[statusKey] || STATUS_STYLES.DEFAULT;
    style = `${sColors.bg} ${sColors.text}`;
  }

  return (
    <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl flex flex-col">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-center gap-1.5 mt-0.5">
        {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
        <span className={clsx(
          "text-xs font-bold leading-none",
          isStatus ? "px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border shadow-sm" : "text-slate-700",
          isStatus && style
        )}>
          {value || 'N/A'}
        </span>
      </div>
    </div>
  );
}

function STATUS_COLORS_LABEL(statusKey) {
  const item = STATUS_STYLES[statusKey];
  return item ? (item.label || 'No Record') : 'No Record';
}
