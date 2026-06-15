import { useEffect, useState } from 'react';
import onboardingService from '../../services/onboardingService';
import './OnboardingWorkspace.css';

export default function SuperAdminOnboardingOverview() {
  const [data, setData] = useState({ summary: {}, companies: [], globalTemplates: [] });

  useEffect(() => {
    onboardingService.getSuperAdminOverview().then(setData);
  }, []);

  return (
    <div className="onb-shell min-h-screen p-5 md:p-8">
      <div className="mb-6">
        <p className="onb-pill bg-slate-900 text-white">Multi-tenant control</p>
        <h1 className="mt-3 text-3xl font-black text-slate-900">Super admin onboarding overview</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Monitor onboarding performance across companies and manage global onboarding templates at the product layer.</p>
      </div>

      <div className="onb-grid cols-4 mb-6">
        {[
          ['companies', 'Companies'],
          ['activeOnboardings', 'Active onboardings'],
          ['pendingTasks', 'Pending tasks'],
          ['completedOnboardings', 'Completed onboardings'],
        ].map(([key, label]) => (
          <div key={key} className="onb-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{data.summary?.[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="onb-grid cols-3">
        <div className="onb-card rounded-[28px] p-5 lg:col-span-2">
          <h2 className="text-xl font-black text-slate-900">Company rollout</h2>
          <div className="mt-4 space-y-3">
            {(data.companies || []).map((company) => (
              <div key={company._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{company.companyName}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{company.code}</p>
                  </div>
                  <span className="onb-pill bg-slate-100 text-slate-700">{company.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="onb-card rounded-[28px] p-5">
          <h2 className="text-xl font-black text-slate-900">Global templates</h2>
          <div className="mt-4 space-y-3">
            {(data.globalTemplates || []).map((template) => (
              <div key={template._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="font-bold text-slate-900">{template.name}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{template.code}</p>
              </div>
            ))}
            {(!data.globalTemplates || data.globalTemplates.length === 0) && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No global templates published yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
