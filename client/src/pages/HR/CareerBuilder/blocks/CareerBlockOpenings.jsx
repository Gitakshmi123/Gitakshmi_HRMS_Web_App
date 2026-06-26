import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import JobCard from './JobCard';
import JobDetailModal from './JobDetailModal';
import { safeId } from '../../../../utils/idHelper';

export default function CareerBlockOpenings({
    content,
    jobs = [],
    loading = false,
    myApplications = new Set(),
    onApply,
    previewMode = 'desktop',
    openingsLocked = false,
    loginHref = '/candidate/login',
}) {

    const [selectedJob, setSelectedJob] = useState(null);
    const isMobile = previewMode === 'mobile';

    const {
        title = "Open Positions",
        layout = "grid", // grid, list
        gridColumns = 3, // 2, 3, 4
        gap = 8, // tailwind spacing unit (8 = 2rem)
        enabled = true,
        // Card Config passed down
    } = content || {};

    if (enabled === false) return null;

    // Direct use of passed 'jobs' prop (assumed filtered by parent)
    const safeJobs = jobs || [];

    // Grid Columns Logic
    const getGridClass = () => {
        if (isMobile || layout === 'list') return 'grid-cols-1';
        if (Number(gridColumns) === 2) return 'grid-cols-1 md:grid-cols-2';
        if (Number(gridColumns) === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'; // Default 3
    };

    return (
        <section id="open-positions-section" className={`w-full ${isMobile ? 'py-14 px-4' : 'py-24 px-8'}`}
            style={{ background: '#F8FAFF' }}>
            <div className="max-w-6xl mx-auto">

                {/* Section Header */}
                <div className={`flex items-end justify-between ${isMobile ? 'mb-8' : 'mb-14'}`}>
                    <div>
                        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[11px] font-bold text-indigo-600 tracking-widest uppercase">Now Hiring</span>
                        </div>
                        <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl lg:text-5xl'} font-black text-gray-900 tracking-tight leading-tight`}>
                            {title}
                        </h2>
                    </div>
                    {!openingsLocked && (
                        <div className="shrink-0 ml-4 flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-2 shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-black text-gray-900`}>{safeJobs.length}</span>
                            <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-400`}>Open Roles</span>
                        </div>
                    )}
                </div>


            {openingsLocked ? (
                <div className="rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50/80 px-6 py-16 text-center sm:px-12">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                        <Lock size={26} strokeWidth={2.25} />
                    </div>
                    <h3 className="mb-2 text-xl font-black text-gray-900">Sign in to view openings</h3>
                    <p className="mx-auto mb-8 max-w-md text-sm font-medium text-gray-500">
                        Job listings are available to registered candidates only. Log in with your account to browse and apply.
                    </p>
                    <Link
                        to={loginHref}
                        className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-black active:scale-[0.98]"
                    >
                        Candidate Login
                    </Link>
                </div>
            ) : loading ? (
                <div className={`grid ${getGridClass()} gap-6`}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-80 bg-white rounded-3xl animate-pulse border border-gray-100 shadow-sm" />
                    ))}
                </div>
            ) : safeJobs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Lock size={24} className="text-indigo-400" />
                    </div>
                    <p className="text-gray-500 font-semibold text-base">No open positions found matching your search.</p>
                    <p className="text-gray-400 text-sm mt-1">Try adjusting your search terms.</p>
                </div>
            ) : (
                <div className={`grid ${getGridClass()} gap-6`}>
                    {safeJobs.map((job, idx) => {
                        const jobId = safeId(job?._id || job?.id);
                        const jobKey = jobId || `job-${idx}-${job?.jobTitle || 'opening'}`;
                        return (
                            <div key={jobKey} className="h-full">
                                <JobCard
                                    job={job}
                                    config={content}
                                    isApplied={myApplications.has(jobId)}
                                    onApply={onApply}
                                    onViewDetails={(j) => setSelectedJob(j)}
                                    previewMode={previewMode}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Job Detail Modal */}
            {!openingsLocked && (
                <JobDetailModal
                    job={selectedJob}
                    onClose={() => setSelectedJob(null)}
                    onApply={onApply}
                    isApplied={selectedJob ? myApplications.has(safeId(selectedJob._id || selectedJob.id)) : false}
                />
            )}
            </div>
        </section>
    );
}
