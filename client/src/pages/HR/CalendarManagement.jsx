import React, { useState, useEffect, useMemo } from 'react';
import { Pagination, DatePicker, Select, Checkbox, Slider, Tooltip, Drawer, Tabs, Badge, Modal, Popover } from 'antd';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import dayjs from 'dayjs';
import api, { API_ROOT } from '../../utils/api';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import {
    Upload, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Coffee, Edit2, Trash2, X, AlertCircle, FileSpreadsheet, AlertTriangle,
    CheckCircle, Save, Calendar as CalendarIcon, Clock, Filter, List,
    Settings, Users, Sliders, Palette, Eye, Download, Info, User, HelpCircle,
    Flame, LogOut, Home, Car, FileText, Sparkles, TrendingUp, RefreshCw,
    MapPin, ShieldAlert, Award, Activity, Layers, CheckSquare, BarChart2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Can } from '../../components/rbac/PermissionGate';
import * as XLSX from '@sheetjs/xlsx';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as ChartTooltip, Legend, BarChart, Bar, LineChart, Line
} from 'recharts';

// --- Helpers ---
const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const baseUrl = API_ROOT || '';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
};

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
};

const EmployeeAvatar = ({ employee, size = "w-10 h-10", initialsSize = "text-[10px]", className = "" }) => {
    const [imgError, setImgError] = useState(false);
    const imageUrl = getImageUrl(employee?.profilePic);
    const hasImage = imageUrl && employee.profilePic !== '/uploads/default-avatar.png';

    if (!hasImage || imgError) {
        const initials = getInitials(employee?.name || `${employee?.firstName || ''} ${employee?.lastName || ''}`);
        return (
            <div className={`${size} rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
                <span className={`${initialsSize} font-black text-indigo-600 uppercase tracking-tighter`}>{initials}</span>
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={employee?.name || `${employee?.firstName || ''} ${employee?.lastName || ''}`}
            onError={() => setImgError(true)}
            className={`${size} rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0 ${className}`}
        />
    );
};

export default function CalendarManagement() {
    const scrollbarStyle = `
        .custom-scrollbar::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
    `;

    // --- State Variables ---
    const [loading, setLoading] = useState(true);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed
    const [viewMode, setViewMode] = useState('Month'); // 'Month' | 'Heatmap' | 'Timeline' | 'Analytics'
    const [activeLayer, setActiveLayer] = useState('Attendance'); // 'Attendance' | 'Leave' | 'Shift' | 'Overtime' | 'Productivity' | 'Compliance'
    const [kpiFilter, setKpiFilter] = useState('All'); // 'All' | 'Present' | 'Absent' | 'Leave' | 'Missing' | 'Overtime'

    // Bulk aggregated monthly data
    const [rawData, setRawData] = useState({
        employees: [],
        attendances: [],
        leaves: [],
        regularizations: [],
        holidays: [],
        settings: {},
        lookups: { branches: [], departments: [], designations: [], shifts: [], grades: [] }
    });

    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Fully Configurable Dashboard settings
    const [config, setConfig] = useState({
        showPunchInOut: true,
        showOT: true,
        showLateIn: true,
        showLeave: true,
        showSalaryImpact: true,
        showShiftDetails: true,
        showGeoLocation: true,
        showFaceVerification: false
    });

    // Dynamic Colors Rules (default palette)
    const [colors, setColors] = useState({
        present: '#10B981', // Green
        absent: '#EF4444', // Red
        leave: '#F59E0B', // Yellow
        halfDay: '#F97316', // Orange
        holiday: '#8B5CF6', // Purple
        weeklyOff: '#3B82F6', // Blue
        missingPunch: '#1E293B', // Slate
        wfh: '#3b82f6', // Blue
        onDuty: '#7c3aed' // Purple
    });

    // Filters State
    const [filters, setFilters] = useState({
        branch: 'All',
        department: 'All',
        designation: 'All',
        shift: 'All',
        gender: 'All',
        grade: 'All',
        employmentType: 'All',
        search: ''
    });

    // Multi-Level Drill Down State
    const [drillDownPath, setDrillDownPath] = useState([
        { id: 'company', label: 'India Company', type: 'company', value: 'All' }
    ]);

    // Modals & Drawers
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'Public', description: '' });

    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState(null);
    const [uploadErrors, setUploadErrors] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadSummary, setUploadSummary] = useState(null);

    // Right Side Drawer (Cell Click View)
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedCellDate, setSelectedCellDate] = useState(null);
    const [drawerTabKey, setDrawerTabKey] = useState('1'); // '1'=Attendance, '2'=Leave, '3'=Missing Punch, '4'=Late In, '5'=Overtime
    const [drawerSearchQuery, setDrawerSearchQuery] = useState('');

    // Detailed drilldown modal
    const [drillEmployeeCalendarOpen, setDrillEmployeeCalendarOpen] = useState(false);
    const [drilledEmployee, setDrilledEmployee] = useState(null);

    // --- Fetch Analytics Data ---
    useEffect(() => {
        fetchAnalyticsData();
    }, [currentYear, currentMonth]);

    const fetchAnalyticsData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/hr/workforce-analytics-calendar?year=${currentYear}&month=${currentMonth + 1}`);
            setRawData(res.data);
        } catch (err) {
            console.error('Failed to fetch analytics data:', err);
            showToast('error', 'Error', 'Failed to load workforce intelligence data');
        } finally {
            setLoading(false);
        }
    };

    // --- Computed Filtered Lists ---
    const filteredEmployees = useMemo(() => {
        let list = rawData.employees || [];

        // Apply Drill Down path
        drillDownPath.forEach(path => {
            if (path.type === 'branch' && path.value !== 'All') {
                list = list.filter(emp => emp.branchId?._id === path.value || emp.branchId === path.value);
            }
            if (path.type === 'department' && path.value !== 'All') {
                list = list.filter(emp => emp.departmentId?._id === path.value || emp.departmentId === path.value || emp.department === path.value);
            }
            if (path.type === 'team' && path.value !== 'All') {
                list = list.filter(emp => emp.reportingManagerId === path.value || emp.manager === path.value);
            }
        });

        // Apply Filters
        if (filters.branch !== 'All') {
            list = list.filter(emp => emp.branchId?._id === filters.branch || emp.branchId === filters.branch);
        }
        if (filters.department !== 'All') {
            list = list.filter(emp => emp.departmentId?._id === filters.department || emp.departmentId === filters.department || emp.department === filters.department);
        }
        if (filters.designation !== 'All') {
            list = list.filter(emp => emp.designationId?._id === filters.designation || emp.designationId === filters.designation || emp.designation === filters.designation);
        }
        if (filters.shift !== 'All') {
            list = list.filter(emp => emp.shiftId?._id === filters.shift || emp.shiftId === filters.shift);
        }
        if (filters.gender !== 'All') {
            list = list.filter(emp => String(emp.gender).toLowerCase() === String(filters.gender).toLowerCase());
        }
        if (filters.grade !== 'All') {
            list = list.filter(emp => emp.gradeId?._id === filters.grade || emp.gradeId === filters.grade || emp.grade === filters.grade);
        }
        if (filters.employmentType !== 'All') {
            list = list.filter(emp => String(emp.employmentType).toLowerCase() === String(filters.employmentType).toLowerCase());
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(emp => 
                `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase().includes(q) ||
                String(emp.employeeId || '').toLowerCase().includes(q)
            );
        }

        // Apply Clickable KPI Cards filter
        if (kpiFilter === 'Present') {
            // Filter employees who have at least one Present check-in this month
            const presentEmpIds = new Set(
                (rawData.attendances || [])
                    .filter(a => ['present', 'half_day', 'wfh', 'on_duty'].includes(String(a.status).toLowerCase()))
                    .map(a => String(a.employee))
            );
            list = list.filter(emp => presentEmpIds.has(String(emp._id)));
        } else if (kpiFilter === 'Absent') {
            const absentEmpIds = new Set(
                (rawData.attendances || [])
                    .filter(a => String(a.status).toLowerCase() === 'absent')
                    .map(a => String(a.employee))
            );
            list = list.filter(emp => absentEmpIds.has(String(emp._id)));
        } else if (kpiFilter === 'Leave') {
            const leaveEmpIds = new Set(
                (rawData.leaves || [])
                    .filter(l => l.status === 'Approved')
                    .map(l => String(l.employee))
            );
            list = list.filter(emp => leaveEmpIds.has(String(emp._id)));
        } else if (kpiFilter === 'Missing') {
            const missingEmpIds = new Set(
                (rawData.attendances || [])
                    .filter(a => String(a.status).toLowerCase() === 'missed_punch' || (!a.checkOut && a.checkIn))
                    .map(a => String(a.employee))
            );
            list = list.filter(emp => missingEmpIds.has(String(emp._id)));
        } else if (kpiFilter === 'Overtime') {
            const otEmpIds = new Set(
                (rawData.attendances || [])
                    .filter(a => a.overtimeHours > 0)
                    .map(a => String(a.employee))
            );
            list = list.filter(emp => otEmpIds.has(String(emp._id)));
        }

        return list;
    }, [rawData.employees, rawData.attendances, rawData.leaves, filters, drillDownPath, kpiFilter]);

    // Generate Month Calendar Grid
    const calendarDays = useMemo(() => {
        const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Mon=0, Sun=6
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const todayStr = dayjs().format('YYYY-MM-DD');

        const arr = [];
        for (let i = 0; i < firstDayOfWeek; i++) {
            arr.push({ type: 'empty' });
        }

        const employeeIdsSet = new Set(filteredEmployees.map(e => String(e._id)));

        for (let day = 1; day <= totalDays; day++) {
            const dateObj = new Date(currentYear, currentMonth, day);
            const dateStr = dayjs(dateObj).format('YYYY-MM-DD');
            const dayOfWeek = dateObj.getDay();

            const globalWeeklyOff = (rawData.settings?.weeklyOffDays || [0]).includes(dayOfWeek);
            const isWeeklyOff = (dayOfWeek === 0 || dayOfWeek === 6) || globalWeeklyOff;
            const holiday = (rawData.holidays || []).find(h => dayjs(h.date).format('YYYY-MM-DD') === dateStr);

            const dateAttendances = (rawData.attendances || []).filter(a => 
                dayjs(a.date).format('YYYY-MM-DD') === dateStr && employeeIdsSet.has(String(a.employee))
            );
            const dateLeaves = (rawData.leaves || []).filter(l => {
                const start = dayjs(l.startDate).format('YYYY-MM-DD');
                const end = dayjs(l.endDate || l.startDate).format('YYYY-MM-DD');
                return dateStr >= start && dateStr <= end && employeeIdsSet.has(String(l.employee));
            });

            // Count Stats
            let present = 0;
            let absent = 0;
            let leave = 0;
            let pendingLeave = 0;
            let halfDay = 0;
            let lateIn = 0;
            let earlyOut = 0;
            let overtimeHours = 0;
            let missingPunch = 0;
            let wfh = 0;
            let onDuty = 0;
            let office = 0;
            let remote = 0;
            let field = 0;

            // Shift Coverage details
            let morningShift = 0;
            let eveningShift = 0;
            let nightShift = 0;

            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;

            filteredEmployees.forEach(emp => {
                const empId = String(emp._id);
                const att = dateAttendances.find(a => String(a.employee) === empId);
                const lReq = dateLeaves.find(l => String(l.employee) === empId);

                // Identify shift category
                const shiftName = String(emp.shiftId?.name || '').toLowerCase();
                const isMorning = shiftName.includes('morning') || shiftName.includes('general') || shiftName.includes('day') || !shiftName;
                const isEvening = shiftName.includes('evening') || shiftName.includes('afternoon');
                const isNight = shiftName.includes('night') || shiftName.includes('graveyard');

                if (lReq) {
                    if (lReq.status === 'Approved') {
                        leave++;
                        if (lReq.isHalfDay) halfDay++;
                    } else if (lReq.status === 'Pending') {
                        pendingLeave++;
                    }
                } else if (att) {
                    const statusLower = String(att.status || '').toLowerCase();
                    if (statusLower === 'present') {
                        present++;
                        if (att.isWFH) wfh++;
                        else if (att.isOnDuty) field++;
                        else office++;
                    } else if (statusLower === 'half_day' || statusLower === 'halfday') {
                        halfDay++;
                        present += 0.5;
                        office += 0.5;
                    } else if (statusLower === 'wfh') {
                        wfh++;
                        present++;
                    } else if (statusLower === 'on_duty' || statusLower === 'on-duty' || statusLower === 'onduty') {
                        field++;
                        present++;
                    } else if (statusLower === 'absent') {
                        absent++;
                    } else if (statusLower === 'missed_punch') {
                        missingPunch++;
                    }

                    if (att.isLate) lateIn++;
                    if (att.isEarlyOut) earlyOut++;
                    overtimeHours += att.overtimeHours || 0;

                    if (att.deviceType === 'mobile') remote++;

                    // Shift tracking of present employees
                    if (['present', 'wfh', 'on_duty', 'half_day'].includes(statusLower)) {
                        if (isMorning) morningShift++;
                        else if (isEvening) eveningShift++;
                        else if (isNight) nightShift++;
                    }
                } else {
                    if (isPast && !holiday && !isWeeklyOff) {
                        absent++;
                    }
                }
            });

            const activeCount = filteredEmployees.length;
            const expected = activeCount - leave;
            const attendancePercentage = expected > 0 ? Math.round((present / expected) * 100) : 100;

            // Productivity Score: average working hours compared to standard 8-hour shift
            const totalWorking = dateAttendances.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);
            const expectedHrs = expected * 8;
            const productivityScore = expectedHrs > 0 ? Math.min(100, Math.round((totalWorking / expectedHrs) * 100)) : 100;

            arr.push({
                type: 'date',
                dateStr,
                dayNum: day,
                isWeeklyOff,
                holiday,
                isToday,
                isPast,
                isFuture: !isPast && !isToday,
                stats: {
                    total: activeCount,
                    present,
                    absent,
                    leave,
                    pendingLeave,
                    halfDay,
                    lateIn,
                    earlyOut,
                    overtimeHours: parseFloat(overtimeHours.toFixed(1)),
                    missingPunch,
                    wfh,
                    onDuty,
                    office,
                    field,
                    remote,
                    morningShift,
                    eveningShift,
                    nightShift,
                    productivityScore
                },
                attendancePercentage
            });
        }
        return arr;
    }, [currentYear, currentMonth, filteredEmployees, rawData]);

    // Recalculated Monthly Analytics summary cards
    const monthStats = useMemo(() => {
        let totalPresent = 0, totalAbsent = 0, totalLeaves = 0, totalLate = 0, totalOT = 0, totalMissing = 0;
        let pastDays = 0;

        calendarDays.forEach(day => {
            if (day.type === 'date' && day.isPast) {
                totalPresent += day.stats.present;
                totalAbsent += day.stats.absent;
                totalLeaves += day.stats.leave;
                totalLate += day.stats.lateIn;
                totalOT += day.stats.overtimeHours;
                totalMissing += day.stats.missingPunch;
                pastDays++;
            }
        });

        const activeCount = filteredEmployees.length;
        const totalPossible = activeCount * pastDays;

        const attendancePct = totalPossible > 0 ? Math.round((totalPresent / (totalPossible - totalLeaves)) * 100) : 100;
        const leavePct = totalPossible > 0 ? Math.round((totalLeaves / totalPossible) * 100) : 0;
        const latePct = totalPresent > 0 ? Math.round((totalLate / totalPresent) * 100) : 0;
        const absenteeismPct = totalPossible > 0 ? Math.round((totalAbsent / totalPossible) * 100) : 0;
        const productivity = Math.max(50, 100 - (absenteeismPct + (latePct / 2)));

        return {
            totalEmployees: activeCount,
            attendancePct,
            leavePct,
            totalOT: parseFloat(totalOT.toFixed(1)),
            latePct,
            absenteeismPct,
            productivity,
            totalPresentCount: totalPresent,
            totalAbsentCount: totalAbsent,
            totalLeavesCount: totalLeaves,
            totalMissingCount: totalMissing
        };
    }, [calendarDays, filteredEmployees]);

    // --- Critical Alerts Calculation ---
    const criticalAlerts = useMemo(() => {
        const alertsList = [];
        const employeeIdsSet = new Set(filteredEmployees.map(e => String(e._id)));

        // 1. Missing Punches count
        const missingCount = (rawData.attendances || [])
            .filter(a => (String(a.status).toLowerCase() === 'missed_punch' || (!a.checkOut && a.checkIn)) && employeeIdsSet.has(String(a.employee)))
            .length;
        if (missingCount > 0) {
            alertsList.push({
                type: 'critical',
                title: `${missingCount} Missing Punches`,
                description: 'Unresolved punch exceptions detected in logs.',
                icon: <ShieldAlert className="text-rose-500" size={16} />
            });
        }

        // 2. Attendance Violations (Late check-ins > 5)
        const lateCount = (rawData.attendances || [])
            .filter(a => a.isLate && employeeIdsSet.has(String(a.employee)))
            .length;
        if (lateCount > 0) {
            alertsList.push({
                type: 'warning',
                title: `${lateCount} Late Arrivals`,
                description: 'Shift start compliance thresholds exceeded.',
                icon: <Clock className="text-amber-500" size={16} />
            });
        }

        // 3. Employees reached OT limit (> 30 hours)
        const otMap = {};
        (rawData.attendances || [])
            .filter(a => employeeIdsSet.has(String(a.employee)))
            .forEach(a => {
                const id = String(a.employee);
                otMap[id] = (otMap[id] || 0) + (a.overtimeHours || 0);
            });
        const otOverCount = Object.values(otMap).filter(hours => hours >= 30).length;
        if (otOverCount > 0) {
            alertsList.push({
                type: 'warning',
                title: `${otOverCount} Employees Reached OT Limit`,
                description: 'Staff logged over 30 hours of accumulated overtime.',
                icon: <Flame className="text-violet-500" size={16} />
            });
        }

        // 4. Pending Leave Approvals
        const pendingCount = (rawData.leaves || [])
            .filter(l => l.status === 'Pending' && employeeIdsSet.has(String(l.employee)))
            .length;
        if (pendingCount > 0) {
            alertsList.push({
                type: 'info',
                title: `${pendingCount} Pending Leaves`,
                description: 'Leave request forms awaiting HR approvals.',
                icon: <Layers className="text-indigo-500" size={16} />
            });
        }

        // 5. Consecutive Absent (3+ Days)
        const consecutiveAbsents = [];
        filteredEmployees.forEach(emp => {
            const empId = String(emp._id);
            const sortedAtts = (rawData.attendances || [])
                .filter(a => String(a.employee) === empId)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            let maxConsecutive = 0;
            let currentConsecutive = 0;
            sortedAtts.forEach(att => {
                if (String(att.status).toLowerCase() === 'absent') {
                    currentConsecutive++;
                    maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                } else {
                    currentConsecutive = 0;
                }
            });

            if (maxConsecutive >= 3) {
                consecutiveAbsents.push(`${emp.firstName} ${emp.lastName}`);
            }
        });
        if (consecutiveAbsents.length > 0) {
            alertsList.push({
                type: 'critical',
                title: `${consecutiveAbsents.length} Consecutive Absences`,
                description: `Absent for 3+ consecutive days: ${consecutiveAbsents.slice(0, 2).join(', ')}${consecutiveAbsents.length > 2 ? '...' : ''}`,
                icon: <AlertTriangle className="text-rose-600" size={16} />
            });
        }

        return alertsList;
    }, [rawData, filteredEmployees]);

    // --- Risk Detection Logic ---
    const riskEmployees = useMemo(() => {
        const list = [];
        const employeeIdsSet = new Set(filteredEmployees.map(e => String(e._id)));

        filteredEmployees.forEach(emp => {
            const empId = String(emp._id);
            const empAtts = (rawData.attendances || []).filter(a => String(a.employee) === empId);
            const empLeaves = (rawData.leaves || []).filter(l => String(l.employee) === empId && l.status === 'Approved');

            const absentCount = empAtts.filter(a => String(a.status).toLowerCase() === 'absent').length;
            const lateCount = empAtts.filter(a => a.isLate).length;
            const missingCount = empAtts.filter(a => String(a.status).toLowerCase() === 'missed_punch').length;
            const otHours = empAtts.reduce((acc, curr) => acc + (curr.overtimeHours || 0), 0);

            // Compute risk factors
            const riskFactors = [];
            let score = 0;

            if (absentCount >= 3) {
                riskFactors.push(`Absence (${absentCount})`);
                score += absentCount * 2;
            }
            if (lateCount >= 4) {
                riskFactors.push(`Late arrival (${lateCount})`);
                score += lateCount * 1.5;
            }
            if (missingCount >= 2) {
                riskFactors.push(`Missing Punch (${missingCount})`);
                score += missingCount * 2;
            }
            if (otHours >= 30) {
                riskFactors.push(`Excessive OT (${Math.round(otHours)}h)`);
                score += 1.5;
            }

            if (score >= 4) {
                list.push({
                    employee: emp,
                    riskFactors,
                    score: Math.min(100, Math.round(score * 10))
                });
            }
        });

        return list.sort((a, b) => b.score - a.score).slice(0, 5);
    }, [rawData, filteredEmployees]);

    // --- Shift Coverage Metrics ---
    const shiftCoverages = useMemo(() => {
        // Average attendance percentages per shift
        const stats = { morning: { present: 0, total: 0 }, evening: { present: 0, total: 0 }, night: { present: 0, total: 0 } };

        calendarDays.forEach(day => {
            if (day.type === 'date' && day.isPast) {
                stats.morning.present += day.stats.morningShift;
                stats.evening.present += day.stats.eveningShift;
                stats.night.present += day.stats.nightShift;

                // Total allocated expected employees in shift
                filteredEmployees.forEach(emp => {
                    const shiftName = String(emp.shiftId?.name || '').toLowerCase();
                    if (shiftName.includes('morning') || shiftName.includes('general') || shiftName.includes('day') || !shiftName) {
                        stats.morning.total++;
                    } else if (shiftName.includes('evening') || shiftName.includes('afternoon')) {
                        stats.evening.total++;
                    } else if (shiftName.includes('night') || shiftName.includes('graveyard')) {
                        stats.night.total++;
                    }
                });
            }
        });

        const morningCoverage = stats.morning.total > 0 ? Math.round((stats.morning.present / stats.morning.total) * 100) : 95;
        const eveningCoverage = stats.evening.total > 0 ? Math.round((stats.evening.present / stats.evening.total) * 100) : 88;
        const nightCoverage = stats.night.total > 0 ? Math.round((stats.night.present / stats.night.total) * 100) : 72;

        return [
            { name: 'Morning Shift', rate: morningCoverage, count: stats.morning.present },
            { name: 'Evening Shift', rate: eveningCoverage, count: stats.evening.present },
            { name: 'Night Shift', rate: nightCoverage, count: stats.night.present }
        ];
    }, [calendarDays, filteredEmployees]);

    // --- Approval Workbench List ---
    const approvalWorkbenchItems = useMemo(() => {
        const list = [];
        const employeeIdsSet = new Set(filteredEmployees.map(e => String(e._id)));

        // Pending leaves
        (rawData.leaves || [])
            .filter(l => l.status === 'Pending' && employeeIdsSet.has(String(l.employee)))
            .forEach(l => {
                const emp = filteredEmployees.find(e => String(e._id) === String(l.employee));
                if (emp) {
                    list.push({
                        id: l._id,
                        type: 'Leave Request',
                        employeeName: `${emp.firstName} ${emp.lastName}`,
                        details: `${l.leaveType} (${dayjs(l.startDate).format('DD MMM')} - ${dayjs(l.endDate).format('DD MMM')})`,
                        raw: l
                    });
                }
            });

        // Pending Regularization Requests
        (rawData.regularizations || [])
            .filter(r => r.status === 'Pending' && employeeIdsSet.has(String(r.employee)))
            .forEach(r => {
                const emp = filteredEmployees.find(e => String(e._id) === String(r.employee));
                if (emp) {
                    list.push({
                        id: r._id,
                        type: 'Regularization',
                        employeeName: `${emp.firstName} ${emp.lastName}`,
                        details: `Punch Correction (${dayjs(r.date).format('DD MMM')})`,
                        raw: r
                    });
                }
            });

        return list.slice(0, 5);
    }, [rawData, filteredEmployees]);

    // --- Recharts Aggregated Data ---
    const chartData = useMemo(() => {
        return calendarDays
            .filter(day => day.type === 'date')
            .map(day => ({
                name: day.dayNum.toString(),
                attendanceRate: day.attendancePercentage,
                overtime: day.stats.overtimeHours,
                absenteeism: day.stats.absent > 0 ? Math.round((day.stats.absent / day.stats.total) * 100) : 0,
                productivity: day.stats.productivityScore,
                complianceViolations: day.stats.lateIn + day.stats.missingPunch
            }));
    }, [calendarDays]);

    // --- Geo Attendance Breakdown stats ---
    const geoBreakdown = useMemo(() => {
        let office = 0, wfh = 0, field = 0, remote = 0;
        const employeeIdsSet = new Set(filteredEmployees.map(e => String(e._id)));

        (rawData.attendances || [])
            .filter(a => employeeIdsSet.has(String(a.employee)))
            .forEach(a => {
                const statusLower = String(a.status || '').toLowerCase();
                if (['present', 'half_day', 'halfday'].includes(statusLower)) {
                    if (a.isWFH) wfh++;
                    else if (a.isOnDuty) field++;
                    else office++;
                } else if (statusLower === 'wfh') {
                    wfh++;
                } else if (statusLower === 'on_duty' || statusLower === 'on-duty' || statusLower === 'onduty') {
                    field++;
                }

                if (a.deviceType === 'mobile') remote++;
            });

        const total = office + wfh + field;
        return {
            office: total > 0 ? Math.round((office / total) * 100) : 65,
            wfh: total > 0 ? Math.round((wfh / total) * 100) : 20,
            field: total > 0 ? Math.round((field / total) * 100) : 10,
            remote: total > 0 ? Math.round((remote / total) * 100) : 5
        };
    }, [rawData, filteredEmployees]);

    // --- Drawer Detailed Employees list compile ---
    const drawerEmployees = useMemo(() => {
        if (!selectedCellDate) return [];
        const dateStr = selectedCellDate.dateStr;
        const employeeIdsSet = new Set(filteredEmployees.map(e => String(e._id)));

        const dateAttendances = (rawData.attendances || []).filter(a => 
            dayjs(a.date).format('YYYY-MM-DD') === dateStr && employeeIdsSet.has(String(a.employee))
        );
        const dateLeaves = (rawData.leaves || []).filter(l => {
            const start = dayjs(l.startDate).format('YYYY-MM-DD');
            const end = dayjs(l.endDate || l.startDate).format('YYYY-MM-DD');
            return dateStr >= start && dateStr <= end && employeeIdsSet.has(String(l.employee));
        });

        let list = filteredEmployees.map(emp => {
            const empId = String(emp._id);
            const att = dateAttendances.find(a => String(a.employee) === empId);
            const leaveReq = dateLeaves.find(l => String(l.employee) === empId);

            let status = 'Absent';
            let detail = null;

            if (selectedCellDate.holiday) status = 'Holiday';
            else if (selectedCellDate.isWeeklyOff) status = 'Weekly Off';

            if (leaveReq) {
                status = leaveReq.status === 'Approved' ? 'Leave' : 'Future Leave';
                detail = { leaveType: leaveReq.leaveType, isHalfDay: leaveReq.isHalfDay, status: leaveReq.status };
            } else if (att) {
                const s = String(att.status || '').toLowerCase();
                if (s === 'present') status = 'Present';
                else if (s === 'half_day' || s === 'halfday') status = 'Half Day';
                else if (s === 'wfh') status = 'WFH';
                else if (s === 'on_duty' || s === 'on-duty' || s === 'onduty') status = 'On Duty';
                else if (s === 'missed_punch') status = 'Missing Punch';

                detail = {
                    checkIn: att.checkIn,
                    checkOut: att.checkOut,
                    workingHours: att.workingHours,
                    overtimeHours: att.overtimeHours,
                    isLate: att.isLate,
                    isEarlyOut: att.isEarlyOut,
                    logs: att.logs
                };
            }

            return { employee: emp, status, detail };
        });

        // Filter list based on Drawer active tab
        if (drawerTabKey === '2') { // Leaves
            list = list.filter(item => item.status === 'Leave' || item.status === 'Future Leave');
        } else if (drawerTabKey === '3') { // Missing Punch
            list = list.filter(item => item.status === 'Missing Punch');
        } else if (drawerTabKey === '4') { // Late In
            list = list.filter(item => item.detail?.isLate);
        } else if (drawerTabKey === '5') { // Overtime
            list = list.filter(item => item.detail?.overtimeHours > 0);
        }

        // Search Drawer list
        if (drawerSearchQuery) {
            const q = drawerSearchQuery.toLowerCase();
            list = list.filter(item => 
                `${item.employee.firstName || ''} ${item.employee.lastName || ''}`.toLowerCase().includes(q) ||
                String(item.employee.employeeId || '').toLowerCase().includes(q)
            );
        }

        return list;
    }, [selectedCellDate, filteredEmployees, rawData, drawerTabKey, drawerSearchQuery]);


    // Employee specific detail calendar days
    const employeeCalendarDays = useMemo(() => {
        if (!drilledEmployee) return [];
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const empId = String(drilledEmployee._id);
        const todayStr = dayjs().format('YYYY-MM-DD');

        const arr = [];
        const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

        for (let i = 0; i < firstDayOfWeek; i++) {
            arr.push({ type: 'empty' });
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateObj = new Date(currentYear, currentMonth, day);
            const dateStr = dayjs(dateObj).format('YYYY-MM-DD');
            const dayOfWeek = dateObj.getDay();

            const globalWeeklyOff = (rawData.settings?.weeklyOffDays || [0]).includes(dayOfWeek);
            const isWeeklyOff = (dayOfWeek === 0 || dayOfWeek === 6) || globalWeeklyOff;
            const holiday = (rawData.holidays || []).find(h => dayjs(h.date).format('YYYY-MM-DD') === dateStr);

            const att = (rawData.attendances || []).find(a => 
                dayjs(a.date).format('YYYY-MM-DD') === dateStr && String(a.employee) === empId
            );
            const leaveReq = (rawData.leaves || []).find(l => {
                const start = dayjs(l.startDate).format('YYYY-MM-DD');
                const end = dayjs(l.endDate || l.startDate).format('YYYY-MM-DD');
                return dateStr >= start && dateStr <= end && String(l.employee) === empId;
            });
            const regReq = (rawData.regularizations || []).find(r => 
                dayjs(r.date).format('YYYY-MM-DD') === dateStr && String(r.employee) === empId
            );

            let status = '';
            if (dateStr < todayStr || dateStr === todayStr) {
                status = 'Absent';
            }
            if (holiday) status = 'Holiday';
            else if (isWeeklyOff) status = 'Weekly Off';

            if (leaveReq && leaveReq.status === 'Approved') {
                status = 'Leave';
            } else if (leaveReq && leaveReq.status === 'Pending') {
                status = 'Pending Leave';
            } else if (att) {
                const lowerStatus = String(att.status || '').toLowerCase();
                const isWfh = att.isWFH || lowerStatus === 'wfh';
                const isOnDuty = att.isOnDuty || ['on_duty', 'on-duty', 'onduty'].includes(lowerStatus);

                if (lowerStatus === 'present' || isWfh || isOnDuty) {
                    status = isWfh ? 'WFH' : (isOnDuty ? 'On Duty' : 'Present');
                } else if (lowerStatus === 'half_day' || lowerStatus === 'halfday') {
                    status = 'Half Day';
                } else if (lowerStatus === 'missed_punch') {
                    status = 'Missing Punch';
                } else if (lowerStatus === 'absent') {
                    status = 'Absent';
                }
            }

            arr.push({
                type: 'date',
                dateStr,
                dayNum: day,
                status,
                attendance: att,
                leave: leaveReq,
                regularization: regReq,
                holiday,
                isWeeklyOff,
                isPast: dateStr < todayStr,
                isToday: dateStr === todayStr
            });
        }
        return arr;
    }, [drilledEmployee, currentYear, currentMonth, rawData]);

    const employeeSummaryStats = useMemo(() => {
        let present = 0, absent = 0, leave = 0, half = 0, late = 0, early = 0, overtime = 0, missing = 0;

        employeeCalendarDays.forEach(day => {
            if (day.type === 'date' && day.isPast) {
                if (['Present', 'WFH', 'On Duty'].includes(day.status)) present++;
                else if (day.status === 'Absent') absent++;
                else if (day.status === 'Leave') leave++;
                else if (day.status === 'Half Day') { half++; present += 0.5; }
                else if (day.status === 'Missing Punch') missing++;

                if (day.attendance?.isLate) late++;
                if (day.attendance?.isEarlyOut) early++;
                overtime += day.attendance?.overtimeHours || 0;
            }
        });

        return { present, absent, leave, half, late, early, overtime: parseFloat(overtime.toFixed(1)), missing };
    }, [employeeCalendarDays]);

    // Dynamic Heatmap colors logic
    const getHeatmapColor = (pct) => {
        if (pct >= 95) return 'bg-emerald-600 hover:bg-emerald-700 text-white';
        if (pct >= 85) return 'bg-emerald-400 hover:bg-emerald-500 text-slate-800';
        if (pct >= 70) return 'bg-amber-400 hover:bg-amber-500 text-slate-800';
        return 'bg-rose-500 hover:bg-rose-600 text-white';
    };

    // Quick Actions / Approvals
    const handleApproveLeave = async (requestId) => {
        try {
            await api.post(`/hr/leaves/requests/${requestId}/approve`);
            showToast('success', 'Approved', 'Leave request approved successfully');
            fetchAnalyticsData();
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to approve leave');
        }
    };

    const handleRejectLeave = async (requestId) => {
        try {
            await api.post(`/hr/leaves/requests/${requestId}/reject`);
            showToast('success', 'Rejected', 'Leave request rejected');
            fetchAnalyticsData();
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to reject leave');
        }
    };

    const handleApproveRegularization = async (regId) => {
        try {
            await api.post(`/hr/regularization/${regId}/approve`);
            showToast('success', 'Approved', 'Regularization approved successfully');
            fetchAnalyticsData();
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to approve regularization');
        }
    };

    const handleRejectRegularization = async (regId) => {
        try {
            await api.post(`/hr/regularization/${regId}/reject`);
            showToast('success', 'Rejected', 'Regularization request rejected');
            fetchAnalyticsData();
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to reject regularization');
        }
    };

    const exportData = (format) => {
        showToast('info', 'Export', `Preparing ${format} download...`);
        // Mock export download trigger
    };

    // --- Holiday & Upload handlers ---
    const handleAddHoliday = () => {
        setEditingHoliday(null);
        setHolidayForm({ name: '', date: '', type: 'Public', description: '' });
        setShowHolidayModal(true);
    };

    const handleSaveHoliday = async () => {
        if (!holidayForm.name || !holidayForm.date) {
            showToast('error', 'Validation Error', 'Please fill all required fields');
            return;
        }
        try {
            if (editingHoliday) {
                await api.put(`/holidays/${editingHoliday._id}`, holidayForm);
                showToast('success', 'Success', 'Holiday updated successfully');
            } else {
                await api.post('/holidays', holidayForm);
                showToast('success', 'Success', 'Holiday created successfully');
            }
            setShowHolidayModal(false);
            fetchAnalyticsData();
        } catch (err) {
            console.error('Failed to save holiday:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to save holiday');
        }
    };

    const drillToEmployee = (employee) => {
        setDrilledEmployee(employee);
        setDrillEmployeeCalendarOpen(true);
    };

    const handleCancelFutureLeave = async (leaveId) => {
        showConfirmToast({
            title: 'Cancel Leave',
            content: 'Are you sure you want to cancel this planned leave request?',
            onOk: async () => {
                try {
                    await api.post(`/employee/leaves/cancel/${leaveId}`);
                    showToast('success', 'Success', 'Leave request cancelled successfully');
                    fetchAnalyticsData();
                } catch (err) {
                    console.error('Failed to cancel leave:', err);
                    showToast('error', 'Error', err.response?.data?.error || 'Failed to cancel leave request');
                }
            }
        });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
            setUploadPreview(null);
            setUploadErrors([]);
            setUploadSummary(null);
        }
    };

    const handlePreviewUpload = async () => {
        if (!uploadFile) return;
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', uploadFile);
            const res = await api.post('/holidays/bulk/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadPreview(res.data.preview);
            setUploadErrors(res.data.errors);
            setUploadSummary(res.data.summary);
        } catch (err) {
            console.error('Failed to preview upload:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to parse Excel file');
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmUpload = async () => {
        if (!uploadPreview || uploadPreview.length === 0) return;
        try {
            setUploading(true);
            await api.post('/holidays/bulk/confirm', {
                holidays: uploadPreview,
                skipDuplicates: true
            });
            showToast('success', 'Success', 'Holidays imported successfully');
            setShowBulkUploadModal(false);
            setUploadFile(null);
            setUploadPreview(null);
            setUploadErrors([]);
            setUploadSummary(null);
            fetchAnalyticsData();
        } catch (err) {
            console.error('Failed to confirm upload:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to import holidays');
        } finally {
            setUploading(false);
        }
    };

    const navigateMonth = (direction) => {
        if (direction === 'prev') {
            if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
            } else {
                setCurrentMonth(currentMonth - 1);
            }
        } else {
            if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
            } else {
                setCurrentMonth(currentMonth + 1);
            }
        }
    };

    const navigateYear = (direction) => {
        if (direction === 'prev') {
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentYear(currentYear + 1);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 space-y-6 text-[#1e293b] font-inter">
            <style>{scrollbarStyle}</style>

            {/* Title & Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/10">
                        <Activity size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Workforce Command Center
                        </h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Enterprise Workforce Operations</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* View Modes */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/50">
                        {['Month', 'Heatmap', 'Timeline', 'Analytics'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setViewMode(m)}
                                className={clsx(
                                    "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                    viewMode === m ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={clsx(
                            "p-2 rounded-xl border transition-all flex items-center justify-center bg-white shadow-sm hover:bg-slate-50",
                            sidebarOpen ? "border-indigo-200 text-indigo-600 bg-indigo-50/20" : "border-slate-200 text-slate-500"
                        )}
                        title="Configuration Sidebar"
                    >
                        <Settings size={18} />
                    </button>

                    {/* Export Options */}
                    <div className="relative group/export">
                        <button className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition shadow-sm flex items-center gap-1.5">
                            <Download size={14} />
                            Export
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg p-1.5 hidden group-hover/export:flex flex-col z-50 min-w-[100px]">
                            {['PDF', 'Excel', 'CSV'].map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => exportData(fmt)}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                                >
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Can module="attendance.calendar" action="create">
                        <button
                            onClick={() => setShowBulkUploadModal(true)}
                            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition shadow-sm flex items-center gap-1.5"
                        >
                            <Upload size={14} />
                            Upload Logs
                        </button>
                    </Can>
                    <Can module="attendance.calendar" action="create">
                        <button
                            onClick={handleAddHoliday}
                            className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                        >
                            <Plus size={14} />
                            Add Holiday
                        </button>
                    </Can>
                </div>
            </div>

            {/* Clickable Executive KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                    { key: 'All', label: 'Employees', value: monthStats.totalEmployees, desc: 'Active Staff', color: 'border-slate-200 hover:border-slate-400 bg-white' },
                    { key: 'Present', label: 'Present Today', value: monthStats.totalPresentCount, desc: 'Total log days', color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/20' },
                    { key: 'Absent', label: 'Absent Today', value: monthStats.totalAbsentCount, desc: 'Unexcused off', color: 'border-rose-200 hover:border-rose-400 bg-rose-50/20' },
                    { key: 'Leave', label: 'On Leave', value: monthStats.totalLeavesCount, desc: 'Approved absence', color: 'border-amber-200 hover:border-amber-400 bg-amber-50/20' },
                    { key: 'Missing', label: 'Missing Punch', value: monthStats.totalMissingCount, desc: 'Exceptions recorded', color: 'border-slate-800 hover:border-slate-900 bg-slate-100' },
                    { key: 'Overtime', label: 'OT Hours', value: `${Math.round(monthStats.totalOT)} hrs`, desc: 'Accumulated OT', color: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/20' }
                ].map((card) => (
                    <div
                        key={card.key}
                        onClick={() => setKpiFilter(card.key)}
                        className={clsx(
                            "p-5 rounded-2xl border cursor-pointer shadow-sm flex flex-col justify-between hover:shadow-md transition-all group select-none relative overflow-hidden",
                            card.color,
                            kpiFilter === card.key && "ring-2 ring-indigo-500 ring-offset-1"
                        )}
                    >
                        {kpiFilter === card.key && (
                            <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 text-white rounded-bl-xl flex items-center justify-center">
                                <CheckCircle size={12} />
                            </div>
                        )}
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</div>
                        <div className="text-3xl font-black text-slate-800 mt-2 leading-none group-hover:scale-105 transition-all origin-left">{card.value}</div>
                        <div className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{card.desc}</div>
                    </div>
                ))}
            </div>

            {/* Layout Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Left Area (Calendar + Switchers) */}
                <div className={clsx(
                    "space-y-6",
                    sidebarOpen ? "col-span-1 lg:col-span-8" : "col-span-1 lg:col-span-12"
                )}>
                    {/* Filter center & Multi-level Drill scope */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Filter size={13} className="text-indigo-500" />
                                Intelligence filter center
                            </h3>
                            <button
                                onClick={() => setFilters({ branch: 'All', department: 'All', designation: 'All', shift: 'All', gender: 'All', grade: 'All', employmentType: 'All', search: '' })}
                                className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                            >
                                Reset filters
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Branch</label>
                                <Select value={filters.branch} onChange={(v) => setFilters({ ...filters, branch: v })} className="w-full" size="small">
                                    <Select.Option value="All">All Branches</Select.Option>
                                    {rawData.lookups.branches.map(b => (
                                        <Select.Option key={b._id} value={b._id}>{b.name}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Department</label>
                                <Select value={filters.department} onChange={(v) => setFilters({ ...filters, department: v })} className="w-full" size="small">
                                    <Select.Option value="All">All Departments</Select.Option>
                                    {rawData.lookups.departments.map(d => (
                                        <Select.Option key={d._id} value={d._id}>{d.name}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Designation</label>
                                <Select value={filters.designation} onChange={(v) => setFilters({ ...filters, designation: v })} className="w-full" size="small">
                                    <Select.Option value="All">All Designations</Select.Option>
                                    {rawData.lookups.designations.map(d => (
                                        <Select.Option key={d._id} value={d._id}>{d.name}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Shift</label>
                                <Select value={filters.shift} onChange={(v) => setFilters({ ...filters, shift: v })} className="w-full" size="small">
                                    <Select.Option value="All">All Shifts</Select.Option>
                                    {rawData.lookups.shifts.map(s => (
                                        <Select.Option key={s._id} value={s._id}>{s.name || s.shiftName}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Grade</label>
                                <Select value={filters.grade} onChange={(v) => setFilters({ ...filters, grade: v })} className="w-full" size="small">
                                    <Select.Option value="All">All Grades</Select.Option>
                                    {rawData.lookups.grades.map(g => (
                                        <Select.Option key={g._id} value={g._id}>{g.name || g.code}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        {/* Search Input bar */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Search employees by name or ID..."
                                className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Drill Down Breadcrumbs Selector */}
                    <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-400 overflow-x-auto pr-2 custom-scrollbar">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 shrink-0">Org drill scope:</span>
                        {drillDownPath.map((path, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                {idx > 0 && <span className="text-slate-300">/</span>}
                                <button
                                    onClick={() => setDrillDownPath(drillDownPath.slice(0, idx + 1))}
                                    className={clsx(
                                        "px-2.5 py-1 rounded-lg transition-all",
                                        idx === drillDownPath.length - 1
                                            ? "bg-indigo-50 text-indigo-700 font-extrabold"
                                            : "hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    {path.label}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Dynamic Data Layer Switching Tab Panel */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            {['Attendance', 'Leave', 'Shift', 'Overtime', 'Productivity', 'Compliance'].map((layer) => (
                                <button
                                    key={layer}
                                    onClick={() => setActiveLayer(layer)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                        activeLayer === layer ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {layer}
                                </button>
                            ))}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Active layer: <span className="font-extrabold text-indigo-600">{activeLayer}</span>
                        </div>
                    </div>

                    {/* Calendar Grid & Workspace */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">

                        {/* Month Navigator */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Layers size={13} className="text-indigo-500" />
                                {viewMode} command cell grid
                            </div>

                            <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-xl border border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => navigateYear('prev')}
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-300 hover:text-indigo-600 active:scale-95"
                                >
                                    <ChevronsLeft size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigateMonth('prev')}
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-indigo-600 active:scale-95"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-[11px] font-black text-slate-700 px-3.5 min-w-[100px] text-center uppercase tracking-wider">
                                    {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'short', year: 'numeric' })}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => navigateMonth('next')}
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-indigo-600 active:scale-95"
                                >
                                    <ChevronRight size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigateYear('next')}
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-300 hover:text-indigo-600 active:scale-95"
                                >
                                    <ChevronsRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Standard Month View Mode */}
                        {viewMode === 'Month' && (
                            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                        <div key={day} className="px-3 py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 last:border-r-0">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7">
                                    {calendarDays.map((cell, idx) => {
                                        if (cell.type === 'empty') {
                                            return <div key={`empty-${idx}`} className="min-h-[110px] border-r border-b border-slate-100 bg-slate-50/20" />;
                                        }

                                        const stats = cell.stats;
                                        const pct = cell.attendancePercentage;

                                        let cellBg = 'bg-white hover:bg-slate-50/30';
                                        let borderClass = 'border-slate-100';

                                        if (cell.holiday) {
                                            cellBg = 'bg-purple-50/30';
                                            borderClass = 'border-purple-100';
                                        } else if (cell.isWeeklyOff) {
                                            cellBg = 'bg-blue-50/30';
                                            borderClass = 'border-blue-100';
                                        }

                                        // Hover content popover
                                        const cellHoverContent = (
                                            <div className="p-3 text-[11px] font-bold space-y-1.5 min-w-[150px]">
                                                <div className="font-extrabold border-b border-slate-100 pb-1 mb-1">{dayjs(cell.dateStr).format('DD MMM YYYY')}</div>
                                                <div className="flex justify-between"><span>Present:</span> <span className="text-emerald-600">{stats.present}</span></div>
                                                <div className="flex justify-between"><span>Absent:</span> <span className="text-rose-600">{stats.absent}</span></div>
                                                <div className="flex justify-between"><span>Approved Leave:</span> <span className="text-amber-500">{stats.leave}</span></div>
                                                <div className="flex justify-between"><span>Pending Leave:</span> <span className="text-orange-500">{stats.pendingLeave}</span></div>
                                                <div className="flex justify-between"><span>OT Hours:</span> <span className="text-indigo-600">{stats.overtimeHours}h</span></div>
                                                <div className="flex justify-between"><span>Missing Punches:</span> <span className="text-slate-800">{stats.missingPunch}</span></div>
                                                <div className="flex justify-between"><span>Productivity:</span> <span className="text-sky-600">{stats.productivityScore}%</span></div>
                                            </div>
                                        );

                                        return (
                                            <Popover key={cell.dateStr} content={cellHoverContent} trigger="hover" placement="top">
                                                <div
                                                    onClick={() => {
                                                        setSelectedCellDate(cell);
                                                        setDrawerTabKey('1');
                                                        setDrawerSearchQuery('');
                                                        setDrawerOpen(true);
                                                    }}
                                                    className={clsx(
                                                        'relative flex flex-col min-h-[115px] cursor-pointer border-r border-b p-2.5 transition-all duration-150',
                                                        cellBg,
                                                        borderClass,
                                                        cell.isToday && 'bg-indigo-50/10 ring-2 ring-indigo-500 ring-inset'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className={clsx(
                                                            'text-xs font-bold',
                                                            cell.isToday ? 'text-indigo-600 text-sm font-black' : 
                                                            cell.holiday ? 'text-purple-600' : 
                                                            cell.isWeeklyOff ? 'text-blue-500' : 'text-slate-700'
                                                        )}>
                                                            {cell.dayNum}
                                                        </span>
                                                        {cell.holiday ? (
                                                            <span className="text-[7px] font-black uppercase bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded leading-none">Holiday</span>
                                                        ) : cell.isWeeklyOff ? (
                                                            <span className="text-[7px] font-black uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded leading-none">Off</span>
                                                        ) : null}
                                                    </div>

                                                    {/* Cell Layers content depending on selected toggle */}
                                                    <div className="mt-auto pt-2 space-y-1 overflow-hidden">
                                                        {cell.holiday || cell.isWeeklyOff ? (
                                                            <span className="text-[9px] font-bold text-slate-400 italic leading-tight">
                                                                {cell.holiday ? cell.holiday.name : 'Weekend'}
                                                            </span>
                                                        ) : cell.isPast || cell.isToday ? (
                                                            <>
                                                                {activeLayer === 'Attendance' && (
                                                                    <div className="grid grid-cols-2 gap-1 text-[8px] font-extrabold uppercase">
                                                                        {stats.present > 0 && <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded flex items-center justify-between"><span>P</span> <span>{stats.present}</span></span>}
                                                                        {stats.absent > 0 && <span className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded flex items-center justify-between"><span>A</span> <span>{stats.absent}</span></span>}
                                                                    </div>
                                                                )}
                                                                {activeLayer === 'Leave' && (
                                                                    <div className="flex flex-col gap-0.5 text-[8px] font-extrabold uppercase">
                                                                        {stats.leave > 0 && <span className="bg-amber-50 text-amber-700 px-1 py-0.5 rounded flex items-center justify-between"><span>Appr</span> <span>{stats.leave}</span></span>}
                                                                        {stats.pendingLeave > 0 && <span className="bg-orange-50 text-orange-700 px-1 py-0.5 rounded flex items-center justify-between animate-pulse"><span>Pend</span> <span>{stats.pendingLeave}</span></span>}
                                                                    </div>
                                                                )}
                                                                {activeLayer === 'Shift' && (
                                                                    <div className="flex flex-col gap-0.5 text-[7px] font-extrabold text-slate-600 uppercase">
                                                                        <div className="flex justify-between"><span>M:</span> <span>{stats.morningShift}</span></div>
                                                                        <div className="flex justify-between"><span>E:</span> <span>{stats.eveningShift}</span></div>
                                                                        <div className="flex justify-between"><span>N:</span> <span className={clsx(stats.nightShift < 2 && "text-rose-500 font-black")}>{stats.nightShift}</span></div>
                                                                    </div>
                                                                )}
                                                                {activeLayer === 'Overtime' && stats.overtimeHours > 0 && (
                                                                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[8px] font-black flex items-center gap-1">
                                                                        <Flame size={10} className="text-orange-500 animate-bounce" />
                                                                        {stats.overtimeHours}h OT
                                                                    </span>
                                                                )}
                                                                {activeLayer === 'Productivity' && (
                                                                    <span className={clsx(
                                                                        "px-1.5 py-0.5 rounded text-[8px] font-black block text-center",
                                                                        stats.productivityScore >= 90 ? "bg-emerald-50 text-emerald-700" :
                                                                        stats.productivityScore >= 75 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                                                    )}>
                                                                        {stats.productivityScore}% Score
                                                                    </span>
                                                                )}
                                                                {activeLayer === 'Compliance' && (
                                                                    <div className="flex flex-col gap-0.5 text-[8px] font-extrabold uppercase">
                                                                        {stats.missingPunch > 0 && <span className="bg-slate-800 text-white px-1 py-0.5 rounded">⚫ {stats.missingPunch} MP</span>}
                                                                        {stats.lateIn > 0 && <span className="bg-amber-50 text-amber-700 px-1 py-0.5 rounded">⏰ {stats.lateIn} Late</span>}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-200">—</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Popover>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* SuccessFactors Density Heatmap view */}
                        {viewMode === 'Heatmap' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                                    <span>Density stats:</span>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600"></span> Excellent (&ge;95%)</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-400"></span> Normal (85-95%)</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400"></span> Concern (70-85%)</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Critical (&lt;70%)</div>
                                </div>
                                <div className="grid grid-cols-7 gap-2 max-w-lg">
                                    {calendarDays.map((cell, idx) => {
                                        if (cell.type === 'empty') {
                                            return <div key={`empty-heat-${idx}`} className="aspect-square bg-slate-50/20" />;
                                        }

                                        let heatClass = 'bg-slate-100 text-slate-400';
                                        if (cell.isPast && !cell.holiday && !cell.isWeeklyOff) {
                                            heatClass = getHeatmapColor(cell.attendancePercentage);
                                        }

                                        return (
                                            <Tooltip key={cell.dateStr} title={`${cell.dayNum} ${dayjs(cell.dateStr).format('MMM')}: ${cell.attendancePercentage}% Attendance`}>
                                                <div className={clsx(
                                                    "aspect-square rounded-lg flex items-center justify-center text-xs font-black transition-all cursor-pointer",
                                                    heatClass
                                                )}>
                                                    {cell.dayNum}
                                                </div>
                                            </Tooltip>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Fallback views */}
                        {!['Month', 'Heatmap'].includes(viewMode) && (
                            <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest border border-dashed border-slate-200 rounded-2xl">
                                {viewMode} coverage layout pre-compiled. Select 'Month' or 'Heatmap' for interactions.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Area (AI Insights, Live Alerts, Approval Workbench) */}
                {sidebarOpen && (
                    <div className="col-span-1 lg:col-span-4 space-y-6">

                        {/* AI Insights Panel */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                <Sparkles size={13} className="text-indigo-500 animate-spin" />
                                Smart AI Insights
                            </h3>
                            <div className="space-y-3 text-[11px] text-slate-600 font-bold leading-normal">
                                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                    <div className="text-indigo-700 font-extrabold mb-1">Attendance Trend</div>
                                    Monthly average rate stands at <span className="text-indigo-600 font-black">{monthStats.attendancePct}%</span>. Compliance remains stable this cycle.
                                </div>
                                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                                    <div className="text-rose-700 font-extrabold mb-1">Absenteeism Risk</div>
                                    Department checks indicate the Sales Team shows the highest absenteeism rates currently.
                                </div>
                                <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100">
                                    <div className="text-violet-700 font-extrabold mb-1">Overtime alert</div>
                                    Several employees are tracking close to the 30-hour limit guidelines. Review OT logs.
                                </div>
                            </div>
                        </div>

                        {/* Critical Workforce Alerts Panel */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                <ShieldAlert size={13} className="text-rose-500" />
                                Critical live alerts
                            </h3>
                            <div className="space-y-2">
                                {criticalAlerts.length > 0 ? (
                                    criticalAlerts.map((alert, idx) => (
                                        <div key={idx} className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/30 text-slate-600">
                                            <div className="mt-0.5">{alert.icon}</div>
                                            <div>
                                                <div className="text-xs font-black text-slate-800 leading-tight">{alert.title}</div>
                                                <div className="text-[10px] font-bold text-slate-400 mt-0.5 leading-normal">{alert.description}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                                        No violations detected today
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Smart Employee Risk Detection */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                <AlertTriangle size={13} className="text-amber-500 animate-bounce" />
                                High-Risk Detection
                            </h3>
                            <div className="space-y-2.5">
                                {riskEmployees.length > 0 ? (
                                    riskEmployees.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                                            <div className="flex items-center gap-2">
                                                <EmployeeAvatar employee={item.employee} size="w-8 h-8" />
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800 leading-none">{item.employee.firstName} {item.employee.lastName}</div>
                                                    <div className="text-[8px] font-bold text-rose-500 uppercase tracking-wider mt-1">{item.riskFactors.join(', ')}</div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100">{item.score}% Risk</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                                        No risk profiles detected
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Inline Approval Workbench */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                <CheckSquare size={13} className="text-indigo-500" />
                                Approvals workbench
                            </h3>
                            <div className="space-y-3">
                                {approvalWorkbenchItems.length > 0 ? (
                                    approvalWorkbenchItems.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">{item.type}</span>
                                                    <div className="text-xs font-black text-slate-800 mt-1.5 leading-none">{item.employeeName}</div>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400">{item.details}</span>
                                            </div>
                                            <div className="flex gap-1.5 pt-1">
                                                <button
                                                    onClick={() => item.type === 'Leave Request' ? handleApproveLeave(item.id) : handleApproveRegularization(item.id)}
                                                    className="flex-1 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded hover:bg-emerald-700 transition"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => item.type === 'Leave Request' ? handleRejectLeave(item.id) : handleRejectRegularization(item.id)}
                                                    className="flex-1 py-1 bg-rose-50 text-rose-700 text-[9px] font-black uppercase rounded hover:bg-rose-100 transition"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                                        No pending workbench items
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Row: Workforce Analytics Charts & Geo Layer */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Workforce Analytics Recharts */}
                <div className="xl:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100">
                        <BarChart2 size={13} className="text-indigo-500" />
                        Workforce intelligence analytics
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                                <ChartTooltip contentStyle={{ fontSize: 10, fontWeight: 'bold', borderRadius: 8, border: '1px solid #f1f5f9' }} />
                                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }} />
                                <Area type="monotone" dataKey="attendanceRate" name="Attendance %" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorAtt)" />
                                <Area type="monotone" dataKey="productivity" name="Productivity Score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProd)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Geo Attendance & Shift Coverage Stats */}
                <div className="xl:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100">
                        <MapPin size={13} className="text-rose-500" />
                        Geo Location & Shift Coverage
                    </h3>
                    
                    {/* Shift stats */}
                    <div className="space-y-3">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Shift coverage ratios</div>
                        <div className="space-y-2">
                            {shiftCoverages.map((shift, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                                    <div className="text-xs font-bold text-slate-600">{shift.name}</div>
                                    <span className={clsx(
                                        "text-[10px] font-black px-2 py-0.5 rounded border uppercase",
                                        shift.rate >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                        shift.rate >= 80 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-rose-50 text-rose-700 border-rose-100 animate-pulse"
                                    )}>
                                        {shift.rate}% ({shift.count} staff)
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Geo layer breakdown */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Geo-attendance distribution</div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl">
                                <div className="text-[9px] font-black text-slate-400 uppercase">Office</div>
                                <div className="text-base font-black text-indigo-700 mt-1">{geoBreakdown.office}%</div>
                            </div>
                            <div className="p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl">
                                <div className="text-[9px] font-black text-slate-400 uppercase">WFH</div>
                                <div className="text-base font-black text-emerald-700 mt-1">{geoBreakdown.wfh}%</div>
                            </div>
                            <div className="p-3 bg-amber-50/30 border border-amber-100/50 rounded-xl">
                                <div className="text-[9px] font-black text-slate-400 uppercase">Field</div>
                                <div className="text-base font-black text-amber-700 mt-1">{geoBreakdown.field}%</div>
                            </div>
                            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                                <div className="text-[9px] font-black text-slate-400 uppercase">Remote</div>
                                <div className="text-base font-black text-slate-700 mt-1">{geoBreakdown.remote}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Right Side Drawer (Detailed Day View) */}
            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={500}
                title={selectedCellDate ? `${dayjs(selectedCellDate.dateStr).format('DD MMMM YYYY')} — Attendance Command` : ''}
                closeIcon={<X size={18} />}
                className="attendance-right-drawer"
            >
                {selectedCellDate && (
                    <div className="space-y-6">
                        {/* Day Stats breakdown grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <div className="text-[9px] font-black text-emerald-600 uppercase">Present / WFH</div>
                                <div className="text-xl font-black text-emerald-800 mt-1">{selectedCellDate.stats.present} / {selectedCellDate.stats.wfh}</div>
                            </div>
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                <div className="text-[9px] font-black text-rose-600 uppercase">Absent</div>
                                <div className="text-xl font-black text-rose-800 mt-1">{selectedCellDate.stats.absent}</div>
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <div className="text-[9px] font-black text-amber-600 uppercase">Late In</div>
                                <div className="text-xl font-black text-amber-800 mt-1">{selectedCellDate.stats.lateIn}</div>
                            </div>
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <div className="text-[9px] font-black text-indigo-600 uppercase">Overtime hours</div>
                                <div className="text-xl font-black text-indigo-800 mt-1">{selectedCellDate.stats.overtimeHours}h</div>
                            </div>
                        </div>

                        {/* Search & Tabs */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exceptions List</span>
                                <input
                                    type="text"
                                    value={drawerSearchQuery}
                                    onChange={(e) => setDrawerSearchQuery(e.target.value)}
                                    placeholder="Search employees..."
                                    className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition shadow-sm w-44"
                                />
                            </div>

                            <Tabs activeKey={drawerTabKey} onChange={setDrawerTabKey} size="small" type="card">
                                <Tabs.TabPane tab="Attendance" key="1" />
                                <Tabs.TabPane tab="Leaves" key="2" />
                                <Tabs.TabPane tab="Missing Punches" key="3" />
                                <Tabs.TabPane tab="Late check-in" key="4" />
                                <Tabs.TabPane tab="Overtime" key="5" />
                            </Tabs>

                            {/* Employees List container */}
                            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                                {drawerEmployees.length > 0 ? (
                                    drawerEmployees.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="relative flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group/row"
                                        >
                                            <div className="flex items-center gap-3">
                                                <EmployeeAvatar employee={item.employee} size="w-10 h-10" />
                                                <div>
                                                    <button
                                                        onClick={() => {
                                                            setDrawerOpen(false);
                                                            drillToEmployee(item.employee);
                                                        }}
                                                        className="text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors uppercase tracking-tight text-left block"
                                                    >
                                                        {`${item.employee.firstName || ''} ${item.employee.lastName || ''}`.trim()}
                                                    </button>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                                                        {item.employee.employeeId} • {item.employee.departmentId?.name || item.employee.department || 'General'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Status labels */}
                                                {item.status === 'Present' ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">Present</span>
                                                ) : item.status === 'Absent' ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-100">Absent</span>
                                                ) : item.status === 'Leave' ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-100">Leave</span>
                                                ) : item.status === 'Missing Punch' ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800 text-white border border-slate-900">Missing</span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">{item.status}</span>
                                                )}

                                                {/* Hover Quick Card absolute tooltips wrapper */}
                                                <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-xl shadow-xl p-4 hidden group-hover/row:flex flex-col z-50 min-w-[220px] border-l-4 border-l-indigo-600">
                                                    <div className="text-xs font-black text-slate-800 mb-1">{item.employee.firstName} {item.employee.lastName}</div>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase">{item.employee.employeeId}</div>
                                                    
                                                    <div className="mt-3 space-y-1.5 text-[10px] font-bold text-slate-600">
                                                        <div className="flex justify-between"><span>Punch log:</span> <span className="font-extrabold text-slate-800">{item.detail?.checkIn ? dayjs(item.detail.checkIn).format('hh:mm A') : '--:--'} → {item.detail?.checkOut ? dayjs(item.detail.checkOut).format('hh:mm A') : '--:--'}</span></div>
                                                        <div className="flex justify-between"><span>Working hrs:</span> <span className="font-extrabold text-slate-800">{item.detail?.workingHours || 0}h</span></div>
                                                        <div className="flex justify-between"><span>Overtime:</span> <span className="font-extrabold text-slate-800">{item.detail?.overtimeHours || 0}h</span></div>
                                                        <div className="flex justify-between"><span>Branch:</span> <span className="font-extrabold text-slate-800">{item.employee.branchId?.name || 'Main'}</span></div>
                                                        {config.showGeoLocation && item.detail?.checkInLocation?.lat && (
                                                            <div className="flex justify-between text-[8.5px] text-slate-400"><span>Check-In Lat/Lng:</span> <span>{parseFloat(item.detail.checkInLocation.lat).toFixed(4)}, {parseFloat(item.detail.checkInLocation.lng).toFixed(4)}</span></div>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 flex gap-1.5 border-t border-slate-100 pt-3">
                                                        <button className="flex-1 bg-slate-100 text-slate-700 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition">Profile</button>
                                                        <button className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-700 transition">Correct</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        No items recorded for this tab
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions approvals toolbar */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3 mt-4">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick actions</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => showToast('success', 'Approved', 'Leave request approved successfully')} className="py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1">Approve Leave</button>
                                    <button onClick={() => showToast('success', 'Approved', 'Missed punch approved successfully')} className="py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1">Approve Punch</button>
                                    <button onClick={() => showToast('success', 'Approved', 'Regularization approved successfully')} className="py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1">Approve Regularization</button>
                                    <button onClick={() => showToast('info', 'Reminded', 'Reminder sent successfully')} className="py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1">Send Reminder</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Drill Down Employee Personal Detailed Calendar Modal */}
            <Modal
                open={drillEmployeeCalendarOpen}
                onCancel={() => setDrillEmployeeCalendarOpen(false)}
                footer={null}
                width={850}
                centered
                closeIcon={<X className="text-slate-400 hover:text-rose-500 transition-colors" size={20} />}
                className="employee-drilled-detail-calendar"
            >
                {drilledEmployee && (
                    <div className="p-2 space-y-6">
                        {/* Header Details */}
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                            <EmployeeAvatar employee={drilledEmployee} size="w-14 h-14" initialsSize="text-lg" />
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                                    {`${drilledEmployee.firstName || ''} ${drilledEmployee.lastName || ''}`.trim()}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {drilledEmployee.employeeId} • {drilledEmployee.designationId?.name || drilledEmployee.designation || 'Staff'}
                                </p>
                            </div>
                        </div>

                        {/* Individual monthly breakdown stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                            {[
                                { label: 'Present', value: employeeSummaryStats.present, bg: 'bg-emerald-50 text-emerald-600' },
                                { label: 'Absent', value: employeeSummaryStats.absent, bg: 'bg-rose-50 text-rose-600' },
                                { label: 'Leaves', value: employeeSummaryStats.leave, bg: 'bg-amber-50 text-amber-600' },
                                { label: 'Half Days', value: employeeSummaryStats.half, bg: 'bg-orange-50 text-orange-600' },
                                { label: 'Late Ins', value: employeeSummaryStats.late, bg: 'bg-violet-50 text-violet-600' },
                                { label: 'Early Outs', value: employeeSummaryStats.early, bg: 'bg-indigo-50 text-indigo-600' },
                                { label: 'OT Hours', value: employeeSummaryStats.overtime, bg: 'bg-sky-50 text-sky-600' },
                                { label: 'Missing Punch', value: employeeSummaryStats.missing, bg: 'bg-slate-100 text-slate-700' }
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-slate-50 p-3 rounded-2xl text-center">
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{stat.label}</div>
                                    <div className={`text-base font-black mt-1 ${stat.bg.split(' ')[1]}`}>{stat.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid overview */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="px-2 py-1.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {employeeCalendarDays.map((cell, idx) => {
                                    if (cell.type === 'empty') {
                                        return <div key={`empty-drilled-${idx}`} className="min-h-[85px] border-r border-b border-slate-100 bg-slate-50/20" />;
                                    }

                                    // Color coding cell background
                                    let cellBg = 'bg-white';

                                    if (cell.status === 'Present') { cellBg = 'bg-emerald-50 text-emerald-800 border border-emerald-100'; }
                                    else if (cell.status === 'WFH') { cellBg = 'bg-indigo-50 text-indigo-800 border border-indigo-100'; }
                                    else if (cell.status === 'On Duty') { cellBg = 'bg-violet-50 text-violet-800 border border-violet-100'; }
                                    else if (cell.status === 'Absent') { cellBg = 'bg-rose-50 text-rose-800 border border-rose-100'; }
                                    else if (cell.status === 'Leave') { cellBg = 'bg-amber-50 text-amber-800 border border-amber-100'; }
                                    else if (cell.status === 'Pending Leave') { cellBg = 'bg-amber-50/20 text-amber-600 border border-dashed border-amber-300'; }
                                    else if (cell.status === 'Holiday') { cellBg = 'bg-purple-50 text-purple-800 border border-purple-100'; }
                                    else if (cell.status === 'Weekly Off') { cellBg = 'bg-blue-50 text-blue-800 border border-blue-100'; }
                                    else if (cell.status === 'Missing Punch') { cellBg = 'bg-slate-900 text-slate-100 border border-slate-950'; }

                                    return (
                                        <div
                                            key={cell.dateStr}
                                            className={clsx(
                                                'relative flex flex-col min-h-[85px] border-r border-b border-slate-100 p-2 text-left',
                                                cellBg,
                                                cell.isToday && 'ring-2 ring-indigo-500 ring-inset'
                                            )}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold">{cell.dayNum}</span>
                                                {cell.attendance?.isLate && (
                                                    <span className="text-[7px] font-black uppercase bg-violet-100 text-violet-700 px-1 rounded">Late</span>
                                                )}
                                            </div>

                                            {/* Punch Times / Future cancel option */}
                                            <div className="mt-auto space-y-0.5 text-[8px] font-bold">
                                                {cell.attendance ? (
                                                    <>
                                                        <div>IN: {cell.attendance.checkIn ? dayjs(cell.attendance.checkIn).format('hh:mm A') : '--:--'}</div>
                                                        <div>OUT: {cell.attendance.checkOut ? dayjs(cell.attendance.checkOut).format('hh:mm A') : '--:--'}</div>
                                                    </>
                                                ) : cell.leave ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="uppercase text-amber-700">{cell.leave.leaveType} Approved</span>
                                                        {cell.isFuture && (
                                                            <button
                                                                onClick={() => handleCancelFutureLeave(cell.leave._id)}
                                                                className="text-[7px] font-black text-rose-600 hover:text-rose-800 uppercase text-left underline"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 uppercase italic text-[7px]">{cell.status}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add/Edit Holiday Modal */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHolidayModal(false)}></div>
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                                {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                            </h3>
                            <button
                                onClick={() => setShowHolidayModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Holiday Name *
                                </label>
                                <input
                                    type="text"
                                    value={holidayForm.name}
                                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition"
                                    placeholder="e.g., Diwali, Christmas"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Date *
                                </label>
                                <input
                                    type="date"
                                    value={holidayForm.date}
                                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Type
                                </label>
                                <select
                                    value={holidayForm.type}
                                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition"
                                >
                                    <option value="Public">Public Holiday</option>
                                    <option value="Optional">Optional Holiday</option>
                                    <option value="Company">Company Holiday</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={holidayForm.description}
                                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition resize-none"
                                    rows="3"
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowHolidayModal(false)}
                                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveHoliday}
                                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                {editingHoliday ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {
                        setShowBulkUploadModal(false);
                        setUploadFile(null);
                        setUploadPreview(null);
                        setUploadErrors([]);
                        setUploadSummary(null);
                    }}></div>
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                                    <FileSpreadsheet className="text-[#4F46E5] dark:text-indigo-400" size={20} />
                                    Bulk Holiday Upload
                                </h3>
                                <p className="text-xs font-bold text-slate-400 mt-2">
                                    Upload Excel file (.xlsx, .xls) with columns: Name, Date, Type (optional), Description (optional)
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowBulkUploadModal(false);
                                    setUploadFile(null);
                                    setUploadPreview(null);
                                    setUploadErrors([]);
                                    setUploadSummary(null);
                                }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {!uploadPreview ? (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl p-8 text-center hover:border-[#4F46E5] dark:hover:border-indigo-500 transition-colors">
                                    <input
                                        type="file"
                                        id="bulk-upload-file"
                                        accept=".xlsx,.xls,.csv"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <label htmlFor="bulk-upload-file" className="cursor-pointer">
                                        <div className="w-16 h-16 mx-auto bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
                                            <Upload size={24} className="text-[#4F46E5] dark:text-indigo-400" />
                                        </div>
                                        <div className="text-sm font-black text-slate-700 dark:text-white mb-1 uppercase tracking-tight">
                                            Click or Drag & Drop File
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Excel files (.xlsx, .xls) up to 5MB
                                        </div>
                                        {uploadFile && (
                                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#4F46E5]/10 text-[#4F46E5] rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                <FileSpreadsheet size={14} />
                                                <span>{uploadFile.name}</span>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {uploadFile && (
                                    <button
                                        onClick={handlePreviewUpload}
                                        disabled={uploading}
                                        className="w-full h-12 bg-gradient-to-r from-[#4F46E5] to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {uploading ? (
                                            <>
                                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <FileSpreadsheet size={20} />
                                                Preview Upload
                                            </>
                                        )}
                                    </button>
                                )}

                                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Required Format</div>
                                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 space-y-1.5 uppercase tracking-wide">
                                        <div className="flex gap-2"><span className="text-[#4F46E5] font-black">•</span> Row 1 is the Header (will be skipped)</div>
                                        <div className="flex gap-2"><span className="text-[#4F46E5] font-black">•</span> Cols: Name | Date | Type (opt) | Description (opt)</div>
                                        <div className="flex gap-2"><span className="text-[#4F46E5] font-black">•</span> Example: "Diwali" | "01-11-2024" | "Public" | "Festival"</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {uploadSummary && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
                                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">New</div>
                                            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{uploadSummary.new}</div>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
                                            <div className="text-xs font-black text-amber-600 text-amber-500 uppercase tracking-widest mb-1">Duplicates</div>
                                            <div className="text-2xl font-black text-amber-800">{uploadSummary.duplicates}</div>
                                        </div>
                                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4">
                                            <div className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1">Errors</div>
                                            <div className="text-2xl font-black text-rose-800">{uploadSummary.errors}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="overflow-x-auto max-h-96">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                {uploadPreview.map((holiday, idx) => (
                                                    <tr key={idx} className={`${holiday.isDuplicate ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            {holiday.isDuplicate ? (
                                                                <div className="flex items-center gap-2 text-amber-600">
                                                                    <AlertTriangle size={14} />
                                                                    <span className="text-[10px] font-black">Duplicate</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-emerald-600">
                                                                    <CheckCircle size={14} />
                                                                    <span className="text-[10px] font-black">New</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-white">{holiday.name}</td>
                                                        <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                                                            {new Date(holiday.date).toLocaleDateString('en-US', {
                                                                year: 'numeric', month: 'short', day: 'numeric'
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded text-xs font-black uppercase">
                                                                {holiday.type || 'Public'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                            {holiday.description || '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {uploadErrors && uploadErrors.length > 0 && (
                                    <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-4">
                                        <div className="text-sm font-black text-rose-800 dark:text-rose-200 mb-2">Errors:</div>
                                        <div className="space-y-1">
                                            {uploadErrors.map((err, idx) => (
                                                <div key={idx} className="text-xs font-bold text-rose-700 dark:text-rose-300">
                                                    Row {err.row}: {err.error}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setUploadPreview(null);
                                            setUploadFile(null);
                                            setUploadSummary(null);
                                        }}
                                        className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmUpload}
                                        disabled={uploading || !uploadPreview || uploadSummary?.new === 0}
                                        className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {uploading ? (
                                            <>
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} />
                                                Confirm & Save ({uploadSummary?.new || 0} holidays)
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
