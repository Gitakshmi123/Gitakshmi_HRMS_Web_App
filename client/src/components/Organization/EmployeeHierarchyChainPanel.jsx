import React, { useEffect, useState } from 'react';
import { RefreshCw, Route } from 'lucide-react';
import hierarchyService from '../../services/hierarchyService';

export default function EmployeeHierarchyChainPanel({ employee }) {
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async (rebuild = false) => {
    if (!employee?._id) return;
    setLoading(true);
    try {
      const response = rebuild
        ? await hierarchyService.rebuildEmployeeChain(employee._id, { type: employee.hierarchySource === 'employee' ? 'employee' : 'user' })
        : await hierarchyService.getEmployeeChain(employee._id, {
          type: employee.hierarchySource === 'employee' ? 'employee' : 'user',
        });
      setChain(response.data);
    } catch {
      setChain({ chain: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?._id]);

  if (!employee?._id) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Route size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Reporting Chain</h3>
            <p className="text-xs text-slate-500">Used by the universal workflow engine.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Rebuild
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-sm font-semibold text-slate-500">Loading chain...</div>
      ) : !chain?.chain?.length ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          No reporting chain resolved. Assign a manager, department head, HR Head or CEO.
        </div>
      ) : (
        <div className="space-y-2">
          {chain.chain.map((node) => (
            <div key={`${node.relationKey}-${node.employeeId || node.userId || node.email}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{node.name || node.email || 'Unassigned'}</div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{node.relationLabel || node.relationKey}</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{node.role || 'role not set'}</div>
                <div>{node.source}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
