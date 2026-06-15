import React from 'react';
import { PencilLine, XCircle } from 'lucide-react';

export default function LeaveActionIcon({ type = 'edit', enabled = false, onClick }) {
    const isEdit = type === 'edit';
    const Icon = isEdit ? PencilLine : XCircle;

    const title = enabled ? (isEdit ? 'Edit leave request' : 'Cancel leave request') : 'Action not allowed';

    const colorClass = enabled
        ? (isEdit ? 'text-indigo-600 hover:text-indigo-700' : 'text-rose-500 hover:text-rose-600')
        : 'text-slate-300 cursor-not-allowed';

    return (
        <div className="relative group">
            <button
                onClick={(e) => {
                    if (!enabled) {
                        e.preventDefault();
                        return;
                    }
                    onClick && onClick(e);
                }}
                aria-disabled={!enabled}
                className={`p-2 rounded-lg flex items-center justify-center transition-all duration-200 ${enabled ? 'hover:scale-110' : ''} ${colorClass}`}
            >
                <Icon size={18} strokeWidth={2} />
            </button>

            <div className="absolute -top-9 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                <div className={`text-xs px-2 py-1 rounded-md ${enabled ? 'bg-slate-800 text-white' : 'bg-slate-700 text-white/90'}`}>
                    {title}
                </div>
            </div>
        </div>
    );
}
