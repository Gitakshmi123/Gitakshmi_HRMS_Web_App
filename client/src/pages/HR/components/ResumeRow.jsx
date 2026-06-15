import React from 'react';
import { FileText, Eye } from 'lucide-react';

const ResumeRow = ({ applicant, onViewResume }) => {
    return (
        <div className="w-full bg-slate-50/80 border border-slate-100 rounded-xl p-3 flex items-center justify-between shadow-sm mt-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
                    <FileText size={16} />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Resume & Details</p>
                    <p className="text-[9px] text-slate-400 font-bold">Application Data</p>
                </div>
            </div>

            <button
                onClick={() => onViewResume(applicant)}
                className="group flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all active:scale-95"
            >
                <Eye size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span>View Resume</span>
            </button>
        </div>
    );
};

export default ResumeRow;
