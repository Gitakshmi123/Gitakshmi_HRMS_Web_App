import React, { useState, useEffect } from 'react';
import { Pagination, DatePicker, Modal, Select } from 'antd';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import dayjs from 'dayjs';
import api, { API_ROOT } from '../../utils/api';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import {
    Upload, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Coffee, Edit2, Trash2, X, AlertCircle,
    FileSpreadsheet, AlertTriangle, CheckCircle, Save,
    Calendar as CalendarIcon, Clock, Filter, List
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Can } from '../../components/rbac/PermissionGate';


// --- Helpers & Compact Components ---

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
        const initials = getInitials(employee?.name);
        return (
            <div className={`${size} rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0 ${className}`}>
                <span className={`${initialsSize} font-black text-blue-600 uppercase tracking-tighter`}>{initials}</span>
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={employee?.name}
            onError={() => setImgError(true)}
            className={`${size} rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0 ${className}`}
        />
    );
};

export default function CalendarManagement() {
    const [searchParams] = useSearchParams();

    // Custom scrollbar styles
    const scrollbarStyle = `
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
        }
    `;
    const [view, setView] = useState('calendar'); // 'calendar' or 'list'
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'Public', description: '' });
    const [settings, setSettings] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [calendarData, setCalendarData] = useState(null);
    // Date panel state
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [dateAttendanceData, setDateAttendanceData] = useState(null);
    const [dateLoading, setDateLoading] = useState(false);
    const [dateError, setDateError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('total');
    const [showEmployeeList, setShowEmployeeList] = useState(false);

    // Detail Modal State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Bulk Upload State (Restored)
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState(null);
    const [uploadErrors, setUploadErrors] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadSummary, setUploadSummary] = useState(null);

    useEffect(() => {
        fetchData();
    }, [currentYear, currentMonth]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/attendance/calendar?year=${currentYear}&month=${currentMonth + 1}`);
            const data = res.data || {};

            setCalendarData(data);
            setHolidays(data.holidays || []);
            setSettings(data.settings || {});

        } catch (err) {
            console.error('Failed to fetch calendar data:', err);
            showToast('error', 'Error', 'Failed to load calendar data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch attendance details for a selected date
    useEffect(() => {
        if (!selectedDate || !isPanelOpen) return;

        const fetchDateDetails = async () => {
            try {
                setDateLoading(true);
                setDateError(null);
                const res = await api.get(`/attendance/by-date?date=${selectedDate}&filterType=${statusFilter}`);
                setDateAttendanceData(res.data);
            } catch (err) {
                console.error('Failed to fetch date attendance:', err);
                setDateError(err.response?.data || { message: err.message });
            } finally {
                setDateLoading(false);
            }
        };

        fetchDateDetails();
    }, [selectedDate, isPanelOpen, statusFilter]);

    const handleEmployeeClick = async (employee) => {
        try {
            setDetailLoading(true);
            setShowDetailModal(true);
            const res = await api.get(`/attendance/employee/${employee._id}/${selectedDate}`);
            setSelectedEmployeeDetail(res.data);
        } catch (err) {
            console.error('Failed to fetch employee details:', err);
            showToast('error', 'Error', 'Failed to load employee details');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleDateClick = (dateStr) => {
        const dateStrIso = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        setSelectedDate(dateStrIso);
        setStatusFilter('total');
        setShowEmployeeList(false); // Hide list on date change as per rule
        setIsPanelOpen(true);
    };

    const handleAddHoliday = () => {
        setEditingHoliday(null);
        setHolidayForm({ name: '', date: '', type: 'Public', description: '' });
        setShowHolidayModal(true);
    };

    const handleEditHoliday = (holiday) => {
        setEditingHoliday(holiday);
        const dateStr = new Date(holiday.date).toISOString().split('T')[0];
        setHolidayForm({
            name: holiday.name,
            date: dateStr,
            type: holiday.type || 'Public',
            description: holiday.description || ''
        });
        setShowHolidayModal(true);
    };

    const handleSaveHoliday = async () => {
        try {
            if (!holidayForm.name || !holidayForm.date) {
                showToast('error', 'Error', 'Please fill in holiday name and date');
                return;
            }

            if (editingHoliday) {
                await api.put(`/holidays/${editingHoliday._id}`, holidayForm);
            } else {
                await api.post('/holidays', holidayForm);
            }

            setShowHolidayModal(false);
            showToast('success', 'Success', 'Holiday saved successfully');
            fetchData();
        } catch (err) {
            console.error('Failed to save holiday:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to save holiday');
        }
    };

    const handleDeleteHoliday = async (id) => {
        showConfirmToast({
            title: 'Delete Holiday',
            description: 'Are you sure you want to delete this holiday? This action cannot be undone.',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/holidays/${id}`);
                    showToast('success', 'Success', 'Holiday deleted successfully');
                    fetchData();
                } catch (err) {
                    console.error('Failed to delete holiday:', err);
                    showToast('error', 'Error', err.response?.data?.error || 'Failed to delete holiday');
                }
            }
        });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
            setUploadPreview(null);
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
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setUploadPreview(res.data.preview);
            setUploadErrors(res.data.errors || []);
            setUploadSummary(res.data.summary);
        } catch (err) {
            console.error('Failed to preview upload:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to process file');
            setUploadFile(null);
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmUpload = async () => {
        if (!uploadPreview || uploadSummary?.new === 0) return;

        try {
            setUploading(true);
            const res = await api.post('/holidays/bulk/confirm', {
                holidays: uploadPreview,
                skipDuplicates: true
            });

            showToast('success', 'Success', `Successfully uploaded ${res.data.summary.saved} holidays!`);
            setShowBulkUploadModal(false);
            setUploadFile(null);
            setUploadPreview(null);
            setUploadErrors([]);
            setUploadSummary(null);
            fetchData(); // Refresh the holiday list
        } catch (err) {
            console.error('Failed to confirm upload:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to save holidays');
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
        setCurrentYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.5, staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <style>{scrollbarStyle}</style>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Calendar...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white p-2.5 space-y-6 text-[#1e293b]">
            <style>{scrollbarStyle}</style>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Manage Working Days & Holidays
                </div>
                <div className="flex items-center gap-3">
                    <Can module="attendance.calendar" action="create">
                        <button
                            onClick={() => setShowBulkUploadModal(true)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                        >
                            <Upload size={14} />
                            Bulk Upload
                        </button>
                    </Can>
                    <Can module="attendance.calendar" action="create">
                        <button
                            onClick={handleAddHoliday}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-sm flex items-center gap-2"
                        >
                            <Plus size={14} />
                            Add Holiday
                        </button>
                    </Can>
                </div>
            </div>

            {/* Top Section: Summary Cards */}
            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
                {/* Card 1: Total Holidays */}
                <motion.div 
                    variants={itemVariants}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group overflow-hidden relative"
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100/50 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <CalendarIcon size={26} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Holidays</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-slate-900 leading-none">{holidays.length}</h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">in {currentYear}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Card 2: Next Holiday */}
                <motion.div 
                    variants={itemVariants}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group overflow-hidden relative"
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100/50 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <Coffee size={26} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Holiday</p>
                            <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">
                                {holidays.find(h => new Date(h.date) >= new Date())?.name || 'No upcoming holidays'}
                            </h3>
                            <p className="text-[10px] font-black text-indigo-600/70 uppercase tracking-widest mt-1">
                                {holidays.find(h => new Date(h.date) >= new Date())
                                    ? formatDateDDMMYYYY(holidays.find(h => new Date(h.date) >= new Date()).date)
                                    : 'Relax!'}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Card 3: View Mode Controls */}
                <motion.div 
                    variants={itemVariants}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-center"
                >
                    <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <button
                            onClick={() => setView('calendar')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                view === 'calendar' ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <CalendarIcon size={14} />
                            Calendar
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                view === 'list' ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <List size={14} />
                            List
                        </button>
                    </div>
                </motion.div>
            </motion.div>

            {/* Monthly Stats Row */}
            {calendarData?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Monthly Present', value: calendarData.summary.totalPresent, dot: 'bg-emerald-500', badge: 'Days', badgeColor: 'bg-emerald-50 text-emerald-600' },
                        { label: 'Monthly Absent', value: calendarData.summary.totalAbsent, dot: 'bg-rose-500', badge: 'Days', badgeColor: 'bg-rose-50 text-rose-600' },
                        { label: 'Monthly Leave', value: calendarData.summary.totalLeave, dot: 'bg-blue-500', badge: 'Days', badgeColor: 'bg-blue-50 text-blue-600' },
                        { label: 'Monthly Holidays', value: calendarData.summary.totalHolidays, dot: 'bg-amber-500', badge: 'Fixed', badgeColor: 'bg-amber-50 text-amber-600' },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-50 hover:shadow-md transition-all group">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={clsx("w-1.5 h-1.5 rounded-full", stat.dot)}></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-3xl font-bold text-slate-900 group-hover:scale-110 transition-transform origin-left">{stat.value}</span>
                                <span className={clsx("text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest", stat.badgeColor)}>{stat.badge}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === 'calendar' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                    {/* Left: Calendar Grid */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-50 overflow-hidden">
                            <AttendanceCalendar
                                data={calendarData?.days || calendarData?.calendarDays || []}
                                holidays={calendarData?.holidays || []}
                                settings={calendarData?.settings || {}}
                                currentMonth={currentMonth}
                                currentYear={currentYear}
                                onDateClick={handleDateClick}
                                selectedDate={selectedDate}
                            />
                        </div>
                    </div>

                    {/* Right: Day Analytics Panel */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-50 p-6 sticky top-6">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 leading-none">
                                        {selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                                        {selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long' }) : ''}
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-0.5 bg-slate-50/50 p-0.5 rounded-xl border border-slate-100">
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigateYear('prev'); }}
                                                className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-300 hover:text-blue-600 active:scale-95"
                                                title="Previous Year"
                                            >
                                                <ChevronsLeft size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigateMonth('prev'); }}
                                                className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-blue-600 active:scale-95"
                                                title="Previous Month"
                                            >
                                                <ChevronLeft size={13} />
                                            </button>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-600 px-2 min-w-[90px] text-center uppercase tracking-tight">
                                            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'short', year: 'numeric' })}
                                        </span>
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigateMonth('next'); }}
                                                className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-blue-600 active:scale-95"
                                                title="Next Month"
                                            >
                                                <ChevronRight size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigateYear('next'); }}
                                                className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-300 hover:text-blue-600 active:scale-95"
                                                title="Next Year"
                                            >
                                                <ChevronsRight size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {dateAttendanceData && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: 'Total', value: dateAttendanceData.summary?.totalEmployees ?? 0, color: 'text-blue-600', filter: 'total' },
                                            { label: 'Present', value: dateAttendanceData.summary?.present ?? 0, color: 'text-emerald-600', filter: 'present' },
                                            { label: 'Absent', value: dateAttendanceData.summary?.absent ?? 0, color: 'text-rose-600', filter: 'absent' },
                                            { label: 'Leave', value: dateAttendanceData.summary?.onLeave ?? 0, color: 'text-indigo-600', filter: 'leave' },
                                        ].map((stat) => (
                                            <div 
                                                key={stat.label}
                                                onClick={() => {
                                                    if (stat.filter === 'total' || !dateAttendanceData.summary?.isFutureDate) {
                                                        setStatusFilter(stat.filter);
                                                        setShowEmployeeList(true);
                                                    }
                                                }}
                                                className={clsx(
                                                    "p-2.5 rounded-xl border transition-all cursor-pointer group",
                                                    showEmployeeList && statusFilter === stat.filter 
                                                        ? "border-blue-500 bg-blue-50/50" 
                                                        : "border-slate-50 bg-slate-50 hover:bg-white hover:border-slate-200"
                                                )}
                                            >
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                                <p className={clsx("text-lg font-black", stat.color)}>{stat.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 border-t border-slate-100 pt-6">
                                        {dateLoading ? (
                                            <div className="flex justify-center py-12">
                                                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                            </div>
                                        ) : showEmployeeList ? (
                                            <div className="space-y-4 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{statusFilter} employees</span>
                                                    <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100/50">
                                                        {dateAttendanceData.employees?.length || 0} Total
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    <AnimatePresence mode="popLayout">
                                                        {dateAttendanceData.employees?.length > 0 ? (
                                                            dateAttendanceData.employees.map((emp, idx) => (
                                                                <motion.div
                                                                    layout
                                                                    initial={{ opacity: 0, x: -10 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                                                                    key={emp.employeeId}
                                                                    onClick={() => handleEmployeeClick(emp)}
                                                                    className="flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-blue-50/40 cursor-pointer transition-all group relative overflow-hidden"
                                                                >
                                                                    <div className="relative z-10">
                                                                        <EmployeeAvatar employee={emp} size="w-11 h-11" />
                                                                        <div className={clsx(
                                                                            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                                                                            ['Present', 'Half Day', 'On Duty'].includes(emp.status) ? 'bg-emerald-500' :
                                                                            emp.status === 'Absent' ? 'bg-rose-500' :
                                                                            emp.status === 'Leave' ? 'bg-blue-500' : 'bg-slate-300'
                                                                        )}></div>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 z-10">
                                                                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">{emp.name}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">{emp.employeeId}</span>
                                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight truncate max-w-[100px]">{emp.department}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <ChevronRight size={14} className="text-blue-400 translate-x-[-4px] group-hover:translate-x-0 transition-transform" />
                                                                    </div>
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/10 group-hover:to-transparent transition-all duration-500"></div>
                                                                </motion.div>
                                                            ))
                                                        ) : (
                                                            <motion.div 
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="text-center py-16"
                                                            >
                                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 text-slate-300">
                                                                    <X size={20} />
                                                                </div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching records</p>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-16">
                                                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100 group">
                                                    <Filter size={32} className="text-slate-300 group-hover:rotate-12 transition-transform" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-400 uppercase tracking-tight">Select statistics card</p>
                                                <p className="text-[10px] text-slate-300 mt-2 uppercase tracking-widest font-black">To explore employee logs</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-50 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
                            Holidays ({currentYear})
                        </h3>
                    </div>
                    <div className="p-6">
                        {holidays.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No holidays defined for {currentYear}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {holidays.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((holiday) => (
                                    <div key={holiday._id} className="bg-white flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                                                <span className="text-[10px] font-black uppercase leading-none">{new Date(holiday.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                                <span className="text-xl font-black leading-none mt-1">{new Date(holiday.date).getDate()}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900 uppercase group-hover:text-blue-600 transition-colors tracking-tight">{holiday.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                                                    <span className={clsx(
                                                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                                                        holiday.type === 'Public' ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                                    )}>
                                                        {holiday.type || 'Public'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Can module="attendance.calendar" action="edit">
                                                <button
                                                    onClick={() => handleEditHoliday(holiday)}
                                                    className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </Can>
                                            <Can module="attendance.calendar" action="delete">
                                                <button
                                                    onClick={() => handleDeleteHoliday(holiday._id)}
                                                    className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </Can>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {holidays.length > pageSize && (
                            <div className="mt-8 flex justify-center">
                                <Pagination
                                    current={currentPage}
                                    pageSize={pageSize}
                                    total={holidays.length}
                                    onChange={(page) => setCurrentPage(page)}
                                    showSizeChanger={false}
                                    hideOnSinglePage
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Holiday Modal */}
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
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
                                    placeholder="e.g., Diwali, Christmas"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Date *
                                </label>
                                <DatePicker
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition h-[46px]"
                                    format="DD-MM-YYYY"
                                    placeholder="DD-MM-YYYY"
                                    value={holidayForm.date ? dayjs(holidayForm.date) : null}
                                    onChange={(date) => setHolidayForm({ ...holidayForm, date: date ? date.format('YYYY-MM-DD') : '' })}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Type
                                </label>
                                <select
                                    value={holidayForm.type}
                                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
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
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition resize-none"
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
                                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition flex items-center justify-center gap-2"
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
                                {/* Summary */}
                                {uploadSummary && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
                                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">New</div>
                                            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{uploadSummary.new}</div>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
                                            <div className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Duplicates</div>
                                            <div className="text-2xl font-black text-amber-700 dark:text-amber-300">{uploadSummary.duplicates}</div>
                                        </div>
                                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4">
                                            <div className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Errors</div>
                                            <div className="text-2xl font-black text-rose-700 dark:text-rose-300">{uploadSummary.errors}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Preview Table */}
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

                                {/* Errors */}
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

                                {/* Action Buttons */}
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
            {/* Employee Detail Modal */}
            <Modal
                open={showDetailModal}
                onCancel={() => setShowDetailModal(false)}
                footer={null}
                width={600}
                centered
                closeIcon={<X className="text-slate-400 hover:text-rose-500 transition-colors" size={20} />}
                className="attendance-detail-modal"
            >
                {detailLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fetching Details...</p>
                    </div>
                ) : selectedEmployeeDetail ? (
                    <div className="p-2 space-y-8 animate-in fade-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                            <EmployeeAvatar
                                employee={selectedEmployeeDetail.employee}
                                size="w-20 h-20"
                                initialsSize="text-2xl"
                                className="rounded-2xl shadow-lg"
                            />
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedEmployeeDetail.employee?.name}</h2>
                                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{selectedEmployeeDetail.employee?.designation || 'Staff'}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedEmployeeDetail.employee?.employeeId}</span>
                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedEmployeeDetail.employee?.department}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status Card */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Attendance Status</p>
                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${['Present', 'Half Day', 'On Duty'].includes(selectedEmployeeDetail.status) ? 'bg-emerald-100 text-emerald-700' :
                                    selectedEmployeeDetail.status === 'Absent' ? 'bg-rose-100 text-rose-700' :
                                        selectedEmployeeDetail.status === 'Leave' ? 'bg-indigo-100 text-indigo-700' :
                                            selectedEmployeeDetail.status === 'Holiday' ? 'bg-amber-100 text-amber-700' :
                                                selectedEmployeeDetail.status === 'Weekly Off' ? 'bg-slate-200 text-slate-700' :
                                                    'bg-slate-100 text-slate-400'
                                    }`}>
                                    {selectedEmployeeDetail.status}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                                <p className="text-sm font-black text-slate-800">{new Date(selectedEmployeeDetail.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                            </div>
                        </div>

                        {/* Attendance Logs */}
                        {selectedEmployeeDetail.attendance ? (
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={16} className="text-blue-500" />
                                    Punch Records
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Check In</p>
                                        <p className="text-xl font-black text-emerald-700">{selectedEmployeeDetail.attendance.checkIn ? new Date(selectedEmployeeDetail.attendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                                        <p className="text-[10px] text-emerald-600 mt-1 font-bold">{selectedEmployeeDetail.attendance.logs?.[0]?.device || 'System'}</p>
                                    </div>
                                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                                        <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Check Out</p>
                                        <p className="text-xl font-black text-rose-700">{selectedEmployeeDetail.attendance.checkOut ? new Date(selectedEmployeeDetail.attendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Working Hours</p>
                                        <p className="text-lg font-black text-slate-700">{selectedEmployeeDetail.attendance.workingHours || 0} hrs</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Overtime</p>
                                        <p className="text-lg font-black text-emerald-600">{selectedEmployeeDetail.attendance.overtimeHours || 0} hrs</p>
                                    </div>
                                </div>
                            </div>
                        ) : selectedEmployeeDetail.status === 'Holiday' ? (
                            <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 border-dashed">
                                <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Info size={16} />
                                    Holiday Details
                                </h3>
                                <p className="text-lg font-black text-amber-800">{dateAttendanceData?.holiday || 'Public Holiday'}</p>
                                <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">Office is Closed</p>
                            </div>
                        ) : (
                            <div className="py-12 text-center bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                                {selectedEmployeeDetail.isFutureDate ? (
                                    <Clock className="mx-auto text-slate-300 mb-3" size={32} />
                                ) : (
                                    <AlertTriangle className="mx-auto text-rose-400 mb-3" size={32} />
                                )}
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
                                    {selectedEmployeeDetail.isFutureDate ? 'Future Date - Not Marked' : 'Attendance Not Marked'}
                                </p>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tight">
                                    {selectedEmployeeDetail.status === 'Weekly Off' ? 'Employee Weekly Off' : (selectedEmployeeDetail.isFutureDate ? 'Status will be calculated on this date' : 'Employee was likely absent')}
                                </p>
                            </div>
                        )}
                    </div>
                ) : null}
            </Modal >
        </div >
    );
}
