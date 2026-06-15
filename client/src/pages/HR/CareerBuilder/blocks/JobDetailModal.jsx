import React from 'react';
import {
    X,
    MapPin,
    Briefcase,
    Calendar,
    Clock,
    Users,
    Shield,
    ArrowRight,
    Building2,
    CheckCircle2
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../../../../utils/dateUtils';

export default function JobDetailModal({ job, onClose, onApply, isApplied }) {
    if (!job) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
            <div
                className="bg-white rounded-[3rem] shadow-[0_32px_128px_-20px_rgba(0,0,0,0.2)] w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="relative h-64 sm:h-80 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-black/10"></div>

                    {/* Decorative Shapes */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>

                    {/* Navigation */}
                    <div className="relative z-20 flex justify-between items-center px-10 pt-8">
                        <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white border border-white/10">
                            Job Opportunity
                        </span>
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-2xl text-white transition-all border border-white/10 active:scale-95"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Title Area */}
                    <div className="absolute bottom-10 left-10 right-10 z-20">
                        <div className="flex flex-col gap-4">
                            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tighter leading-tight drop-shadow-sm">
                                {job.jobTitle}
                            </h2>
                            <div className="flex flex-wrap items-center gap-6 text-white/90 text-xs font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-2">
                                    <Building2 size={16} className="text-white/60" /> {job.department}
                                </span>
                                <span className="flex items-center gap-2">
                                    <MapPin size={16} className="text-white/60" /> {job.workMode || 'On-site'}
                                </span>
                                <span className="flex items-center gap-2">
                                    <Clock size={16} className="text-white/60" /> {job.jobType || 'Full Time'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-y-auto p-10 sm:p-14 space-y-12 bg-white">

                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience</span>
                            <span className="text-lg font-black text-slate-800 tracking-tight">
                                {job.minExperienceMonths ? `${Math.floor(job.minExperienceMonths / 12)}+ Years` : 'Fresher'}
                            </span>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vacancies</span>
                            <span className="text-lg font-black text-slate-800 tracking-tight">{job.vacancy || job.positions || 1} Openings</span>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-2 text-indigo-600">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budgeted Salary</span>
                            <span className="text-lg font-black tracking-tight">
                                {job.salaryMin ? `₹${(job.salaryMin / 100000).toFixed(1)}L - ${(job.salaryMax / 100000).toFixed(1)}L` : 'Competitive'}
                            </span>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posted On</span>
                            <span className="text-lg font-black text-slate-800 tracking-tight">{formatDateDDMMYYYY(job.publishedAt || job.createdAt)}</span>
                        </div>
                    </div>

                    {/* Job Description */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-indigo-600 rounded-full shadow-sm"></div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Role Overview</h3>
                        </div>
                        <div className="text-slate-600 font-medium leading-relaxed text-lg whitespace-pre-wrap">
                            {job.description || "No detailed description provided for this role. Join us and make an impact!"}
                        </div>
                    </div>

                    {/* Additional Details (if any) */}
                    {job.customFields && job.customFields.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-purple-600 rounded-full shadow-sm"></div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Additional Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {job.customFields.map((field, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{field.label}</span>
                                        <span className="text-sm font-black text-slate-700">{field.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="p-10 border-t border-slate-50 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 text-slate-400">
                        <Shield size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Your privacy is protected by SSL Encryption</span>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-700 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                onApply(job);
                                onClose();
                            }}
                            disabled={isApplied}
                            className={`flex-[2] sm:flex-none px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3
                                ${isApplied
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default'
                                    : 'bg-slate-900 hover:bg-black text-white shadow-slate-200'
                                }`}
                        >
                            {isApplied ? (
                                <>
                                    <CheckCircle2 size={18} /> Applied
                                </>
                            ) : (
                                <>
                                    Apply Now <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
