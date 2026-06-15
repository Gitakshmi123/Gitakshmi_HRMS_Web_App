import React from 'react';
import { Clock, CheckCircle, MessageSquare, Shield, Activity, RefreshCw } from 'lucide-react';

export default function TicketTimeline({ logs }) {
    if (!logs || logs.length === 0) return (
        <div className="p-8 text-center text-slate-400 opacity-50 flex flex-col items-center">
            <Activity size={32} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-widest mt-2">No activity recorded</p>
        </div>
    );

    const getActionIcon = (action) => {
        switch (action) {
            case 'CREATED': return <MessageSquare size={14} className="text-indigo-600" />;
            case 'ASSIGNED': return <Shield size={14} className="text-amber-600" />;
            case 'STATUS_CHANGE': return <RefreshCw size={14} className="text-blue-600" />;
            case 'RESOLVED': return <CheckCircle size={14} className="text-emerald-600" />;
            default: return <Activity size={14} className="text-slate-600" />;
        }
    };

    return (
        <div className="flex flex-col space-y-6 pt-4 relative ml-4 before:content-[''] before:absolute before:left-[-1px] before:top-0 before:bottom-0 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
            {logs.map((log, idx) => (
                <div key={idx} className="relative pl-6">
                    <div className={`absolute left-[-7px] top-1 w-[14px] h-[14px] rounded-full bg-white dark:bg-slate-900 border-2 z-10 flex items-center justify-center p-2 shadow-sm
                        ${log.action === 'RESOLVED' ? 'border-emerald-500 bg-emerald-50' : 
                          log.action === 'ASSIGNED' ? 'border-amber-500 bg-amber-50' : 
                          log.action === 'STATUS_CHANGE' ? 'border-blue-500 bg-blue-50' : 'border-indigo-500 bg-indigo-50'}`}>
                        {getActionIcon(log.action)}
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{log.action}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                {new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-snug">{log.notes}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
