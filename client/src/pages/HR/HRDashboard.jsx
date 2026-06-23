import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Modal, message } from 'antd';
import { notification } from '../../utils/antdGlobal';
import { PieChart, Pie, Cell } from 'recharts';
import {
  Briefcase, Calendar, ChevronDown, ClipboardCheck, Clock, MapPin,
  MoreHorizontal, Plus, Users, UserCheck, UserMinus, UserPlus, X, Zap, Send,
  RefreshCcw
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import api, { API_ROOT } from '../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { getScopedStorageKey } from '../../utils/sidebarStorage';

const BACKEND_URL = API_ROOT || '';
const MotionDiv = motion.div;
const CONFETTI_COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const seededRandom = (index, salt = 0) => {
  const value = Math.sin((index + 1) * 999 + salt * 101) * 10000;
  return value - Math.floor(value);
};

const Confetti = ({ active }) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center overflow-hidden">
      {[...Array(60)].map((_, i) => {
        const angle = seededRandom(i, 1) * Math.PI * 2;
        const velocity = 400 + seededRandom(i, 2) * 600;
        const xDir = Math.cos(angle) * velocity;
        const yDir = Math.sin(angle) * velocity;
        const size = seededRandom(i, 4) * 10 + 6;
        const colorIndex = Math.floor(seededRandom(i, 6) * CONFETTI_COLORS.length);

        return (
          <MotionDiv
            key={i}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: xDir,
              y: [0, yDir - 200, yDir + 400],
              scale: [0, 1, 1, 0],
              opacity: [1, 1, 0.8, 0],
              rotate: seededRandom(i, 3) * 720,
            }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            style={{
              position: 'absolute',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: CONFETTI_COLORS[colorIndex],
              borderRadius: seededRandom(i, 5) > 0.5 ? '50%' : '2px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            }}
          />
        );
      })}
    </div>
  );
};


const stats = [
  ['employees', 'Total Employees', Users, 'employees', 'blue'],
  ['presentToday', 'Present Today', UserCheck, 'present', 'emerald'],
  ['absentToday', 'Absent Today', UserMinus, 'absent', 'rose'],
  ['onDutyToday', 'On Duty', Zap, 'onDuty', 'amber'],
  ['onLeaveToday', 'On Leave', Calendar, 'leave', 'sky'],
  ['newJoiners', 'New Joiners', UserPlus, 'newJoiners', 'indigo'],
  ['pendingLeaves', 'Pending Requests', ClipboardCheck, 'pendingLeaves', 'orange'],
];

const donutColors = ['#2563eb', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];
const REQUEST_TIMEOUT_MS = 12000;

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const toPercent = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

function EmployeeModal({ modal, onClose, onEmployeeClick }) {
  if (!modal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-800">{modal.title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Total {modal.data.length} records</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-400 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all border border-transparent hover:border-slate-200">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modal.data.length ? modal.data.map((emp, idx) => {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onEmployeeClick && onEmployeeClick(emp)}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-xl hover:shadow-slate-500/5 hover:-translate-y-0.5"
                >
                  <div className={clsx(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg",
                    idx % 3 === 0 ? "bg-gradient-to-br from-slate-700 to-slate-900 shadow-slate-100" :
                      idx % 3 === 1 ? "bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-100" :
                        "bg-gradient-to-br from-indigo-800 to-slate-900 shadow-indigo-100"
                  )}>
                    {getInitials(`${emp.firstName} ${emp.lastName}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-slate-900 group-hover:text-slate-700 transition-colors tracking-tight">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.designation || 'Team Member'}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                      <span className="text-[10px] font-semibold text-slate-400">{emp.department?.name || emp.department || 'General'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 group-hover:bg-slate-100 group-hover:border-slate-200 transition-colors">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Employee ID</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5">{emp.employeeId || '--'}</p>
                  </div>
                </button>
              );
            }) : (
              <div className="col-span-full flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                  <Users size={24} />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No records found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestModal({ modal, onClose }) {
  if (!modal.isOpen || !modal.req) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-900">Leave Request</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Detailed View</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-black text-white shadow-md">
              {getInitials(`${modal.req.employee?.firstName} ${modal.req.employee?.lastName}`)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-slate-900">{modal.req.employee?.firstName} {modal.req.employee?.lastName}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{modal.req.employee?.employeeId || '--'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leave Type</p>
              <p className="mt-1 text-sm font-black text-slate-800">{modal.req.leaveType}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
              <p className="mt-1 text-sm font-black text-slate-900">{modal.req.status}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</p>
            <p className="mt-1 text-sm font-black text-slate-800">{formatDate(modal.req.startDate)} - {formatDate(modal.req.endDate)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{modal.req.reason || 'No specific reason provided.'}</p>
          </div>
        </div>
        <div className="bg-slate-50/50 p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ employees: 0, presentToday: 0, absentToday: 0, onDutyToday: 0, onLeaveToday: 0, newJoiners: 0, pendingLeaves: 0 });
  const [birthdays, setBirthdays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [, setAttendanceTrend] = useState([]);
  const [departments, setDepartments] = useState([]);
  // const [branches, setBranches] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [filters, setFilters] = useState({ department: 'All Departments', month: 'This Month', /* location: 'All Locations' */ });
  const [activeTab, setActiveTab] = useState('pending');
  const [onLeaveTodayRequests, setOnLeaveTodayRequests] = useState([]);
  const [employeeModal, setEmployeeModal] = useState({ isOpen: false, title: '', data: [] });
  const [requestModal, setRequestModal] = useState({ isOpen: false, req: null });
  const [actionLoading, setActionLoading] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedBday, setSelectedBday] = useState(null);
  const [currentWishes, setCurrentWishes] = useState([]);
  const [loadingWishes, setLoadingWishes] = useState(false);
  const [newWish, setNewWish] = useState('');
  const [metricStyles, setMetricStyles] = useState({ bg: '', text: '' });
  const [seedingDemo, setSeedingDemo] = useState(false);

  const handleGenerateDemoData = async () => {
    setSeedingDemo(true);
    try {
      const res = await api.post('/demo-data/seed');
      notification.success({
        message: 'Demo Data Seeded Successfully',
        description: 'The HRMS has been successfully seeded with dummy data for departments, grades, employees, attendance, leaves, requirements, candidates, tickets, and payroll. Reloading...',
        placement: 'topRight',
        duration: 5
      });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Demo seeding error:", err);
      notification.error({
        message: 'Failed to Seed Demo Data',
        description: err.response?.data?.error || err.message || 'An error occurred during demo data seeding.',
        placement: 'topRight'
      });
    } finally {
      setSeedingDemo(false);
    }
  };

  useEffect(() => {
    const loadMetricStyles = () => {
      try {
        const panel = location.pathname.startsWith('/employee') ? 'employee' : 'hr';
        const scopedKey = getScopedStorageKey('hrms:sidebar:advanced-config:v1', { user, panel });
        const cfg = JSON.parse(localStorage.getItem(scopedKey) || '{}');
        if (cfg?.appearance) {
          setMetricStyles({
            bg: cfg.appearance.metricBgColor || '',
            text: cfg.appearance.metricTextColor || ''
          });
        } else {
          setMetricStyles({ bg: '', text: '' });
        }
      } catch {
        // Appearance settings are optional.
      }
    };

    loadMetricStyles();
    window.addEventListener('hrms:appearance:changed', loadMetricStyles);
    return () => window.removeEventListener('hrms:appearance:changed', loadMetricStyles);
  }, [user, location.pathname]);

  const fetchWishes = async (empId) => {
    setLoadingWishes(true);
    try {
      const res = await api.get(`/employee/birthdays/${empId}/wishes`);
      if (res.data.success) {
        const formatted = res.data.data.map(w => ({
          _id: w._id,
          from: w.commenterName,
          text: w.message,
          time: new Date(w.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
          color: w.commentedByRole === 'hr' ? 'purple' : 'blue'
        }));
        setCurrentWishes(formatted);
      }
    } catch (err) {
      console.error("Fetch wishes error:", err);
    } finally {
      setLoadingWishes(false);
    }
  };

  const handleSendWish = async () => {
    if (!newWish.trim() || !selectedBday) return;
    const empId = selectedBday._id;

    try {
      const res = await api.post(`/employee/birthdays/${empId}/wish`, { message: newWish });
      if (res.data.success) {
        const w = res.data.data;
        setCurrentWishes(prev => [...prev, {
          _id: w._id,
          from: w.commenterName,
          text: w.message,
          time: new Date(w.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
          color: 'rose'
        }]);
        setNewWish('');
        message.success('Wish posted! 🎈');
      }
    } catch (err) {
      console.error("Post wish error:", err);
      message.error("Failed to post wish");
    }
  };

  const triggerCelebration = (emp) => {
    setSelectedBday(emp);
    fetchWishes(emp._id);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  const recalcStats = useCallback((employees, leavesData, attendanceSummary) => {
    let filteredEmployees = employees;
    if (filters.department !== 'All Departments') filteredEmployees = filteredEmployees.filter((emp) => (emp.departmentId?.name || emp.departmentId || emp.department) === filters.department);
    // if (filters.location !== 'All Locations') filteredEmployees = filteredEmployees.filter((emp) => (emp.branchId?.name || emp.branchId || emp.location) === filters.location);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeLeavesToday = leavesData.filter((leave) => {
      if (String(leave.status).toLowerCase() !== 'approved') return false;
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return today >= start && today <= end;
    });
    const filteredLeavesToday = activeLeavesToday.filter((leave) => filteredEmployees.some((emp) => emp._id === (leave.employee?._id || leave.employee)));
    setOnLeaveTodayRequests(filteredLeavesToday);

    const presentTodayCount = attendanceSummary.present || filteredEmployees.filter((emp) => emp.isPunchedIn && emp.attendanceStatus !== 'On Duty').length;
    const onDutyTodayCount = filteredEmployees.filter((emp) => emp.attendanceStatus === 'On Duty').length;
    const onLeaveTodayCount = filteredLeavesToday.length;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setCounts({
      employees: filteredEmployees.length,
      presentToday: presentTodayCount,
      onDutyToday: onDutyTodayCount,
      absentToday: Math.max(0, filteredEmployees.length - presentTodayCount - onLeaveTodayCount - onDutyTodayCount),
      onLeaveToday: onLeaveTodayCount,
      newJoiners: filteredEmployees.filter((emp) => emp.joiningDate && new Date(emp.joiningDate) >= thirtyDaysAgo).length,
      pendingLeaves: leavesData.filter((leave) => String(leave?.status || '').toLowerCase() === 'pending' && filteredEmployees.some((emp) => emp._id === (leave.employee?._id || leave.employee))).length,
    });

    const currentMonth = new Date().getMonth();
    const monthBirthdays = filteredEmployees
      .filter((emp) => emp.dob && new Date(emp.dob).getMonth() === currentMonth)
      .sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());

    setBirthdays(monthBirthdays);
  }, [filters.department]);

  useEffect(() => {
    let cancelled = false;

    const withFallback = async (request, fallbackValue) => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve(fallbackValue);
        }, REQUEST_TIMEOUT_MS);

        Promise.resolve(request)
          .then((response) => {
            clearTimeout(timer);
            resolve(response);
          })
          .catch(() => {
            clearTimeout(timer);
            resolve(fallbackValue);
          });
      });
    };

    async function load() {
      setLoading(true);
      try {
        const [eRes, dRes, lRes, attRes, reqRes, trendRes] = await Promise.all([
          withFallback(api.get('/hr/employees'), { data: [] }),
          withFallback(api.get('/hr/departments'), { data: [] }),
          withFallback(api.get('/hr/leaves/requests'), { data: { data: [] } }),
          withFallback(
            api.get(`/attendance/by-date?date=${new Date().toISOString().split('T')[0]}`),
            { data: { summary: { present: 0 }, employees: [] } },
          ),
          withFallback(api.get('/requirements'), { data: { data: [] } }),
          withFallback(api.get('/attendance/trend?days=30'), { data: [] }),
        ]);

        if (cancelled) return;

        const employees = Array.isArray(eRes.data) ? eRes.data : (eRes.data?.data || []);
        const leavesData = lRes.data?.data || [];
        const attendanceData = attRes?.data || {};
        const attendanceSummary = attendanceData.summary || { present: 0 };
        const attendanceList = attendanceData.employees || [];
        const updatedEmployees = employees.map((emp) => {
          const attendanceRecord = attendanceList.find((entry) => String(entry._id) === String(emp._id));
          return {
            ...emp,
            isPunchedIn: attendanceRecord ? ['Present', 'Half Day', 'On Duty'].includes(attendanceRecord.status) : false,
            attendanceStatus: attendanceRecord ? attendanceRecord.status : 'Absent',
          };
        });

        setAllEmployees(updatedEmployees);
        setLeaves(leavesData);
        setDepartments(Array.isArray(dRes.data) ? dRes.data : (dRes.data?.data || []));
        /*
        const uniqueBranches = [...new Set(
          updatedEmployees
            .map((emp) => emp.branchId?.name || emp.branchId || emp.location)
            .filter(Boolean)
            .map((v) => String(v))
        )];
        setBranches(uniqueBranches);
        */
        setOpenPositions(reqRes.data?.data || []);
        recalcStats(updatedEmployees, leavesData, attendanceSummary);

        if (!cancelled) {
          setAttendanceTrend(trendRes.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load HR dashboard data', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [recalcStats]);

  useEffect(() => {
    if (!loading && allEmployees.length > 0) {
      recalcStats(allEmployees, leaves, { present: allEmployees.filter((emp) => emp.isPunchedIn).length });

      // Celebration logic for today's birthdays
      const today = new Date();
      const bdayToday = allEmployees.find(emp => {
        if (!emp.dob) return false;
        const dob = new Date(emp.dob);
        return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
      });

      if (bdayToday && !sessionStorage.getItem(`bday_wish_${bdayToday._id}_${today.toDateString()}`)) {
        setTimeout(() => {
          notification.open({
            message: <span className="font-bold text-rose-600">🎉 Happy Birthday!</span>,
            description: (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Today is <span className="font-bold text-slate-900">{bdayToday.firstName} {bdayToday.lastName}</span>&apos;s birthday! 🎂</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => notification.destroy()}
                    className="px-3 py-1 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-sm hover:bg-rose-600 transition-colors"
                  >
                    Celebrate
                  </button>
                </div>
              </div>
            ),
            placement: 'top',
            duration: 10,
            style: { marginTop: '20px' },
            className: 'birthday-celebration-popup rounded-2xl border-rose-100 bg-white/95 backdrop-blur-xl shadow-2xl max-w-[90vw] sm:max-w-[400px]',
            icon: <div className="h-10 w-10 flex items-center justify-center rounded-full bg-rose-50 text-rose-500 animate-bounce"><Zap size={20} fill="currentColor" /></div>
          });
        }, 1500);
        sessionStorage.setItem(`bday_wish_${bdayToday._id}_${today.toDateString()}`, 'true');
      }
    }
  }, [allEmployees, leaves, loading, recalcStats]);

  const openEmployeeModal = (type) => {
    let title = '';
    let data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let filteredEmps = [...allEmployees];
    if (filters.department !== 'All Departments') filteredEmps = filteredEmps.filter((emp) => (emp.departmentId?.name || emp.departmentId || emp.department) === filters.department);
    // if (filters.location !== 'All Locations') filteredEmps = filteredEmps.filter((emp) => (emp.branchId?.name || emp.branchId || emp.location) === filters.location);

    if (type === 'employees') { title = 'Total Employees'; data = filteredEmps; }
    if (type === 'present') { title = 'Present Today'; data = filteredEmps.filter((emp) => emp.isPunchedIn && emp.attendanceStatus !== 'On Duty'); }
    if (type === 'absent') { title = 'Absent Employees'; data = filteredEmps.filter((emp) => !emp.isPunchedIn && emp.attendanceStatus !== 'On Duty'); }
    if (type === 'onDuty') { title = 'Employees On Duty'; data = filteredEmps.filter((emp) => emp.attendanceStatus === 'On Duty'); }
    if (type === 'newJoiners') {
      title = 'New Joiners (Last 30 Days)';
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      data = filteredEmps.filter((emp) => emp.joiningDate && new Date(emp.joiningDate) >= thirtyDaysAgo);
    }
    if (type === 'leave') {
      title = 'On Leave Today';
      data = filteredEmps.filter((emp) => leaves.some((leave) => {
        if ((leave.employee?._id || leave.employee) !== emp._id) return false;
        if (String(leave.status).toLowerCase() !== 'approved') return false;
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return today >= start && today <= end;
      }));
    }
    if (type === 'pendingLeaves') {
      title = 'Pending Leave Requests';
      const pendingRequests = leaves.filter((leave) => String(leave.status).toLowerCase() === 'pending');
      data = filteredEmps.filter((emp) => pendingRequests.some((req) => (req.employee?._id || req.employee) === emp._id));
    }
    setEmployeeModal({ isOpen: true, title, data });
  };

  const handleAction = async (reqId, type) => {
    setActionLoading((prev) => ({ ...prev, [reqId + type]: true }));
    try {
      await api.post(`/hr/leaves/requests/${reqId}/${type}`, { remark: 'Processed from Dashboard' });
      notification.success({ message: 'Success', description: `Request ${type === 'approve' ? 'Approved' : 'Rejected'} Successfully`, placement: 'topRight' });
      setLeaves((prev) => prev.map((leave) => (leave._id === reqId ? { ...leave, status: type === 'approve' ? 'Approved' : 'Rejected' } : leave)));
      setCounts((prev) => ({ ...prev, pendingLeaves: Math.max(0, prev.pendingLeaves - 1) }));
    } catch (err) {
      notification.error({ message: 'Error', description: err.response?.data?.error || 'Action failed', placement: 'topRight' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [reqId + type]: false }));
    }
  };

  const openEmployeeProfileFromModal = (emp) => {
    if (!emp?._id) return;
    const basePath = location.pathname.startsWith('/tenant') ? '/tenant/employees' : '/hr/employees';
    setEmployeeModal((prev) => ({ ...prev, isOpen: false }));
    navigate(`${basePath}/${emp._id}/profile`, { state: { employee: emp } });
  };

  const positionsByDepartment = useMemo(() => {
    const totals = {};
    openPositions.filter((req) => filters.department === 'All Departments' || req.department === filters.department).forEach((req) => {
      const department = req.department || 'Other';
      totals[department] = (totals[department] || 0) + (req.vacancy || 1);
    });
    return Object.entries(totals).map(([name, value], index) => ({ name, value, color: donutColors[index % donutColors.length] }));
  }, [filters.department, openPositions]);

  const queueItems = useMemo(() => (
    activeTab === 'pending'
      ? leaves.filter((leave) => String(leave.status).toLowerCase() === 'pending' && (filters.department === 'All Departments' || (leave.employee?.department?.name || leave.employee?.department) === filters.department))
      : onLeaveTodayRequests
  ), [activeTab, filters.department, leaves, onLeaveTodayRequests]);

  const departmentMenuItems = useMemo(() => ([
    { key: 'All Departments', label: 'All Departments' },
    ...departments.map((dept) => ({ key: String(dept.name || dept), label: String(dept.name || dept) })),
  ]), [departments]);

  const monthMenuItems = useMemo(() => ([
    { key: 'This Month', label: 'This Month' },
    { key: 'Last Month', label: 'Last Month' },
    { key: 'Last 3 Months', label: 'Last 3 Months' },
  ]), []);

  /*
  const locationMenuItems = useMemo(() => ([
    { key: 'All Locations', label: 'All Locations' },
    ...branches.map((loc) => ({ key: String(loc.name || loc), label: String(loc.name || loc) })),
  ]), [branches]);
  */

  const attendanceSummaryBar = useMemo(() => {
    const totalEmployees = Number(counts.employees || 0);
    const presentEmployees = Number(counts.presentToday || 0);
    const absentEmployees = Number(counts.absentToday || 0);

    return {
      totalEmployees,
      presentEmployees,
      absentEmployees,
      presentPercent: toPercent(presentEmployees, totalEmployees),
      absentPercent: toPercent(absentEmployees, totalEmployees),
    };
  }, [counts]);
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }),
    [],
  );
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <>
      <Confetti active={showConfetti} />

      <Modal
        open={!!selectedBday}
        onCancel={() => setSelectedBday(null)}
        footer={null}
        centered
        width={750}
        closeIcon={null}
        className="birthday-celebration-modal-wide"
        modalRender={(modal) => (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {modal}
          </motion.div>
        )}
      >
        {selectedBday && (
          <div className="relative flex min-h-[450px] overflow-hidden rounded-[32px] bg-white shadow-2xl">
            {/* Left Side: Profile & Details */}
            <div className="relative w-[40%] bg-gradient-to-br from-rose-500 to-pink-600 p-8 text-center text-white flex flex-col justify-center items-center">
              {/* Decorative particles */}
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-10 left-10 h-20 w-20 rounded-full bg-white blur-2xl" />
                <div className="absolute bottom-10 right-10 h-20 w-20 rounded-full bg-rose-200 blur-2xl" />
              </div>

              <div className="relative z-10 w-full">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border-4 border-white/30 shadow-2xl">
                  <Zap size={44} fill="white" className="animate-pulse" />
                </div>

                <h2 className="text-2xl font-bold tracking-tight leading-none mb-1">Happy Birthday!</h2>
                <p className="text-lg font-semibold text-rose-100 mb-6">{selectedBday.firstName} {selectedBday.lastName}</p>

                <div className="space-y-2.5 w-full max-w-[180px] mx-auto">
                  <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-1">Department</p>
                    <p className="text-xs font-semibold truncate">{selectedBday.department || 'General'}</p>
                  </div>

                  <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-1">Birth Date</p>
                    <p className="text-xs font-semibold">{formatDate(selectedBday.dob)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBday(null)}
                  className="mt-8 h-10 w-full max-w-[180px] rounded-xl bg-white text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 shadow-lg transition-all hover:bg-rose-50 active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="w-[60%] flex flex-col p-6 bg-slate-50/30">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">Wish Wall</h3>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Team Celebration</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-500 border border-rose-100">
                  <Users size={12} />
                  <span className="text-[11px] font-bold">{currentWishes.length} wishes</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto mb-5 pr-2 custom-scrollbar min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {currentWishes.map((w, idx) => (
                    <motion.div
                      key={w._id || idx}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group"
                    >
                      <div className="flex gap-3">
                        <div className={clsx(
                          "h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase text-white shrink-0 shadow-md",
                          w.color === 'blue' ? 'bg-blue-500 shadow-blue-50' :
                            w.color === 'purple' ? 'bg-purple-500 shadow-purple-50' :
                              w.color === 'emerald' ? 'bg-emerald-500 shadow-emerald-50' : 'bg-rose-500 shadow-rose-50'
                        )}>
                          {w.from[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="truncate text-[10px] font-bold text-slate-800 uppercase tracking-wide">{w.from}</p>
                            <p className="shrink-0 text-[8px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{w.time}</p>
                          </div>
                          <div className="rounded-2xl rounded-tl-none bg-white border border-slate-100 p-3 shadow-sm group-hover:border-rose-200 transition-all">
                            <p className="text-xs font-medium text-slate-600 leading-relaxed">{w.text}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {currentWishes.length === 0 && !loadingWishes && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-6">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Be the first to wish!</p>
                  </div>
                )}
                {loadingWishes && (
                  <div className="h-full flex items-center justify-center py-10">
                    <RefreshCcw size={20} className="animate-spin text-slate-200" />
                  </div>
                )}
              </div>

              <div className="relative group/input">
                <input
                  type="text"
                  value={newWish}
                  onChange={(e) => setNewWish(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendWish()}
                  placeholder="Type a wish..."
                  className="w-full h-12 pl-5 pr-14 rounded-2xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all shadow-sm placeholder:text-slate-400"
                />
                <button
                  onClick={handleSendWish}
                  disabled={!newWish.trim()}
                  className="absolute right-1.5 top-1.5 h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-100 disabled:opacity-30 disabled:grayscale transition-all active:scale-90"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <div className="space-y-2 p-2.5">
        <section className="px-0 py-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{todayLabel}</p>
              <div className="text-slate-900 font-semibold tracking-tight" style={{ fontSize: '22px', lineHeight: '1.4' }}>
                {getGreeting()} {(() => {
                  const isGeneric = (val) => {
                    const v = String(val || '').trim().toLowerCase();
                    return !v || v === 'user' || v === 'admin' || v === 'super admin' || v === 'superadmin' || v === 'employee' || v === 'null' || v === 'undefined';
                  };
                  const resolved = (!isGeneric(user?.name || user?.fullName) ? (user?.name || user?.fullName) : (user?.email ? user.email.split('@')[0] : 'Admin'));
                  return resolved.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                })()}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateDemoData}
                disabled={seedingDemo}
                className={clsx(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all",
                  seedingDemo 
                    ? "bg-slate-400 cursor-not-allowed" 
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0"
                )}
              >
                {seedingDemo ? (
                  <>
                    <RefreshCcw size={14} className="animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} className="text-violet-200" fill="currentColor" />
                    <span>Seed Demo Data</span>
                  </>
                )}
              </button>
              <Dropdown menu={{ items: departmentMenuItems, onClick: ({ key }) => setFilters({ ...filters, department: key }) }} trigger={['click']}>
                <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold uppercase tracking-widest text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50">
                  <span>{filters.department}</span><ChevronDown size={14} className="text-slate-400" />
                </button>
              </Dropdown>
              <Dropdown menu={{ items: monthMenuItems, onClick: ({ key }) => setFilters({ ...filters, month: key }) }} trigger={['click']}>
                <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold uppercase tracking-widest text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50">
                  <Calendar size={14} className="text-sky-600" /><span>{filters.month}</span><ChevronDown size={14} className="text-slate-400" />
                </button>
              </Dropdown>
            </div>
          </div>
        </section>

        <section className="px-0 py-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {stats.map(([key, label, Icon, type, colorScheme]) => {
              const iconNode = React.createElement(Icon, { size: 16 });

              const schemes = {
                blue: "text-blue-700 bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:bg-blue-50 hover:shadow-blue-500/10",
                emerald: "text-emerald-700 bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-emerald-500/10",
                rose: "text-rose-700 bg-rose-50/50 border-rose-100 hover:border-rose-300 hover:bg-rose-50 hover:shadow-rose-500/10",
                amber: "text-amber-700 bg-amber-50/50 border-amber-100 hover:border-amber-300 hover:bg-amber-50 hover:shadow-amber-500/10",
                sky: "text-sky-700 bg-sky-50/50 border-sky-100 hover:border-sky-300 hover:bg-sky-50 hover:shadow-sky-500/10",
                indigo: "text-indigo-700 bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-indigo-500/10",
                orange: "text-orange-700 bg-orange-50/50 border-orange-100 hover:border-orange-300 hover:bg-orange-50 hover:shadow-orange-500/10",
              };

              const currentScheme = schemes[colorScheme] || schemes.blue;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openEmployeeModal(type)}
                  className={clsx(
                    "metric-card relative overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm transition-all group",
                    !metricStyles.bg && currentScheme
                  )}
                  style={{
                    backgroundColor: 'var(--hr-metric-bg)',
                    borderColor: 'rgba(0,0,0,0.05)'
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[9px] font-black uppercase tracking-widest opacity-60"
                        style={{ color: metricStyles.text || undefined }}
                      >
                        {label}
                      </p>
                      <p
                        className="mt-1 text-xl font-bold"
                        style={{ color: metricStyles.text || undefined }}
                      >
                        {String(counts[key]).padStart(2, '0')}
                      </p>
                    </div>
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm border border-current/10 shadow-sm transition-all group-hover:scale-110"
                      style={{ backgroundColor: metricStyles.bg ? 'rgba(255,255,255,0.2)' : undefined }}
                    >
                      {iconNode}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">Attendance Trend</h3>

              </div>
              <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-widest text-slate-900">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#94a3b8]" />
                  <span>Absent</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">Current Status</p>
                  <p className="mt-1 text-2xl font-medium text-slate-900">{attendanceSummaryBar.presentPercent}% Present</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">Total Workforce</p>
                  <p className="mt-1 text-lg font-medium text-slate-700">{attendanceSummaryBar.totalEmployees}</p>
                </div>
              </div>

              <div className="h-6 overflow-hidden rounded-full bg-slate-200 ring-4 ring-slate-100/50">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700 ease-out"
                    style={{ width: `${attendanceSummaryBar.presentPercent}%` }}
                    title={`Present ${attendanceSummaryBar.presentPercent}%`}
                  />
                  <div
                    className="h-full bg-slate-300 transition-all duration-700 ease-out"
                    style={{ width: `${attendanceSummaryBar.absentPercent}%` }}
                    title={`Absent ${attendanceSummaryBar.absentPercent}%`}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500">Present Today</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-xl font-medium text-slate-900">{attendanceSummaryBar.presentEmployees}</p>
                    <p className="text-xs font-bold text-blue-600/70">{attendanceSummaryBar.presentPercent}%</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">Absent Today</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-xl font-medium text-slate-900">{attendanceSummaryBar.absentEmployees}</p>
                    <p className="text-xs font-bold text-slate-400">{attendanceSummaryBar.absentPercent}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Open Positions</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hiring Status</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-100 p-2.5 text-slate-600">
                  <Briefcase size={20} />
                </div>
              </div>
              {positionsByDepartment.length ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center">
                    <PieChart width={96} height={96}>
                      <Pie data={positionsByDepartment} innerRadius={28} outerRadius={44} dataKey="value" stroke="none">
                        {positionsByDepartment.map((entry, index) => <Cell key={entry.name} fill={entry.color || donutColors[index % donutColors.length]} />)}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {positionsByDepartment.slice(0, 4).map((position) => (
                      <div key={position.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: position.color }} />
                          <span className="truncate text-xs font-medium text-slate-600 uppercase tracking-wider">{position.name}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{position.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-medium text-slate-500">
                  No open positions found
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm overflow-hidden relative">
              <div className="mb-3 flex items-center justify-between relative z-10">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Birthdays</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Celebrations</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-2 text-rose-400">
                  <Plus size={18} className="rotate-45" />
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                {birthdays.length ? birthdays.slice(0, 3).map((emp, idx) => {
                  const isToday = new Date(emp.dob).getDate() === new Date().getDate() && new Date(emp.dob).getMonth() === new Date().getMonth();

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => triggerCelebration(emp)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-2xl border p-3.5 transition-all active:scale-95 group/bday",
                        isToday
                          ? "bg-gradient-to-br from-rose-500 to-pink-600 border-rose-400 shadow-lg shadow-rose-200 animate-in zoom-in-95 duration-500"
                          : "border-slate-100 bg-white hover:bg-slate-50 hover:border-rose-200"
                      )}
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <p className={clsx("truncate text-sm font-bold", isToday ? "text-white" : "text-slate-900 group-hover/bday:text-rose-600")}>
                            {emp.firstName} {emp.lastName}
                          </p>
                          {isToday && (
                            <span className="bg-white/20 text-[8px] font-black uppercase text-white px-1.5 py-0.5 rounded-full backdrop-blur-md">Today</span>
                          )}
                        </div>
                        <p className={clsx("text-[10px] font-medium uppercase tracking-widest mt-1", isToday ? "text-rose-100" : "text-slate-400")}>
                          {isToday ? "Happy Birthday! 🎉" : formatDate(emp.dob)}
                        </p>
                      </div>
                      <div className={clsx(
                        "flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-transform group-hover/bday:rotate-12",
                        isToday ? "bg-white text-rose-500" : "bg-white text-rose-400"
                      )}>
                        <Zap size={16} fill={isToday ? "currentColor" : "none"} />
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-medium text-slate-500">
                    No birthdays this month
                  </div>
                )}
              </div>

              {/* Decorative Background Elements for Celebrations */}
              {birthdays.some(emp => new Date(emp.dob).getDate() === new Date().getDate() && new Date(emp.dob).getMonth() === new Date().getMonth()) && (
                <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
                  <Plus size={120} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-medium tracking-tight text-slate-900">Leave Pipeline</h3>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Requests and tracking</p>
            </div>
            <Link to="/hr/leave-approvals" className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium uppercase tracking-widest text-slate-700 shadow-sm transition hover:bg-slate-50">
              View All
            </Link>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={clsx(
                "h-10 shrink-0 rounded-xl px-4 text-xs font-medium uppercase tracking-widest transition-all",
                activeTab === 'pending' ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              Pending ({String(counts.pendingLeaves).padStart(2, '0')})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('onLeave')}
              className={clsx(
                "h-10 shrink-0 rounded-xl px-4 text-xs font-medium uppercase tracking-widest transition-all",
                activeTab === 'onLeave' ? "bg-sky-600 text-white shadow-lg shadow-sky-100" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              On Leave ({String(onLeaveTodayRequests.length).padStart(2, '0')})
            </button>
          </div>

          <div className="space-y-3">
            {queueItems.slice(0, 5).map((req, idx) => (
              <div key={idx} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-sky-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-black text-white shadow-md">
                    {getInitials(`${req.employee?.firstName} ${req.employee?.lastName}`)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{req.employee?.firstName} {req.employee?.lastName}</p>
                    <p className="truncate text-[11px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                      {(req.employee?.department?.name || req.employee?.department || 'General')} • {req.leaveType}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-medium text-slate-700">{formatDate(req.startDate)}{req.startDate !== req.endDate ? ` - ${formatDate(req.endDate)}` : ''}</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Duration</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestModal({ isOpen: true, req })}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                      title="View Details"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {req.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleAction(req._id, 'approve')}
                        disabled={actionLoading[req._id + 'approve']}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-100 transition-all hover:bg-sky-700 disabled:opacity-60"
                      >
                        {actionLoading[req._id + 'approve'] ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Plus size={18} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {queueItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm mb-3">
                  <ClipboardCheck size={24} />
                </div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">No active requests</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <EmployeeModal
        modal={employeeModal}
        onEmployeeClick={openEmployeeProfileFromModal}
        onClose={() => setEmployeeModal({ ...employeeModal, isOpen: false })}
      />
      <RequestModal modal={requestModal} onClose={() => setRequestModal({ isOpen: false, req: null })} />
    </>
  );
}
