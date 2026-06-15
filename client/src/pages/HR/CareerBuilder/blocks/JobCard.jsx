import React from 'react';
import { Briefcase, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../../../utils/dateUtils';

export default function JobCard({ job, config = {}, onApply, onViewDetails, isApplied, previewMode = 'desktop' }) {
    const isMobile = previewMode === 'mobile';
    const {
        cardStyle = 'rounded',
        cardBackground = '#ffffff',
        showDept = true,
        showExperience = true,
        showPostedDate = true,
        showLocation = true,
        showDescription = true,
        showApplyButton = true,
        // showJobId = false, // Not using job ID in the target design
        // applyButtonText = 'Apply Now', // Defaulting to 'Apply Now'
        applyButtonColor = '#2563EB', // blue-600
        applyButtonStyle = 'filled',
    } = config;

    // Container Styles
    const containerClasses = `
        flex flex-col h-full relative overflow-hidden transition-all duration-300 bg-white
        ${cardStyle === 'rounded' ? 'rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl' : ''}
        ${cardStyle === 'sharp' ? 'rounded-none border border-gray-200 hover:border-black' : ''}
        ${cardStyle === 'shadow' ? 'rounded-2xl shadow-lg border-none hover:-translate-y-1' : ''}
        ${cardStyle === 'border' ? 'rounded-xl border-2 border-gray-100 hover:border-blue-500' : ''}
    `;

    // Apply Button Style
    const applyClasses = `
        flex-1 flex items-center justify-center gap-2 px-4 py-3 font-bold text-sm transition-all rounded-xl
        ${applyButtonStyle === 'filled' ? 'text-white shadow-lg hover:shadow-xl active:scale-95' : ''}
        ${applyButtonStyle === 'outline' ? 'bg-transparent border-2 hover:bg-gray-50' : ''}
        ${applyButtonStyle === 'soft' ? 'bg-opacity-10 hover:bg-opacity-20' : ''}
    `;

    const applyStyle = {
        backgroundColor: applyButtonStyle === 'filled' ? applyButtonColor : applyButtonStyle === 'soft' ? `${applyButtonColor}20` : 'transparent',
        borderColor: applyButtonStyle === 'outline' ? applyButtonColor : 'transparent',
        color: applyButtonStyle === 'filled' ? '#ffffff' : applyButtonColor,
    };

    return (
        <div style={{ backgroundColor: cardBackground }} className={containerClasses}>
            <div className={`${isMobile ? 'p-4' : 'p-7'} flex-1 flex flex-col items-start text-left`}>

                {/* Header: Title + Opening Badge */}
                <div className="w-full flex justify-between items-start mb-2">
                    <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-black text-gray-900 leading-tight w-3/4`}>
                        {job.jobTitle}
                    </h3>
                    <span className={`${isMobile ? 'text-[8px] px-1.5' : 'text-[10px] px-2'} bg-blue-50 text-blue-600 font-black uppercase tracking-widest py-1 rounded-full whitespace-nowrap`}>
                        {job.positions || 1} Openings
                    </span>
                </div>

                {/* Posted Date */}
                {showPostedDate && (
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-4">
                        <Calendar size={14} />
                        <span>Posted: {formatDateDDMMYYYY(job.publishedAt || job.createdAt)}</span>
                    </div>
                )}

                {/* Tags Row */}
                <div className="flex flex-wrap gap-2 mb-6 w-full">
                    {showDept && (
                        <span className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide">
                            {job.department}
                        </span>
                    )}
                    {showExperience && (
                        <span className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide">
                            {job.minExperienceMonths ? `${Math.floor(job.minExperienceMonths / 12)}+ Yrs` : 'Fresher'}
                        </span>
                    )}
                    {showLocation && (
                        <span className="bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                            <MapPin size={12} /> {job.workMode || 'On-site'}
                        </span>
                    )}
                </div>

                {/* Description */}
                {showDescription && (
                    <p className={`text-gray-500 ${isMobile ? 'text-[11px] mb-4' : 'text-sm mb-6'} font-medium line-clamp-2 leading-relaxed`}>
                        {job.description || `We are looking for a talented ${job.jobTitle} to join our growing team.`}
                    </p>
                )}
            </div>

            {/* Footer Buttons */}
            <div className={`${isMobile ? 'p-4' : 'p-7'} pt-0 mt-auto w-full flex ${isMobile ? 'flex-col gap-2' : 'gap-3'}`}>
                <button
                    className={`${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'} flex-1 bg-white border border-gray-200 text-gray-900 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm`}
                    onClick={() => onViewDetails ? onViewDetails(job) : (onApply && onApply(job))}
                >
                    View Details
                </button>

                {showApplyButton && (
                    <button
                        onClick={() => onApply && onApply(job)}
                        style={applyStyle}
                        className={`${applyClasses} ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}
                    >
                        {isApplied ? 'Applied' : config.applyButtonText || 'Apply Now'}
                        {!isApplied && <ArrowRight size={isMobile ? 14 : 16} />}
                    </button>
                )}
            </div>
        </div>
    );
}
