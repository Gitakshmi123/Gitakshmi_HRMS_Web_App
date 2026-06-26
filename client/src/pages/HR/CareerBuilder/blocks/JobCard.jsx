import React from 'react';
import { Briefcase, MapPin, Calendar, ArrowRight, Clock, Users2 } from 'lucide-react';
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
        applyButtonColor = '#6366F1',
        applyButtonStyle = 'filled',
    } = config;

    const workModeColors = {
        Remote: { bg: '#ecfdf5', text: '#059669', dot: '#10B981' },
        Hybrid: { bg: '#eff6ff', text: '#2563EB', dot: '#3B82F6' },
        'On-site': { bg: '#faf5ff', text: '#7C3AED', dot: '#8B5CF6' },
    };
    const modeStyle = workModeColors[job.workMode] || workModeColors['On-site'];

    return (
        <>
            <style>{`
                @keyframes jc-in { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .jc-root { animation: jc-in 0.4s ease both; }
                .jc-root:hover .jc-arrow { transform: translateX(4px); opacity: 1; }
                .jc-arrow { opacity: 0; transition: all 0.2s ease; }
                .jc-apply-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
                .jc-apply-btn { transition: all 0.2s ease; }
            `}</style>

            <div
                className="jc-root group flex flex-col h-full relative overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1"
                style={{
                    background: cardBackground,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)',
                    border: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                {/* Top accent bar */}
                <div className="h-1 w-full rounded-t-3xl"
                    style={{ background: `linear-gradient(90deg, ${applyButtonColor}, ${applyButtonColor}99)` }} />

                {/* Hover shimmer */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.02) 0%, transparent 60%)' }} />

                <div className={`${isMobile ? 'p-5' : 'p-6'} flex-1 flex flex-col`}>

                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                        {/* Job Icon */}
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{ background: `${applyButtonColor}15`, border: `1.5px solid ${applyButtonColor}25` }}>
                            <Briefcase size={18} style={{ color: applyButtonColor }} />
                        </div>
                        {/* Openings badge */}
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                            style={{ background: `${applyButtonColor}12`, color: applyButtonColor }}>
                            {job.positions || 1} Opening{(job.positions || 1) > 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-black text-gray-900 leading-tight mb-1`}>
                        {job.jobTitle}
                    </h3>

                    {/* Posted Date */}
                    {showPostedDate && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mb-4">
                            <Clock size={11} />
                            Posted {formatDateDDMMYYYY(job.publishedAt || job.createdAt)}
                        </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {showDept && job.department && (
                            <span className="bg-violet-50 text-violet-600 border border-violet-100 px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide">
                                {job.department}
                            </span>
                        )}
                        {showExperience && (
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide">
                                {job.minExperienceMonths ? `${Math.floor(job.minExperienceMonths / 12)}+ Yrs` : 'Fresher'}
                            </span>
                        )}
                        {showLocation && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide border"
                                style={{ background: modeStyle.bg, color: modeStyle.text, borderColor: `${modeStyle.dot}30` }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: modeStyle.dot }} />
                                {job.workMode || 'On-site'}
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    {showDescription && (
                        <p className={`text-gray-500 ${isMobile ? 'text-xs mb-4' : 'text-[13px] mb-5'} leading-relaxed line-clamp-2 flex-1`}>
                            {job.description || `We are looking for a talented ${job.jobTitle} to join our growing team and make an impact.`}
                        </p>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className={`${isMobile ? 'px-5 pb-5' : 'px-6 pb-6'} flex gap-2.5`}>
                    <button
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-50 border border-gray-100 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all active:scale-95"
                        onClick={() => onViewDetails ? onViewDetails(job) : (onApply && onApply(job))}
                    >
                        Details
                        <ArrowRight size={14} className="jc-arrow" />
                    </button>

                    {showApplyButton && (
                        <button
                            onClick={() => onApply && onApply(job)}
                            disabled={isApplied}
                            className="jc-apply-btn flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-sm text-white shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{
                                background: isApplied
                                    ? '#9CA3AF'
                                    : `linear-gradient(135deg, ${applyButtonColor} 0%, ${applyButtonColor}cc 100%)`,
                                boxShadow: isApplied ? 'none' : `0 4px 15px ${applyButtonColor}40`,
                            }}
                        >
                            {isApplied ? '✓ Applied' : (config.applyButtonText || 'Apply Now')}
                            {!isApplied && <ArrowRight size={14} />}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
