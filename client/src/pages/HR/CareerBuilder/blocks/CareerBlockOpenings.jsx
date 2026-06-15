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
        <section id="open-positions-section" className={`${isMobile ? 'py-10 px-4' : 'py-20 px-4 sm:px-8 lg:px-12'} bg-white w-full max-w-[1800px] mx-auto`}>

            {/* Section Header */}
            <div className={`flex items-center justify-between ${isMobile ? 'mb-6' : 'mb-12'} px-2`}>
                <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-gray-900 tracking-tight`}>{title}</h2>
                {!openingsLocked && (
                    <div className="bg-blue-50 px-3 py-1.5 rounded-full">
                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-black text-blue-600 uppercase tracking-widest`}>{safeJobs.length} Jobs</span>
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
                <div className={`grid ${getGridClass()} gap-${gap}`}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-96 bg-gray-50 rounded-3xl animate-pulse border border-gray-100"></div>
                    ))}
                </div>
            ) : safeJobs.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold text-lg">No open positions found matching your search.</p>
                </div>
            ) : (
                <div className={`grid ${getGridClass()} gap-${gap}`}>
                    {safeJobs.map((job, idx) => {
                        const jobId = safeId(job?._id || job?.id);
                        const jobKey = jobId || `job-${idx}-${job?.jobTitle || 'opening'}`;

                        return (
                        <div key={jobKey} className="h-full">
                            <JobCard
                                job={job}
                                config={content} // Pass the entire content object as config
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
        </section>
    );
}
