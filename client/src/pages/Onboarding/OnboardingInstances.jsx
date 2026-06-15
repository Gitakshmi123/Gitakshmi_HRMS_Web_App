import { useEffect, useState } from 'react';
import onboardingService from '../../services/onboardingService';
import api from '../../utils/api';
import './OnboardingWorkspace.css';

export default function OnboardingInstances() {
  const [instances, setInstances] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeId: '', templateId: '' });

  const load = async () => {
    const [instancesData, templatesData, employeesData] = await Promise.all([
      onboardingService.getInstances(),
      onboardingService.getTemplates(),
      api.get('/hr/employees').then((res) => res.data).catch(() => ({ data: [] })),
    ]);

    setInstances(instancesData.instances || []);
    setTemplates((templatesData.templates || []).filter((template) => !template.isGlobal || template.isActive));
    setEmployees(employeesData.data || employeesData.employees || []);
  };

  useEffect(() => { load(); }, []);

  const start = async () => {
    if (!form.employeeId || !form.templateId) return;
    await onboardingService.startOnboarding(form);
    setForm({ employeeId: '', templateId: '' });
    await load();
  };

  return (
    <div className="onb-shell rounded-[28px] p-4 md:p-6">
      <div className="onb-grid cols-3">
        <div className="onb-card rounded-[28px] p-5 lg:col-span-1">
          <h2 className="text-2xl font-black text-slate-900">Launch onboarding</h2>
          <p className="mt-2 text-sm text-slate-500">Select an employee and template. Tasks are generated automatically with role-based routing.</p>

          <div className="mt-5 space-y-4">
            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {[employee.firstName, employee.lastName].filter(Boolean).join(' ')} {employee.employeeId ? `(${employee.employeeId})` : ''}
                </option>
              ))}
            </select>

            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.templateId} onChange={(e) => setForm((prev) => ({ ...prev, templateId: e.target.value }))}>
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template._id} value={template._id}>{template.name}</option>
              ))}
            </select>

            <button type="button" onClick={start} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
              Start Onboarding
            </button>
          </div>
        </div>

        <div className="onb-card rounded-[28px] p-5 lg:col-span-2">
          <h3 className="text-xl font-black text-slate-900">Live onboarding instances</h3>
          <div className="mt-4 space-y-3">
            {instances.map((instance) => (
              <div key={instance._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{instance.employee?.firstName} {instance.employee?.lastName}</p>
                    <p className="text-sm text-slate-500">{instance.template?.name}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="onb-pill bg-sky-50 text-sky-700">{instance.progressPercent || 0}% complete</span>
                    <span className="onb-pill bg-slate-100 text-slate-700">{instance.status}</span>
                  </div>
                </div>
              </div>
            ))}
            {instances.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No onboarding journeys have been started yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
