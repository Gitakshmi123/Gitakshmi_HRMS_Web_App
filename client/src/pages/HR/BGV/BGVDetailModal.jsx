import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import SendEmailModal from './SendEmailModal';
import ConsentFormModal from './ConsentFormModal';
import AddDiscrepancyModal from './AddDiscrepancyModal';
import TaskAssignmentModal from './TaskAssignmentModal';

import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import {
    X, Shield, CheckCircle, XCircle, Clock, AlertCircle, FileText,
    Calendar, User, Package, Download, Eye, Upload, MessageSquare,
    TrendingUp, AlertTriangle, CheckSquare, Edit, Save, RefreshCw,
    Search, FileSearch, ShieldCheck, Activity, ChevronRight, Mail, ChevronDown, Settings, Target
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import usePagePermissions from '../../../hooks/usePagePermissions';
dayjs.extend(relativeTime);

const EMAIL_TYPES = [
    {
        value: 'DOCUMENT_PENDING',
        label: 'Document Pending Reminder',
        description: 'Remind candidate to upload pending documents',
        recipientType: 'CANDIDATE',
        allowedWhen: ['PENDING', 'IN_PROGRESS']
    },
    {
        value: 'BGV_IN_PROGRESS',
        label: 'BGV In Progress',
        description: 'Notify candidate that verification has started',
        recipientType: 'CANDIDATE',
        allowedWhen: ['IN_PROGRESS']
    },
    {
        value: 'DISCREPANCY_RAISED',
        label: 'Discrepancy Notification',
        description: 'Inform candidate about discrepancy found',
        recipientType: 'CANDIDATE',
        allowedWhen: ['IN_PROGRESS', 'VERIFIED_WITH_DISCREPANCIES']
    },
    {
        value: 'BGV_COMPLETED_VERIFIED',
        label: 'BGV Completed - Verified',
        description: 'Congratulate candidate on successful verification',
        recipientType: 'CANDIDATE',
        allowedWhen: ['VERIFIED', 'CLOSED']
    },
    {
        value: 'BGV_COMPLETED_FAILED',
        label: 'BGV Completed - Failed',
        description: 'Notify candidate about failed verification',
        recipientType: 'CANDIDATE',
        allowedWhen: ['FAILED', 'CLOSED']
    }
];

const BGVDetailModal = ({ caseData, onClose, onUpdate }) => {
    const { canEdit } = usePagePermissions('bgv.caseMaster');
    const navigate = useNavigate();
    const location = useLocation();
    
    // Dynamic prefix logic to support /hr, /tenant/xxx, /employee etc.
    const hrPrefix = (location.pathname.startsWith('/tenant/') ? '/tenant' : (location.pathname.startsWith('/employee/') ? '/employee' : '/hr'));
    
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedCase, setSelectedCase] = useState(caseData);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInitialType, setEmailInitialType] = useState('');
    const [emailMenuOpen, setEmailMenuOpen] = useState(false);
    const emailMenuRef = useRef(null);

    // Modal states for BGV features
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
    const [showTaskAssignModal, setShowTaskAssignModal] = useState(false);
    const [selectedCheck, setSelectedCheck] = useState(null);
    const [previewDoc, setPreviewDoc] = useState(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/bgv/email-templates');
            setTemplates(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        }
    };

    useEffect(() => {
        const onDocMouseDown = (e) => {
            if (!emailMenuRef.current) return;
            if (emailMenuRef.current.contains(e.target)) return;
            setEmailMenuOpen(false);
        };

        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, []);


    const refreshCase = async () => {
        try {
            const res = await api.get(`/bgv/case/${selectedCase._id}`);
            setSelectedCase(res.data.data);
            onUpdate();
        } catch (err) {
            console.error('Failed to refresh case:', err);
        }
    };

    const handleConsentCaptured = () => {
        showToast('success', 'Success', 'Consent captured successfully');
        refreshCase();
    };

    const handleDiscrepancyAdded = (data) => {
        showToast('success', 'Success', `Risk score updated to ${data.totalRiskScore} points`);
        refreshCase();
    };

    const handleTaskAssigned = () => {
        showToast('success', 'Success', 'Task assigned successfully');
        refreshCase();
    };

    const handleVerifyCheck = async (checkId, status, remarks) => {
        setLoading(true);
        try {
            await api.post(`/bgv/check/${checkId}/verify`, {
                status,
                internalRemarks: remarks,
                verificationMethod: 'MANUAL'
            });
            showToast('success', 'Success', `Check ${status.toLowerCase()} successfully`);
            await refreshCase();
        } catch (err) {
            console.error('Failed to update check status:', err);
            const msg = err.response?.data?.message || 'Failed to update check status';
            showToast('error', 'Error', msg);
        } finally {
            setLoading(false);
        }
    };

    // ─── Document Review ─────────────────────────────────────────
    const handleReviewDocument = async (documentId, reviewStatus, reviewRemarks) => {
        setLoading(true);
        try {
            await api.post(`/bgv/document/${documentId}/review`, {
                reviewStatus,  // 'ACCEPTED' or 'REJECTED' or 'REQUIRES_REUPLOAD'
                reviewRemarks
            });
            const msg = reviewStatus === 'ACCEPTED' ? '✅ Document accepted' : '❌ Document rejected — candidate notified to re-upload';
            showToast(reviewStatus === 'ACCEPTED' ? 'success' : 'warning', reviewStatus === 'ACCEPTED' ? 'Accepted' : 'Rejected', msg);

            // If rejected, also send email reminder
            if (reviewStatus === 'REQUIRES_REUPLOAD' || reviewStatus === 'REJECTED') {
                try {
                    await api.post(`/bgv/case/${selectedCase._id}/send-email`, {
                        emailType: 'DOCUMENT_PENDING',
                        recipientEmail: selectedCase.candidateEmail || selectedCase.candidateName,
                        additionalContext: { reason: reviewRemarks }
                    });
                } catch (emailErr) {
                    console.warn('Email notification failed (non-critical):', emailErr.message);
                }
            }
            await refreshCase();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to review document';
            showToast('error', 'Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseBGV = async (decision, remarks) => {
        setLoading(true);
        try {
            await api.post(`/bgv/case/${selectedCase._id}/close`, {
                decision,
                remarks
            });
            showToast('success', 'Success', `BGV ${decision.toLowerCase()} successfully`);
            await refreshCase();
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.message || 'Failed to close BGV');
        } finally {
            setLoading(false);
        }
    };

    // After BGV approved → continue joining letter process
    const handleContinueJoiningLetter = () => {
        const applicationId = selectedCase?.applicationId?._id || selectedCase?.applicationId;
        const requirementId = selectedCase?.applicationId?.requirementId?._id || selectedCase?.applicationId?.requirementId || selectedCase?.requirementId;

        // console.log('[BGV_NAV] Attempting redirect:', { applicationId, requirementId, name: selectedCase?.candidateName });

        if (!applicationId) {
            showToast('warning', 'Info', 'No linked application found for joining letter');
            return;
        }

        // Redirect to Offer & Joining Manager with specific job and tab selected
        const reqId = requirementId?._id || requirementId || 'all';
        const candidateName = selectedCase?.candidateName || selectedCase?.candidateId?.name || '';
        const url = `${hrPrefix}/offers-joining?reqId=${reqId}&tab=Offer Accepted&search=${encodeURIComponent(candidateName)}`;
        
        showToast('info', 'Redirecting', `Moving to Joining Letter for ${candidateName}...`);
        
        navigate(url);
        
        // Close modal AFTER navigation is triggered
        setTimeout(() => {
            onClose();
        }, 100);
    };

    const handleGenerateReport = async () => {
        setLoading(true);
        try {
            await api.post(`/bgv/case/${selectedCase._id}/generate-report`);
            showToast('success', 'Success', 'Report generated successfully');
            await refreshCase();
        } catch {
            showToast('error', 'Error', 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'VERIFIED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'VERIFIED_WITH_DISCREPANCIES': return 'bg-indigo-50 text-[#4F46E5] border-indigo-100';
            case 'FAILED': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'IN_PROGRESS': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'PENDING': return 'bg-slate-50 text-slate-500 border-slate-200';
            case 'CLOSED': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'NOT_STARTED': return 'bg-slate-50 text-slate-400 border-slate-200';
            case 'DISCREPANCY': return 'bg-orange-50 text-orange-600 border-orange-100';
            default: return 'bg-slate-50 text-slate-400 border-slate-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'VERIFIED': return <CheckCircle size={14} />;
            case 'VERIFIED_WITH_DISCREPANCIES': return <Shield size={14} />;
            case 'FAILED': return <XCircle size={14} />;
            case 'IN_PROGRESS': return <Clock size={14} />;
            case 'PENDING': return <AlertCircle size={14} />;
            case 'CLOSED': return <CheckSquare size={14} />;
            case 'NOT_STARTED': return <Clock size={14} />;
            case 'DISCREPANCY': return <AlertTriangle size={14} />;
            default: return <AlertCircle size={14} />;
        }
    };

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-[#4F46E5] px-10 py-8 flex items-center justify-between flex-shrink-0 relative">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-t-[2.5rem]">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center border border-white/30">
                            <Shield size={32} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-medium text-white tracking-tight">{selectedCase.caseId}</h2>
                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.1em] bg-white/20 text-white border border-white/30 backdrop-blur-md`}>
                                    {getStatusIcon(selectedCase.overallStatus)}
                                    {selectedCase.overallStatus?.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <p className="text-indigo-50 font-medium tracking-[0.15em] uppercase text-[9px] opacity-80 flex items-center gap-2">
                                <User size={12} strokeWidth={2} />
                                {selectedCase.candidateName}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 relative z-50">
                        <div className="relative" ref={emailMenuRef}>
                            {canEdit && (
                                <button
                                    onClick={() => setEmailMenuOpen(v => !v)}
                                    className="flex items-center gap-3 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all font-bold text-[11px] uppercase tracking-widest border border-white/30 shadow-lg"
                                    title="Send Email"
                                >
                                    <Mail size={16} strokeWidth={2.5} />
                                    Email
                                    <ChevronDown size={14} strokeWidth={2.5} className={`transition-transform duration-300 ${emailMenuOpen ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {emailMenuOpen && (
                                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-6 py-4 bg-slate-900">
                                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                            SELECT TEMPLATE
                                        </div>
                                    </div>
                                    <div className="max-h-[24rem] overflow-y-auto p-2">
                                        {(() => {
                                            const filtered = templates.filter(t => t.isActive !== false);

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="px-6 py-10 text-center">
                                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                                            <Mail size={20} className="text-slate-300" />
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Library Items</div>
                                                    </div>
                                                );
                                            }

                                            return filtered.map((t) => {
                                                const type = t.emailType;
                                                let isRecommended = false;
                                                if (selectedCase.overallStatus === 'PENDING') isRecommended = ['DOCUMENT_PENDING', 'BGV_IN_PROGRESS'].includes(type);
                                                if (selectedCase.overallStatus === 'IN_PROGRESS') isRecommended = ['BGV_IN_PROGRESS', 'DISCREPANCY_RAISED', 'DOCUMENT_PENDING'].includes(type);
                                                if (selectedCase.overallStatus === 'VERIFIED') isRecommended = ['BGV_COMPLETED_VERIFIED'].includes(type);
                                                if (selectedCase.overallStatus === 'FAILED') isRecommended = ['BGV_COMPLETED_FAILED'].includes(type);

                                                return (
                                                    <button
                                                        key={t._id}
                                                        onClick={() => {
                                                            setEmailInitialType(t.emailType);
                                                            setShowEmailModal(true);
                                                            setEmailMenuOpen(false);
                                                        }}
                                                        className="w-full text-left p-4 rounded-2xl hover:bg-slate-50 transition-all group relative border border-transparent hover:border-slate-100"
                                                    >
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-[9px] font-bold text-[#4F46E5] uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded">#{type}</div>
                                                                {isRecommended && (
                                                                    <div className="text-[8px] font-bold bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Best Fit</div>
                                                                )}
                                                            </div>
                                                            <ChevronRight size={12} className="text-slate-300 group-hover:text-[#4F46E5] transition-colors" />
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-900 leading-tight mb-1">{t.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{t.subject}</div>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                        <button
                                            onClick={() => {
                                                setEmailMenuOpen(false);
                                            }}
                                            className="text-[10px] font-bold text-slate-400 hover:text-[#4F46E5] uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                        >
                                            <Settings size={12} /> Configure
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all border border-transparent hover:border-white/30 text-white"
                        >
                            <X size={24} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Tabs Bar */}
                <div className="border-b border-slate-100 bg-white px-10 flex gap-4 flex-shrink-0 pt-2 shadow-sm relative z-20">
                    {[
                        { id: 'overview', label: 'OVERVIEW', icon: <Eye size={16} strokeWidth={2.5} /> },
                        { id: 'checks', label: 'CHECKS', icon: <CheckCircle size={16} strokeWidth={2.5} /> },
                        { id: 'documents', label: 'DOCUMENTS', icon: <FileText size={16} strokeWidth={2.5} /> },
                        { id: 'timeline', label: 'TIMELINE', icon: <Activity size={16} strokeWidth={2.5} /> },
                        { id: 'actions', label: 'ACTIONS', icon: <Settings size={16} strokeWidth={2.5} /> }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-8 py-5 text-[11px] font-medium tracking-[0.1em] flex items-center gap-3 border-b-[3px] transition-all relative group
                            ${activeTab === tab.id
                                    ? 'border-[#4F46E5] text-[#4F46E5]'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <span className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-105' : 'group-hover:scale-105'}`}>
                                {tab.icon}
                            </span>
                            {tab.label.charAt(0) + tab.label.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 scroll-smooth custom-scrollbar">
                    {activeTab === 'overview' && <OverviewTab caseData={selectedCase} />}
                    {activeTab === 'checks' && <ChecksTab
                        caseData={selectedCase}
                        onVerify={handleVerifyCheck}
                        loading={loading}
                        canEdit={canEdit}
                        onOpenConsentModal={() => setShowConsentModal(true)}
                        onOpenDiscrepancyModal={(check) => {
                            setSelectedCheck(check);
                            setShowDiscrepancyModal(true);
                        }}
                        onOpenTaskModal={(check) => {
                            setSelectedCheck(check);
                            setShowTaskAssignModal(true);
                        }}
                        getStatusStyles={getStatusStyles}
                        getStatusIcon={getStatusIcon}
                    />}
                    {activeTab === 'documents' && <DocumentsTab
                        caseData={selectedCase}
                        handleReviewDocument={handleReviewDocument}
                        canEdit={canEdit}
                        onViewDocument={setPreviewDoc}
                        onReprocessOCR={async (docId) => {
                            try {
                                await api.post(`/bgv/document/${docId}/reprocess-ocr`);
                                showToast('success', 'Success', 'OCR reprocessing started in background');
                                refreshCase();
                            } catch {
                                showToast('error', 'Error', 'Failed to start OCR reprocessing');
                            }
                        }}
                    />}
                    {activeTab === 'timeline' && <TimelineTab caseData={selectedCase} />}
                    {activeTab === 'actions' && (
                        <ActionsTab
                            caseData={selectedCase}
                            onClose={handleCloseBGV}
                            onGenerateReport={handleGenerateReport}
                            loading={loading}
                            canEdit={canEdit}
                            showConsentModal={showConsentModal}
                            setShowConsentModal={setShowConsentModal}
                            showDiscrepancyModal={showDiscrepancyModal}
                            setShowDiscrepancyModal={setShowDiscrepancyModal}
                            showTaskAssignModal={showTaskAssignModal}
                            setShowTaskAssignModal={setShowTaskAssignModal}
                            selectedCheck={selectedCheck}
                            setSelectedCheck={setSelectedCheck}
                            selectedCase={selectedCase}
                            handleConsentCaptured={handleConsentCaptured}
                            handleDiscrepancyAdded={handleDiscrepancyAdded}
                            handleTaskAssigned={handleTaskAssigned}
                            handleContinueJoiningLetter={handleContinueJoiningLetter}
                        />
                    )}

                    {/* Modals triggered by BGV components */}
                    {showEmailModal && (
                        <SendEmailModal
                            visible={showEmailModal}
                            onClose={() => setShowEmailModal(false)}
                            onEmailSent={refreshCase}
                            caseData={selectedCase}
                            initialType={emailInitialType}
                        />
                    )}

                    {showConsentModal && (
                        <ConsentFormModal
                            isOpen={showConsentModal}
                            onClose={() => setShowConsentModal(false)}
                            caseData={selectedCase}
                            onConsentCaptured={handleConsentCaptured}
                        />
                    )}

                    {showDiscrepancyModal && (
                        <AddDiscrepancyModal
                            isOpen={showDiscrepancyModal}
                            onClose={() => {
                                setShowDiscrepancyModal(false);
                                setSelectedCheck(null);
                            }}
                            checkData={selectedCheck}
                            caseId={selectedCase._id}
                            onDiscrepancyAdded={handleDiscrepancyAdded}
                        />
                    )}

                    {showTaskAssignModal && (
                        <TaskAssignmentModal
                            isOpen={showTaskAssignModal}
                            onClose={() => {
                                setShowTaskAssignModal(false);
                                setSelectedCheck(null);
                            }}
                            checkData={selectedCheck}
                            caseId={selectedCase._id}
                            onTaskAssigned={handleTaskAssigned}
                        />
                    )}
                    {previewDoc && (
                        <DocumentPreviewModal
                            doc={previewDoc}
                            onClose={() => {
                                console.log('[BGVDetailModal] Closing preview');
                                setPreviewDoc(null);
                            }}
                        />
                    )}
                </div>

                {/* Integration Modals are now within ActionsTab or top level if needed */}
            </div>
        </div>,
        document.body
    );
};

// Sub Components Redesigned
const OverviewTab = ({ caseData }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Candidate Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <User size={120} />
                    </div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <User size={14} className="text-[#4F46E5]" />
                        Candidate Details
                    </h3>
                    <div className="grid grid-cols-2 gap-y-8 gap-x-12 relative z-10">
                        <InfoItem label="Full Name" value={caseData.candidateName} />
                        <InfoItem label="Email" value={caseData.candidateEmail} />
                        <InfoItem label="Job Title" value={caseData.jobTitle} />
                        <InfoItem label="Package" value={caseData.package} />
                    </div>
                </div>

                <div className="bg-[#4F46E5] rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg shadow-indigo-500/20">
                    <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                    <h3 className="text-[10px] font-bold text-indigo-50 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Target size={14} className="text-indigo-100" />
                        Case Details
                    </h3>
                    <div className="space-y-8 relative z-10">
                        <InfoItem label="Case ID" value={String(caseData._id || '').slice(-8).toUpperCase()} dark />
                        <InfoItem label="Due Date" value={dayjs(caseData.sla?.dueDate).format('DD MMM, YYYY')} dark />
                        <div className="pt-2">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest ${caseData.sla?.isOverdue ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'} border border-white/20 backdrop-blur-sm`}>
                                {caseData.sla?.isOverdue ? 'OVERDUE' : 'ON TRACK'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Metrics */}
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Progress</h3>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Current status of BGV checks</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold text-[#4F46E5]">{caseData.checksProgress?.percentage || 0}%</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-1">COMPLETED</div>
                    </div>
                </div>

                <div className="h-6 bg-slate-50 rounded-2xl p-1.5 mb-10 overflow-hidden border border-slate-100 shadow-inner">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-[#4F46E5] to-emerald-400 rounded-xl transition-all duration-1000 ease-out shadow-lg shadow-indigo-500/20 relative"
                        style={{ width: `${caseData.checksProgress?.percentage || 0}%` }}
                    >
                        <div className="absolute top-0 left-0 right-0 bottom-0 bg-[linear-gradient(45deg,bg-white/10_25%,transparent_25%,transparent_50%,bg-white/10_50%,bg-white/10_75%,transparent_75%,transparent)] bg-[length:20px_20px] opacity-20 animate-stripes"></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <MetricCard label="TOTAL" value={caseData.checksProgress?.total} icon={<FileSearch size={16} />} color="slate" />
                    <MetricCard label="VERIFIED" value={caseData.checksProgress?.verified} icon={<ShieldCheck size={16} />} color="indigo" />
                    <MetricCard label="FAILED" value={caseData.checksProgress?.failed} icon={<AlertTriangle size={16} />} color="rose" />
                    <MetricCard label="PENDING" value={caseData.checksProgress?.pending} icon={<Clock size={16} />} color="amber" />
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, icon, color }) => {
    const colors = {
        indigo: 'bg-indigo-50 text-[#4F46E5] border-indigo-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
        amber: 'bg-amber-50 text-amber-500 border-amber-100',
        slate: 'bg-slate-50 text-slate-400 border-slate-100'
    };
    return (
        <div className={`p-6 rounded-[2rem] border ${colors[color]} flex flex-col items-center text-center group hover:scale-[1.02] transition-transform duration-300`}>
            <div className="mb-3 p-3 rounded-2xl bg-white shadow-sm group-hover:shadow-md transition-shadow">
                {icon}
            </div>
            <div className="text-3xl font-bold mb-1 leading-none">{value}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</div>
        </div>
    );
};

const InfoItem = ({ label, value, dark = false }) => (
    <div className="flex flex-col gap-1.5">
        <span className={`text-[9px] font-bold uppercase tracking-widest ${dark ? 'text-indigo-100/60' : 'text-slate-400'}`}>{label}</span>
        <span className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{value || 'NOT_FOUND'}</span>
    </div>
);

const ChecksTab = ({ caseData, onVerify, loading, canEdit, onOpenConsentModal, onOpenDiscrepancyModal, onOpenTaskModal, getStatusStyles, getStatusIcon }) => {
    const [selectedCheck, setSelectedCheck] = useState(null);
    const [remarks, setRemarks] = useState('');

    const handleVerifyClick = (status) => {
        if (!selectedCheck) return;
        onVerify(selectedCheck._id, status, remarks);
        setSelectedCheck(null);
        setRemarks('');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {!caseData.isClosed && (
                <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                    <div>
                        <h4 className="text-[13px] font-semibold text-slate-700 tracking-tight mb-1">Verification Checks</h4>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest italic opacity-80">Manage individual checks manually</p>
                    </div>
                    {canEdit && (
                        <button
                            onClick={onOpenConsentModal}
                            className="px-6 py-3 bg-[#4F46E5] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all flex items-center gap-2.5"
                        >
                            <ShieldCheck size={16} strokeWidth={2.5} />
                            Update Consent
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-4">
                {caseData.checks?.length > 0 ? (
                    caseData.checks.map((check) => {
                        const statusStyle = getStatusStyles(check.status);
                        return (
                            <div key={check._id} className="bg-white rounded-[2rem] border border-slate-200/60 p-8 hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                                    <div className="flex items-start gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${statusStyle}`}>
                                            {getStatusIcon(check.status)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
                                                    {check.type?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                                                </h4>
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-[0.05em] border ${statusStyle}`}>
                                                    {check.status?.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[9px] font-medium text-slate-400 uppercase tracking-widest opacity-80">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                                    ID: {String(check._id || '').slice(-6).toUpperCase()}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1 h-1 rounded-full ${check.priority === 'HIGH' ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                                                    {check.priority || 'NORMAL'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {!caseData.isClosed && canEdit && (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setSelectedCheck(check)}
                                                className="h-10 px-5 bg-slate-900 text-white rounded-[1.25rem] font-semibold text-[10px] uppercase tracking-widest hover:bg-[#4F46E5] transition-all flex items-center gap-2"
                                            >
                                                <Edit size={14} /> Update
                                            </button>
                                            <button
                                                onClick={() => onOpenDiscrepancyModal(check)}
                                                className="h-10 px-5 bg-orange-50 text-orange-600 rounded-[1.25rem] font-semibold text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-all border border-orange-100 flex items-center gap-2"
                                            >
                                                <AlertTriangle size={14} /> Report Risk
                                            </button>
                                            <button
                                                onClick={() => onOpenTaskModal(check)}
                                                className="h-10 px-5 bg-white border border-slate-200 text-slate-600 rounded-[1.25rem] font-semibold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                                            >
                                                <User size={14} /> Assign
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {check.internalRemarks && (
                                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 mb-4">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <MessageSquare size={12} /> Remarks
                                        </div>
                                        <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{check.internalRemarks}"</p>
                                    </div>
                                )}

                                {selectedCheck?._id === check._id && (
                                    <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-4 duration-300">
                                        <div className="mb-4">
                                            <label className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-widest block mb-2 px-1">Add Remark</label>
                                            <textarea
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                placeholder="Enter remarks..."
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-sm font-medium h-24 resize-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleVerifyClick('VERIFIED')}
                                                disabled={loading}
                                                className="flex-1 h-11 bg-indigo-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={14} strokeWidth={2.5} /> Verify
                                            </button>
                                            <button
                                                onClick={() => handleVerifyClick('FAILED')}
                                                disabled={loading}
                                                className="flex-1 h-11 bg-rose-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-md shadow-rose-500/10 flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={14} strokeWidth={2.5} /> Mark Failed
                                            </button>
                                            <button
                                                onClick={() => setSelectedCheck(null)}
                                                className="h-11 px-6 bg-slate-100 text-slate-500 rounded-xl font-semibold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="bg-white rounded-[3rem] p-24 text-center border border-slate-200/60 shadow-sm">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                            <ShieldCheck size={48} strokeWidth={1} />
                        </div>
                        <h4 className="text-xl font-bold text-slate-900 mb-2">No Checks Found</h4>
                        <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">No background checks exist for this case.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const DocumentsTab = ({ caseData, canEdit, onReprocessOCR, handleReviewDocument, onViewDocument }) => {
    console.log('[DocumentsTab] Rendered');
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [rejectingDocId, setRejectingDocId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const commitReject = () => {
        if (!rejectionReason.trim()) {
            showToast('error', 'Error', 'Please provide a reason for rejection');
            return;
        }
        handleReviewDocument(rejectingDocId, 'REJECTED', rejectionReason);
        setRejectingDocId(null);
        setRejectionReason('');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {rejectingDocId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-rose-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 text-rose-600 mb-2">
                            <XCircle size={32} />
                            <h3 className="text-xl font-bold tracking-tight">Reject Document</h3>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Please provide a reason for rejecting this document. This will be sent to the candidate.</p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for rejection (e.g. Blurry image, wrong document uploaded...)"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[120px] text-sm focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 outline-none transition-all resize-none"
                        />
                        <div className="flex items-center gap-3 mt-4">
                            <button onClick={() => { setRejectingDocId(null); setRejectionReason(''); }} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={commitReject} className="flex-1 px-4 py-3 bg-rose-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg hover:bg-rose-700 transition-colors">Confirm Reject</button>
                        </div>
                    </div>
                </div>
            )}
            {caseData.documents?.length > 0 ? (
                caseData.documents.map((doc) => (
                    <div key={doc._id} className="bg-white rounded-[2.5rem] border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                        <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${doc.documentType === 'AADHAAR' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                                    doc.documentType === 'PAN' ? 'bg-blue-50 text-blue-500 border-blue-100' :
                                        doc.documentType === 'PAYSLIP' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' :
                                            'bg-indigo-50 text-indigo-500 border-indigo-100'
                                    }`}>
                                    <FileText size={28} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1.5 text-ellipsis overflow-hidden">
                                        <h4 className="text-xl font-bold text-slate-900 tracking-tight uppercase whitespace-nowrap">{doc.documentType?.replace(/_/g, ' ')}</h4>
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter ${doc.evidenceMetadata?.ocrStatus === 'COMPLETED' ? 'bg-indigo-50 text-[#4F46E5] border border-indigo-100' :
                                            doc.evidenceMetadata?.ocrStatus === 'PROCESSING' ? 'bg-amber-50 text-amber-500 border border-amber-100 animate-pulse' :
                                                'bg-slate-50 text-slate-400 border border-slate-100'
                                            }`}>
                                            {doc.evidenceMetadata?.ocrStatus === 'COMPLETED' ? 'READY' : doc.evidenceMetadata?.ocrStatus}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">{doc.originalName}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">VERSION {doc.version}</span>
                                        <span className="w-1.5 h-1.5 bg-slate-100 rounded-full"></span>
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{dayjs(doc.uploadedAt).format('DD MMM YYYY')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {doc.evidenceMetadata?.ocrStatus === 'COMPLETED' && (
                                    <button
                                        onClick={() => setSelectedDocId(selectedDocId === doc._id ? null : doc._id)}
                                        className={`h-10 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${selectedDocId === doc._id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-indigo-50 text-[#4F46E5] hover:bg-indigo-100 border border-indigo-100'
                                            }`}
                                    >
                                        <Search size={14} strokeWidth={2.5} />
                                        {selectedDocId === doc._id ? 'HIDE DATA' : 'VIEW DATA'}
                                    </button>
                                )}
                                {canEdit && (
                                    <button
                                        onClick={() => onReprocessOCR(doc._id)}
                                        className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-amber-50 hover:text-amber-500 transition-all border border-slate-100 group"
                                        title="Reprocess Document"
                                    >
                                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                                    </button>
                                )}
                                <button
                                    onClick={() => onViewDocument(doc)}
                                    className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-[#4F46E5] rounded-xl hover:bg-indigo-500 hover:text-white transition-all border border-indigo-100 shadow-sm"
                                    title="View Document"
                                >
                                    <Eye size={18} />
                                </button>
                                <a
                                    href={doc.filePath.startsWith('/') ? doc.filePath : `/${doc.filePath}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={doc.originalName}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-[#4F46E5] hover:text-white transition-all border border-slate-100 shadow-sm"
                                    title="Download"
                                >
                                    <Download size={18} />
                                </a>
                            </div>
                        </div>

                        {selectedDocId === doc._id && doc.evidenceMetadata && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-10 animate-in slide-in-from-top-4 duration-500 relative">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                    <div className="lg:col-span-8 space-y-8">

                                        {canEdit && (!doc.reviewStatus?.status || doc.reviewStatus.status === 'PENDING') && (
                                            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-900 mb-1">Manual Review Required</h5>
                                                    <p className="text-xs text-slate-500 font-medium">Please verify the extracted data vs the original document.</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setRejectingDocId(doc._id)} className="px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-colors border border-rose-100">Reject / Re-upload</button>
                                                    <button onClick={() => handleReviewDocument(doc._id, 'ACCEPTED', 'Looks good manually')} className="px-5 py-2.5 bg-[#4F46E5] text-white hover:bg-indigo-600 font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 transition-all">Accept Document</button>
                                                </div>
                                            </div>
                                        )}
                                        {doc.reviewStatus?.status && doc.reviewStatus.status !== 'PENDING' && (
                                            <div className={`p-5 rounded-2xl border flex items-center gap-4 ${doc.reviewStatus.status === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                                {doc.reviewStatus.status === 'ACCEPTED' ? <CheckCircle className="text-emerald-500" /> : <XCircle className="text-rose-500" />}
                                                <div>
                                                    <h5 className={`text-sm font-bold leading-none mb-1 ${doc.reviewStatus.status === 'ACCEPTED' ? 'text-emerald-900' : 'text-rose-900'}`}>Document {doc.reviewStatus.status.charAt(0) + doc.reviewStatus.status.slice(1).toLowerCase()}</h5>
                                                    <p className={`text-xs font-semibold uppercase tracking-widest opacity-80 ${doc.reviewStatus.status === 'ACCEPTED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                        {doc.reviewStatus.remarks || 'No remarks provided'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between bg-white px-8 py-6 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-[#4F46E5]"></div>
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">CONFIDENCE SCORE</div>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex-1 h-3 w-64 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/40">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${doc.evidenceMetadata.ocrConfidence > 80 ? 'bg-emerald-500' : doc.evidenceMetadata.ocrConfidence > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                            style={{ width: `${doc.evidenceMetadata.ocrConfidence}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-2xl font-bold text-slate-900 tracking-tighter">{doc.evidenceMetadata.ocrConfidence}%</span>
                                                </div>
                                            </div>
                                            <div className="text-right border-l border-slate-100 pl-8">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">MATCH SCORE</div>
                                                <div className={`text-4xl font-bold tracking-tighter ${doc.evidenceMetadata.validation?.score > 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {doc.evidenceMetadata.validation?.score}%
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-3xl border border-slate-200/60 p-8 shadow-sm relative">
                                            <h5 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                                <ShieldCheck size={14} className="text-[#4F46E5]" />
                                                EXTRACTED DATA
                                            </h5>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-10 gap-x-12">
                                                {Object.entries(doc.evidenceMetadata.extractedFields || {}).map(([key, value]) => {
                                                    if (!value || key === 'fullText') return null;
                                                    const isMismatch = doc.evidenceMetadata.validation?.mismatchedFields?.includes(key);
                                                    return (
                                                        <div key={key} className="group flex flex-col gap-1.5">
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60 group-hover:text-[#4F46E5] transition-colors">{key.replace(/([A-Z])/g, ' $1')}</div>
                                                            <div className={`text-sm font-bold flex items-center gap-3 ${isMismatch ? 'text-rose-600' : 'text-slate-900'}`}>
                                                                {isMismatch && <AlertTriangle size={14} className="animate-pulse" />}
                                                                <span className="tracking-tight">{typeof value === 'object' ? dayjs(value).format('DD MMM YYYY') : value}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-4 space-y-6">
                                        <div className={`p-8 rounded-[2.5rem] border relative overflow-hidden ${doc.evidenceMetadata.validation?.status === 'MATCHED' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                                            doc.evidenceMetadata.validation?.status === 'MISMATCH' ? 'bg-rose-50 border-rose-100 text-rose-900' :
                                                'bg-amber-50 border-amber-100 text-amber-900'
                                            }`}>
                                            <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 opacity-60">VERIFICATION RESULT</div>
                                            <div className="flex items-center gap-4 mb-4">
                                                {doc.evidenceMetadata.validation?.status === 'MATCHED' ? <CheckCircle size={32} className="text-emerald-600" /> : <AlertCircle size={32} className="text-rose-600" />}
                                                <div className="text-2xl font-bold tracking-tight leading-none uppercase">{doc.evidenceMetadata.validation?.status?.replace(/_/g, ' ')}</div>
                                            </div>
                                            <p className="text-[11px] font-semibold leading-relaxed opacity-70">
                                                The system compared the extracted document text with the candidate profile information.
                                            </p>
                                        </div>

                                        {doc.evidenceMetadata.validationFlags?.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2">DISCREPANCIES FOUND</div>
                                                {doc.evidenceMetadata.validationFlags.map((flag, fidx) => (
                                                    <div key={fidx} className={`p-4 rounded-2xl flex items-start gap-4 border ${flag.severity === 'ERROR' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'
                                                        }`}>
                                                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                                        <div className="text-[10px] font-bold leading-normal tracking-wide uppercase">{flag.message}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between">
                                    <button
                                        onClick={() => onViewDocument(doc)}
                                        className="text-[10px] font-bold text-slate-400 hover:text-[#4F46E5] uppercase tracking-widest flex items-center gap-2 group transition-all"
                                    >
                                        <Eye size={14} className="group-hover:scale-110 transition-transform" /> VIEW DOCUMENT
                                    </button>
                                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">AUTOMATED SYSTEM</div>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                        <FileText size={40} strokeWidth={1} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">No Documents Found</h4>
                    <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">No documents have been uploaded for this check.</p>
                </div>
            )}
        </div>
    );
};

const TimelineTab = ({ caseData }) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pl-12 pr-4">
            {caseData.timeline?.length > 0 ? (
                <div className="relative">
                    <div className="absolute left-[-2rem] top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500/20 via-slate-200 to-transparent"></div>
                    {caseData.timeline.map((event, idx) => (
                        <div key={event._id || idx} className="relative mb-10 group">
                            <div className="absolute left-[-2.65rem] top-1.5 w-5 h-5 bg-white border-2 border-[#4F46E5] rounded-full z-10 shadow-sm group-hover:scale-125 transition-transform duration-300 ring-4 ring-white"></div>

                            <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform">
                                    <Clock size={80} />
                                </div>
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="px-2 py-1 bg-indigo-50 text-[#4F46E5] text-[8px] font-bold uppercase tracking-widest rounded-lg border border-indigo-100">
                                            {dayjs(event.timestamp).format('HH:mm')}
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 tracking-tight uppercase">{event.title}</h4>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                                        {dayjs(event.timestamp).format('DD MMM, YYYY')}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed relative z-10">{event.description}</p>
                                {event.performedBy && (
                                    <div className="flex items-center gap-3 pt-6 border-t border-slate-50 relative z-10">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200 uppercase">
                                            {event.performedBy.userName?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-700 leading-none mb-0.5">{event.performedBy.userName}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{event.performedBy.userRole}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                        <Activity size={40} strokeWidth={1} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">No Activity Yet</h4>
                    <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">Timeline events will appear here as the verification progresses.</p>
                </div>
            )}
        </div>
    );
};

const ActionsTab = ({
    caseData, onClose, onGenerateReport, loading, canEdit,
    showConsentModal, setShowConsentModal,
    showDiscrepancyModal, setShowDiscrepancyModal,
    showTaskAssignModal, setShowTaskAssignModal,
    selectedCheck, setSelectedCheck, selectedCase,
    handleConsentCaptured, handleDiscrepancyAdded, handleTaskAssigned,
    handleContinueJoiningLetter
}) => {
    const [decision, setDecision] = useState('');
    const [remarks, setRemarks] = useState('');

    const handleSubmit = () => {
        if (!decision) {
            showToast('error', 'Error', 'Please select a professional decision');
            return;
        }
        onClose(decision, remarks);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-10 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform">
                    <Download size={140} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="max-w-md">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-50 text-[#4F46E5] rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4">
                            REPORTS
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-3 uppercase">Generate Report</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">Download the complete background verification report.</p>
                    </div>
                    {canEdit && (
                        <button
                            onClick={onGenerateReport}
                            disabled={loading}
                            className="h-16 px-10 bg-slate-900 text-white rounded-[1.5rem] font-bold text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-[#4F46E5] hover:scale-105 transition-all flex items-center justify-center gap-3 shrink-0"
                        >
                            <Download size={20} strokeWidth={2.5} />
                            Generate
                        </button>
                    )}
                </div>
            </div>

            {!caseData.isClosed ? (
                <div className="bg-white rounded-[3rem] border border-slate-200/60 p-10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5">
                        <CheckSquare size={140} />
                    </div>
                    <div className="mb-10 text-center relative z-10">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-50 text-[#4F46E5] rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4">
                            CASE CLOSURE
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Final Decision</h3>
                        <p className="text-slate-400 text-sm font-semibold mt-2 uppercase tracking-widest">SELECT THE FINAL DECISION FOR THIS CASE</p>
                    </div>

                    {canEdit ? (
                        <div className="space-y-10 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { id: 'APPROVED', label: 'APPROVED', icon: <CheckCircle className="text-emerald-500" /> },
                                    { id: 'REJECTED', label: 'REJECTED', icon: <XCircle className="text-rose-500" /> },
                                    { id: 'RECHECK_REQUIRED', label: 'RECHECK', icon: <RefreshCw className="text-amber-500" /> }
                                ].map((dec) => (
                                    <button
                                        key={dec.id}
                                        onClick={() => setDecision(dec.id)}
                                        className={`flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 transition-all duration-300 ${decision === dec.id
                                            ? 'border-[#4F46E5] bg-indigo-50 shadow-lg shadow-indigo-500/10'
                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border ${decision === dec.id ? 'border-indigo-200' : 'border-slate-100'}`}>
                                            {dec.icon}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{dec.label}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 block">FINAL REMARKS</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Enter final remarks..."
                                    className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[2rem] focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-sm font-medium h-40 resize-none shadow-inner"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || !decision}
                                className="w-full h-16 bg-[#4F46E5] text-white rounded-[1.5rem] font-bold text-[12px] uppercase tracking-[0.25em] shadow-2xl shadow-indigo-500/30 hover:bg-[#0ea5e9] hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-3"
                            >
                                {loading ? 'CLOSING CASE...' : 'CLOSE CASE'}
                            </button>
                        </div>
                    ) : (
                        <div className="p-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <Shield size={40} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Administrative access required for case closure</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <ShieldCheck size={160} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-indigo-500 rounded-[2rem] flex items-center justify-center border-4 border-white/20 mx-auto mb-8 shadow-2xl">
                            <CheckSquare size={32} className="text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-white tracking-tight uppercase mb-4">Case Closed</h3>
                        <p className="text-slate-400 font-semibold text-sm tracking-widest uppercase mb-10 opacity-80">THIS BACKGROUND VERIFICATION HAS BEEN CLOSED</p>

                        <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 text-left">
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <InfoItem label="DECISION" value={caseData.decision} dark />
                                <InfoItem label="CLOSED AT" value={dayjs(caseData.closedAt).format('DD MMM YYYY')} dark />
                            </div>
                            {caseData.decisionRemarks && (
                                <div className="pt-6 border-t border-white/10">
                                    <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-3">REMARKS</div>
                                    <p className="text-sm text-slate-200 font-medium leading-relaxed italic opacity-90">"{caseData.decisionRemarks}"</p>
                                </div>
                            )}

                            {canEdit && caseData.decision === 'APPROVED' && (
                                <div className="mt-8">
                                    <button
                                        onClick={handleContinueJoiningLetter}
                                        className="w-full h-14 bg-gradient-to-r from-indigo-400 to-[#4F46E5] rounded-xl text-white font-bold text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform"
                                    >
                                        <FileText size={18} />
                                        Continue to Joining Letter
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DocumentPreviewModal = ({ doc, onClose }) => {
    console.log('[DocumentPreviewModal] Rendering for doc:', doc.originalName);
    if (!doc) return null;

    // Build correct URL. Force root-relative by ensuring leading /
    const fileUrl = doc.filePath.startsWith('http')
        ? doc.filePath
        : doc.filePath.startsWith('/') ? doc.filePath : `/${doc.filePath}`;

    const fileName = doc.originalName || doc.filePath.split('/').pop() || '';
    const isImage = fileName.match(/\.(jpg|jpeg|png|gif)$/i);
    const isPdf = fileName.match(/\.pdf$/i);
    const isWord = fileName.match(/\.(doc|docx)$/i);

    return createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight uppercase">{doc.documentType?.replace(/_/g, ' ')}</h4>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">{doc.originalName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a
                            href={fileUrl}
                            download={doc.originalName}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-xl transition-all shadow-md flex items-center gap-2"
                        >
                            <Download size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Download</span>
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2.5 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all border border-slate-100"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-50 overflow-hidden relative">
                    {isImage ? (
                        <div className="absolute inset-0 flex items-center justify-center p-8 overflow-auto">
                            <img
                                src={fileUrl}
                                className="max-w-full max-h-full object-contain rounded-xl shadow-xl border-4 border-white"
                                alt="Document"
                            />
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={fileUrl}
                            className="w-full h-full border-none bg-white"
                            title="PDF Preview"
                        />
                    ) : isWord ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Word Document Preview</h3>
                            <p className="text-slate-500 max-w-sm mb-8">
                                Direct browser preview is not supported for Word documents (.doc, .docx). 
                                Please download the file to view its content.
                            </p>
                            <a
                                href={fileUrl}
                                download={doc.originalName}
                                className="px-8 py-4 bg-[#4F46E5] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-[#4338CA] transition-all shadow-lg shadow-indigo-200 flex items-center gap-3"
                            >
                                <Download size={18} />
                                Download for Preview
                            </a>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mb-6">
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Unsupported Preview</h3>
                            <p className="text-slate-500 max-w-sm mb-8">
                                This file type cannot be previewed in the browser. 
                                Please download the file to view it.
                            </p>
                            <a
                                href={fileUrl}
                                download={doc.originalName}
                                className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-900 transition-all shadow-lg flex items-center gap-3"
                            >
                                <Download size={18} />
                                Download File
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                        SECURE PREVIEW ENGINE V1.0
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            VERSION {doc.version || 1}
                        </span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {doc.fileSize ? (doc.fileSize / 1024).toFixed(1) + ' KB' : 'Size Unknown'}
                        </span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BGVDetailModal;
