import React from 'react';
import { Clock } from 'lucide-react';
import dayjs from 'dayjs';

const PipelineStatusBlock = ({ status, createdAt }) => {
    // Determine colors based on status
    const getStatusStyles = (s) => {
        switch (s) {
            case 'Selected':
                return 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50';
            case 'Rejected':
                return 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/50';
            case 'Shortlisted':
                return 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/50';
            case 'Interview':
            case 'HR Round':
                return 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-100/50';
            default:
                return 'bg-white text-slate-400 border-slate-100';
        }
    };

    return (
        <div className="flex flex-col items-center gap-2.5 w-full">
            <div className={`px-5 py-2 rounded-full text-[10px] font-black border tracking-[2px] uppercase transition-all shadow-sm ${getStatusStyles(status)}`}>
                {status || 'Applied'}
            </div>

            {createdAt && (
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    <Clock size={10} className="text-slate-200" />
                    {dayjs().diff(dayjs(createdAt), 'day')} DAYS AGO
                </div>
            )}
        </div>
    );
};

export default PipelineStatusBlock;
