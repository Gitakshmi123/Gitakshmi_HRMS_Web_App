import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import {
    ArrowLeft, Clock, User, MessageSquare, Calendar,
    CheckCircle, PlusCircle, XCircle, PlayCircle,
    MapPin, Phone, Mail, Award, Briefcase, AlertCircle
} from 'lucide-react';
import dayjs from 'dayjs';
import CandidateCard from './CandidateCard';
import InterviewDetailsRow from './InterviewDetailsRow';
import StatusActionRow from './StatusActionRow';

export default function CandidateTimeline() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [candidate, setCandidate] = useState(null);
    const [timeline, setTimeline] = useState({});
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedButtonLoading, setSelectedButtonLoading] = useState('');
    const [activeTab, setActiveTab] = useState('timeline');

    // Modal State for Status Update
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [formData, setFormData] = useState({
        status: '',
        stage: 'HR',
        remarks: '',
        actionBy: 'HR Manager'
    });

    // Available rounds (you can fetch from settings if needed)
    const [dynamicStages, setDynamicStages] = useState(['HR', 'Technical', 'Final']);

    // Available rounds generated dynamically
    const availableRounds = dynamicStages.map(stage => ({
        id: stage.toLowerCase().replace(/\s+/g, '-'),
        label: stage
    }));

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch candidate directly by ID

            const cRes = await api.get(`/hr/candidate-status/candidates/${id}`);
            const found = cRes.data;
            setCandidate(found);

            // Get timeline using new endpoint
            const statusRes = await api.get(`/hr/candidate/${id}/status`);
            setTimeline(statusRes.data || {});

            // Fetch interview if exists (optional)
            try {
                const iRes = await api.get(`/interviews/${id}`);
                if (iRes.data) {
                    setInterview(iRes.data);
                }
            } catch {
                setInterview(null);
            }

            if (found) {
                setFormData(prev => ({
                    ...prev,
                    status: found.currentStatus || '',
                    stage: found.currentStage || 'HR'
                }));
                
                if (Array.isArray(found.pipelineStages) && found.pipelineStages.length > 0) {
                    setDynamicStages(found.pipelineStages.map(s => s.stageName || s.name || s));
                }
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status !== 404) {
                alert('Failed to load candidate data');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    // === UPDATE STATUS HANDLERS ===
    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/hr/candidate-status/${id}/status`, formData);
            setShowUpdateModal(false);
            loadData();
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        }
    };

    const handleSelected = async (candidateId) => {
        setSelectedButtonLoading('selected');
        try {
            // Call existing update API
            await api.post(`/hr/candidate-status/${candidateId}/status`, {
                status: 'Selected',
                stage: 'HR Round',
                remarks: 'Candidate selected and moved to HR Round',
                actionBy: 'HR Manager'
            });

            // Reload data
            await loadData();
            alert('✅ Candidate moved to HR Round');
        } catch (err) {
            console.error('Error updating candidate:', err);
            alert('Failed to update candidate status');
        } finally {
            setSelectedButtonLoading('');
        }
    };

    const handleRejected = async (candidateId) => {
        setSelectedButtonLoading('rejected');
        try {
            // Call existing update API
            await api.post(`/hr/candidate-status/${candidateId}/status`, {
                status: 'Rejected',
                stage: 'Final',
                remarks: 'Candidate rejected after interview',
                actionBy: 'HR Manager'
            });

            // Reload data
            await loadData();
            alert('❌ Candidate marked as rejected');
        } catch (err) {
            console.error('Error rejecting candidate:', err);
            alert('Failed to reject candidate');
        } finally {
            setSelectedButtonLoading('');
        }
    };

    const handleMoveToRound = async (round) => {
        setSelectedButtonLoading('moveToRound');
        try {
            // Check if the round is the first round or not to decide status
            // Simply use "Interview Scheduled" for any round movement in the UI unless it's a known non-interview stage
            const newStatus = (round.id === 'applied' || round.id === 'shortlisted') ? 'Shortlisted' : 'Interview Scheduled';

            // Call existing update API
            await api.post(`/hr/candidate-status/${candidate._id}/status`, {
                status: newStatus,
                stage: round.label,
                remarks: `Candidate moved to ${round.label}`,
                actionBy: 'HR Manager'
            });

            // Reload data
            await loadData();
            alert(`✅ Candidate moved to ${round.label}`);
        } catch (err) {
            console.error('Error moving candidate:', err);
            alert('Failed to move candidate to another round');
        } finally {
            setSelectedButtonLoading('');
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            'Applied': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: Clock },
            'Shortlisted': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: CheckCircle },
            'Interview Scheduled': { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', icon: Calendar },
            'Selected': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: CheckCircle },
            'Rejected': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: XCircle },
        };
        const style = config[status] || { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', icon: Clock };
        const Icon = style.icon;

        return (
            <span className={`inline-flex max-w-full items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${style.bg} ${style.color} ${style.border}`}>
                <Icon size={11} strokeWidth={2.5} className="shrink-0" />
                <span className="truncate">{status}</span>
            </span>
        );
    };

    // === PIPELINE TAB RENDERING FUNCTIONS ===
    const renderShortlistTab = () => {
        if (!candidate) return null;
        if (candidate.currentStatus !== 'Shortlisted' && candidate.currentStatus !== 'Interview Scheduled') return null;

        return (
            <div className="space-y-2">
                <CandidateCard
                    candidate={candidate}
                    interview={interview}
                    showInterviewDetails={!!interview}
                    showActionButtons={false}
                />
            </div>
        );
    };

    const renderInterviewTab = () => {
        if (!candidate) return null;
        if (candidate.currentStatus !== 'Interview Scheduled') return null;

        return (
            <div className="space-y-2">
                <CandidateCard
                    candidate={candidate}
                    interview={interview}
                    showInterviewDetails={!!interview}
                    showActionButtons={true}
                    onSelected={handleSelected}
                    onRejected={handleRejected}
                    onMoveToRound={handleMoveToRound}
                    availableRounds={availableRounds}
                    selectedButtonLoading={selectedButtonLoading}
                    disableActions={selectedButtonLoading !== ''}
                />
            </div>
        );
    };



    const renderRejectedTab = () => {
        if (!candidate) return null;
        if (candidate.currentStatus !== 'Rejected') return null;

        return (
            <div className="rounded-xl border border-rose-200/60 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                    <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                        <XCircle size={20} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="mb-0.5 text-base font-bold text-slate-900">Application Closed</h3>
                        <p className="text-sm text-slate-600">
                            ❌ <span className="font-semibold text-rose-600">Rejected — Processed on {dayjs(candidate.updatedAt).format('MMM DD, YYYY')}</span>
                        </p>
                    </div>
                </div>

                {/* Candidate details */}
                <CandidateCard
                    candidate={candidate}
                    showInterviewDetails={false}
                    showActionButtons={false}
                />
            </div>
        );
    };

    const renderTimeline = () => {
        const steps = [
            { key: 'applied', label: 'APPLIED', icon: PlusCircle },
            { key: 'shortlisted', label: 'SHORTLISTED', icon: Award },
            { key: 'interview', label: 'INTERVIEW SCHEDULED', icon: PlayCircle },
            { key: 'selected', label: 'SELECTED', icon: CheckCircle },
            { key: 'rejected', label: 'REJECTED', icon: XCircle },
        ];

        // Filter out steps that shouldn't be shown?
        // User requirements: "If selected = true -> auto-mark previous... If rejected -> mark that stage red".
        // The backend returns an object with all keys.
        // We usually don't show "Rejected" and "Selected" together appropriately.
        // If rejected has status, we might want to prioritize showing it? 
        // Or simply show all 5 if they have data? 
        // Let's show all that have data OR are standard pipeline (Applied/Shortlisted/Interview). 
        // Actually, just show all 5 in order, but maybe hide Rejected if null?
        // User example had `rejected: { status: null }`. 
        // So we should hide rejected if status is null.

        const validSteps = steps.filter(step => {
            // always show first 3?
            if (['applied', 'shortlisted', 'interview'].includes(step.key)) return true;
            // Show selected/rejected only if they have status?
            // Actually, the user wants "timeline icons should change color".
            // If we hide "Selected" slot when it's null, the timeline looks unfinished.
            // But "Rejected" is an alternative ending.

            const data = timeline[step.key];
            // If rejected has data, show it.
            if (step.key === 'rejected') return data && data.status;

            // If selected has data, show it. If rejected has data, maybe hide selected if selected is null?
            if (step.key === 'selected') {
                // If we are rejected, usually we don't show "Selected" slot?
                // Let's just show it if it exists or if we are not rejected?
                // Simple approach: Show Applied, Shortlisted, Interview, Selected. 
                // If Rejected exists, show it INSTEAD of Selected? or After?
                // Let's just filter strictly by existence or standard flow.
                if (timeline.rejected && timeline.rejected.status) return false; // Hide selected if rejected
                return true; // Show selected slot (maybe empty) if not rejected
            }
            return true;
        });

        return (
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Clock size={16} className="text-[#4F46E5] shrink-0" />
                    Execution Timeline
                </h3>

                <div className="relative ml-2 sm:ml-3">
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-slate-100" aria-hidden />

                    <div className="space-y-2">
                        {validSteps.map((step) => {
                            const data = timeline[step.key] || { status: null, time: null };
                            const status = data.status;

                            let colorClass = "text-slate-400 bg-white border-slate-200";
                            let iconColor = "text-slate-300";

                            if (status === 'completed') {
                                colorClass = "text-[#4F46E5] bg-indigo-50 border-indigo-100";
                                iconColor = "text-[#4F46E5]";
                            } else if (status === 'in-progress') {
                                colorClass = "text-indigo-600 bg-indigo-50 border-indigo-100";
                                iconColor = "text-indigo-500";
                            } else if (status === 'rejected') {
                                colorClass = "text-rose-600 bg-rose-50 border-rose-100";
                                iconColor = "text-rose-500";
                            }

                            return (
                                <div key={step.key} className="relative pl-7 sm:pl-8">
                                    <div className={`absolute left-0 top-1 -ml-[15px] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm z-10 sm:-ml-[17px] ${status === 'completed' ? 'border-indigo-100' : (status === 'rejected' ? 'border-rose-100' : 'border-slate-100')}`}>
                                        <step.icon size={14} className={iconColor} strokeWidth={2.25} />
                                    </div>
                                    <div className={`rounded-lg border px-2.5 py-2 transition ${status ? 'bg-slate-50/60' : 'bg-white'} border-slate-100`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-[11px] font-black uppercase leading-tight text-slate-800 sm:text-xs">
                                                {step.label}
                                            </h4>
                                            {data.time && (
                                                <span className="shrink-0 rounded border border-slate-100 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                                    {data.time}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1">
                                            {status ? (
                                                <span className={`inline-block text-[9px] font-bold uppercase tracking-wide border px-1.5 py-0.5 rounded ${colorClass}`}>
                                                    {status === 'in-progress' ? 'In Progress' : status}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Activity Log Section */}
                {timeline.logs && timeline.logs.length > 0 && (
                    <div className="mt-8 pt-5 border-t border-slate-100">
                        <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                            <Clock size={16} className="text-[#4F46E5] shrink-0" />
                            Detailed Activity Log
                        </h3>
                        <div className="space-y-3">
                            {timeline.logs.map((log, idx) => (
                                <div key={log._id || idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4 flex flex-col gap-2">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
                                        <div className="flex items-center flex-wrap gap-2">
                                            <span className="font-black text-xs uppercase tracking-wide text-slate-800">{log.status}</span>
                                            {log.stage && <span className="px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-500 uppercase tracking-wider">{log.stage}</span>}
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-2 py-1 rounded-md">
                                            {dayjs(log.actionDate).format('MMM DD, YYYY hh:mm A')}
                                        </span>
                                    </div>
                                    {log.remarks && (
                                        <p className="text-[11px] text-slate-600 font-medium bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                            {log.remarks}
                                        </p>
                                    )}
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                        <User size={12} className="text-slate-300" />
                                        Processed By: <span className="text-slate-600">{log.actionBy || 'System'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Building Pipeline...</p>
            </div>
        </div>
    );

    if (!candidate) return (
        <div className="p-12 text-center">
            <div className="text-slate-400 mb-4 font-bold text-xl uppercase">404 - Not Found</div>
            <button onClick={() => navigate('/hr/candidate-status')} className="text-blue-600 hover:underline">Return to list</button>
        </div>
    );

    return (
        <div className="min-h-0 bg-slate-50/50 pb-6">
            {/* Top Banner */}
            <div className="bg-white border-b border-slate-200 shadow-sm relative z-10">
                <div className="w-full px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate('/hr/candidate-status')}
                            className="p-1.5 hover:bg-indigo-50 hover:text-[#4F46E5] rounded-lg transition text-slate-500 shrink-0"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-base md:text-lg font-bold text-slate-900 truncate">{candidate.name}</h2>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide truncate max-w-[200px] md:max-w-xs">{candidate.requirementTitle}</p>
                                <span className="inline-flex items-center">
                                    {getStatusBadge(candidate.currentStatus)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowUpdateModal(true)}
                        className="shrink-0 px-3 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-indigo-600 transition shadow-sm shadow-indigo-500/15 font-bold text-xs"
                    >
                        Update Progress
                    </button>
                </div>
            </div>

            <div className="w-full px-4 md:px-6 mt-3 pb-4">
                {/* Tab Navigation */}
                <div className="flex items-center gap-1 mb-3 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-max">
                    {[
                        { id: 'shortlisted', label: '⭐ Shortlisted', show: false },
                        { id: 'interview', label: '📞 Interview', show: false },
                        { id: 'rejected', label: '❌ Rejected', show: candidate.currentStatus === 'Rejected' },
                        { id: 'timeline', label: '📅 Timeline', show: true }
                    ].map(tab => tab.show && (
                        <button
                            type="button"
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-1.5 rounded-md font-bold text-xs transition-all ${activeTab === tab.id
                                ? 'bg-[#4F46E5] text-white shadow-sm shadow-indigo-500/10'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-3">
                    {activeTab === 'shortlisted' && renderShortlistTab()}
                    {activeTab === 'interview' && renderInterviewTab()}
                    {activeTab === 'rejected' && renderRejectedTab()}
                    {activeTab === 'timeline' && renderTimeline()}
                </div>
            </div>

            {/* Update Status Modal */}
            {showUpdateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-[#4F46E5] p-6 flex justify-between items-center">
                            <h3 className="text-white font-bold tracking-tight">Update Progress</h3>
                            <button
                                onClick={() => setShowUpdateModal(false)}
                                className="text-white/80 hover:text-white"
                            >
                                <ArrowLeft className="rotate-90" size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateStatus} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Status</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-[#4F46E5] outline-none text-slate-700 font-bold"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    required
                                >
                                    <option value="Applied">Applied</option>
                                    <option value="Shortlisted">Shortlisted</option>
                                    <option value="Interview Scheduled">Interview Scheduled</option>
                                    <option value="Selected">Selected</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Stage</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {dynamicStages.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, stage: s })}
                                            className={`py-2 text-xs font-bold rounded-lg border transition ${formData.stage === s
                                                ? 'bg-indigo-50 border-[#4F46E5] text-[#4F46E5]'
                                                : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-100 hover:text-[#4F46E5]'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Remarks</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-[#4F46E5] outline-none text-slate-700 min-h-[100px] font-medium"
                                    placeholder="Add remarks..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    required
                                ></textarea>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowUpdateModal(false)}
                                    className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-[#4F46E5] text-white font-bold rounded-xl hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all border-none"
                                >
                                    Update
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
