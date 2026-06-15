import React, { useState } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

const STATUS_STYLE = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    Completed: 'bg-blue-50 text-blue-700 border-blue-200',
};

const STAGE_STYLE = {
    'Requested': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'HR Review': 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
    'Notice Period': 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    'Clearance': 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    'FNF': 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
    'Letters Generated': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    'Deactivated': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
};

export default function ExitRequestsTable({ requests, onView }) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatus] = useState('');
    const [stageFilter, setStage] = useState('');
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const filtered = requests
        .filter(r => {
            const name = `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.toLowerCase();
            const q = search.toLowerCase();
            const matchSearch = !q || name.includes(q) || (r.reason || '').toLowerCase().includes(q);
            const matchStatus = !statusFilter || r.status === statusFilter;
            const matchStage = !stageFilter || r.stage === stageFilter;
            return matchSearch && matchStatus && matchStage;
        })
        .sort((a, b) => {
            let va = a[sortField], vb = b[sortField];
            if (sortField === 'employee') {
                va = `${a.employee?.firstName} ${a.employee?.lastName}`;
                vb = `${b.employee?.firstName} ${b.employee?.lastName}`;
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

    const SortIcon = ({ field }) => sortField === field
        ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
        : <ChevronDown size={13} className="opacity-30" />;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search employee or reason..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatus(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Completed">Completed</option>
                </select>
                <select
                    value={stageFilter}
                    onChange={e => setStage(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">All Stages</option>
                    <option value="Requested">Requested</option>
                    <option value="HR Review">HR Review</option>
                    <option value="Notice Period">Notice Period</option>
                    <option value="Clearance">Clearance</option>
                    <option value="FNF">FNF</option>
                    <option value="Letters Generated">Letters Generated</option>
                    <option value="Deactivated">Deactivated</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        <tr>
                            <th className="px-5 py-3 text-left">
                                <button onClick={() => toggleSort('employee')} className="flex items-center gap-1 hover:text-slate-700">
                                    Employee <SortIcon field="employee" />
                                </button>
                            </th>
                            <th className="px-5 py-3 text-left">Dept.</th>
                            <th className="px-5 py-3 text-left">Exit Type</th>
                            <th className="px-5 py-3 text-left">Reason</th>
                            <th className="px-5 py-3 text-left">
                                <button onClick={() => toggleSort('stage')} className="flex items-center gap-1 hover:text-slate-700">
                                    Stage <SortIcon field="stage" />
                                </button>
                            </th>
                            <th className="px-5 py-3 text-left">Status</th>
                            <th className="px-5 py-3 text-left">
                                <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-slate-700">
                                    Submitted <SortIcon field="createdAt" />
                                </button>
                            </th>
                            <th className="px-5 py-3 text-left">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtered.map(req => (
                            <tr key={req._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-white whitespace-nowrap">
                                    <div>{req.employee?.firstName} {req.employee?.lastName}</div>
                                    <div className="text-xs text-slate-400">{req.employee?.employeeId}</div>
                                </td>
                                <td className="px-5 py-3.5 text-slate-600">{req.employee?.department || '—'}</td>
                                <td className="px-5 py-3.5 text-slate-600">{req.exitType}</td>
                                <td className="px-5 py-3.5 text-slate-600 max-w-[180px] truncate">{req.reason}</td>
                                <td className="px-5 py-3.5">
                                    <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${STAGE_STYLE[req.stage] || STAGE_STYLE['Requested']}`}>
                                        {req.stage}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[req.status] || ''}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-5 py-3.5">
                                    <button
                                        onClick={() => onView(req)}
                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold hover:underline"
                                    >
                                        Manage →
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-sm">
                                    {requests.length === 0 ? 'No exit requests yet.' : 'No results match your search.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {filtered.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                    Showing {filtered.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}
