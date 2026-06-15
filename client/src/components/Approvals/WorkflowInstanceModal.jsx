import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import workflowService from '../../services/workflowService';

const statusClass = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  SENT_BACK: 'bg-orange-50 text-orange-700 border-orange-200',
  SKIPPED: 'bg-slate-50 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
};

function Pill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[status] || statusClass.PENDING}`}>
      {status || 'PENDING'}
    </span>
  );
}

export default function WorkflowInstanceModal({ item, onClose, onAction, canProcess }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');

  const instanceId = item?.instanceId || item?.instance?._id;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!instanceId) return;
      setLoading(true);
      try {
        const res = await workflowService.getInstance(instanceId);
        if (active) setDetails(res.data);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [instanceId]);

  const instance = details?.instance || item?.instance || {};
  const contextRows = useMemo(() => {
    const snapshot = instance?.contextSnapshot || {};
    return Object.entries(snapshot)
      .filter(([key]) => key !== 'hierarchyChain')
      .slice(0, 12);
  }, [instance]);

  const submit = (action) => {
    onAction?.(instanceId, action, comment);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{instance.entityType || 'Workflow'} Approval</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {instance.moduleKey || 'module'} / {instance.currentStepKey || 'completed'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Status</div>
                  <div className="mt-2"><Pill status={instance.status} /></div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Step</div>
                  <div className="mt-2 text-sm font-bold text-slate-800">{item.stepName || instance.currentStepKey || 'N/A'}</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Due</div>
                  <div className="mt-2 text-sm font-bold text-slate-800">{item.dueAt ? new Date(item.dueAt).toLocaleString() : 'N/A'}</div>
                </div>
              </div>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">Request Context</h3>
                <div className="rounded-lg border border-slate-100">
                  {contextRows.length ? contextRows.map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-3 border-b border-slate-100 px-4 py-2 text-sm last:border-b-0">
                      <div className="font-semibold text-slate-500">{key}</div>
                      <div className="col-span-2 break-words text-slate-800">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                      </div>
                    </div>
                  )) : (
                    <div className="px-4 py-5 text-sm text-slate-500">No request context captured.</div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">Assignments</h3>
                <div className="space-y-2">
                  {(details?.assignments || []).map((assignment) => (
                    <div key={assignment._id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{assignment.stepName}</div>
                        <div className="text-xs text-slate-500">Order {assignment.stepOrder}</div>
                      </div>
                      <Pill status={assignment.status} />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">Audit Timeline</h3>
                <div className="space-y-3 border-l-2 border-slate-100 pl-4">
                  {(details?.history || []).map((event) => (
                    <div key={event._id} className="relative">
                      <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                      <div className="text-sm font-bold text-slate-800">{event.action}</div>
                      <div className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
                      {event.comment ? <div className="mt-1 text-sm text-slate-600">{event.comment}</div> : null}
                    </div>
                  ))}
                </div>
              </section>

              {canProcess ? (
                <textarea
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  rows="3"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Add approval comment"
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          {canProcess ? (
            <>
              <button type="button" onClick={() => submit('SENT_BACK')} className="rounded-lg bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-200">Send Back</button>
              <button type="button" onClick={() => submit('REJECTED')} className="rounded-lg bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-200">Reject</button>
              <button type="button" onClick={() => submit('APPROVED')} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Approve</button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-white hover:bg-slate-900">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
