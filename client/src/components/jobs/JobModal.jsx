import React from 'react';
import { X, MapPin, Briefcase, Clock, CheckCircle } from 'lucide-react';

const JobModal = ({ job, onClose, onApply }) => {
    if (!job) return null;

    const experienceText = (min, max) => {
        if (min === undefined || min === null) return '';
        if (max) return `${Math.floor(min / 12)}-${Math.ceil(max / 12)} Yrs`;
        return `${Math.floor(min / 12)}+ Yrs`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Blurred Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-200 scrollbar-hide">

                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-5 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{job.jobTitle}</h2>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                            {job.department && <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-purple-500" /> {job.department}</span>}
                            {(job.minExperienceMonths !== undefined) && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-green-500" /> {experienceText(job.minExperienceMonths, job.maxExperienceMonths)}</span>}
                            {job.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-500" /> {job.location}</span>}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8">
                    <section>
                        <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-tight">Job Description</h3>
                        <div
                            className="text-gray-600 leading-relaxed text-justify prose prose-blue max-w-none"
                            dangerouslySetInnerHTML={{ __html: job.description }}
                        />
                    </section>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex flex-col sm:flex-row justify-end gap-3 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onApply(job)}
                        className="w-full sm:w-auto px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:shadow-lg hover:from-blue-700 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all"
                    >
                        Apply for this Position
                    </button>
                </div>

            </div>
        </div>
    );
};

export default JobModal;
