import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, History, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRBAC } from '../../context/RBACContext';
import workflowService from '../../services/workflowService';
import WorkflowInstanceModal from '../../components/Approvals/WorkflowInstanceModal';

const tabs = [
  { key: 'PENDING', label: 'Pending', icon: Clock },
  { key: 'PROCESSED', label: 'Processed', icon: History },
];

function statusBadge(status) {
  const map = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    SENT_BACK: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return map[status] || 'bg-slate-50 text-slate-600 border-slate-200';
}

export default function ApprovalsDashboard() {
  const [activeTab, setActiveTab] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const { hasPermission } = useRBAC();

  const canProcessApproval = hasPermission('approval.approve', 'edit') || hasPermission('approval.approve', 'any');

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'PROCESSED') {
        const [approved, rejected, sentBack] = await Promise.all([
          workflowService.getInbox({ status: 'APPROVED' }),
          workflowService.getInbox({ status: 'REJECTED' }),
          workflowService.getInbox({ status: 'SENT_BACK' }),
        ]);
        setItems([...(approved.data || []), ...(rejected.data || []), ...(sentBack.data || [])]);
      } else {
        const response = await workflowService.getInbox({ status: activeTab });
        setItems(response.data || []);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load workflow approvals');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const counts = useMemo(() => ({
    total: items.length,
    overdue: items.filter((item) => item.dueAt && new Date(item.dueAt) < new Date() && item.status === 'PENDING').length,
  }), [items]);

  const handleAction = async (instanceId, action, comment) => {
    if (!canProcessApproval) {
      toast.error('Approve/reject permission is required.');
      return;
    }
    try {
      await workflowService.processAction(instanceId, { action, comment });
      toast.success(`Workflow ${action.toLowerCase().replace('_', ' ')} successfully`);
      setSelected(null);
      loadInbox();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Workflow action failed');
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Universal Approval Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">All modules route approvals through the centralized workflow engine.</p>
        </div>
        <button
          type="button"
          onClick={loadInbox}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Current View</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{counts.total}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Overdue</div>
          <div className="mt-2 text-2xl font-black text-rose-600">{counts.overdue}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Permission</div>
          <div className="mt-2 text-sm font-bold text-slate-800">{canProcessApproval ? 'Approve / Reject enabled' : 'View only'}</div>
        </div>
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-semibold text-slate-500">
          No workflow approvals found.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const instance = item.instance || {};
            return (
              <button
                type="button"
                key={item._id}
                onClick={() => setSelected(item)}
                className="flex w-full flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-base font-bold text-slate-900">{instance.entityType || 'Workflow'} Request</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {instance.moduleKey || 'module'} / {item.stepName || instance.currentStepKey || 'step'}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Due: {item.dueAt ? new Date(item.dueAt).toLocaleString() : 'No SLA due date'}
                  </div>
                </div>
                <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusBadge(item.status)}`}>
                  {item.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <WorkflowInstanceModal
          item={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          canProcess={canProcessApproval && selected.status === 'PENDING'}
        />
      ) : null}
    </div>
  );
}
