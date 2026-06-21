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
  ShieldCheck,
  DollarSign
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
  balances,
  leaves,
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
  
  const [earlyReturnModal, setEarlyReturnModal] = useState({ isOpen: false, leaveId: null, leaveData: null, newEndDate: '' });
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isEarlyReturning, setIsEarlyReturning] = useState(false);

  // Encashment sub-tab state
  const [leavesSubTab, setLeavesSubTab] = useState('apply'); // 'apply' | 'encashment'
  const [encashConfig, setEncashConfig] = useState(null);
  const [basicSalary, setBasicSalary] = useState(0);
  const [encashRequests, setEncashRequests] = useState([]);
  const [encashLoading, setEncashLoading] = useState(false);
  const [encashForm, setEncashForm] = useState({ days: '', reason: '' });
  const [encashSubmitting, setEncashSubmitting] = useState(false);
  const [encashCancelling, setEncashCancelling] = useState(null);

  // Fetch encashment config when activeTab is 'leaves' (so we can render the sub-tab toggle)
  useEffect(() => {
    if (activeTab !== 'leaves') return;
    const fetchConfig = async () => {
      try {
        const cfgRes = await api.get('/employee/leaves/encashment/config');
        setEncashConfig(cfgRes.data?.config || null);
        if (cfgRes.data?.basicSalary) {
          setBasicSalary(cfgRes.data.basicSalary);
        }
      } catch (e) {
        console.error('[encashment] fetch config error:', e);
      }
    };
    fetchConfig();
  }, [activeTab]);

  // Fetch encashment requests when sub-tab is 'encashment'
  useEffect(() => {
    if (activeTab !== 'leaves' || leavesSubTab !== 'encashment') return;
    const fetchRequests = async () => {
      setEncashLoading(true);
      try {
        const reqRes = await api.get('/employee/leaves/encashment/requests');
        setEncashRequests(reqRes.data?.requests || []);
      } catch (e) {
        console.error('[encashment] fetch requests error:', e);
      } finally {
        setEncashLoading(false);
      }
    };
    fetchRequests();
  }, [activeTab, leavesSubTab]);

  const handleEncashSubmit = async (e) => {
    e.preventDefault();
    setEncashSubmitting(true);
    try {
      await api.post('/employee/leaves/encashment/requests', {
        requestedDays: parseInt(encashForm.days),
        reason: encashForm.reason
      });
      setEncashForm({ days: '', reason: '' });
      // Refresh requests
      const reqRes = await api.get('/employee/leaves/encashment/requests');
      setEncashRequests(reqRes.data?.requests || []);
      alert('Encashment request submitted successfully! HR will review it.');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to submit encashment request.');
    } finally {
      setEncashSubmitting(false);
    }
  };

  const handleEncashCancel = async (requestId) => {
    setEncashCancelling(requestId);
    try {
      await api.post(`/employee/leaves/encashment/requests/${requestId}/cancel`);
      const reqRes = await api.get('/employee/leaves/encashment/requests');
      setEncashRequests(reqRes.data?.requests || []);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to cancel request.');
    } finally {
      setEncashCancelling(null);
    }
  };


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


  // Tab State
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [settings, setSettings] = useState({});
  const [_loadingAttendance, setLoadingAttendance] = useState(false);

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

            {/* Sub-tab toggle for Apply / Encashment */}
            {encashConfig?.allowed && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setLeavesSubTab('apply')}
                  className={clsx("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all", 
                    leavesSubTab === 'apply' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300')}
                >
                  <Plane size={12} /> Apply Leave
                </button>
                <button
                  onClick={() => setLeavesSubTab('encashment')}
                  className={clsx("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                    leavesSubTab === 'encashment' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300')}
                >
                  <DollarSign size={12} /> Leave Encashment
                </button>
              </div>
            )}

            {leavesSubTab === 'apply' && (
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
                        <div key={i} onClick={() => setSelectedLeave(leave)} className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-6 hover:shadow-md transition-all duration-300 cursor-pointer">
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
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelLeave?.(leave._id);
                                }} 
                                className="w-9 h-9 flex items-center justify-center bg-[#FEF2F2] text-[#DC2626] rounded-lg hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95" 
                                title="Cancel Request"
                              >
                                <XCircle size={18} />
                              </button>
                            )}
                            {canEditAttendance && leave.status === 'Approved' && dayjs().isBefore(dayjs(leave.endDate).endOf('day')) && (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setEarlyReturnModal({ isOpen: true, leaveId: leave._id, leaveData: leave, newEndDate: dayjs().format('YYYY-MM-DD') });
                                 }} 
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
            )}

            {leavesSubTab === 'encashment' && encashConfig?.allowed && (
              <div className="space-y-6 animate-in slide-in-from-bottom-3 duration-300">
                {encashLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold">Loading...</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Apply Form */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Policy Info Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Info size={14} className="text-indigo-500"/> Encashment Policy details
                        </h3>
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Allowed Leave Type</span>
                            <span className="font-black text-indigo-700">{encashConfig.leaveType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Max Encashable Days/Year</span>
                            <span className="font-black text-indigo-700">{encashConfig.maxEncashableDays} Days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Min Balance to Retain</span>
                            <span className="font-black text-indigo-700">{encashConfig.minBalanceRetain} Days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Formula</span>
                            <span className="font-black text-indigo-700">{encashConfig.formula}</span>
                          </div>
                          {encashConfig.taxRule && (
                            <div className="flex justify-between border-t border-indigo-100/50 pt-2 mt-2">
                              <span className="text-slate-500">Tax Rule</span>
                              <span className="font-black text-slate-700">{encashConfig.taxRule}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Request Form */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign size={14} className="text-indigo-500"/> Request Encashment
                        </h3>
                        
                        {(() => {
                          const encashableBalance = balances.find(b => b.leaveType === encashConfig.leaveType.toUpperCase());
                          const availableDays = encashableBalance ? (encashableBalance.available || 0) : 0;
                          const daysNum = parseInt(encashForm.days) || 0;

                          const validationError = (() => {
                            if (daysNum <= 0) return null;
                            if (daysNum > (encashConfig?.maxEncashableDays || 0)) {
                              return `Maximum encashable days is ${encashConfig?.maxEncashableDays}.`;
                            }
                            if (availableDays - daysNum < (encashConfig?.minBalanceRetain || 0)) {
                              return `You must retain at least ${encashConfig?.minBalanceRetain} days of ${encashConfig?.leaveType} balance. (Current: ${availableDays}, Retained: ${availableDays - daysNum})`;
                            }
                            return null;
                          })();

                          const payoutAmount = daysNum > 0 && basicSalary > 0 
                            ? Math.round((basicSalary / 30) * daysNum)
                            : 0;

                          return (
                            <form onSubmit={handleEncashSubmit} className="space-y-4">
                              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex items-center justify-between text-xs">
                                <span className="text-slate-500">Your {encashConfig.leaveType} Balance:</span>
                                <span className="font-black text-emerald-600">{availableDays} Days</span>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Days to Encash *</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={encashConfig?.maxEncashableDays || 30}
                                  value={encashForm.days}
                                  onChange={e => setEncashForm(prev => ({ ...prev, days: e.target.value }))}
                                  placeholder={`Max ${encashConfig?.maxEncashableDays || 0} days`}
                                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                  required
                                />
                              </div>

                              {/* Live payout preview */}
                              {daysNum > 0 && (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-xs">Estimated Payout:</span>
                                    <span className="text-sm font-black text-emerald-700">₹{payoutAmount.toLocaleString()}</span>
                                  </div>
                                  {basicSalary > 0 && (
                                    <p className="text-[10px] text-slate-400 font-medium leading-normal">
                                      Calculation: ₹{basicSalary.toLocaleString()} (Basic) ÷ 30 × {daysNum} Days = ₹{payoutAmount.toLocaleString()}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-slate-400 italic">Exact payout will be verified and approved by HR.</p>
                                </div>
                              )}

                              {validationError && (
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] font-semibold text-rose-600 flex items-start gap-2">
                                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                  <span>{validationError}</span>
                                </div>
                              )}

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason (Optional)</label>
                                <textarea
                                  rows={2}
                                  value={encashForm.reason}
                                  onChange={e => setEncashForm(prev => ({ ...prev, reason: e.target.value }))}
                                  placeholder="Provide a reason for encashment request..."
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-500 transition-all resize-none"
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={encashSubmitting || !!validationError || daysNum <= 0}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {encashSubmitting ? 'Submitting...' : 'Submit Encashment Request'}
                              </button>
                            </form>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right: Request History */}
                    <div className="lg:col-span-7">
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <History size={14} className="text-indigo-500"/> My Encashment Requests
                        </h3>
                        {encashRequests.length === 0 ? (
                          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                            <span className="text-3xl mb-2">💰</span>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No encashment requests yet</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {encashRequests.map(req => {
                              const statusColor = { 
                                Pending: 'bg-amber-50 text-amber-600 border-amber-100', 
                                Approved: 'bg-emerald-50 text-emerald-600 border-emerald-100', 
                                Rejected: 'bg-rose-50 text-rose-600 border-rose-100', 
                                Cancelled: 'bg-slate-100 text-slate-500 border-slate-200' 
                              }[req.status] || 'bg-slate-100 text-slate-500 border-slate-200';
                              return (
                                <div key={req._id} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-200 transition-all">
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-slate-800 text-xs">{req.requestedDays} Days ({req.leaveType})</span>
                                      <span className={clsx("px-2 py-0.5 rounded text-[9px] font-black uppercase border", statusColor)}>
                                        {req.status}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                      <div>Available: <span className="font-bold text-slate-700">{req.availableBalance} Days</span></div>
                                      <div>Payout: <span className="font-bold text-emerald-600">₹{(req.payoutAmount || 0).toLocaleString()}</span></div>
                                      {req.reason && <div className="col-span-2 text-slate-400 italic truncate mt-0.5">Reason: "{req.reason}"</div>}
                                      {req.adminRemark && <div className="col-span-2 text-indigo-600 font-semibold mt-0.5">HR Remark: "{req.adminRemark}"</div>}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                      Requested on: {dayjs(req.createdAt).format('DD-MM-YYYY HH:mm')}
                                    </div>
                                  </div>
                                  {req.status === 'Pending' && (
                                    <button
                                      onClick={() => handleEncashCancel(req._id)}
                                      disabled={encashCancelling === req._id}
                                      className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-[10px] font-black text-rose-500 uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                      {encashCancelling === req._id ? '...' : 'Cancel'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                   } catch {
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

      {/* ─── Leave Request Details Modal ─────────────────────────────── */}
      {selectedLeave && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0 font-inter">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                  <FileText size={16} className="text-indigo-650" />
                  Leave Request Details
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  REQ-{selectedLeave._id?.slice(-6).toUpperCase()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedLeave(null)} 
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all active:scale-95 animate-in fade-in"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 font-inter text-xs">
              {/* Status and Leave Type Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Leave Category</span>
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black rounded">{selectedLeave.leaveType}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Status</span>
                  {getStatusBadge(selectedLeave.status, selectedLeave.meta)}
                </div>
              </div>

              {/* Dates & Duration */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration Details</span>
                <div className="bg-white border border-slate-150 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50/50 flex items-center justify-center text-indigo-600">
                      <CalendarIcon size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {formatDateDDMMYYYY(selectedLeave.startDate)} {selectedLeave.endDate && selectedLeave.endDate !== selectedLeave.startDate ? `→ ${formatDateDDMMYYYY(selectedLeave.endDate)}` : ''}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Applied on {selectedLeave.createdAt ? dayjs(selectedLeave.createdAt).format('DD-MM-YYYY HH:mm') : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[#2563EB]">
                      {selectedLeave.daysCount} {selectedLeave.daysCount === 1 ? 'Day' : 'Days'}
                    </span>
                    {selectedLeave.isHalfDay && (
                      <span className="block text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded mt-1 uppercase tracking-wider">
                        {(() => {
                          const custom = selectedLeave.meta?.customHalfDays;
                          if (custom && selectedLeave.startDate !== selectedLeave.endDate) {
                            if (custom.firstDayHalf && custom.lastDayHalf) return 'Half (Both Days)';
                            if (custom.firstDayHalf) return `Half (First: ${custom.firstDaySession.split(' ')[0]})`;
                            if (custom.lastDayHalf) return `Half (Last: ${custom.lastDaySession.split(' ')[0]})`;
                          }
                          return selectedLeave.halfDaySession || 'Half Day';
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reason / Justification */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Justification / Reason</span>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium text-slate-750 leading-relaxed min-h-[60px] whitespace-pre-line">
                  {selectedLeave.reason || <span className="text-slate-400 italic">No reason provided</span>}
                </div>
              </div>

              {/* Leave Balances Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Leave Balance</span>
                <div className="grid grid-cols-1 gap-2">
                  {balances.filter(b => String(b.leaveType).toUpperCase() === String(selectedLeave.leaveType).toUpperCase()).map(b => (
                    <div key={b.leaveType} className="p-2.5 rounded-xl border text-center transition-all bg-indigo-50/20 border-indigo-200">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{b.leaveType}</div>
                      <div className="text-xs font-extrabold text-slate-800 mt-0.5">{b.available} <span className="text-[9px] font-bold text-slate-400 uppercase">Avail</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medical Certificate */}
              {selectedLeave.medicalCertUrl && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Medical Certificate</span>
                  <a 
                    href={selectedLeave.medicalCertUrl.startsWith('http') ? selectedLeave.medicalCertUrl : `http://localhost:5009${selectedLeave.medicalCertUrl}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 border border-emerald-200 hover:border-emerald-400 bg-emerald-50/20 text-emerald-700 text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    <FileText size={14} />
                    <span>View Medical Certificate</span>
                  </a>
                </div>
              )}

              {/* History log/Workflow Details */}
              {(selectedLeave.approvedAt || selectedLeave.rejectedAt || selectedLeave.cancelledAt) && (
                <div className="border-t border-slate-100 pt-4 space-y-2 text-[11px] text-slate-500">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Action Trail</span>
                  <div className="space-y-1.5 bg-slate-50/30 border border-slate-100 p-3 rounded-xl">
                    <div>
                      <span className="font-bold text-slate-700">Action: </span>
                      <span className={clsx(
                        "font-bold uppercase",
                        selectedLeave.status === 'Approved' && 'text-[#16A34A]',
                        (selectedLeave.status === 'Rejected' || selectedLeave.status === 'Cancelled') && 'text-[#DC2626]'
                      )}>{selectedLeave.status}</span>
                    </div>
                    {selectedLeave.actionBy && (
                      <div>
                        <span className="font-bold text-slate-700">Processed By: </span>
                        <span className="font-medium">{selectedLeave.actionBy.firstName} {selectedLeave.actionBy.lastName}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-700">Processed On: </span>
                      <span className="font-medium">
                        {dayjs(selectedLeave.approvedAt || selectedLeave.rejectedAt || selectedLeave.cancelledAt).format('DD-MM-YYYY HH:mm')}
                      </span>
                    </div>
                    {selectedLeave.rejectionReason && (
                      <div className="text-rose-600 bg-rose-50/50 p-2 rounded border border-rose-100 mt-1 font-medium">
                        <span className="font-bold text-rose-700">Rejection Reason:</span> {selectedLeave.rejectionReason}
                      </div>
                    )}
                    {selectedLeave.adminRemark && (
                      <div className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1 font-medium">
                        <span className="font-bold text-slate-700">Admin Remarks:</span> {selectedLeave.adminRemark}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Early Return request info */}
              {selectedLeave.meta?.earlyReturnRequest && (
                <div className="border-t border-slate-100 pt-4 space-y-2 text-[11px]">
                  <span className="text-[10px] font-bold text-purple-655 uppercase tracking-wider block">Early Return Request Details</span>
                  <div className="bg-purple-50/30 border border-purple-100 p-3 rounded-xl space-y-1.5">
                    <div>
                      <span className="font-bold text-purple-700">Proposed Return Date: </span>
                      <span className="font-bold text-slate-800">
                        {dayjs(selectedLeave.meta.earlyReturnRequest.actualReturnDate).format('DD-MM-YYYY')}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-purple-700">Request Status: </span>
                      <span className="font-bold uppercase text-purple-600">
                        {selectedLeave.meta.earlyReturnRequest.status}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-purple-700">Reason: </span>
                      <span className="font-medium text-slate-750">{selectedLeave.meta.earlyReturnRequest.reason}</span>
                    </div>
                    {selectedLeave.meta.earlyReturnRequest.comments && (
                      <div>
                        <span className="font-bold text-purple-700">Comments: </span>
                        <span className="font-medium text-slate-650">{selectedLeave.meta.earlyReturnRequest.comments}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
