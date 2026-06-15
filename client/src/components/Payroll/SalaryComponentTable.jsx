import React from 'react';
import { Edit2, CheckCircle, XCircle, Trash2, IndianRupee } from 'lucide-react';

// ─── Status Chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }) {
    const isActive = status === 'Active';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ring-1 ring-inset shadow-sm ${isActive
                ? 'text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40'
                : 'text-slate-500 bg-slate-50 border-slate-100 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {status}
        </span>
    );
}

// ─── Type Badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
    const map = {
        'Fixed': 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40',
        'Variable': 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
        'Pre-Tax': 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
        'Post-Tax': 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/40',
    };
    const style = map[type] || 'bg-slate-50 text-slate-600 border-slate-100';
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${style}`}>
            {type}
        </span>
    );
}

// ─── Desktop Row ───────────────────────────────────────────────────────────────
function ComponentRow({ item, onEdit, onToggleStatus, onDelete, canEdit, canToggleStatus, canDelete, hasActions }) {
    const isTemplate = item.category === 'Template';
    return (
        <div className="bg-white dark:bg-slate-900 grid items-center px-6 py-3.5 rounded-2xl border border-transparent dark:border-slate-800/40 shadow-sm hover:shadow-md hover:border-[#4F46E5]/20 transition-all group"
            style={{ gridTemplateColumns: isTemplate ? (hasActions ? '2fr 1fr 1.5fr 1fr 1fr' : '2fr 1fr 1.5fr 1fr') : (hasActions ? '2fr 1fr 1.5fr 0.8fr 0.8fr 1fr 1fr' : '2fr 1fr 1.5fr 0.8fr 0.8fr 1fr') }}
        >
            {/* Name */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] flex items-center justify-center text-xs font-black border border-indigo-100 dark:border-indigo-800/40 shadow-sm shrink-0">
                    {item.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-black text-slate-700 dark:text-slate-200 truncate group-hover:text-[#4F46E5] transition-colors leading-none">
                        {item.name}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">
                        {item.category}
                    </span>
                </div>
            </div>

            {/* Type */}
            <div className="pl-4 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <TypeBadge type={item.type} />
            </div>

            {/* Calculation / Frequency */}
            <div className="pl-4 border-l border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                {isTemplate ? (
                    <>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 leading-none">
                            ₹{item.annualCTC?.toLocaleString()} PA
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                            ₹{item.monthlyCTC?.toLocaleString()} PM
                        </span>
                    </>
                ) : (
                    <>
                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 text-center leading-none">
                            {item.calculationType}
                        </span>
                        {item.frequency && (
                            <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                                {item.frequency}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* PF / ESI — only for non-template */}
            {!isTemplate && (
                <>
                    <div className="pl-4 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center">
                        {item.considerForPF
                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                            : <span className="text-slate-300 dark:text-slate-600 font-black text-sm">—</span>}
                    </div>
                    <div className="pl-4 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center">
                        {item.considerForESI
                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                            : <span className="text-slate-300 dark:text-slate-600 font-black text-sm">—</span>}
                    </div>
                </>
            )}

            {/* Status */}
            <div className="pl-4 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <StatusChip status={item.status} />
            </div>

            {/* Actions */}
            {hasActions && (
                <div className="pl-4 border-l border-slate-100 dark:border-slate-800 flex justify-end items-center gap-1.5 pr-2">
                    {canEdit && (
                        <button
                            onClick={() => onEdit(item)}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-100 dark:border-blue-800/40 transition-all shadow-sm"
                            title="Edit"
                        >
                            <Edit2 size={13} strokeWidth={2.5} />
                        </button>
                    )}
                    {canToggleStatus && (
                        <button
                            onClick={() => onToggleStatus(item)}
                            className={`p-1.5 rounded-lg border transition-all shadow-sm ${item.status === 'Active'
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 hover:bg-amber-500 hover:text-white border-amber-100 dark:border-amber-800/40'
                                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border-emerald-100 dark:border-emerald-800/40'
                                }`}
                            title={item.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                            {item.status === 'Active' ? <XCircle size={13} strokeWidth={2.5} /> : <CheckCircle size={13} strokeWidth={2.5} />}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => onDelete(item)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-100 dark:border-rose-800/40 transition-all shadow-sm"
                            title="Delete"
                        >
                            <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function SalaryComponentTable({
    data = [],
    onEdit,
    onToggleStatus,
    onDelete,
    canEdit = true,
    canToggleStatus = true,
    canDelete = true
}) {
    const isTemplate = data[0]?.category === 'Template';
    const hasActions = canEdit || canToggleStatus || canDelete;

    const colHeaders = isTemplate
        ? ['Component', 'Type', 'Annual / Monthly', 'Status', ...(hasActions ? ['Actions'] : [])]
        : ['Component', 'Type', 'Calculation / Frequency', 'PF', 'ESI', 'Status', ...(hasActions ? ['Actions'] : [])];

    const centerCols = isTemplate
        ? (hasActions ? [false, true, true, true, true] : [false, true, true, true])
        : (hasActions ? [false, true, true, true, true, true, true] : [false, true, true, true, true, true]);

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 flex flex-col items-center justify-center gap-4 shadow-sm">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-[#4F46E5]">
                    <IndianRupee size={32} strokeWidth={1.5} />
                </div>
                <div className="text-center">
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">No Components Found</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Add a new component to get started</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Column labels */}
            <div
                className="hidden md:grid px-6 py-2 opacity-60"
                style={{ gridTemplateColumns: isTemplate ? (hasActions ? '2fr 1fr 1.5fr 1fr 1fr' : '2fr 1fr 1.5fr 1fr') : (hasActions ? '2fr 1fr 1.5fr 0.8fr 0.8fr 1fr 1fr' : '2fr 1fr 1.5fr 0.8fr 0.8fr 1fr') }}
            >
                {colHeaders.map((h, i) => (
                    <div
                        key={h}
                        className={`text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center
                            ${i > 0 ? 'border-l border-slate-200 dark:border-slate-800 pl-4' : ''}
                            ${centerCols[i] ? 'justify-center' : ''}
                            ${i === colHeaders.length - 1 ? 'justify-end pr-4' : ''}
                        `}
                    >
                        {h}
                    </div>
                ))}
            </div>

            {/* Desktop rows */}
            <div className="hidden md:flex flex-col gap-2">
                {data.map((item) => (
                    <ComponentRow
                        key={item.id}
                        item={item}
                        onEdit={onEdit}
                        onToggleStatus={onToggleStatus}
                        onDelete={onDelete}
                        canEdit={canEdit}
                        canToggleStatus={canToggleStatus}
                        canDelete={canDelete}
                        hasActions={hasActions}
                    />
                ))}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3">
                {data.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] flex items-center justify-center text-sm font-black border border-indigo-100 dark:border-indigo-800/40">
                                    {item.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-black text-slate-800 dark:text-white text-sm tracking-tight">{item.name}</div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.category}</div>
                                </div>
                            </div>
                            <StatusChip status={item.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-50 dark:border-slate-800">
                            <div>
                                <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Type</div>
                                <TypeBadge type={item.type} />
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Calculation</div>
                                <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                                    {item.category === 'Template' ? `₹${item.annualCTC?.toLocaleString()} PA` : item.calculationType}
                                </div>
                            </div>
                            {!isTemplate && (
                                <div className="col-span-2">
                                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Considerations</div>
                                    <div className="flex gap-2">
                                        {item.considerForPF && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[8px] font-black border border-blue-100 uppercase tracking-widest">PF</span>}
                                        {item.considerForESI && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[8px] font-black border border-purple-100 uppercase tracking-widest">ESI</span>}
                                        {!item.considerForPF && !item.considerForESI && <span className="text-slate-300 dark:text-slate-600 text-xs font-black">—</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {hasActions && (
                            <div className="flex gap-2 justify-end">
                                {canEdit && (
                                    <button onClick={() => onEdit(item)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800/40 text-[10px] font-black uppercase tracking-widest transition">
                                        <Edit2 size={12} strokeWidth={2.5} /> Edit
                                    </button>
                                )}
                                {canToggleStatus && (
                                    <button onClick={() => onToggleStatus(item)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800/40 text-[10px] font-black uppercase tracking-widest transition">
                                        {item.status === 'Active' ? <XCircle size={12} strokeWidth={2.5} /> : <CheckCircle size={12} strokeWidth={2.5} />}
                                        {item.status === 'Active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                )}
                                {canDelete && (
                                    <button onClick={() => onDelete(item)} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-800/40 text-[10px] font-black uppercase tracking-widest transition">
                                        <Trash2 size={12} strokeWidth={2.5} /> Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
