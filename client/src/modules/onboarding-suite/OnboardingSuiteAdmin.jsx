import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, FileText, GitBranch, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import onboardingSuiteApi from './api';
import './onboardingSuite.css';

const defaultStep = {
  key: 'personal_info',
  title: 'Personal Information',
  phase: 'pre_onboarding',
  type: 'form',
  order: 1,
  assignedRole: 'employee',
  executionMode: 'sequential',
  conditions: {},
  dependencies: [],
  config: {
    formSchema: [
      { name: 'firstName', label: 'First name', type: 'text', required: true },
      { name: 'lastName', label: 'Last name', type: 'text', required: true },
      { name: 'mobile', label: 'Mobile', type: 'tel', required: true },
    ],
  },
};

function statusClass(status) {
  if (status === 'completed') return 'os-badge os-badge-ok';
  if (status === 'blocked') return 'os-badge os-badge-danger';
  if (status === 'in_progress') return 'os-badge os-badge-info';
  return 'os-badge';
}

export default function OnboardingSuiteAdmin() {
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({
    name: 'Developer Onboarding',
    code: 'DEV_ONBOARDING',
    description: 'Role-based onboarding workflow for developer hires.',
    targetRoles: ['developer'],
    targetDepartments: ['IT'],
    status: 'active',
    steps: [
      defaultStep,
      {
        key: 'kyc_documents',
        title: 'Upload KYC Documents',
        phase: 'pre_onboarding',
        type: 'document',
        order: 2,
        assignedRole: 'employee',
        dependencies: [{ stepKey: 'personal_info', status: 'completed' }],
        config: { requiredDocuments: ['AADHAAR', 'PAN', 'BANK_PROOF'] },
      },
      {
        key: 'hr_approval',
        title: 'HR Verification',
        phase: 'day_1',
        type: 'approval',
        order: 3,
        assignedRole: 'hr',
        dependencies: [{ stepKey: 'kyc_documents', status: 'completed' }],
        config: { approvalLevels: [{ level: 1, role: 'hr' }] },
      },
      {
        key: 'face_registration',
        title: 'Face Registration',
        phase: 'day_1',
        type: 'face_registration',
        order: 4,
        assignedRole: 'employee',
        dependencies: [{ stepKey: 'hr_approval', status: 'completed' }],
        config: { livenessRequired: true },
      },
    ],
  });

  const summary = useMemo(() => ({
    total: assignments.length,
    active: assignments.filter((item) => item.status === 'in_progress').length,
    blocked: assignments.filter((item) => item.status === 'blocked').length,
    completed: assignments.filter((item) => item.status === 'completed').length,
  }), [assignments]);

  const load = async () => {
    setLoading(true);
    try {
      const [templateRes, assignmentRes] = await Promise.all([
        onboardingSuiteApi.listTemplates(),
        onboardingSuiteApi.listAssignments({ limit: 50 }),
      ]);
      setTemplates(templateRes.templates || []);
      setAssignments(assignmentRes.assignments || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addStep = () => {
    setTemplateDraft((draft) => ({
      ...draft,
      steps: [
        ...draft.steps,
        {
          ...defaultStep,
          key: `step_${draft.steps.length + 1}`,
          title: `Step ${draft.steps.length + 1}`,
          order: draft.steps.length + 1,
        },
      ],
    }));
  };

  const saveTemplate = async () => {
    await onboardingSuiteApi.createTemplate(templateDraft);
    await load();
  };

  return (
    <div className="os-shell">
      <header className="os-header">
        <div>
          <p className="os-kicker">Onboarding Suite</p>
          <h1>Admin control center</h1>
        </div>
        <button className="os-icon-button" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="os-metrics">
        <Metric icon={Users} label="Total" value={summary.total} />
        <Metric icon={GitBranch} label="In progress" value={summary.active} />
        <Metric icon={Bell} label="Blocked" value={summary.blocked} tone="danger" />
        <Metric icon={CheckCircle2} label="Completed" value={summary.completed} tone="ok" />
      </section>

      <div className="os-grid">
        <section className="os-panel">
          <div className="os-panel-head">
            <div>
              <h2>Workflow template</h2>
              <p>Configure dynamic steps, dependencies, conditions, and triggers.</p>
            </div>
            <button className="os-button" onClick={saveTemplate}><Plus size={16} /> Save</button>
          </div>

          <div className="os-form-grid">
            <label>Name<input value={templateDraft.name} onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })} /></label>
            <label>Code<input value={templateDraft.code} onChange={(e) => setTemplateDraft({ ...templateDraft, code: e.target.value })} /></label>
            <label>Target role<input value={templateDraft.targetRoles.join(',')} onChange={(e) => setTemplateDraft({ ...templateDraft, targetRoles: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label>
            <label>Department<input value={templateDraft.targetDepartments.join(',')} onChange={(e) => setTemplateDraft({ ...templateDraft, targetDepartments: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label>
          </div>

          <div className="os-step-list">
            {templateDraft.steps.map((step, index) => (
              <div className="os-step-row" key={step.key}>
                <span className="os-step-index">{index + 1}</span>
                <input value={step.title} onChange={(e) => {
                  const steps = [...templateDraft.steps];
                  steps[index] = { ...step, title: e.target.value };
                  setTemplateDraft({ ...templateDraft, steps });
                }} />
                <select value={step.type} onChange={(e) => {
                  const steps = [...templateDraft.steps];
                  steps[index] = { ...step, type: e.target.value };
                  setTemplateDraft({ ...templateDraft, steps });
                }}>
                  <option value="form">Form</option>
                  <option value="document">Document</option>
                  <option value="approval">Approval</option>
                  <option value="training">Training</option>
                  <option value="api_trigger">API trigger</option>
                  <option value="face_registration">Face registration</option>
                </select>
                <span className="os-muted">{step.phase}</span>
              </div>
            ))}
          </div>
          <button className="os-secondary" onClick={addStep}><Plus size={16} /> Add step</button>
        </section>

        <section className="os-panel">
          <div className="os-panel-head">
            <div>
              <h2>Active templates</h2>
              <p>Versioned workflows ready for assignment.</p>
            </div>
          </div>
          <div className="os-list">
            {templates.map((template) => (
              <div className="os-list-item" key={template._id}>
                <FileText size={18} />
                <div>
                  <strong>{template.name}</strong>
                  <span>{template.code} v{template.version} - {template.steps?.length || 0} steps</span>
                </div>
                <span className={template.status === 'active' ? 'os-badge os-badge-ok' : 'os-badge'}>{template.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="os-panel">
        <div className="os-panel-head">
          <div>
            <h2>Employee onboarding</h2>
            <p>Monitor progress, blocked steps, and completion.</p>
          </div>
        </div>
        <div className="os-table">
          <div className="os-table-head"><span>Employee</span><span>Status</span><span>Phase</span><span>Progress</span></div>
          {assignments.map((assignment) => (
            <div className="os-table-row" key={assignment._id}>
              <span>{assignment.employeeSnapshot?.name || assignment.employee}</span>
              <span className={statusClass(assignment.status)}>{assignment.status}</span>
              <span>{assignment.phase}</span>
              <div className="os-mini-progress"><i style={{ width: `${assignment.progressPercent || 0}%` }} /><b>{assignment.progressPercent || 0}%</b></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone = '' }) {
  const IconComponent = icon;
  return (
    <div className={`os-metric ${tone}`}>
      <IconComponent size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
