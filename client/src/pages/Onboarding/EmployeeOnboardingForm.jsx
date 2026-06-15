import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { extractEmployeeProfilePayload, isEmployeePendingActivation } from '../../utils/employeeProfile';

const STATUS_CONFIG = {
  APPROVED: {
    icon: <CheckCircleOutlined className="text-[42px] text-emerald-600" />,
    title: 'Account Activated',
    description: 'Your employee account is active now. You can continue to your dashboard.',
    badge: 'Ready',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    primaryLabel: 'Open Dashboard',
  },
  SUBMITTED: {
    icon: <ClockCircleOutlined className="text-[42px] text-amber-500" />,
    title: 'Profile Under Review',
    description: 'HR is reviewing your onboarding details. Once approved, employee modules will unlock automatically.',
    badge: 'Waiting For HR',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    primaryLabel: 'Refresh Status',
  },
  PENDING: {
    icon: <ClockCircleOutlined className="text-[42px] text-amber-500" />,
    title: 'Activation Pending',
    description: 'Your account is not active yet. Please wait for HR to complete the activation process.',
    badge: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    primaryLabel: 'Refresh Status',
  },
  DRAFT: {
    icon: <ExclamationCircleOutlined className="text-[42px] text-sky-600" />,
    title: 'Onboarding Managed By HR',
    description: 'This employee form has been disabled. If any details are still required, please contact HR directly.',
    badge: 'Contact HR',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    primaryLabel: 'Refresh Status',
  },
  NOT_STARTED: {
    icon: <ExclamationCircleOutlined className="text-[42px] text-sky-600" />,
    title: 'Onboarding Managed By HR',
    description: 'This employee form has been disabled. Please contact HR if your account has not been activated yet.',
    badge: 'Contact HR',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    primaryLabel: 'Refresh Status',
  },
  DEFAULT: {
    icon: <ClockCircleOutlined className="text-[42px] text-slate-500" />,
    title: 'Activation Status',
    description: 'Your account status is being checked. If this screen stays here, please contact HR.',
    badge: 'Checking',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    primaryLabel: 'Refresh Status',
  },
};

export default function EmployeeOnboardingForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('DEFAULT');
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setRefreshing(true);
    }

    try {
      const [profileRes, onboardingRes] = await Promise.allSettled([
        api.get('/employee/profile', { _silent: true }),
        api.get('/onboarding-workflow/my-status', { _silent: true }),
      ]);

      const profileData =
        profileRes.status === 'fulfilled'
          ? extractEmployeeProfilePayload(profileRes.value?.data)
          : null;

      const onboardingData =
        onboardingRes.status === 'fulfilled'
          ? onboardingRes.value?.data?.data || null
          : null;

      const normalizedStatus = String(
        onboardingData?.status ||
        profileData?.status ||
        'DEFAULT'
      ).trim().toUpperCase();

      setProfile(profileData || onboardingData || null);
      setStatus(STATUS_CONFIG[normalizedStatus] ? normalizedStatus : 'DEFAULT');

      if (normalizedStatus === 'APPROVED' || !isEmployeePendingActivation(profileData, profileRes.status === 'fulfilled' ? profileRes.value?.data?.message : '')) {
        navigate('/employee', { replace: true });
        return;
      }

      const backendMessage =
        onboardingRes.status === 'fulfilled'
          ? onboardingRes.value?.data?.message
          : profileRes.status === 'fulfilled'
            ? profileRes.value?.data?.message
            : '';

      setMessage(String(backendMessage || '').trim());
    } catch {
      setStatus('DEFAULT');
      setMessage('Unable to fetch activation status right now. Please try again or contact HR.');
    } finally {
      setLoading(false);
      if (!silent) {
        setRefreshing(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    loadStatus({ silent: true });
  }, [loadStatus]);

  const config = useMemo(() => STATUS_CONFIG[status] || STATUS_CONFIG.DEFAULT, [status]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-white px-4 py-10">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <Spin size="small" />
          <span className="text-sm font-semibold text-slate-600">Checking employee activation status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_-28px_rgba(15,23,42,0.25)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#eff6ff,white_55%,#f8fafc)] px-8 py-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
            {config.icon}
          </div>
          <div className={`mx-auto inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${config.badgeClass}`}>
            {config.badge}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900">{config.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
            {config.description}
          </p>
        </div>

        <div className="space-y-5 px-8 py-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Current Status</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(status || 'DEFAULT').replace(/_/g, ' ')}</p>
            {profile?.email && (
              <p className="mt-1 text-sm text-slate-500">{profile.email}</p>
            )}
          </div>

          {message ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-medium leading-6 text-sky-800">
              {message}
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Important</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The old onboarding form has been removed from the employee panel. If anything is missing in your account, HR will guide you directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              size="large"
              onClick={() => loadStatus()}
              loading={refreshing}
            >
              {config.primaryLabel}
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/employee', { replace: true })}
            >
              Go To Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
