import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Info,
  Send,
  History,
  ClipboardList,
  Plane,
  ShieldCheck
} from 'lucide-react';
import api from '../../utils/api';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import ClientMeetingTracker from '../../components/attendance/ClientMeetingTracker';
import ApplyLeaveForm from '../../components/ApplyLeaveForm';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { Pagination, Empty } from 'antd';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useRBAC } from '../../context/RBACContext';
import { isEmployeePendingActivation } from '../../utils/employeeProfile';

const SectionHeading = ({ title, subtitle }) => (
  <div className="mb-1.5">
    <h3 className="text-[14px] font-semibold text-[#334155] leading-tight mb-0.5">{title}</h3>
    {subtitle && <p className="text-[#64748B] text-[10px] font-medium opacity-80">{subtitle}</p>}
  </div>
);

const TabButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={clsx(
      "relative flex items-center gap-2 px-4 py-0.5 border-b-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98]",
      active
        ? "border-[#2563EB] text-[#1E40AF]"
        : "border-transparent text-[#64748B] hover:text-[#334155]"
    )}
  >
    <span>{label}</span>
  </button>
);

const SummaryCard = ({ label, value, icon: Icon, bgTint, textColor }) => (
  <div className="flex-1 bg-white p-2 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between transition-all hover:shadow-md group">
    <div className="flex flex-col">
      <span className="text-[#64748B] text-[9px] font-semibold uppercase tracking-wider mb-0.5">{label}</span>
      <span className={clsx("text-lg font-semibold leading-tight text-slate-900", textColor)}>{value}</span>
    </div>
    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-110", bgTint, textColor)}>
      <Icon size={16} />
    </div>
  </div>
);

const PolicyInsightCard = ({ policy }) => (
  <div
    className={clsx(
      'rounded-xl border p-1.5 shadow-sm transition-all hover:shadow-md w-[380px] h-[110px] overflow-hidden',
      policy?.isEffective ? 'border-[#BFDBFE] bg-[#F8FBFF]' : 'border-[#E2E8F0] bg-white'
    )}
  >
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5">
        <h4 className="text-[10px] font-semibold text-[#334155] truncate max-w-[100px]">{policy?.name || 'Leave Policy'}</h4>
        {policy?.isEffective && (
          <span className="bg-[#DBEAFE] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[#1D4ED8] rounded">Active</span>
        )}
      </div>
      <span className="text-[8px] font-medium uppercase text-[#64748B]">Scope: {policy?.applicableTo || 'All'}</span>
    </div>


    <div className="mt-1 grid grid-cols-3 gap-1">
      {(policy?.rules || []).map((rule, index) => {
        const total = Number(rule?.totalPerYear || 0);
        const available = rule?.balance?.available;
        const progressValue = rule?.balance ? Math.min(100, ((available || 0) / (total || 1)) * 100) : 100;

        return (
          <div key={`${policy?._id || policy?.name}-${rule?.leaveType || index}`} className="flex items-center gap-1 bg-white/80 p-0.5 rounded border border-slate-100">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: rule?.color || '#2563EB' }}
            />
            <span className="truncate text-[9px] font-semibold text-[#334155] w-8">{rule?.leaveType || 'Leave'}</span>
            <div className="flex-1 h-1 overflow-hidden rounded-full bg-slate-100 mx-1">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progressValue}%`, backgroundColor: rule?.color || '#2563EB' }}
              />
            </div>
            <span className="text-[8px] font-bold text-[#2563EB] whitespace-nowrap">
              {rule?.balance ? `${available || 0}/${total}` : `${total}y`}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default function AttendanceModule({
  profile,
  stats,
  isCheckedIn,
  isCheckedOut,
  todayRecord,
  attendance: initialAttendance,
  balances,
  leaves,
  handleClockInOut,
  clocking,
  hasLeavePolicy,
  leavePolicies = [],
  effectivePolicyId = null,
  fetchDashboardData,
  handleCancelLeave,
  editLeave,
  setEditLeave
}) {
  const { hasPermission, loading: permissionLoading } = useRBAC();
  const canOpenAttendance = hasPermission('employee.attendance', 'any');
  const canViewAttendance = hasPermission('employee.attendance', 'view');
  const canCreateAttendance = hasPermission('employee.attendance', 'create');
  const canEditAttendance = hasPermission('employee.attendance', 'edit');
  const canDeleteAttendance = hasPermission('employee.attendance', 'delete');
  const canApplyLeave = canCreateAttendance || canViewAttendance;
  const canSeeLeaveHistory = canViewAttendance || canEditAttendance || canDeleteAttendance;
  const canSeeRequestHistory = canViewAttendance || canEditAttendance || canDeleteAttendance;
  const onboardingPending = useMemo(() => isEmployeePendingActivation(profile), [profile]);
  const effectiveLeavePolicy = useMemo(() => {
    const policies = Array.isArray(leavePolicies) ? leavePolicies : [];
    return (
      policies.find((policy) => policy?.isEffective || String(policy?._id || '') === String(effectivePolicyId || '')) ||
      policies[0] ||
      profile?.leavePolicy ||
      null
    );
  }, [effectivePolicyId, leavePolicies, profile?.leavePolicy]);
  const location = useLocation();
  const navigate = useNavigate();
  
  const [earlyReturnModal, setEarlyReturnModal] = useState({ isOpen: false, leaveId: null, leaveData: null, newEndDate: '' });
  const [isEarlyReturning, setIsEarlyReturning] = useState(false);

  const handleEarlyReturnSubmit = async () => {
    if (!earlyReturnModal.newEndDate) return;
    try {
      setIsEarlyReturning(true);
      await api.post(`/employee/leaves/early-return/${earlyReturnModal.leaveId}`, { newEndDate: earlyReturnModal.newEndDate });
      setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: '' });
      fetchDashboardData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Failed to process early return");
    } finally {
      setIsEarlyReturning(false);
    }
  };
  const availableTabs = useMemo(() => [
    canViewAttendance ? 'attendance' : null,
    (canApplyLeave || canSeeLeaveHistory) ? 'leaves' : null,
    (canCreateAttendance || canSeeRequestHistory) ? 'requests' : null,
  ].filter(Boolean), [canViewAttendance, canCreateAttendance, canApplyLeave, canSeeLeaveHistory, canSeeRequestHistory]);
  const [activeTab, setActiveTab] = useState(availableTabs[0] || 'attendance');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && availableTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!tabParam && availableTabs.length > 0) {
      setActiveTab(availableTabs[0]);
    }
  }, [location.search, availableTabs]);

  // Tab State
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [settings, setSettings] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Requests Tab State
  const [requests, setRequests] = useState([]);
  const [requestForm, setRequestForm] = useState({
    startDate: '',
    endDate: '',
    checkIn: '',
    checkOut: '',
    reason: ''
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Effects
  useEffect(() => {
    if (permissionLoading || !canOpenAttendance || onboardingPending) return;
    if (activeTab === 'attendance') {
      fetchMonthlyData();
    } else if (activeTab === 'requests') {
      fetchRequestHistory();
    }
  }, [activeTab, currentMonth, currentYear, canOpenAttendance, canViewAttendance, canSeeRequestHistory, permissionLoading, onboardingPending]);

  useEffect(() => {
    if (!availableTabs.length) return;
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  const fetchMonthlyData = async () => {
    if (!canViewAttendance) return;
    try {
      setLoadingAttendance(true);
      const [attRes, holidayRes, settingsRes] = await Promise.all([
        api.get(`/attendance/my?month=${currentMonth + 1}&year=${currentYear}`),
        api.get('/holidays'),
        api.get('/attendance/settings')
      ]);
      setMonthlyAttendance(attRes.data || []);
      setHolidays(holidayRes.data || []);
      setSettings(settingsRes.data || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const fetchRequestHistory = async () => {
    if (!canSeeRequestHistory) return;
    try {
      const res = await api.get('/employee/regularization/my');
      setRequests(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!canCreateAttendance) return;
    if (!requestForm.startDate || !requestForm.reason) return;

    try {
      setSubmittingRequest(true);
      const payload = {
        category: 'Attendance',
        startDate: requestForm.startDate,
        endDate: requestForm.endDate || requestForm.startDate,
        issueType: 'Regularization',
        reason: requestForm.reason,
        requestedData: {
          checkIn: requestForm.checkIn ? `${requestForm.startDate}T${requestForm.checkIn}:00` : null,
          checkOut: requestForm.checkIn ? `${requestForm.startDate}T${requestForm.checkIn}:00` : null,
          punchIn: requestForm.checkIn ? `${requestForm.startDate}T${requestForm.checkIn}:00` : null,
          punchOut: requestForm.checkOut ? `${requestForm.startDate}T${requestForm.checkOut}:00` : null
        }
      };
      await api.post('/employee/regularization', payload);
      alert('Correction request submitted successful.');
      setRequestForm({ startDate: '', endDate: '', checkIn: '', checkOut: '', reason: '' });
      fetchRequestHistory();
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || 'pending';
    const base = "inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 ";

    if (s === 'approved') return (
      <span className={base + "text-[#16A34A]"}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></div>
        Approved
      </span>
    );
    if (s === 'rejected' || s === 'cancelled') return (
      <span className={base + "text-[#DC2626]"}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></div>
        {s === 'rejected' ? 'Rejected' : 'Cancelled'}
      </span>
    );
    return (
      <span className={base + "text-[#F59E0B]"}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse"></div>
        Pending
      </span>
    );
  };

  if (permissionLoading) {
    return null;
  }

  if (!canOpenAttendance) {
    return (
      <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
        <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-[20px] font-semibold text-slate-900">Attendance Access Restricted</h3>
          <p className="mt-2 text-xs font-medium text-[#64748B]">
            You do not currently have permission to open attendance data for this workspace.
          </p>
        </div>
      </div>
    );
  }

  if (onboardingPending) {
    return (
      <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
        <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <ShieldCheck size={28} />
          </div>
          <h3 className="text-[20px] font-semibold text-slate-900">Finish Onboarding First</h3>
          <p className="mt-2 text-xs font-medium text-[#64748B]">
            Attendance, leave history, and regularization will unlock after HR completes your account activation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full bg-white font-inter flex flex-col">
      <div className="w-full flex min-h-0 flex-1 flex-col">

        {/* Tabs Portaled to Header */}
        {createPortal(
          <div className="flex flex-row items-center justify-start ml-2">
            <div className="flex">
              {canViewAttendance && (
                <TabButton
                  active={activeTab === 'attendance'}
                  label="Attendance"
                  onClick={() => navigate('/employee/attendance?tab=attendance')}
                />
              )}
              {(canApplyLeave || canSeeLeaveHistory) && (
                <TabButton
                  active={activeTab === 'leaves'}
                  label="Leaves"
                  onClick={() => navigate('/employee/attendance?tab=leaves')}
                />
              )}
              {(canCreateAttendance || canSeeRequestHistory) && (
                <TabButton
                  active={activeTab === 'requests'}
                  label="Requests"
                  onClick={() => navigate('/employee/attendance?tab=requests')}
                />
              )}
            </div>
          </div>,
          document.getElementById('hr-header-portal-target') || document.body
        )}

        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth transition-all duration-300 [scrollbar-gutter:stable] p-4">

          {/* --- ATTENDANCE TAB --- */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Metrics Row - Sticky */}
              <div className="sticky top-[-16px] z-20 -mx-4 px-4 pt-1 pb-4 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SummaryCard label="Present Days" value={stats.presentDays} icon={CheckCircle} bgTint="bg-[#ECFDF5]" textColor="text-[#16A34A]" />
                  <SummaryCard label="Absent Days" value={stats.absentDayCount || 0} icon={AlertCircle} bgTint="bg-[#FEF2F2]" textColor="text-[#DC2626]" />
                  <SummaryCard label="Leaves Taken" value={stats.leavesTaken} icon={Plane} bgTint="bg-[#EFF6FF]" textColor="text-[#2563EB]" />
                </div>
              </div>

              {/* Shift Information Banner */}
              {settings?.effectiveShift && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100/50 shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-blue-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{settings.effectiveShift.name}</h3>
                      <p className="text-xs font-medium text-slate-500">Your currently assigned shift schedule</p>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-sm font-bold text-slate-700">
                        {settings.effectiveShift.startTime} to {settings.effectiveShift.endTime}
                      </span>
                      {settings.effectiveShift.isNightShift && (
                        <span className="ml-2 text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Night Shift</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <ClientMeetingTracker
                isCheckedIn={isCheckedIn}
                isCheckedOut={isCheckedOut}
                todayRecord={todayRecord}
                fetchDashboardData={fetchDashboardData}
              />

              <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-4">
                  <AttendanceCalendar
                    data={monthlyAttendance}
                    holidays={holidays}
                    leaves={leaves}
                    settings={settings}
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                    headerControls={
                      <div className="flex items-center gap-0.5 bg-slate-50 px-0.5 py-0.5 rounded-lg border border-[#E2E8F0]">
                        <button onClick={() => setCurrentYear(y => y - 1)} className="flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90">
                          <div className="flex items-center -space-x-2">
                            <ChevronLeft size={12} />
                            <ChevronLeft size={12} />
                          </div>
                        </button>
                        <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); }} className="flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90"><ChevronLeft size={13} /></button>
                        <span className="text-xs font-semibold text-[#334155] w-18 text-center uppercase tracking-wider">{dayjs(new Date(currentYear, currentMonth)).format('MMM YYYY')}</span>
                        <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); }} className="flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90"><ChevronRight size={13} /></button>
                        <button onClick={() => setCurrentYear(y => y + 1)} className="flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90">
                          <div className="flex items-center -space-x-2">
                            <ChevronRight size={12} />
                            <ChevronRight size={12} />
                          </div>
                        </button>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* --- LEAVES TAB --- */}
          {activeTab === 'leaves' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-3 duration-500">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionHeading title="Leave Balances" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {balances.map((b, i) => {
                    const typeLeaves = leaves.filter(l => l.leaveType === b.leaveType);
                    const used = typeLeaves.filter(l => l.status?.toLowerCase() === 'approved').reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
                    const pending = typeLeaves.filter(l => l.status?.toLowerCase() === 'pending').reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
                    const remaining = b.available || 0;
                    const total = b.total || (used + remaining);
                    
                    const colors = { 
                      text: 'text-slate-600', 
                      bg: 'bg-slate-50/50', 
                      border: 'border-slate-100/50', 
                      accent: 'bg-slate-400' 
                    };

                    return (
                      <div key={b.leaveType || i} className={clsx("bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-all group relative overflow-hidden", colors.border)}>
                        {/* Accent Bar */}
                        <div className={clsx("absolute top-0 left-0 w-1 h-full", colors.accent)} />
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{b.leaveType}</span>
                          {remaining === 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-400">Exhausted</span>
                          ) : (
                            <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-md", colors.bg, colors.text)}>Available</span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-1.5 mb-4">
                          <span className="text-2xl font-black text-slate-800 leading-none">{remaining}</span>
                          <span className="text-xs font-bold text-slate-400">Units</span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                            <span className="text-[8px] font-black text-slate-400 uppercase">Tot</span>
                            <span className="text-xs font-bold text-slate-700">{total}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-emerald-50/50 px-2 py-1 rounded-md">
                            <span className="text-[8px] font-black text-emerald-400 uppercase">Use</span>
                            <span className="text-xs font-bold text-emerald-600">{used}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-amber-50/50 px-2 py-1 rounded-md">
                            <span className="text-[8px] font-black text-amber-400 uppercase">Wait</span>
                            <span className={clsx("text-xs font-bold", pending > 0 ? "text-amber-500" : "text-slate-300")}>{pending}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Apply Form */}
                {canApplyLeave && (
                  <div className="lg:col-span-5">
                    <SectionHeading title="Apply for Leave" />
                    <ApplyLeaveForm
                      balances={balances}
                      existingLeaves={leaves}
                      editData={editLeave}
                      onSuccess={() => { setEditLeave(null); fetchDashboardData(); }}
                      onCancelEdit={() => setEditLeave(null)}
                      profile={profile}
                      leavePolicy={effectiveLeavePolicy}
                      hasLeavePolicy={hasLeavePolicy}
                    />
                  </div>
                )}

                {/* History */}
                <div className={clsx("lg:col-span-7", !canApplyLeave && "lg:col-span-12")}>
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeading title="Leave Activity" />
                    <span className="text-xs font-medium text-[#64748B] bg-slate-100 px-3 py-1 rounded-full">{leaves.length} Total</span>
                  </div>

                  <div className="space-y-3">
                    {!canSeeLeaveHistory ? (
                      <div className="bg-white border border-dashed border-[#E2E8F0] rounded-xl py-16 flex flex-col items-center justify-center text-center">
                        <AlertCircle size={28} className="mb-1.5 text-slate-300" />
                        <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">History hidden by access control</p>
                      </div>
                    ) : leaves.length > 0 ? (
                      [...leaves].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map((leave, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-6 hover:shadow-md transition-all duration-300">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center text-[#334155]">
                              <span className="text-[9px] uppercase font-semibold text-[#64748B] opacity-60 leading-none mb-1">{dayjs(leave.startDate).format('MMM')}</span>
                              <span className="text-[18px] font-semibold leading-none">{dayjs(leave.startDate).format('DD')}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="text-xs font-bold text-[#334155]">{leave.leaveType}</h4>
                                {leave.isHalfDay && leave.halfDaySession && (
                                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                    {leave.halfDaySession}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#64748B]">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon size={12} className="opacity-40" />
                                  {formatDateDDMMYYYY(leave.startDate)} {leave.endDate && leave.endDate !== leave.startDate ? `→ ${formatDateDDMMYYYY(leave.endDate)}` : ''}
                                </div>
                                <span className="text-[#2563EB] font-semibold tracking-tight">
                                  {leave.daysCount} <span className="text-[8px] font-medium uppercase opacity-60 ml-0.5">{leave.daysCount === 1 ? 'Day' : 'Days'}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end gap-1 px-2">
                              {getStatusBadge(leave.status)}
                              {(leave.approvedAt || leave.rejectedAt || leave.cancelledAt) && (
                                <span className="text-[9px] font-semibold text-slate-400 opacity-60 uppercase tracking-tighter mt-0.5">
                                  {dayjs(leave.approvedAt || leave.rejectedAt || leave.cancelledAt).format('DD-MM-YYYY HH:mm')}
                                </span>
                              )}
                            </div>
                            {canDeleteAttendance && leave.status?.toLowerCase() === 'pending' && (
                              <button onClick={() => handleCancelLeave?.(leave._id)} className="w-9 h-9 flex items-center justify-center bg-[#FEF2F2] text-[#DC2626] rounded-lg hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95" title="Cancel Request">
                                <XCircle size={18} />
                              </button>
                            )}
                            {canEditAttendance && leave.status === 'Approved' && dayjs().isBefore(dayjs(leave.endDate).endOf('day')) && (
                               <button 
                                 onClick={() => setEarlyReturnModal({ isOpen: true, leaveId: leave._id, leaveData: leave, newEndDate: dayjs().format('YYYY-MM-DD') })} 
                                 className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                                 title="Early Return / Partial Cancel"
                               >
                                 <History size={16} />
                               </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white border border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center py-20">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[#64748B] text-xs font-medium">No records found</span>} />
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
      )}

          {/* --- REQUESTS TAB --- */}
          {activeTab === 'requests' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in slide-in-from-bottom-3 duration-500">
              {/* Form */}
              {canCreateAttendance && (
                <div className="lg:col-span-5">
                  <SectionHeading title="Regularization" />
                  <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
                    <form onSubmit={handleRequestSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[#64748B]">Target Date *</label>
                          <input
                            type="date"
                            required
                            max={dayjs().format('YYYY-MM-DD')}
                            className="w-full h-[40px] bg-white border border-[#E2E8F0] rounded-lg px-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all"
                            value={requestForm.startDate}
                            onChange={e => setRequestForm({ ...requestForm, startDate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[#64748B]">Category</label>
                          <div className="h-[40px] flex items-center px-4 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#64748B] tracking-wide uppercase opacity-60">Attendance Log</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[#64748B]">Punch In</label>
                          <input
                            type="time"
                            className="w-full h-[40px] bg-white border border-[#E2E8F0] rounded-lg px-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all"
                            value={requestForm.checkIn}
                            onChange={e => setRequestForm({ ...requestForm, checkIn: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[#64748B]">Punch Out</label>
                          <input
                            type="time"
                            className="w-full h-[40px] bg-white border border-[#E2E8F0] rounded-lg px-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all"
                            value={requestForm.checkOut}
                            onChange={e => setRequestForm({ ...requestForm, checkOut: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[#64748B]">Justification Reason *</label>
                        <textarea
                          required
                          placeholder="Why is this correction needed?..."
                          className="w-full bg-slate-50 border border-[#E2E8F0] rounded-lg p-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all min-h-[120px] resize-none"
                          value={requestForm.reason}
                          onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })}
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={submittingRequest}
                          className="w-full h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 shadow-sm shadow-blue-500/10"
                        >
                          {submittingRequest ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Send size={16} />
                              <span>Submit Adjustment</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* History */}
              <div className={clsx("lg:col-span-7", !canCreateAttendance && "lg:col-span-12")}>
                <div className="flex items-center justify-between mb-2">
                  <SectionHeading title="Adjustment Log" />
                  <span className="text-xs font-medium text-[#64748B] bg-slate-100 px-3 py-1 rounded-full">{requests.length} Total</span>
                </div>

                <div className="space-y-3">
                  {!canSeeRequestHistory ? (
                    <div className="bg-white p-12 rounded-xl border border-dashed border-[#E2E8F0] flex flex-col items-center justify-center opacity-60">
                      <History size={32} className="mb-2 text-slate-300" />
                      <span className="text-xs font-medium uppercase">History hidden by access control</span>
                    </div>
                  ) : requests.length > 0 ? (
                    requests.map((req, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between transition-all duration-200 hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center text-[#334155]">
                            <span className="text-[9px] uppercase font-semibold text-[#64748B] opacity-60 leading-none mb-1">{dayjs(req.startDate).format('MMM')}</span>
                            <span className="text-[18px] font-semibold leading-none">{dayjs(req.startDate).format('DD')}</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#334155] mb-0.5">{formatDateDDMMYYYY(req.startDate)}</h4>
                            <p className="text-xs text-[#64748B] font-medium line-clamp-1 max-w-[240px]">"{req.reason}"</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(req.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white p-12 rounded-xl border border-dashed border-[#E2E8F0] flex flex-col items-center justify-center opacity-40">
                      <History size={32} className="mb-2 text-slate-300" />
                      <span className="text-xs font-medium uppercase">No history</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Early Return Modal */}
      {earlyReturnModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Early Return / Cancel Leave</h3>
              <button onClick={() => setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: '' })} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-amber-700 leading-relaxed">
                  If you have returned to work earlier than expected, select your new End Date below. Your unused leave balance will be automatically refunded, and your attendance records will be cleared.
                  <br/><br/>
                  <span className="font-bold">Note: To fully cancel this leave and refund all days, click the 'Full Cancel' button below.</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">New End Date</label>
                <input 
                  type="date" 
                  min={dayjs(earlyReturnModal.leaveData.startDate).format('YYYY-MM-DD')}
                  max={dayjs(earlyReturnModal.leaveData.endDate).format('YYYY-MM-DD')}
                  className="w-full h-[42px] px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  value={earlyReturnModal.newEndDate}
                  onChange={(e) => setEarlyReturnModal({ ...earlyReturnModal, newEndDate: e.target.value })}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end items-center">
              <button 
                onClick={async () => {
                   try {
                     setIsEarlyReturning(true);
                     const fullCancelDate = dayjs(earlyReturnModal.leaveData.startDate).subtract(1, 'day').format('YYYY-MM-DD');
                     await api.post(`/employee/leaves/early-return/${earlyReturnModal.leaveId}`, { newEndDate: fullCancelDate });
                     setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: '' });
                     fetchDashboardData();
                   } catch(err) {
                     alert("Failed to fully cancel leave");
                   } finally {
                     setIsEarlyReturning(false);
                   }
                }}
                disabled={isEarlyReturning}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all mr-auto"
              >
                Full Cancel
              </button>
              <button onClick={() => setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: '' })} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">Cancel</button>
              <button 
                onClick={handleEarlyReturnSubmit} 
                disabled={isEarlyReturning || !earlyReturnModal.newEndDate}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
              >
                {isEarlyReturning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={14} />}
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
);
}
