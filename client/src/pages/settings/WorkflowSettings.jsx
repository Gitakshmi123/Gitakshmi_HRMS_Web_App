import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Send, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import workflowService from '../../services/workflowService';

const entityOptions = [
  { moduleKey: 'leave', entityType: 'LeaveRequest', label: 'Leave Request' },
  { moduleKey: 'recruitment', entityType: 'ManpowerRequest', label: 'Manpower Request' },
  { moduleKey: 'recruitment', entityType: 'GeneratedLetter', label: 'Offer Letter' },
  { moduleKey: 'employee', entityType: 'EmployeeActivation', label: 'Employee Activation' },
  { moduleKey: 'expense', entityType: 'ExpenseClaim', label: 'Expense Claim' },
  { moduleKey: 'payroll', entityType: 'SalaryRevision', label: 'Salary Revision' },
  { moduleKey: 'exit', entityType: 'ExitRequest', label: 'Resignation / Exit' },
];

const approverTypes = [
  ['REPORTING_MANAGER', 'Reporting Manager'],
  ['TEAM_LEAD', 'Team Lead'],
  ['DEPARTMENT_HEAD', 'Department Head'],
  ['BRANCH_HEAD', 'Branch Head'],
  ['HR', 'HR'],
  ['HR_HEAD', 'HR Head'],
  ['FINANCE', 'Finance'],
  ['FINANCE_HEAD', 'Finance Head'],
  ['CEO', 'CEO'],
  ['ROLE', 'Role'],
  ['SPECIFIC_EMPLOYEE', 'Specific Employee'],
];

const blankStep = (order = 1) => ({
  key: `step_${order}`,
  name: `Approval Step ${order}`,
  order,
  approvalMode: 'ANY',
  minApprovals: 1,
  slaHours: 24,
  approver: { type: 'REPORTING_MANAGER', value: '' },
  fallbackApprover: { type: 'HR', value: 'hr' },
  conditionJoin: 'AND',
  conditions: [],
});

const getEntityFields = (entityType) => {
  switch (entityType) {
    case 'LeaveRequest': return ['leaveDays', 'leaveType', 'isConsecutive'];
    case 'ExpenseClaim': return ['amount', 'expenseCategory'];
    case 'SalaryRevision': return ['percentageIncrease', 'newSalary'];
    case 'GeneratedLetter': return ['offerAmount', 'department'];
    default: return ['amount', 'days'];
  }
};

function buildPayload(form) {
  return {
    name: form.name,
    description: form.description,
    moduleKey: form.moduleKey,
    entityType: form.entityType,
    definition: {
      settings: {
        allowRequesterApproval: false,
        rejectPolicy: 'ANY_REJECTS',
      },
      rules: [],
      steps: form.steps.map((step, index) => ({
        ...step,
        key: step.key || `step_${index + 1}`,
        name: step.name || `Approval Step ${index + 1}`,
        order: Number(step.order || index + 1),
        minApprovals: Number(step.minApprovals || 1),
        slaHours: Number(step.slaHours || 24),
        approver: {
          type: step.approver?.type || 'REPORTING_MANAGER',
          value: step.approver?.value || null,
        },
        fallbackApprover: {
          type: step.fallbackApprover?.type || 'HR',
          value: step.fallbackApprover?.value || null,
        },
        conditionJoin: step.conditionJoin || 'AND',
        conditions: (step.conditions || []).filter((condition) => condition.field && condition.operator),
      })),
    },
    applicableUnitIds: form.applicableUnitIds || [],
    isGlobal: form.isGlobal !== false,
  };
}

export default function WorkflowSettings({ embedded = false, unitId = null }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: 'Leave Approval',
    description: '',
    moduleKey: 'leave',
    entityType: 'LeaveRequest',
    steps: [blankStep(1)],
  });

  const selectedEntity = useMemo(
    () => entityOptions.find((item) => item.moduleKey === form.moduleKey && item.entityType === form.entityType),
    [form.moduleKey, form.entityType]
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await workflowService.listWorkflows();
      setWorkflows(response.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setForm({
      name: selectedEntity?.label ? `${selectedEntity.label} Workflow` : 'Approval Workflow',
      description: '',
      moduleKey: 'leave',
      entityType: 'LeaveRequest',
      steps: [
        {
          ...blankStep(1),
          key: 'reporting_manager',
          name: 'Reporting Manager',
          approver: { type: 'REPORTING_MANAGER', value: '' },
        },
      ],
    });
    setEditing(true);
  };

  const editWorkflow = async (workflow) => {
    try {
      const response = await workflowService.getWorkflow(workflow._id);
      const latest = response.data?.versions?.[0];
      setForm({
        _id: workflow._id,
        name: workflow.name || '',
        description: workflow.description || '',
        moduleKey: workflow.moduleKey || 'leave',
        entityType: workflow.entityType || 'LeaveRequest',
        steps: latest?.definition?.steps?.length ? latest.definition.steps : [blankStep(1)],
        isGlobal: workflow.isGlobal !== false,
        applicableUnitIds: workflow.applicableUnitIds || [],
      });
      setEditing(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to open workflow');
    }
  };

  const saveWorkflow = async (event) => {
    event.preventDefault();
    if (!form.name || !form.moduleKey || !form.entityType) {
      toast.error('Workflow name, module and entity are required');
      return;
    }
    if (!form.steps.length) {
      toast.error('At least one workflow step is required');
      return;
    }

    try {
      const payload = buildPayload(form);
      if (embedded && unitId) {
        payload.isGlobal = false;
        payload.applicableUnitIds = [unitId];
      }

      if (form._id) {
        await workflowService.updateWorkflow(form._id, payload);
        toast.success('Workflow draft updated');
      } else {
        await workflowService.createWorkflow(payload);
        toast.success('Workflow draft created');
      }
      setEditing(false);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save workflow');
    }
  };

  const publishWorkflow = async (id) => {
    try {
      await workflowService.publishWorkflow(id);
      toast.success('Workflow published');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to publish workflow');
    }
  };

  const disableWorkflow = async (id) => {
    try {
      await workflowService.disableWorkflow(id);
      toast.success('Workflow disabled');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to disable workflow');
    }
  };

  const updateStep = (index, updater) => {
    setForm((current) => {
      const steps = current.steps.map((step, stepIndex) => (
        stepIndex === index ? updater(step) : step
      ));
      return { ...current, steps };
    });
  };

  const addCondition = (index) => {
    updateStep(index, (step) => ({
      ...step,
      conditions: [...(step.conditions || []), { field: 'amount', operator: 'gt', value: 0 }],
    }));
  };

  const removeStep = (index) => {
    setForm((current) => ({
      ...current,
      steps: current.steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({ ...step, order: stepIndex + 1 })),
    }));
  };

  const setEntity = (value) => {
    const [moduleKey, entityType] = value.split('|');
    setForm((current) => ({ ...current, moduleKey, entityType }));
  };

  return (
    <div className={embedded ? "w-full animate-fade-in" : "mx-auto max-w-7xl p-6"}>
      {!embedded ? (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Universal Workflow Designer</h1>
            <p className="mt-1 text-sm text-slate-500">One approval engine for Leave, Hiring, Payroll, Expense, Exit and every future module.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw size={16} />
              Refresh
            </button>
            <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
              <Plus size={16} />
              Create Workflow
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Universal Workflows</h2>
            <p className="text-xs text-slate-500 mt-0.5">Flows adapt automatically to the organization hierarchy.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw size={14} />
              Refresh
            </button>
            <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm shadow-blue-200">
              <Plus size={14} />
              Create Workflow
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <form onSubmit={saveWorkflow} className="mb-8 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Name</label>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Module Event</label>
              <select value={`${form.moduleKey}|${form.entityType}`} onChange={(event) => setEntity(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                {entityOptions.map((option) => (
                  <option key={`${option.moduleKey}|${option.entityType}`} value={`${option.moduleKey}|${option.entityType}`}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Description</label>
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="space-y-4">
            {form.steps.map((step, index) => (
              <div key={`${step.key}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                    <Settings2 size={16} />
                    Step {index + 1}
                  </div>
                  <button type="button" onClick={() => removeStep(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input value={step.name} onChange={(event) => updateStep(index, (current) => ({ ...current, name: event.target.value, key: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || current.key }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Step name" />
                  <select value={step.approver?.type || 'REPORTING_MANAGER'} onChange={(event) => updateStep(index, (current) => ({ ...current, approver: { ...current.approver, type: event.target.value } }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                    {approverTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input value={step.approver?.value || ''} onChange={(event) => updateStep(index, (current) => ({ ...current, approver: { ...current.approver, value: event.target.value } }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Role or employee id, if needed" />
                  <input type="number" min="1" value={step.slaHours || 24} onChange={(event) => updateStep(index, (current) => ({ ...current, slaHours: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="SLA hours" />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <select value={step.approvalMode || 'ANY'} onChange={(event) => updateStep(index, (current) => ({ ...current, approvalMode: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="ANY">Any one approver</option>
                    <option value="ALL">All approvers</option>
                    <option value="MAJORITY">Majority</option>
                  </select>
                  <input type="number" min="1" value={step.minApprovals || 1} onChange={(event) => updateStep(index, (current) => ({ ...current, minApprovals: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Minimum approvals" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addCondition(index)} className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">Add condition</button>
                    {(step.conditions || []).length > 1 && (
                      <select value={step.conditionJoin || 'AND'} onChange={(event) => updateStep(index, (current) => ({ ...current, conditionJoin: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none">
                        <option value="AND">Match ALL (AND)</option>
                        <option value="OR">Match ANY (OR)</option>
                      </select>
                    )}
                  </div>
                </div>

                {(step.conditions || []).length ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Execute this step if:</div>
                    {step.conditions.map((condition, conditionIndex) => (
                      <div key={conditionIndex} className="grid grid-cols-1 gap-2 md:grid-cols-4 items-center">
                        <select value={condition.field || ''} onChange={(event) => updateStep(index, (current) => {
                          const conditions = [...(current.conditions || [])];
                          conditions[conditionIndex] = { ...conditions[conditionIndex], field: event.target.value };
                          return { ...current, conditions };
                        })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Select Field...</option>
                          {getEntityFields(form.entityType).map(f => <option key={f} value={f}>{f}</option>)}
                          <option value="custom">Custom Field...</option>
                        </select>
                        <select value={condition.operator || 'gt'} onChange={(event) => updateStep(index, (current) => {
                          const conditions = [...(current.conditions || [])];
                          conditions[conditionIndex] = { ...conditions[conditionIndex], operator: event.target.value };
                          return { ...current, conditions };
                        })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="eq">Equals</option>
                          <option value="gt">Greater than</option>
                          <option value="gte">Greater/equal</option>
                          <option value="lt">Less than</option>
                          <option value="lte">Less/equal</option>
                        </select>
                        <input value={condition.value ?? ''} onChange={(event) => updateStep(index, (current) => {
                          const conditions = [...(current.conditions || [])];
                          conditions[conditionIndex] = { ...conditions[conditionIndex], value: event.target.value };
                          return { ...current, conditions };
                        })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Value" />
                        <button type="button" onClick={() => updateStep(index, (current) => ({ ...current, conditions: (current.conditions || []).filter((_, idx) => idx !== conditionIndex) }))} className="rounded-lg text-sm font-bold text-rose-600 hover:bg-rose-50">Remove</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-between">
            <button type="button" onClick={() => setForm((current) => ({ ...current, steps: [...current.steps, blankStep(current.steps.length + 1)] }))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Add Step</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Save Draft</button>
            </div>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-semibold text-slate-500">No workflow templates configured.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <div key={workflow._id} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{workflow.moduleKey} / {workflow.entityType}</div>
                  <h3 className="mt-1 text-lg font-black text-slate-900">{workflow.name}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${workflow.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {workflow.status}
                </span>
              </div>
              <p className="min-h-[2rem] text-sm text-slate-500">{workflow.description || 'No description'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => editWorkflow(workflow)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Edit</button>
                <button type="button" onClick={() => publishWorkflow(workflow._id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  <Send size={14} />
                  Publish
                </button>
                <button type="button" onClick={() => disableWorkflow(workflow._id)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Disable</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
