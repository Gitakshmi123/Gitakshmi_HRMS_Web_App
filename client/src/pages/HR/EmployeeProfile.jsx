import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import EmployeeProfileView from '../../components/EmployeeProfileView';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

export default function EmployeeProfile() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const seededEmployee = location.state?.employee || null;
  const seededEmployeeId = seededEmployee?._id || seededEmployee?.id || null;
  const seededEmployeeMatchesRoute = Boolean(
    employeeId &&
    seededEmployeeId &&
    String(seededEmployeeId) === String(employeeId)
  );
  const [employee, setEmployee] = useState(seededEmployee || null);
  const [loading, setLoading] = useState(Boolean(employeeId && !seededEmployeeMatchesRoute));
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const employeesPath = useMemo(() => {
    return location.pathname.startsWith('/tenant') ? '/tenant/employees' : '/hr/employees';
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployee() {
      if (!employeeId) {
        setLoading(false);
        return;
      }

      if (seededEmployeeMatchesRoute) {
        if (!cancelled) {
          setEmployee((current) => current || seededEmployee);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await api.get(`/hr/employees/${employeeId}`);
        if (!cancelled) {
          setEmployee(res.data?.data || res.data || null);
        }
      } catch {
        if (!cancelled) {
          showToast('error', 'Error', 'Failed to load employee profile');
          navigate(employeesPath, { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEmployee();

    return () => {
      cancelled = true;
    };
  }, [employeeId, employeesPath, navigate, seededEmployee, seededEmployeeMatchesRoute]);

  useEffect(() => {
    let cancelled = false;

    const loadLeaveHistory = async () => {
      if (!employeeId) {
        if (!cancelled) setLeaveHistory([]);
        return;
      }

      setHistoryLoading(true);
      try {
        const res = await api.get('/hr/leaves/requests');
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];

        const filtered = list
          .filter((leave) => String(leave?.employee?._id || leave?.employee) === String(employeeId))
          .sort(
            (a, b) =>
              new Date(b?.updatedAt || b?.createdAt || b?.startDate).getTime() -
              new Date(a?.updatedAt || a?.createdAt || a?.startDate).getTime()
          );

        if (!cancelled) setLeaveHistory(filtered);
      } catch {
        if (!cancelled) setLeaveHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    loadLeaveHistory();

    const intervalId = window.setInterval(loadLeaveHistory, 30000);
    const onFocus = () => loadLeaveHistory();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [employeeId]);

  const latestLeave = leaveHistory[0] || null;

  const statusClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (normalized === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (normalized === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatDate = (value) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen">
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
            <p className="mt-4 text-sm font-medium text-slate-500">Loading employee profile...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <EmployeeProfileView 
            employee={employee} 
            leaveHistory={leaveHistory} 
            historyLoading={historyLoading} 
          />
        </div>
      )}
    </div>
  );
}
