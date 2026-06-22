import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Pagination } from 'antd';
import api from '../../utils/api';
import {
    Search, Filter, Download,
    Settings, ShieldAlert, RefreshCw,
    User, Clock, MapPin,
    MoreVertical, Edit2, Lock, X, Eye, ChevronLeft, ChevronRight, Upload,
    CheckCircle, XCircle, AlertTriangle, AlertCircle, LayoutDashboard, History, List, LogIn, LogOut, Package, Shield, ShieldCheck,
    Navigation, Activity, Map as MapIcon, Calendar
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import AttendanceSettings from './AttendanceSettings';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import AttendanceHistory from './AttendanceHistory';
import AttendanceExcelUploadModal from '../../components/HR/AttendanceExcelUploadModal';
import usePagePermissions from '../../hooks/usePagePermissions';
import AttendanceLiveMap from '../../components/attendance/AttendanceLiveMap';

const ensureBase64DataUrl = (imgStr) => {
    if (!imgStr) return '';
    if (imgStr.startsWith('data:')) return imgStr;
    return `data:image/jpeg;base64,${imgStr}`;
};

// --- Sub-components ---

function StatItem({ label, value, icon, colorClass, bgColorClass }) {
    return (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-none flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgColorClass}`}>
                {icon && React.isValidElement(icon)
                    ? React.cloneElement(icon, { size: 16, className: colorClass })
                    : null}
            </div>
            <div>
                <h4 className="text-xl font-bold text-slate-900 leading-none mb-1">{value}</h4>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
        </div>
    );
}

function StatusChip({ status, isLate }) {
    if (!status) return null;
    let style = 'bg-gray-100 text-gray-700 border-gray-200';
    let text = typeof status === 'string' ? status.replace('_', ' ') : status;

    if (status === 'present') {
        if (isLate) {
            style = 'text-orange-600';
            text = 'LATE';
        } else {
            style = 'text-green-600';
        }
    } else if (status === 'absent') {
        style = 'text-red-600';
    } else if (status === 'leave') {
        style = 'text-blue-600';
    } else if (status === 'half_day') {
        style = 'text-amber-600';
    } else if (status === 'missed_punch') {
        style = 'text-orange-600';
    } else if (status === 'holiday') {
        style = 'text-purple-600';
    }

    return (
        <span className={`inline-flex items-center text-[12px] font-bold tracking-wide ${style}`}>
            {text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()}
        </span>
    );
}

function TabButton({ active, label, onClick, icon }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${active
                    ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
            `}
        >
            {icon && <span className={active ? 'text-emerald-600' : 'text-slate-400'}>{icon}</span>}
            {label}
        </button>
    );
}

// --- Main Component ---

export default function AttendanceAdmin({ forceView }) {
    const { canView, canCreate, canEdit, loading: permLoading } = usePagePermissions('attendance.dashboard');
    const canBulkUpload = canCreate || canEdit;
    const [view, setView] = useState(forceView || 'dashboard'); // dashboard, settings
    const [isShiftFormActive, setIsShiftFormActive] = useState(false);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Register View for specific employee
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [employeeAttendance, setEmployeeAttendance] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [holidays, setHolidays] = useState([]);
    const [employeeLeaves, setEmployeeLeaves] = useState([]);
    const [settings, setSettings] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Edit Attendance Modal
    const [editingAttendance, setEditingAttendance] = useState(null);
    const [editForm, setEditForm] = useState({
        status: 'present',
        checkIn: '',
        checkOut: '',
        reason: ''
    });
    const [uploadingPopup, setUploadingPopup] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewImage, setPreviewImage] = useState({ show: false, title: '', src: '', time: null, employee: null });
    const [breakModal, setBreakModal] = useState(null); // { logs: [], employee: {} }

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/attendance/all?date=${date}`);
            setAttendance(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        if (forceView) {
            setView(forceView);
        }
    }, [forceView]);

    useEffect(() => {
        if (view === 'dashboard') {
            fetchStats();
        }
    }, [fetchStats, view]);

    const fetchEmployeeRegister = useCallback(async () => {
        if (!viewingEmployee) return;
        try {
            const [attRes, holidayRes, settingsRes, leavesRes] = await Promise.all([
                api.get(`/attendance/my?employeeId=${viewingEmployee._id}&month=${currentMonth + 1}&year=${currentYear}`),
                api.get('/holidays'),
                api.get(`/attendance/settings?employeeId=${viewingEmployee._id}`),
                api.get(`/hr/leaves/requests?employeeId=${viewingEmployee._id}&limit=all`)
            ]);
            setEmployeeAttendance(attRes.data);
            setHolidays(holidayRes.data || []);
            setSettings(settingsRes.data || {});
            setEmployeeLeaves(leavesRes.data?.data || []);
        } catch (err) {
            console.error(err);
        }
    }, [currentMonth, currentYear, viewingEmployee]);

    useEffect(() => {
        if (viewingEmployee) {
            fetchEmployeeRegister();
        }
    }, [fetchEmployeeRegister, viewingEmployee]);

    const handlePreviousMonth = () => {
        if (currentMonth === 0) {
            setCurrentYear(p => p - 1);
            setCurrentMonth(11);
        } else {
            setCurrentMonth(p => p - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentYear(p => p + 1);
            setCurrentMonth(0);
        } else {
            setCurrentMonth(p => p + 1);
        }
    };

    const handleSaveEdit = async () => {
        if (!editForm.reason.trim()) {
            alert('Please provide a reason for the override');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                employeeId: editingAttendance.employee._id || editingAttendance.employee,
                date: editingAttendance.date,
                status: editForm.status,
                reason: editForm.reason
            };

            if (editForm.checkIn) {
                payload.checkIn = new Date(editForm.checkIn).toISOString();
            }
            if (editForm.checkOut) {
                payload.checkOut = new Date(editForm.checkOut).toISOString();
            }

            await api.post('/attendance/override', payload);
            setEditingAttendance(null);
            fetchStats(); // Refresh the attendance list
            alert('Attendance updated successfully');
        } catch (err) {
            console.error('Failed to save attendance edit:', err);
            alert(err.response?.data?.error || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    if (permLoading) return null;

    if (!canView) {
        return <Navigate to="/hr/dashboard" replace />;
    }
    return (
        <>
            <div className={`mx-auto overflow-hidden ${isShiftFormActive ? '' : 'p-2.5'}`}>

                {!isShiftFormActive && view === 'dashboard' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-6 animate-in fade-in duration-300">
                        <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
                            {/* Pagination Controls (Compact) */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 text-slate-400 hover:text-[#00A389] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        title="Previous"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    <div className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5 px-1">
                                        <span className="text-slate-900">{currentPage}</span>
                                        <span className="text-slate-300">/</span>
                                        <span className="text-slate-400">{Math.ceil(attendance.length / pageSize) || 1}</span>
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(attendance.length / pageSize), prev + 1))}
                                        disabled={currentPage === Math.ceil(attendance.length / pageSize) || attendance.length === 0}
                                        className="p-2 text-slate-400 hover:text-[#00A389] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        title="Next"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>

                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-slate-200 text-slate-600 text-[12px] font-bold rounded-lg focus:ring-[#00A389] focus:border-[#00A389] block p-1 px-2 outline-none transition-all shadow-sm h-10"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                    <option value={500}>500</option>
                                    <option value={1000}>1000</option>
                                </select>
                            </div>

                            {/* Filters and Actions */}
                            <div className="flex items-center gap-2">
                                <DatePicker
                                    className="h-10 px-3 border border-slate-200 bg-white rounded-xl text-sm focus:border-[#00A389] hover:border-[#00A389] transition-colors"
                                    format="DD-MM-YYYY"
                                    placeholder="Select Date"
                                    allowClear={false}
                                    value={date ? dayjs(date) : null}
                                    onChange={(d) => setDate(d ? d.format('YYYY-MM-DD') : '')}
                                />
                                <button
                                    onClick={fetchStats}
                                    disabled={loading}
                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-[#00A389] transition-colors shadow-sm"
                                    title="Sync Logs"
                                >
                                    <div className={`${loading ? 'animate-spin' : ''}`}>
                                        <RefreshCw size={16} />
                                    </div>
                                </button>
                                {canBulkUpload && (
                                    <button
                                        onClick={() => setUploadingPopup(true)}
                                        className="flex items-center gap-2 h-10 px-4 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                                    >
                                        <Upload size={16} />
                                        <span className="hidden sm:inline">Bulk Import</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'dashboard' ? (
                    <div className="space-y-7">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                            <StatItem
                                label="Active Employees"
                                value={Array.isArray(attendance) ? attendance.length : 0}
                                icon={<User />}
                                colorClass="text-blue-600"
                                bgColorClass="bg-blue-50"
                            />
                            <StatItem
                                label="Present"
                                value={Array.isArray(attendance) ? attendance.filter(a => a.status === 'present').length : 0}
                                icon={<CheckCircle />}
                                colorClass="text-green-600"
                                bgColorClass="bg-green-50"
                            />
                            <StatItem
                                label="Absent"
                                value={Array.isArray(attendance) ? attendance.filter(a => a.status === 'absent').length : 0}
                                icon={<XCircle />}
                                colorClass="text-red-500"
                                bgColorClass="bg-red-50"
                            />
                            <StatItem
                                label="Late Comers"
                                value={Array.isArray(attendance) ? attendance.filter(a => a.isLate).length : 0}
                                icon={<Clock />}
                                colorClass="text-orange-500"
                                bgColorClass="bg-orange-50"
                            />
                            <StatItem
                                label="Flagged"
                                value={Array.isArray(attendance) ? attendance.filter(a => a.flagged).length : 0}
                                icon={<ShieldAlert />}
                                colorClass="text-rose-600"
                                bgColorClass="bg-rose-50"
                            />
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-none overflow-hidden">
                            <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.2fr_1fr] px-5 py-3 bg-slate-50 border-b border-slate-200">
                                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Employee</div>
                                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</div>
                                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Check In/Out</div>
                                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Hours</div>
                                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Note</div>
                                <div className="text-right text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Action</div>
                            </div>

                            <div className="divide-y divide-slate-200">
                                {attendance.length === 0 ? (
                                    <div className="p-14 flex flex-col items-center justify-center text-slate-500">
                                        <Package size={32} className="mb-3 text-gray-300" />
                                        <p className="text-[18px]">No attendance records found</p>
                                    </div>
                                ) : (
                                    attendance.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item, idx) => (
                                        <div key={item._id} className={`grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_0.8fr_1.2fr_1fr] items-center px-5 py-2.5 transition-colors hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/10'}`}>
                                            {/* Employee */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[11px] font-bold shrink-0" title={`${item.employee?.firstName} ${item.employee?.lastName} (${item.employee?.employeeId})`}>
                                                    {item.employee?.firstName?.[0]}{item.employee?.lastName?.[0]}
                                                </div>
                                            </div>

                                            {/* Status Column */}
                                            <div className="mt-2 md:mt-0">
                                                <StatusChip status={item.status} isLate={item.isLate} />
                                            </div>

                                            {/* Duration Column */}
                                            <div className="flex flex-col mt-1 md:mt-0 gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-400 font-bold text-[10px] uppercase w-7 inline-block">In</span>
                                                    <span className="font-bold text-slate-900 text-[10px]">{item.checkIn ? `${formatDateDDMMYYYY(item.checkIn)} ${new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--:--'}</span>
                                                    {item.checkInImage && (
                                                        <img 
                                                            src={ensureBase64DataUrl(item.checkInImage)} 
                                                            alt="Check-In" 
                                                            className="w-5 h-5 rounded-md object-cover cursor-pointer hover:scale-110 transition-transform border border-slate-200" 
                                                            onClick={() => setPreviewImage({ show: true, title: 'Check In Photo', src: ensureBase64DataUrl(item.checkInImage), time: item.checkIn, employee: item.employee })}
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-400 font-bold text-[10px] uppercase w-7 inline-block">Out</span>
                                                    <span className="font-bold text-slate-900 text-[10px]">{item.checkOut ? `${formatDateDDMMYYYY(item.checkOut)} ${new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--:--'}</span>
                                                    {item.checkOutImage && (
                                                        <img 
                                                            src={ensureBase64DataUrl(item.checkOutImage)} 
                                                            alt="Check-Out" 
                                                            className="w-5 h-5 rounded-md object-cover cursor-pointer hover:scale-110 transition-transform border border-slate-200" 
                                                            onClick={() => setPreviewImage({ show: true, title: 'Check Out Photo', src: ensureBase64DataUrl(item.checkOutImage), time: item.checkOut, employee: item.employee })}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Hours Column */}
                                            <div className="mt-1 md:mt-0">
                                                <span className="text-sm font-semibold text-slate-900">
                                                    {item.workingHours?.toFixed(1) || '0.0'} <span className="text-slate-400 text-[10px] uppercase font-bold tracking-tighter">hrs</span>
                                                </span>
                                            </div>

                                            {/* Note Column */}
                                            <div className="mt-2 md:mt-0">
                                                <div className="flex flex-col gap-1.5">
                                                    {item.faceVerified && (
                                                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200/50 w-fit">
                                                            <CheckCircle size={12} className="text-emerald-500" />
                                                            <span>Face Verified</span>
                                                        </div>
                                                    )}
                                                    {item.flagged ? (
                                                        <div className="space-y-1" title={item.flagReasons?.join(' | ') || item.flagReason || 'Flagged attendance'}>
                                                            <div className="inline-flex items-center gap-1 text-rose-600">
                                                                <ShieldAlert size={14} />
                                                                <span className="text-[12px] font-bold">Flagged</span>
                                                            </div>
                                                            <p className="text-[11px] font-medium text-rose-700 line-clamp-2">
                                                                {item.flagReason || item.flagReasons?.[0] || 'Requires admin review'}
                                                            </p>
                                                        </div>
                                                    ) : item.isManualOverride ? (
                                                        <div className="inline-flex items-center gap-1.5 text-amber-600" title="Manually Modified">
                                                            <ShieldAlert size={14} />
                                                            <span className="text-[12px] font-bold">Modified</span>
                                                        </div>
                                                    ) : (
                                                        !item.faceVerified && <span className="text-gray-400">-</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions Column */}
                                            <div className="flex justify-end gap-1 mt-3 md:mt-0">
                                                {canView && (
                                                    <button onClick={() => setViewingEmployee(item.employee)} className="p-1 text-gray-400 hover:text-[#00A389] transition-colors" title="View Register">
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                                {canView && (
                                                    <button onClick={() => setBreakModal({ logs: item.logs, employee: item.employee })} className="p-1 text-gray-400 hover:text-blue-500 transition-colors" title="View Activity Logs">
                                                        <List size={16} />
                                                    </button>
                                                )}
                                                {canEdit && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingAttendance(item);
                                                            setEditForm({
                                                                status: item.status || 'present',
                                                                checkIn: item.checkIn ? dayjs(item.checkIn).format('YYYY-MM-DDTHH:mm') : '',
                                                                checkOut: item.checkOut ? dayjs(item.checkOut).format('YYYY-MM-DDTHH:mm') : '',
                                                                reason: item.overrideReason || ''
                                                            });
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                                                        title="Edit Attendance"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    </div>
                ) : view === 'liveTracking' ? (
                    <AttendanceLiveMap />
                ) : view === 'settings' ? (
                    <AttendanceSettings onShiftFormChange={setIsShiftFormActive} />
                ) : view === 'calendar' ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[600px]">
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl w-fit border border-gray-200 shadow-sm mb-6">
                            <button onClick={handlePreviousMonth} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"><ChevronLeft size={20} /></button>
                            <span className="text-[14px] font-semibold min-w-[140px] text-center text-[#111827]">
                                {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"><ChevronRight size={20} /></button>
                        </div>
                        <AttendanceCalendar
                            data={attendance}
                            holidays={holidays}
                            settings={settings}
                            currentMonth={currentMonth}
                            currentYear={currentYear}
                        />
                    </div>
                ) : (
                    <AttendanceHistory />
                )}

                {/* Employee Register Modal - Portalled */}
                {viewingEmployee && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
                            onClick={() => setViewingEmployee(null)}
                        ></div>
                        <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

                            {/* Fixed Header */}
                            <div className="flex-none flex justify-between items-center p-6 bg-white border-b border-gray-100 z-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-white border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                                        {viewingEmployee.firstName[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-[18px] font-semibold text-[#111827]">
                                            {viewingEmployee.firstName} {viewingEmployee.lastName}'s Register
                                        </h3>
                                        <p className="text-[13px] text-[#6B7280] mt-0.5">
                                            {viewingEmployee.employeeId}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setViewingEmployee(null)}
                                    className="p-2 bg-white rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 border border-gray-100 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 bg-white p-2 rounded-xl w-fit border border-gray-200 shadow-sm mx-auto sm:mx-0">
                                        <button onClick={handlePreviousMonth} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"><ChevronLeft size={20} /></button>
                                        <span className="text-[14px] font-semibold min-w-[140px] text-center text-[#111827]">
                                            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"><ChevronRight size={20} /></button>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                        <AttendanceCalendar
                                            data={employeeAttendance}
                                            holidays={holidays}
                                            leaves={employeeLeaves}
                                            settings={settings}
                                            currentMonth={currentMonth}
                                            currentYear={currentYear}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Edit Attendance Modal */}
                {editingAttendance && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
                            onClick={() => setEditingAttendance(null)}
                        ></div>
                        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 text-[#111827]">

                            {/* Header */}
                            <div className="flex-none flex justify-between items-center p-5 border-b border-gray-100 z-20">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-white border border-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                                        <Edit2 size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-[16px] font-semibold text-[#111827]">
                                            Edit Attendance
                                        </h3>
                                        <p className="text-[13px] text-[#6B7280] mt-0.5">
                                            {editingAttendance.employee?.firstName} {editingAttendance.employee?.lastName} — {formatDateDDMMYYYY(editingAttendance.date)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingAttendance(null)}
                                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* form body */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-[13px] font-medium text-[#6B7280] mb-2">
                                            Status
                                        </label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[14px] font-medium text-[#111827] outline-none focus:border-[#00A389] focus:ring-1 focus:ring-[#00A389] transition-all"
                                        >
                                            <option value="present">Present</option>
                                            <option value="absent">Absent</option>
                                            <option value="half_day">Half Day</option>
                                            <option value="leave">Leave</option>
                                            <option value="missed_punch">Missed Punch</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[13px] font-medium text-[#6B7280] mb-2">
                                                Check In Time
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={editForm.checkIn}
                                                onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                                                className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[14px] font-medium text-[#111827] outline-none focus:border-[#00A389] focus:ring-1 focus:ring-[#00A389] transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[13px] font-medium text-[#6B7280] mb-2">
                                                Check Out Time
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={editForm.checkOut}
                                                onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                                                className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[14px] font-medium text-[#111827] outline-none focus:border-[#00A389] focus:ring-1 focus:ring-[#00A389] transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-medium text-[#6B7280] mb-2">
                                            Reason for Override <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={editForm.reason}
                                            onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                            className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[14px] font-medium text-[#111827] outline-none focus:border-[#00A389] focus:ring-1 focus:ring-[#00A389] transition-all resize-none"
                                            rows="3"
                                            placeholder="Enter reason for manual override..."
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex-none p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                                <button
                                    onClick={() => setEditingAttendance(null)}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-[14px] font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving || !editForm.reason.trim()}
                                    className="flex-1 px-4 py-2 bg-[#00A389] text-white rounded-lg text-[14px] font-medium hover:bg-[#008b74] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                {/* Breakdown / Logs Modal */}
                {breakModal && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
                            onClick={() => setBreakModal(null)}
                        ></div>
                        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 text-[#111827]">

                            <div className="flex-none flex justify-between items-center p-5 border-b border-gray-100 z-20">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[14px]">
                                        {breakModal.employee?.firstName?.[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-[16px] font-semibold text-[#111827]">
                                            {breakModal.employee?.firstName} {breakModal.employee?.lastName}
                                        </h3>
                                        <p className="text-[13px] text-[#6B7280] mt-0.5">
                                            Activity Log
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setBreakModal(null)}
                                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-none p-4 bg-gray-50 border-b border-gray-100 z-10">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <span className="text-[12px] font-medium text-[#6B7280] mb-1 block">Total Sessions</span>
                                        <div className="text-[20px] font-semibold text-slate-900 flex items-center gap-2">
                                            <List size={18} className="text-[#00A389]" />
                                            {(() => {
                                                const logs = breakModal.logs || [];
                                                const ins = logs.filter(l => l.type === 'IN').length;
                                                return `${ins}`;
                                            })()}
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <span className="text-[12px] font-medium text-[#6B7280] mb-1 block">First Punch</span>
                                        <div className="text-[20px] font-semibold text-slate-900 flex items-center gap-2">
                                            <Clock size={18} className="text-[#00A389]" />
                                            {(() => {
                                                const logs = breakModal.logs || [];
                                                if (logs.length === 0) return '--:--';
                                                const sorted = [...logs].sort((a, b) => new Date(a.time) - new Date(b.time));
                                                return new Date(sorted[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 bg-white custom-scrollbar">
                                {breakModal.logs && breakModal.logs.length > 0 ? (
                                    <div className="relative pl-3 pb-2">
                                        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-200"></div>

                                        {(() => {
                                            const sortedLogs = [...breakModal.logs].sort((a, b) => new Date(a.time) - new Date(b.time));
                                            const sessions = [];
                                            let currentIn = null;

                                            sortedLogs.forEach(log => {
                                                if (log.type === 'IN') {
                                                    currentIn = log;
                                                } else if (log.type === 'OUT' && currentIn) {
                                                    sessions.push({ in: currentIn, out: log });
                                                    currentIn = null;
                                                }
                                            });
                                            if (currentIn) {
                                                sessions.push({ in: currentIn, out: null });
                                            }

                                            return sessions.map((session, idx) => {
                                                const inTime = new Date(session.in.time);
                                                const outTime = session.out ? new Date(session.out.time) : null;
                                                let durationStr = 'Active';

                                                if (outTime) {
                                                    const diffMs = outTime - inTime;
                                                    const hrs = Math.floor(diffMs / 3600000);
                                                    const mins = Math.floor((diffMs % 3600000) / 60000);
                                                    durationStr = `${hrs}h ${mins}m`;
                                                }

                                                return (
                                                    <div key={idx} className="relative pl-10 mb-6 last:mb-0">
                                                        <div className={`absolute left-[13px] top-6 w-3 h-3 rounded-full border-2 border-white z-10 shadow-sm ${outTime ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`}></div>

                                                        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                                                                <span className="text-[13px] font-semibold text-[#6B7280]">
                                                                    Session {idx + 1}
                                                                </span>
                                                                <span className={`text-[12px] font-semibold px-2 py-1 rounded bg-[#F8FAFC] text-[#6B7280] border border-gray-100`}>
                                                                    {durationStr}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[12px] font-medium text-[#6B7280] mb-1">Started</span>
                                                                    <div className="text-[16px] font-semibold text-slate-900">
                                                                        {inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                    <div className="text-[13px] text-[#6B7280] mt-0.5 truncate">
                                                                        {session.in.location || 'Office'}
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col text-right">
                                                                    <span className="text-[12px] font-medium text-[#6B7280] mb-1">Ended</span>
                                                                    <div className="text-[16px] font-semibold text-slate-900">
                                                                        {outTime ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                                    </div>
                                                                    <div className="text-[13px] text-[#6B7280] mt-0.5 truncate">
                                                                        {outTime ? (session.out?.location || 'Office') : 'Running...'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 text-center">
                                        <History size={32} className="text-gray-300 mb-3" />
                                        <span className="text-[14px] text-gray-500">No activity recorded for this date.</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-none p-4 bg-gray-50 border-t border-gray-100">
                                <button
                                    onClick={() => setBreakModal(null)}
                                    className="w-full py-2.5 bg-white border border-gray-200 text-[#111827] font-medium rounded-lg text-[14px] hover:bg-gray-50 transition-colors"
                                >
                                    Close Activity Log
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
            
            {/* Photo Preview Modal */}
            {previewImage.show && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{previewImage.title}</h3>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                                    {previewImage.employee ? `${previewImage.employee.firstName || ''} ${previewImage.employee.lastName || ''}`.trim() : ''}
                                </p>
                            </div>
                            <button 
                                onClick={() => setPreviewImage({ show: false, title: '', src: '', time: null, employee: null })}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            <img src={previewImage.src} alt={previewImage.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                            <span>Captured Time:</span>
                            <span>{previewImage.time ? new Date(previewImage.time).toLocaleTimeString() : ''}</span>
                        </div>
                    </div>
                </div>
            )}

            <AttendanceExcelUploadModal
                isOpen={uploadingPopup}
                onClose={() => setUploadingPopup(false)}
                onSuccess={() => {
                    setUploadingPopup(false);
                    fetchStats();
                }}
            />
        </>
    );
}
