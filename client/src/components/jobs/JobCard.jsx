import React from 'react';
import { MapPin, Briefcase, Clock, ArrowRight, Calendar } from 'lucide-react';

const JobCard = ({ job, onView, onApply }) => {
    // Parsing description to just show a summary
    const getSummary = (desc) => {
        if (!desc) return '';
        // Strip HTML tags if any (basic approach)
        const text = desc.replace(/<[^>]*>?/gm, '');
        return text.length > 150 ? text.substring(0, 150) + '...' : text;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const experienceText = (min, max) => {
        if (min === undefined || min === null) return '';
        if (max) return `${Math.floor(min / 12)}-${Math.ceil(max / 12)} Yrs`;
        return `${Math.floor(min / 12)}+ Yrs`;
    };

    return (
        <div className="group bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 flex flex-col h-full overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>

            <div className="p-6 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                            {job.jobTitle}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" /> Posted: {formatDate(job.createdAt)}
                        </p>
                    </div>
                    {job.vacancy > 0 && (
                        <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ml-2">
                            {job.vacancy} Openings
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {job.department && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                            <Briefcase className="w-3 h-3 mr-1.5" /> {job.department}
                        </span>
                    )}
                    {(job.minExperienceMonths !== undefined || job.maxExperienceMonths !== undefined) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                            <Clock className="w-3 h-3 mr-1.5" /> {experienceText(job.minExperienceMonths, job.maxExperienceMonths)}
                        </span>
                    )}
                    {job.location && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                            <MapPin className="w-3 h-3 mr-1.5" /> {job.location}
                        </span>
                    )}
                    {job.employmentType && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">
                            {job.employmentType}
                        </span>
                    )}
                </div>

                <p className="text-gray-500 text-sm mb-6 line-clamp-3 flex-grow leading-relaxed">
                    {getSummary(job.description)}
                </p>

                <div className="flex gap-3 mt-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(job); }}
                        className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        View Details
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onApply(job); }}
                        className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        Apply Now <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobCard;
