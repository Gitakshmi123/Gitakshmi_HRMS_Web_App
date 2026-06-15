import React, { useState } from 'react';
import { FileText, Download, Calendar, MapPin, Clock, User, ArrowRight } from 'lucide-react';
import dayjs from 'dayjs';
import InterviewDetailsRow from './InterviewDetailsRow';
import StatusActionRow from './StatusActionRow';
import api, { API_ROOT } from '../../../utils/api';

/**
 * CandidateCard
 * Displays candidate information with resume, interview details, and actions
 * Reusable across different pipeline stages
 */
export default function CandidateCard({
    candidate,
    interview = null,
    showInterviewDetails = false,
    showActionButtons = false,
    availableRounds = [],
    onSelected = null,
    onRejected = null,
    onMoveToRound = null,
    loading = false,
    selectedButtonLoading = '',
    disableActions = false
}) {
    const [resumeLoading, setResumeLoading] = useState(false);

    const handleDownloadResume = async () => {
        console.log('🔍 Candidate object:', candidate);
        console.log('📋 resumeUrl value:', candidate?.resumeUrl);
        
        if (!candidate?.resumeUrl) {
            console.warn('⚠️ No resume URL available');
            alert('Resume not available');
            return;
        }
        try {
            setResumeLoading(true);

            // Extract filename from resumeUrl (e.g., "/hr/resume/filename.pdf" -> "filename.pdf")
            const filename = candidate.resumeUrl.split('/').pop();
            
            // Use relative path - axios will append this to its baseURL
            const path = candidate.resumeUrl;
            
            console.log('📥 Download initiated:', { 
                resumeUrl: candidate.resumeUrl, 
                filename,
                path,
                fullRequestUrl: `${API_ROOT}${path}`
            });

            // Use axios 'api' instance to fetch as blob (includes Auth headers)
            const response = await api.get(path, {
                responseType: 'blob'
            });

            console.log('✅ Resume downloaded successfully:', { size: response.data.size, type: response.data.type });

            // Create local URL for the blob
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename || `${candidate.name}_Resume.pdf`);

            document.body.appendChild(link);
            link.click();

            console.log('📁 Download triggered for:', filename);

            // Cleanup
            setTimeout(() => {
                link.remove();
                window.URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            console.error('❌ Download failed:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                config: error.config
            });
            alert(`Failed to download resume: ${error.response?.data?.message || error.message}`);
        } finally {
            setResumeLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* === RESUME ROW === */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Resume Info */}
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-red-50 rounded-lg text-red-600 flex-shrink-0">
                            <FileText size={20} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-slate-800 mb-1">Resume & CV</h4>
                            <div className="text-xs text-slate-500 font-medium space-y-1">
                                <p>📄 {candidate.name}'s application materials</p>
                                {candidate.appliedOn && (
                                    <p className="text-slate-400">
                                        Applied: {dayjs(candidate.appliedOn).format('MMM DD, YYYY')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Download Button */}
                    <button
                        onClick={handleDownloadResume}
                        disabled={resumeLoading || !candidate.resumeUrl}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex-shrink-0 ${resumeLoading || !candidate.resumeUrl
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 active:scale-95'
                            }`}
                    >
                        <Download size={16} className={resumeLoading ? 'animate-bounce' : ''} />
                        {resumeLoading ? 'Downloading...' : 'Download'}
                    </button>
                </div>
            </div>

            {/* === INTERVIEW DETAILS ROW (conditional) === */}
            {showInterviewDetails && interview && (
                <InterviewDetailsRow
                    interview={interview}
                    showTag={true}
                    tagLabel={candidate.currentStatus || 'Shortlisted'}
                />
            )}

            {/* === STATUS & ACTION ROW (conditional) === */}
            {showActionButtons && (
                <StatusActionRow
                    candidateId={candidate._id}
                    onSelected={onSelected}
                    onRejected={onRejected}
                    onMoveToRound={onMoveToRound}
                    availableRounds={availableRounds}
                    loading={loading}
                    selectedButtonLoading={selectedButtonLoading}
                    disabled={disableActions}
                />
            )}
        </div>
    );
}
