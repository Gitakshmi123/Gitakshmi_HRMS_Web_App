import React from 'react';
import { UserCheck, UserX, CheckCircle, Clock } from 'lucide-react';
import dayjs from 'dayjs';

const ActionRow = ({ status, updatedAt, onShortlist, onReject }) => {
    // If NOT Applied, show readonly status
    if (status && status !== 'Applied') {
        const isRejected = status === 'Rejected';
        return (
            <div className={`w-full border rounded-xl p-3 flex items-center justify-between shadow-sm mt-3 gap-3 transition-colors ${isRejected ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                <div className="flex items-center gap-2">
                    {isRejected ? <UserX size={16} className="text-rose-500" /> : <CheckCircle size={16} className="text-emerald-500" />}
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isRejected ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {status}
                        </span>
                        <span className={`text-[9px] font-bold ${isRejected ? 'text-rose-400' : 'text-emerald-400'}`}>
                            Processed on {dayjs(updatedAt).format('MMM D, YYYY')}
                        </span>
                    </div>
                </div>

                {/* Optional: Add an Undo or Edit button here if needed later */}
            </div>
        );
    }

    // Default: Status is 'Applied' -> Show Actions
    return (
        <div className="w-full bg-white border border-slate-100 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between shadow-sm mt-3 gap-3 hover:border-slate-200 transition-colors">
            <div className="text-slate-500 font-bold text-[10px] flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Action Required: Please Shortlist or Reject this candidate.
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                    onClick={onReject}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95"
                >
                    <UserX size={14} />
                    Reject
                </button>
                <button
                    onClick={onShortlist}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white border border-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 hover:shadow-md shadow-blue-200 transition-all active:scale-95"
                >
                    <UserCheck size={14} />
                    Shortlist
                </button>
            </div>
        </div>
    );
};

export default ActionRow;
