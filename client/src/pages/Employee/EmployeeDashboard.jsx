import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { Pagination } from 'antd';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import { useOutletContext, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { UIContext } from '../../context/UIContext';
import {
  FileText, Edit2, X, Calendar as CalendarIcon, Clock, CheckCircle,
  AlertCircle, RefreshCw, LogIn, LogOut, Briefcase, ChevronRight, Info,
  TrendingUp, Activity, Bell, Layers, User, Zap, ShieldCheck, Cpu
} from 'lucide-react';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateUtils';
import Toast from '../../components/common/Toast';
import RegularizationRequest from '../Leaves/RegularizationRequest';
import ApplyLeaveForm from '../../components/ApplyLeaveForm';
import AttendanceClock from '../../components/AttendanceClock';
import LeaveApprovals from '../HR/LeaveApprovals';
import RegularizationApprovals from '../HR/RegularizationApprovals';
import EmployeeProfileView from '../../components/EmployeeProfileView';
import MyAttendanceView from '../../components/MyAttendanceView';
import TeamAttendanceView from '../../components/TeamAttendanceView';
import ReportingTree from '../../components/ReportingTree';

import ESSPayslips from '../ESS/Payslips';
import InternalJobs from './InternalJobs';
import MyApplications from './MyApplications';
import FaceAttendance from './FaceAttendance';
import WorkingHoursCard from '../../components/WorkingHoursCard';
import GlobalModal from '../../components/GlobalModal';
import AttendanceModule from './AttendanceModule';
import DashboardTab from './DashboardTab';
import MyRecords from './MyRecords';
import { useRBAC } from '../../context/RBACContext';
import { extractEmployeeProfilePayload, isEmployeePendingActivation } from '../../utils/employeeProfile';

const DashboardSkeleton = () => (
  <div className="animate-pulse space-y-8 pb-10 bg-white font-inter rounded-xl">
    {/* 1. Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-[#E2E8F0] pb-6 gap-4">
      <div className="h-8 w-48 bg-[#E2E8F0] rounded-lg"></div>
      <div className="flex gap-2">
         <div className="h-9 w-28 bg-[#E2E8F0] rounded-lg"></div>
         <div className="h-9 w-32 bg-[#E2E8F0] rounded-lg"></div>
      </div>
    </div>

    {/* 2. Stats Grid Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[100px] bg-white rounded-xl border border-[#E2E8F0] p-6 flex flex-col justify-between">
            <div className="flex justify-between">
               <div className="h-3 w-20 bg-slate-100 rounded"></div>
               <div className="h-4 w-4 bg-slate-100 rounded"></div>
            </div>
            <div className="space-y-2">
                <div className="h-6 w-32 bg-slate-100 rounded-lg"></div>
            </div>
        </div>
      ))}
    </div>

    {/* 3. Main Body Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
      {/* Left Tracker */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-xl h-[360px] border border-[#E2E8F0] p-8 flex flex-col items-center">
            <div className="h-3 w-24 bg-slate-100 rounded mb-8"></div>
            <div className="w-40 h-40 rounded-full border-4 border-slate-50 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-slate-50"></div>
            </div>
            <div className="mt-8 h-10 w-full bg-slate-100 rounded-lg"></div>
        </div>
      </div>

      {/* Right Metrics */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white rounded-xl h-[220px] border border-[#E2E8F0] p-8 flex flex-col gap-6">
            <div className="h-4 w-48 bg-slate-100 rounded"></div>
            <div className="flex-1 flex items-end gap-4 px-2">
               {[1, 2, 3, 4, 5, 6, 7].map(j => (
                 <div key={j} className="flex-1 bg-slate-50 rounded-t h-20"></div>
               ))}
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl h-60 border border-[#E2E8F0] p-8">
               <div className="h-4 w-32 bg-slate-100 rounded mb-6"></div>
               <div className="space-y-4">
                  <div className="h-10 w-full bg-slate-50 rounded-lg"></div>
                  <div className="h-10 w-full bg-slate-50 rounded-lg"></div>
               </div>
            </div>
            <div className="bg-white rounded-xl h-60 border border-[#E2E8F0] p-8">
               <div className="h-4 w-32 bg-slate-100 rounded mb-6"></div>
               <div className="space-y-4">
                  <div className="h-10 w-full bg-slate-50 rounded-lg"></div>
                  <div className="h-10 w-full bg-slate-50 rounded-lg"></div>
               </div>
            </div>
        </div>
      </div>
    </div>
  </div>
);

const normalizeLeaveType = (value) => String(value || '').trim().toUpperCase();

const mergeBalancesWithEffectivePolicy = ({ balances, policies, effectivePolicyId, profile }) => {
  const rawBalances = Array.isArray(balances) ? balances : [];
  const policyList = Array.isArray(policies) ? policies : [];
  const effectivePolicy =
    policyList.find((policy) => policy?.isEffective || String(policy?._id || '') === String(effectivePolicyId || '')) ||
    policyList[0] ||
    profile?.leavePolicy ||
    null;
  const policyRules = Array.isArray(effectivePolicy?.rules) ? effectivePolicy.rules : [];
  const balanceByType = new Map(
    rawBalances
      .filter((balance) => balance?.leaveType)
      .map((balance) => [normalizeLeaveType(balance.leaveType), balance])
  );
  const merged = [];

  for (const rule of policyRules) {
    const leaveType = normalizeLeaveType(rule?.leaveType);
    if (!leaveType || merged.some((balance) => normalizeLeaveType(balance.leaveType) === leaveType)) {
      continue;
    }

    const balance = balanceByType.get(leaveType);
    const ruleBalance = rule?.balance || {};
    const ruleTotal = Number(rule?.totalPerYear ?? 0);
    const balanceTotal = Number(balance?.total ?? ruleBalance?.total ?? 0);
    const used = Number(balance?.used ?? ruleBalance?.used ?? 0);
    const pending = Number(balance?.pending ?? ruleBalance?.pending ?? 0);
    const fallbackTotal = Number(balance?.available ?? ruleBalance?.available ?? 0) + used + pending;
    const total = balanceTotal > 0 ? balanceTotal : (ruleTotal > 0 ? ruleTotal : fallbackTotal);
    const available = total > 0
      ? Math.max(0, total - used - pending)
      : Number(balance?.available ?? ruleBalance?.available ?? 0);

    merged.push({
      ...(balance || {}),
      policy: balance?.policy || effectivePolicy?._id,
      leaveType,
      total,
      used,
      pending,
      available,
      locked: Boolean(balance?.locked ?? ruleBalance?.locked ?? rule?.eligible === false),
      color: balance?.color || rule?.color
    });
  }

  for (const balance of rawBalances) {
    const leaveType = normalizeLeaveType(balance?.leaveType);
    if (!leaveType || merged.some((item) => normalizeLeaveType(item.leaveType) === leaveType)) {
      continue;
    }
    merged.push(balance);
  }

  // filter Maternity and Paternity based on eligibility
  const profileGender = String(profile?.gender || '').trim().toLowerCase();
  const profileMarital = String(profile?.maritalStatus || '').trim().toLowerCase();
  const profileIsMarried = ['married', 'मेरेડ', 'मेरेड', 'विवाहित', 'vivahit'].includes(profileMarital);

  return merged.filter(opt => {
    const lt = String(opt.leaveType || '').toUpperCase();
    if (lt === 'MATERNITY') {
      return profileGender === 'female' && profileIsMarried;
    }
    if (lt === 'PATERNITY') {
      return profileGender === 'male' && profileIsMarried;
    }
    return true;
  });
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = useRBAC();
  const context = useOutletContext();
  const location = useLocation();
  const fetchAbortRef = useRef(null);
  
  // Resolve activeTab from either context OR current URL path
  const resolvedTab = useMemo(() => {
    if (context?.activeTab) return context.activeTab;
    
    const path = location.pathname;
    if (path.includes('attendance')) return 'attendance';
    if (path.includes('payslip')) return 'payslips';
    if (path.includes('documents')) return 'my-documents';
    if (path.includes('roles')) return 'internal-jobs';
    if (path.includes('support')) return 'tickets';
    if (path.includes('exit')) return 'exit';
    if (path.includes('profile')) return 'profile';
    return 'dashboard';
  }, [context?.activeTab, location.pathname]);

  const { activeTab = resolvedTab, setActiveTab = () => {}, isSidebarCollapsed = false } = context || {};
  const [loading, setLoading] = useState(true);
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Modal States
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isFaceRegistered, setIsFaceRegistered] = useState(true); // Mocked for UI flow; should ideally come from profile data

  // Data States
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [lastMonthAccrual, setLastMonthAccrual] = useState(null);
  const [userLeavePolicy, setUserLeavePolicy] = useState(null);
  const [leavePolicies, setLeavePolicies] = useState([]);
  const [effectivePolicyId, setEffectivePolicyId] = useState(null);
  const [hasLeavePolicy, setHasLeavePolicy] = useState(true);
  const [policyRequesting, setPolicyRequesting] = useState(false);
  const [stats, setStats] = useState({
    presentDays: 0,
    leavesTaken: 0,
    pendingRequests: 0,
    nextHoliday: null
  });
  const [projects, setProjects] = useState([]);
  const [tasksLastUpdated, setTasksLastUpdated] = useState(null);
  const [birthdays, setBirthdays] = useState([]);

  // Attendance States
  const [clocking, setClocking] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [isFinalCheckOut, setFinalCheckOut] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [attendanceSettings, setAttendanceSettings] = useState(null);
  const [editLeave, setEditLeave] = useState(null);

  const roleName = String(user?.roleName || user?.role || '').toLowerCase();
  const subjectType = String(user?.subjectType || '').toLowerCase();
  const isEmployeeSelfServiceUser =
    subjectType === 'employee' ||
    ['employee', 'manager', 'team_lead', 'team lead'].includes(roleName);
  const canViewAttendance =
    isEmployeeSelfServiceUser &&
    (hasPermission('employee.attendance', 'view') || hasPermission('employee.attendance', 'any'));
  const activationBlocked = useMemo(() => isEmployeePendingActivation(profile), [profile]);

  useEffect(() => {
    if (permissionsLoading) {
      return undefined;
    }

    fetchAbortRef.current?.abort?.();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    
    // Perform silent refresh if we already have profile data to prevent "blinking"
    fetchDashboardData({ 
      signal: controller.signal, 
      silent: hasLoadedDashboard || !!profile 
    });

    return () => {
      controller.abort();
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
      }
    };
  }, [permissionsLoading, canViewAttendance, hasLoadedDashboard]);

  const fetchTasks = async () => {
    try {
      const t = Date.now();
      const taskRes = await api.get(`/tasks?t=${t}`).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[EMP_DASH] /api/tasks refresh failed', err?.response?.status, err?.response?.data || err?.message);
        }
        return { data: { projects: [] } };
      });
      const taskProjects = Array.isArray(taskRes?.data?.projects) ? taskRes.data.projects : [];
      if (import.meta.env.DEV) {
        console.debug('[EMP_DASH] /api/tasks response (refresh)', taskRes?.data);
        console.debug('[EMP_DASH] parsed TMS projects count (refresh)', taskProjects.length);
      }
      setProjects(taskProjects);
      setTasksLastUpdated(new Date());
    } catch (e) {
      // keep existing projects if refresh fails
    }
  };

  // Keep tasks fresh while user is on dashboard
  useEffect(() => {
    if (activeTab !== 'dashboard' || activationBlocked) return;

    // fetch once whenever dashboard tab becomes active
    fetchTasks();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchTasks();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = setInterval(fetchTasks, 60000); // 60s
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeTab, activationBlocked]);

  const fetchDashboardData = async ({ signal, silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const t = new Date().getTime(); // Anti-cache
      const withSignal = signal ? { signal } : undefined;
      const fallbackOnError = (fallback) => (err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          throw err;
        }
        return fallback;
      };

      if (!isEmployeeSelfServiceUser) {
        setProfile(null);
        setAttendance([]);
        setLeaves([]);
        setBalances([]);
        setLeavePolicies([]);
        setEffectivePolicyId(null);
        setHasLeavePolicy(false);
        setAttendanceSettings(null);
        setTodaySummary(null);
        setTodayRecord(null);
        setIsCheckedIn(false);
        setIsCheckedOut(false);
        setFinalCheckOut(false);
        setProjects([]);
        setTasksLastUpdated(null);
        setBirthdays([]);
        setStats({
          presentDays: 0,
          leavesTaken: 0,
          pendingRequests: 0,
          activeApplications: 0,
          nextHoliday: null
        });
        setLastUpdated(new Date());
        return;
      }

      const profileRes = await api.get(`/employee/profile?t=${t}`, withSignal).catch(fallbackOnError({ data: null }));
      const profilePayload = extractEmployeeProfilePayload(profileRes?.data);
      const profileMessage =
        profileRes?.data?.message ||
        profileRes?.data?.error ||
        '';

      setProfile(profilePayload);

      if (isEmployeePendingActivation(profilePayload, profileMessage)) {
        setAttendance([]);
        setLeaves([]);
        setBalances([]);
        setLeavePolicies([]);
        setEffectivePolicyId(null);
        setHasLeavePolicy(false);
        setAttendanceSettings(null);
        setTodaySummary(null);
        setTodayRecord(null);
        setIsCheckedIn(false);
        setIsCheckedOut(false);
        setFinalCheckOut(false);
        setProjects([]);
        setTasksLastUpdated(null);
        setStats({
          presentDays: 0,
          leavesTaken: 0,
          pendingRequests: 0,
          activeApplications: 0,
          nextHoliday: null
        });
        setLastUpdated(new Date());
        return;
      }

      const [attRes, leaveRes, balanceRes, policyRes, holidayRes, settingsRes, summaryRes, appSummaryRes, taskRes, birthdaysRes] = await Promise.all([
        canViewAttendance
          ? api.get(`/attendance/my?t=${t}`, withSignal).catch(fallbackOnError({ data: [] }))
          : Promise.resolve({ data: [] }),
        canViewAttendance
          ? api.get(`/employee/leaves/history?t=${t}`, withSignal).catch(fallbackOnError({ data: [] }))
          : Promise.resolve({ data: [] }),
        canViewAttendance
          ? api.get(`/employee/leaves/balances?t=${t}`, withSignal).catch(fallbackOnError({ data: { balances: [] } }))
          : Promise.resolve({ data: { balances: [] } }),
        canViewAttendance
          ? api.get(`/employee/leaves/policies?t=${t}`, withSignal).catch(fallbackOnError({ data: { policies: [] } }))
          : Promise.resolve({ data: { policies: [] } }),
        canViewAttendance
          ? api.get(`/holidays?t=${t}`, withSignal).catch(fallbackOnError({ data: [] }))
          : Promise.resolve({ data: [] }),
        canViewAttendance
          ? api.get(`/attendance/settings?t=${t}`, withSignal).catch(fallbackOnError({ data: null }))
          : Promise.resolve({ data: null }),
        canViewAttendance
          ? api.get(`/attendance/today-summary?t=${t}`, withSignal).catch(fallbackOnError({ data: null }))
          : Promise.resolve({ data: null }),
        api.get(`/requirements/my-applications?summary=1&t=${t}`, withSignal).catch(fallbackOnError({ data: { count: 0 } })),
        api.get(`/tasks?t=${t}`, withSignal).catch((err) => {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
            throw err;
          }
          if (import.meta.env.DEV) {
            console.warn('[EMP_DASH] /api/tasks failed', err?.response?.status, err?.response?.data || err?.message);
          }
          return { data: { projects: [] } };
        }),
        api.get(`/employee/birthdays-today?t=${t}`, withSignal).catch(fallbackOnError({ data: { data: [] } }))
      ]);

      const bdayData = Array.isArray(birthdaysRes?.data?.data) ? birthdaysRes.data.data : [];
      setBirthdays(bdayData);

      const attData = Array.isArray(attRes?.data) ? attRes?.data : [];
      setAttendance(attData);
      const leaveData = Array.isArray(leaveRes?.data) ? leaveRes?.data : [];
      setLeaves(leaveData);
      const balData = balanceRes?.data?.balances || (Array.isArray(balanceRes?.data) ? balanceRes?.data : []);
      const policyPayload = Array.isArray(policyRes?.data) ? { policies: policyRes.data } : (policyRes?.data || {});
      const policyData = Array.isArray(policyPayload?.policies) ? policyPayload.policies : [];
      const mergedBalances = mergeBalancesWithEffectivePolicy({
        balances: balData,
        policies: policyData,
        effectivePolicyId: policyPayload?.effectivePolicyId || null,
        profile: profilePayload
      });
      setBalances(mergedBalances);
      setLastMonthAccrual(balanceRes?.data?.lastMonthAccrual || null);
      setUserLeavePolicy(balanceRes?.data?.leavePolicy || null);
      setLeavePolicies(policyData);
      setEffectivePolicyId(policyPayload?.effectivePolicyId || null);
      setHasLeavePolicy(
        Boolean(balanceRes?.data?.hasLeavePolicy) ||
        Boolean(profilePayload?.leavePolicy) ||
        Boolean(policyPayload?.hasPolicies) ||
        policyData.length > 0 ||
        mergedBalances.length > 0
      );
      setAttendanceSettings(settingsRes?.data);
      setTodaySummary(summaryRes?.data);

      const taskProjects = Array.isArray(taskRes?.data?.projects) ? taskRes?.data?.projects : [];
      if (import.meta.env.DEV) {
        console.debug('[EMP_DASH] /api/tasks response', taskRes?.data);
        console.debug('[EMP_DASH] parsed TMS projects count', taskProjects.length);
      }
      setProjects(taskProjects);
      setTasksLastUpdated(new Date());


      // Simple Stats Calculation
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const presentCount = attData.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear &&
          ['present', 'half_day'].includes((a.status || '').toLowerCase());
      }).length;

      const takenCount = leaveData
        .filter(l => l.status === 'Approved' && new Date(l.startDate).getFullYear() === currentYear)
        .reduce((sum, l) => sum + (l.daysCount || 0), 0);
      
      const pendingCount = leaveData.filter(l => l.status === 'Pending').length;

      const todayStr = new Date().toISOString().split('T')[0];
      const upcomingHolidays = (holidayRes?.data || [])
        .map(h => ({ ...h, dObj: new Date(h.date) }))
        .filter(h => h.dObj.toISOString().split('T')[0] >= todayStr)
        .sort((a, b) => a.dObj - b.dObj);

      const activeAppCount = Number(appSummaryRes?.data?.count || 0);

      setStats({
        presentDays: presentCount,
        leavesTaken: takenCount,
        pendingRequests: pendingCount,
        activeApplications: activeAppCount,
        nextHoliday: upcomingHolidays[0] || null
      });

      // Today Logic (Consolidated)
      const todayISO = formatDateDDMMYYYY(new Date());
      // Prefer today-summary structure but fallback to general logs find
      const todayEntry = summaryRes?.data || attData.find(a => formatDateDDMMYYYY(a.date) === todayISO);
      
      setTodayRecord(todayEntry);
      
      const hasPunchIn = (todayEntry?.firstPunch || todayEntry?.checkIn);
      const hasPunchOut = (todayEntry?.lastPunch || todayEntry?.checkOut);

      if (todayEntry) {
        setIsCheckedIn(!!hasPunchIn);
        setFinalCheckOut(!!hasPunchOut);
        
        const logs = todayEntry.logs || [];
        const isCurrentlyOut = logs.length > 0 
          ? logs[logs.length - 1].type === 'OUT' 
          : !!hasPunchOut;
          
        setIsCheckedOut(isCurrentlyOut);
      } else {
        setIsCheckedIn(false);
        setIsCheckedOut(false);
        setFinalCheckOut(false);
      }

      setLastUpdated(new Date());
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        return;
      }
      console.error("Dashboard Fetch Failed", err);
    } finally {
      if (!signal?.aborted) {
        setHasLoadedDashboard(true);
        setLoading(false);
        setClocking(false);
      }
    }
  };

  const handleCancelLeave = (leaveId) => {
    showConfirmToast(
      'Cancel Leave Request?',
      'Are you sure you want to cancel this leave request? This action cannot be undone.',
      async () => {
        try {
          showToast('info', 'Cancelling...', 'Please wait');
          await api.post(`/employee/leaves/cancel/${leaveId}`);
          showToast('success', 'Cancelled', 'Leave cancelled successfully');
          fetchDashboardData();
        } catch (error) {
          showToast('error', 'Failed', error?.response?.data?.error || 'Could not cancel leave');
        }
      }
    );
  };

  const handleFaceSuccess = async () => {
    try {
        setClocking(true);
        const action = isCheckedIn && !isCheckedOut ? 'OUT' : 'IN';
        showToast('info', 'Secure Check-In', `Finalizing ${action}...`);
        // Real API call: await api.post('/attendance/punch', { method: 'FACE' });
        await fetchDashboardData();
        showToast('success', 'Verified', `Attendance ${action} marked via FaceID`);
    } catch (e) {
        showToast('error', 'Sync Failed', 'Could not record attendance');
    } finally {
        setClocking(false);
    }
  };

  const handleClockInOut = () => {
     // If transitioning status, open Face Modal
     // This simplifies the UI flow for the USER
     setIsFaceModalOpen(true);
  };

  if (loading && !hasLoadedDashboard) return (
    <div className="bg-white flex-1 overflow-hidden">
      <DashboardSkeleton />
    </div>
  );

  return (
    <div className="w-full h-full bg-white overflow-hidden flex flex-col">
       {/* Dashboard View */}
       {activeTab === 'dashboard' && (
         activationBlocked ? (
           <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
             <div className="w-full max-w-2xl rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-10 text-center shadow-sm">
               <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                 <ShieldCheck size={30} />
               </div>
               <h2 className="text-2xl sm:text-[30px] font-semibold text-[#0F172A] leading-tight">Dashboard Is Locked Until Activation</h2>
               <p className="mt-3 text-sm sm:text-[15px] text-[#475569]">
                 Your employee account is still under review. The page you click from the sidebar will now stay on that page, and modules will unlock automatically after HR completes activation.
               </p>
               <button
                 type="button"
                 onClick={() => fetchDashboardData()}
                 className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#4F46E5] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#4338CA] shadow-md shadow-indigo-100"
               >
                 Refresh Dashboard Status
               </button>
             </div>
           </div>
         ) : (
           <DashboardTab
              profile={profile}
              stats={stats}
              isCheckedIn={isCheckedIn}
              isCheckedOut={isCheckedOut}
              todayRecord={todayRecord}
              todaySummary={todaySummary}
              attendance={attendance}
              balances={balances}
              handleClockInOut={handleClockInOut}
              clocking={clocking}
              projects={projects}
              refreshTasks={fetchTasks}
              tasksLastUpdated={tasksLastUpdated}
              birthdays={birthdays}
              lastUpdated={lastUpdated}
              isSidebarCollapsed={isSidebarCollapsed}
              setActiveTab={setActiveTab}
              settings={attendanceSettings}
              isActive={isCheckedIn && !isCheckedOut}
           />
         )
       )}

       {/* Module Switcher for other tabs */}
       {activeTab !== 'dashboard' && (
         <div className={`flex-1 ${activeTab === 'profile' ? 'p-0' : ''} animate-in fade-in duration-500 ${(activeTab === 'attendance' || activeTab === 'leaves' || activeTab === 'regularization' || activeTab === 'face-attendance' || activeTab === 'exit') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {(activeTab === 'attendance' || activeTab === 'leaves' || activeTab === 'regularization' || activeTab === 'face-attendance' || activeTab === 'exit') && (
               <AttendanceModule
                  profile={profile}
                  stats={stats}
                  isCheckedIn={isCheckedIn}
                  isCheckedOut={isCheckedOut}
                  todayRecord={todayRecord}
                  todaySummary={todaySummary}
                  attendance={attendance}
                  balances={balances}
                  lastMonthAccrual={lastMonthAccrual}
                  leavePolicy={userLeavePolicy}
                  leaves={leaves}
                  leavePolicies={leavePolicies}
                  effectivePolicyId={effectivePolicyId}
                  holidays={[]}
                  handleClockInOut={handleClockInOut}
                  clocking={clocking}
                  hasLeavePolicy={hasLeavePolicy}
                  handleCancelLeave={handleCancelLeave}
                  editLeave={editLeave}
                  setEditLeave={setEditLeave}
                  fetchDashboardData={fetchDashboardData}
               />
            )}
            {activeTab === 'profile' && <EmployeeProfileView profile={profile} balances={balances} />}
            {activeTab === 'payslips' && <ESSPayslips />}
            {activeTab === 'my-records' && <MyRecords />}
            {activeTab === 'internal-jobs' && <InternalJobs />}
            {activeTab === 'my-applications' && <MyApplications />}
         </div>
       )}

       {/* Legacy Face Attendance Modal */}
       {isFaceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
                <button 
                   onClick={() => setIsFaceModalOpen(false)}
                   className="absolute top-4 right-4 z-[110] p-2 bg-white/10 hover:bg-slate-100 text-slate-400 rounded-full transition-all"
                >
                   <X size={20} />
                </button>
                <FaceAttendance 
                   onSuccess={() => {
                      handleFaceSuccess();
                      setIsFaceModalOpen(false);
                   }}
                   onClose={() => setIsFaceModalOpen(false)}
                   actionType={isCheckedIn && !isCheckedOut ? 'OUT' : 'IN'}
                   profile={profile}
                />
             </div>
          </div>
       )}
    </div>
  );
}
