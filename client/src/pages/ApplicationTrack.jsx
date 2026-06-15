import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_ROOT } from '../utils/api';
import {
    ArrowLeft, Clock, Briefcase, Building2, MapPin,
    ExternalLink, ShieldCheck, AlertCircle,
    CheckCircle2, Download, X, Upload, FileText,
    Check, XCircle, History
} from 'lucide-react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { getTenantId } from '../utils/auth';
import { getBasePath } from '../utils/navigation';
import { useAuth } from '../context/AuthContext';
import EmployeeOnboardingPortal from './Onboarding/EmployeeOnboardingPortal';
import SignatureModal from './Onboarding/SignatureModal';
import BGVUploadModal from './Onboarding/BGVUploadModal';
import JoiningLetterWorkflowPanel from './Onboarding/JoiningLetterWorkflowPanel';

const OfferCountdown = ({ expiryDate }) => {
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        const calculateTimeLeft = () => {
            if (!expiryDate) return null;
            const difference = new Date(expiryDate) - new Date();
            if (difference > 0) {
                return {
                    hours: Math.floor(difference / (1000 * 60 * 60)),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60),
                };
            }
            return null;
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [expiryDate]);

    if (!timeLeft) return null;

    return (
        <div className="mt-1.5 text-[10px] text-blue-500 font-black uppercase tracking-wider animate-pulse transition-all">
            {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s valid
        </div>
    );
};

const DEFAULT_TRACKING_STAGES = [
    { id: 'Applied', label: 'Application Submitted', backendKeys: ['Applied', 'applied'], description: 'Initial application received', systemStage: true },
    { id: 'Shortlisted', label: 'Resume Screening', backendKeys: ['Shortlisted', 'shortlisted', 'Screening', 'screening', 'Technical'], description: 'HR is reviewing your profile', systemStage: true },
    { id: 'Interview', label: 'Interview Process', backendKeys: ['Interview', 'interview', 'Interview Scheduled', 'Interview Completed', 'L1 Round', 'L2 Round'], description: 'Technical & skill evaluations', systemStage: true },
    { id: 'HR', label: 'HR Round', backendKeys: ['HR Round', 'HR Interview', 'Cultural Fit'], description: 'Culture fit & salary discussion', systemStage: true },
    { id: 'Offered', label: 'Finalized', backendKeys: ['Offered', 'offered', 'Selected', 'selected', 'Offer Issued', 'Offer Accepted', 'Offer Accepted - Awaiting Company Approval', 'Fully Signed', 'Finalized', 'Hired', 'hired', 'Joining Letter Issued'], description: 'Final selection & onboarding', systemStage: true }
];

const FINAL_STAGE_KEYS = ['Offered', 'Selected', 'Offer Issued', 'Offer Accepted', 'Offer Accepted - Awaiting Company Approval', 'Offer Accepted – Awaiting Company Approval', 'Fully Signed', 'Finalized', 'Hired', 'Joining Letter Issued'];

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const isAppliedStage = (stage) => {
    const name = normalizeKey(stage?.stageName || stage?.label || stage?.id);
    const type = normalizeKey(stage?.stageType);
    return name === 'applied' || name === 'application submitted' || (type === 'system' && name.includes('applied'));
};

const isFinalStage = (stage) => {
    const name = normalizeKey(stage?.stageName || stage?.label || stage?.id);
    const type = normalizeKey(stage?.stageType);
    return name === 'finalized' || name === 'selected' || name.includes('offer') || name === 'hired' || type === 'offer' || type === 'finalized';
};

const getStageDescription = (stage) => {
    const type = normalizeKey(stage?.stageType);
    if (type === 'technical') return 'Technical evaluation round';
    if (type === 'assessment') return 'Practical or assignment evaluation';
    if (type === 'hr') return 'HR discussion and fitment review';
    if (type === 'screening') return 'Profile screening and initial review';
    if (type === 'management') return 'Management review round';
    if (type === 'offer' || type === 'finalized') return 'Final selection and offer process';
    return stage?.instructions || 'Recruitment stage review';
};

const buildTrackingStages = (jobDetails) => {
    const configuredStages = Array.isArray(jobDetails?.pipelineStages) ? jobDetails.pipelineStages : [];
    const progressStages = Array.isArray(jobDetails?.pipelineProgress) ? jobDetails.pipelineProgress : [];
    const sourceStages = configuredStages.length ? configuredStages : progressStages;

    if (!sourceStages.length) return DEFAULT_TRACKING_STAGES;

    const stages = [
        { id: 'Applied', label: 'Application Submitted', backendKeys: ['Applied', 'applied'], description: 'Initial application received', systemStage: true }
    ];

    sourceStages.forEach((stage, index) => {
        if (isAppliedStage(stage) || isFinalStage(stage)) return;

        const progress = progressStages.find(item =>
            normalizeKey(item.stageId) === normalizeKey(stage.stageId || index) ||
            normalizeKey(item.stageName) === normalizeKey(stage.stageName)
        );
        const stageName = stage.stageName || stage.name || `Stage ${index + 1}`;
        const keys = [
            stageName,
            stage.stageId,
            stage.stageType,
            progress?.stageName,
            progress?.stageId
        ].filter(Boolean);

        stages.push({
            id: stage.stageId || stageName,
            label: stageName,
            backendKeys: [...new Set(keys)],
            description: getStageDescription(stage),
            stageType: stage.stageType,
            progress
        });
    });

    stages.push({
        id: 'Offered',
        label: 'Finalized',
        backendKeys: FINAL_STAGE_KEYS,
        description: 'Final selection & onboarding',
        systemStage: true
    });

    return stages;
};

const logMatchesStage = (log, stage) => {
    const logValues = [
        log?.status,
        log?.stageName,
        log?.stage,
        log?.to,
        log?.from,
        log?.stageId,
        log?.currentStage?.stageName
    ].map(normalizeKey).filter(Boolean);
    const stageKeys = (stage.backendKeys || []).map(normalizeKey).filter(Boolean);

    return logValues.some(value => stageKeys.includes(value));
};

export default function ApplicationTrack() {
    // console.log('[ApplicationTrack] React.useCallback status:', typeof React.useCallback);
    // 1. All Hooks Must Be at the Top
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const tenantId = getTenantId();
    const isHR = ['admin', 'hr', 'owner', 'company_admin', 'company_super_admin'].includes(user?.role?.toLowerCase() || user?.roleName?.toLowerCase());

    const [timeline, setTimeline] = useState([]);
    const [jobDetails, setJobDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState([]);
    const [uploadingDoc, setUploadingDoc] = useState(null);
    const [bgvInitiated, setBgvInitiated] = useState(false);
    const [requiredDocs, setRequiredDocs] = useState([]);
    const [signedStatus, setSignedStatus] = useState({ isSigned: false });
    const [showSignModal, setShowSignModal] = useState(false);

    // Joining Letter state
    const [joiningSignedStatus, setJoiningSignedStatus] = useState({ isSigned: false });
    const [showJoiningSignModal, setShowJoiningSignModal] = useState(false);
    const [showJoiningOfferModal, setShowJoiningOfferModal] = useState(false);
    const [showBGVModal, setShowBGVModal] = useState(false);
    const [openingOnboarding, setOpeningOnboarding] = useState(false);
    const [onboardingToken, setOnboardingToken] = useState(null);

    // === JOINING LETTER WORKFLOW STATE ===
    const [joiningLetterWorkflow, setJoiningLetterWorkflow] = useState(null);
    const [joiningActionLoading, setJoiningActionLoading] = useState(false);
    const [signingTarget, setSigningTarget] = useState(null); // { id, type: 'offer' | 'joining' }

    const API_ORIGIN = API_ROOT.replace(/\/+$/, '');
    const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

    // Dynamic PDF URL helper (Updated to use candidate-specific endpoint)
    const getLetterPdfUrl = (letterId, download = false) => {
        if (!letterId) return null;
        const authId = getTenantId() || jobDetails?.tenantId;
        const tokenParam = onboardingToken ? `&token=${onboardingToken}` : '';
        return `${API_BASE}/public/letters/${letterId}/view-pdf?tenantId=${authId}${tokenParam}&download=${download}&_t=${Date.now()}`;
    };

    const offerLetterViewId = jobDetails?.offerLetterId || jobDetails?.letterId;
    const offerLetterUrl = offerLetterViewId
        ? getLetterPdfUrl(offerLetterViewId)
        : (jobDetails?.offerLetterUrl?.startsWith('http')
            ? jobDetails?.offerLetterUrl
            : (jobDetails?.offerLetterUrl ? `${API_BASE.replace(/\/api$/, '')}${jobDetails.offerLetterUrl}` : null));
    const joiningLetterUrl = jobDetails?.joiningLetterId
        ? getLetterPdfUrl(jobDetails.joiningLetterId)
        : (jobDetails?.joiningLetterUrl?.startsWith('http')
            ? jobDetails?.joiningLetterUrl
            : (jobDetails?.joiningLetterUrl ? `${API_BASE.replace(/\/api$/, '')}${jobDetails.joiningLetterUrl}` : null));

    const isInternal = window.location.pathname.startsWith('/employee');
    const stages = buildTrackingStages(jobDetails);
    const currentStatus = (jobDetails?.status || 'Applied').toLowerCase();
    const currentStageName = jobDetails?.currentStage?.stageName || jobDetails?.stageHistory?.slice?.(-1)?.[0]?.stageName || null;
    const currentStageDisplay = currentStageName || jobDetails?.status || 'Applied';
    const onboarding = jobDetails?.onboarding || null;
    const hasOnboardingJourney = !!(onboarding?.instanceId || onboarding?.status);
    const shouldShowOnboardingPanel = !isInternal && (hasOnboardingJourney || jobDetails?.joiningLetterStatus === 'SIGNED' || jobDetails?.joiningLetterStatus === 'ACCEPTED' || jobDetails?.status === 'Hired');

    // Effect to auto-fetch onboarding token for embedded form
    useEffect(() => {
        const fetchOnboardingToken = async () => {
            if (shouldShowOnboardingPanel && !onboardingToken && !openingOnboarding && applicationId) {
                try {
                    const res = await api.get(`/candidate/application/onboarding/${applicationId}/access`);
                    const portalUrl = res.data?.onboarding?.portalUrl;
                    if (portalUrl) {
                        try {
                            const url = new URL(portalUrl, window.location.origin);
                            const tokenValue = url.searchParams.get('token');
                            if (tokenValue) setOnboardingToken(tokenValue);
                        } catch (e) {
                            // Fallback if portalUrl is relative or different
                            if (portalUrl.includes('token=')) {
                                const t = portalUrl.split('token=')[1]?.split('&')[0];
                                if (t) setOnboardingToken(t);
                            }
                        }
                    }
                } catch (err) {
                    console.warn("Silent onboarding token fetch failed", err);
                }
            }
        };
        fetchOnboardingToken();
    }, [shouldShowOnboardingPanel, onboardingToken, openingOnboarding, applicationId]);

    const fetchTimeline = useCallback(async () => {
        if (!applicationId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/candidate/application/track/${applicationId}`);
            setTimeline(res.data?.timeline || []);
            setJobDetails(res.data?.jobDetails || null);

            if (!res.data?.jobDetails) {
                setError("Application details not found.");
            }
        } catch (err) {
            console.error("Failed to load timeline", err);
            setError("Failed to load tracking data. The application may be unavailable.");
        } finally {
            setLoading(false);
        }
    }, [applicationId]);

    // 3. Effects
    useEffect(() => {
        fetchTimeline();
    }, [fetchTimeline]);


    // Fetch Signing Status (Offer)
    useEffect(() => {
        const fetchOfferStatus = async () => {
            if (jobDetails?.offerLetterId) {
                try {
                    const res = await api.get(`/candidate/letter/status/${jobDetails.offerLetterId}`);
                    setSignedStatus(res.data);
                } catch (err) {
                    console.error("Offer status fetch failed", err);
                }
            } else if (jobDetails?.letterId) {
                // fallback
                try {
                    const res = await api.get(`/candidate/letter/status/${jobDetails.letterId}`);
                    setSignedStatus(res.data);
                } catch (err) {
                    console.error("Status fetch failed", err);
                }
            }
        };
        fetchOfferStatus();
    }, [jobDetails?.offerLetterId, jobDetails?.letterId]);

    // Fetch Signing Status (Joining)
    useEffect(() => {
        if (jobDetails?.joiningLetterId) {
            api.get(`/candidate/letter/status/${jobDetails.joiningLetterId}`)
                .then(res => setJoiningSignedStatus(res.data))
                .catch(err => console.error("Joining status fetch failed", err));
        }
    }, [jobDetails?.joiningLetterId]);

    // Fetch Joining Letter Workflow Status
    useEffect(() => {
        if (isInternal && jobDetails?.joiningLetterId) {
            api.get(`/letters/joining/${jobDetails.joiningLetterId}/status`)
                .then(res => setJoiningLetterWorkflow(res.data))
                .catch(err => console.warn('[Joining Workflow] Status fetch failed:', err.message));
        }
    }, [jobDetails?.joiningLetterId]);

    useEffect(() => {
        const handlePopState = (event) => {
            event.preventDefault();
            if (window.location.pathname.startsWith('/employee') || window.location.pathname.startsWith('/hr/my-') || window.location.pathname.startsWith('/tenant/my-')) {
                navigate(`${getBasePath(user?.role)}/my-applications`, { replace: true });
            } else if (tenantId) {
                navigate(`/jobs/${tenantId}`, { replace: true });
            } else {
                navigate('/candidate/dashboard', { replace: true });
            }
        };
        window.history.pushState(null, null, window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [tenantId, navigate]);

    const handleBackNav = () => {
        if (window.location.pathname.startsWith('/employee') || window.location.pathname.startsWith('/hr/my-') || window.location.pathname.startsWith('/tenant/my-')) {
            navigate(`${getBasePath(user?.role)}/internal-jobs`);
        } else {
            navigate('/candidate/applications');
        }
    };

    // 4. Handlers
    const handleDownload = async (url, title) => {
        if (!url) return;
        try {
            const baseUrl = API_BASE.replace(/\/api$/, '');
            const finalUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
            window.open(finalUrl, '_blank');
        } catch (err) {
            console.error(`Download failed for ${title}:`, err);
            alert(`Sorry! This ${title} is not yet available.`);
        }
    };

    const handleAcceptOffer = async () => {
        if (!signedStatus.isSigned) {
            alert('Please sign the offer letter first, then accept.');
            return;
        }
        if (!window.confirm("Are you sure you want to ACCEPT this offer?")) return;
        try {
            setLoading(true);
            const res = await api.patch(`/candidate/offer/respond`, { applicationId, action: 'ACCEPT' });
            if (res.data.success) {
                alert("Offer Accepted!");
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to accept offer:", err);
            alert(err.response?.data?.error || err.response?.data?.message || "Failed to accept offer.");
            setLoading(false);
        }
    };

    const handleRequestRevision = async () => {
        if (!window.confirm("Do you want to request HR to issue a new offer?")) return;
        try {
            setLoading(true);
            const res = await api.post(`/candidate/application/request-offer-revision/${applicationId}`);
            if (res.data.success) {
                alert("Your request for a new offer has been sent to HR.");
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to request revision:", err);
            alert(err.response?.data?.error || "Failed to request revision.");
            setLoading(false);
        }
    };

    const handleRejectOffer = async () => {
        if (!window.confirm("Are you sure you want to REJECT this offer?")) return;
        try {
            setLoading(true);
            const res = await api.patch(`/candidate/offer/respond`, { applicationId, action: 'REJECT' });
            if (res.data.success) {
                alert("Offer Rejected.");
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to reject offer:", err);
            alert(err.response?.data?.error || "Failed to reject offer.");
            setLoading(false);
        }
    };


    const handleFinalAccept = async () => {
        try {
            const letterId = jobDetails?.offerLetterId || jobDetails?.letterId;
            if (!letterId) return;

            if (!signedStatus.isSigned) {
                if (!window.confirm("You haven't signed the letter yet. Would you like to sign it now?")) {
                    return;
                }
                setSigningTarget({ id: letterId, type: 'offer' });
                setShowSignModal(true);
                return;
            }

            setLoading(true);
            const res = await api.post(`/letters/${letterId}/accept`);
            if (res.data.success) {
                alert("Congratulations! The letter has been accepted and finalized.");
                setShowOfferModal(false);
                window.location.reload();
            }
        } catch (err) {
            console.error("Final accept error:", err);
            alert(err.response?.data?.message || "Failed to accept letter");
            setLoading(false);
        }
    };

    const handleSignSave = async (data) => {
        if (signingTarget?.type === 'offer') {
            await handleSignOfferLetter(data.signatureImage, data.signaturePosition);
        } else {
            await handleSignJoiningLetter(data.signatureImage, data.signaturePosition);
        }
    };

    const handleSignOfferLetter = async (base64, settings) => {
        try {
            const resolvedOfferLetterId =
                signingTarget?.id ||
                jobDetails?.offerLetterId ||
                jobDetails?.letterId;
            if (!resolvedOfferLetterId) {
                alert("Offer letter not found for signing.");
                return;
            }

            setLoading(true);
            const res = await api.post(`/candidate/letter/sign/${resolvedOfferLetterId}`, {
                signatureImage: base64,
                signaturePosition: settings || signedStatus.signaturePosition
            });
            if (res.data.success) {
                // Sync strict hiring workflow state (OfferLetter + Application)
                try {
                    await api.patch('/candidate/offer/sign', { applicationId });
                } catch (e) {
                    console.warn('Offer sign status update failed:', e?.response?.data?.message || e?.message);
                }

                // Important: Trigger reload or update state to refresh PDF iframe
                setSignedStatus({ isSigned: true, signedAt: res.data.signedAt });
                setShowSignModal(false);
                alert("Letter signed successfully!");
                window.location.reload(); // Force reload to refresh application status and hide accept/reject buttons
            }
        } catch (err) {
            console.error("Signing failed", err);
            alert(err?.response?.data?.details || err?.response?.data?.error || err?.response?.data?.message || "Failed to save signature. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignJoiningLetter = async (base64, settings) => {
        try {
            const targetLetterId = signingTarget?.id || jobDetails?.joiningLetterId;
            if (!targetLetterId) {
                alert("Joining letter not found for signing.");
                return;
            }

            setLoading(true);
            const res = await api.post(`/candidate/letter/sign/${targetLetterId}`, {
                signatureImage: base64,
                signaturePosition: settings || joiningSignedStatus.signaturePosition
            });
            if (res.data.success) {
                setJoiningSignedStatus({ isSigned: true, signedAt: res.data.signedAt });
                setShowJoiningSignModal(false);
                alert(res.data.message || "Joining Letter signed successfully! HR will verify and finalize your onboarding soon.");
                window.location.reload();
            }
        } catch (err) {
            console.error("Signing failed", err);
            alert(err?.response?.data?.details || err?.response?.data?.error || err?.response?.data?.message || "Failed to save signature. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptJoining = async () => {
        if (!window.confirm("Are you sure you want to ACCEPT the joining letter?")) return;
        try {
            setLoading(true);
            // Step 1: Accept joining letter (enables "Sign" UI)
            const res = await api.post(`/candidate/application/accept-joining-letter/${applicationId}`);
            if (res.data.success) {
                alert("Joining Letter Accepted!");
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to accept joining letter:", err);
            alert(err.response?.data?.error || err.response?.data?.message || "Failed to accept joining letter.");
            setLoading(false);
        }
    };

    const handleRejectJoining = async () => {
        if (!window.confirm("Are you sure you want to REJECT the joining letter?")) return;
        try {
            setLoading(true);
            // Keep legacy rejection endpoint for now (strict flow only needs confirm-to-join)
            const res = await api.post(`/candidate/application/reject-joining-letter/${applicationId}`);
            if (res.data.success) {
                alert("Joining Letter Rejected.");
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to reject joining letter:", err);
            alert(err.response?.data?.error || "Failed to reject joining letter.");
            setLoading(false);
        }
    };

    const handleRequestJoiningRevision = async () => {
        if (!window.confirm("Do you want to request HR to issue a new joining letter?")) return;
        try {
            setLoading(true);
            const res = await api.post(`/candidate/application/request-joining-revision/${applicationId}`);
            if (res.data.success) {
                alert("Your request for a new joining letter has been sent to HR.");
                window.location.reload();
            }
        } catch (err) {
            console.error("Failed to request joining revision:", err);
            alert(err.response?.data?.error || "Failed to request joining revision.");
            setLoading(false);
        }
    };

    const handleOpenOnboardingPortal = async () => {
        try {
            setOpeningOnboarding(true);
            const res = await api.get(`/candidate/application/onboarding/${applicationId}/access`);
            const portalUrl = res.data?.onboarding?.portalUrl;
            if (!portalUrl) {
                alert("Onboarding portal link is not ready yet. Please refresh once and try again.");
                return;
            }
            window.location.assign(portalUrl);
        } catch (err) {
            console.error("Failed to open onboarding portal:", err);
            alert(err.response?.data?.message || "Unable to open onboarding portal right now.");
        } finally {
            setOpeningOnboarding(false);
        }
    };

    const handleFileUpload = async (event, docType) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File size must be less than 5MB");
            return;
        }

        const formData = new FormData();
        formData.append('document', file);
        formData.append('type', docType);

        setUploadingDoc(docType);
        try {
            await api.post(`/candidate/application/bgv-documents/${applicationId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const res = await api.get(`/candidate/application/bgv-documents/${applicationId}`);
            if (res.data && res.data.documents) {
                setUploadedDocs(res.data.documents);
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to upload document.");
        } finally {
            setUploadingDoc(null);
        }
    };

    // 5. Early Returns (AFTER hooks)
    if (loading) return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tracking Journey...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-100 text-center">
                <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Tracking Error</h3>
                <p className="text-slate-500 font-medium mb-10 leading-relaxed">{error}</p>
                <button
                    onClick={handleBackNav}
                    className="w-full bg-slate-50 border border-slate-100 text-slate-600 py-4 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                >
                    <ArrowLeft size={16} /> Back to My Applications
                </button>
            </div>
        </div>
    );

    const onboardingStatusLabel = String(onboarding?.status || 'started').replace(/_/g, ' ');
    const offerExpiryAt = jobDetails?.offerExpiryAt ? dayjs(jobDetails.offerExpiryAt) : null;
    const offerStatus = jobDetails?.offerStatus; // SENT, EXPIRED, ACCEPTED, REQUESTED, etc.

    // Robust expiry check
    const isOfferExpired = Boolean(
        offerStatus === 'EXPIRED' ||
        jobDetails?.status === 'Offer Expired' ||
        (offerStatus === 'SENT' && offerExpiryAt && dayjs().isAfter(offerExpiryAt))
    );

    // Include SIGNED / Fully Signed: hiring flow sets offerStatus to SIGNED after /candidate/offer/sign
    const statusNorm = String(jobDetails?.status || '').toLowerCase();
    const isOfferAccepted =
        offerStatus === 'ACCEPTED' ||
        offerStatus === 'SIGNED' ||
        jobDetails?.status === 'Offer Accepted' ||
        jobDetails?.status === 'Offer Accepted - Awaiting Company Approval' ||
        jobDetails?.status === 'Fully Signed' ||
        statusNorm.includes('fully signed');
    const isOfferRejected = offerStatus === 'REJECTED' || jobDetails?.status === 'Offer Rejected';
    // Priority: If status is SENT, then it's NO LONGER just requested (it's now ACTIVE)
    const isRevisionRequested = offerStatus === 'REQUESTED' || (jobDetails?.offerRevisionRequested && offerStatus !== 'SENT');

    const joiningLetterExpiryAt = jobDetails?.joiningLetterExpiryAt ? dayjs(jobDetails.joiningLetterExpiryAt) : null;
    const joiningLetterStatus = jobDetails?.joiningLetterStatus;
    const isJoiningLetterExpired = Boolean(
        joiningLetterStatus === 'EXPIRED' ||
        (joiningLetterStatus === 'SENT' && joiningLetterExpiryAt && dayjs().isAfter(joiningLetterExpiryAt))
    );
    const isJoiningRevisionRequested = joiningLetterStatus === 'REQUESTED' || (jobDetails?.joiningLetterRevisionRequested && joiningLetterStatus !== 'SENT');

    const progressIndex = stages.findIndex(stage => normalizeKey(stage.progress?.status) === 'in progress');
    const currentStageIndex = stages.findIndex(stage => {
        const keys = (stage.backendKeys || []).map(normalizeKey);
        return keys.includes(normalizeKey(currentStageName)) || keys.includes(currentStatus);
    });
    const statusIndex = progressIndex >= 0
        ? progressIndex
        : (currentStageIndex >= 0
            ? currentStageIndex
            : stages.findIndex(stage => (stage.backendKeys || []).map(normalizeKey).includes(currentStatus)));
    const effectiveStatusIndex = statusIndex >= 0 ? statusIndex : 0;
    const isFinalApplicationStatus = FINAL_STAGE_KEYS.map(normalizeKey).includes(currentStatus);

    return (
        <>
            <div className="min-h-screen bg-[#F8FAFC] p-3 animate-in fade-in duration-500 overflow-y-auto">
                {/* -- PREMIUM BACKGROUND MESH -- */}
                <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
                <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-blue-400/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute top-40 left-0 w-[300px] h-[300px] bg-indigo-400/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative z-10 w-full">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 sm:mb-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBackNav}
                            className="bg-white/80 backdrop-blur-md p-2.5 rounded-xl shadow-sm border border-slate-200/50 text-slate-400 hover:text-blue-600 transition-all duration-300 group"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div className="min-w-0">
                            <div className="mb-0.5">
                                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[6.5px] font-black uppercase tracking-[1px] rounded-md shadow-md shadow-blue-500/10">Active Journey</span>
                            </div>
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <h1 className="text-sm sm:text-base font-black text-slate-800 tracking-tight leading-none uppercase truncate">
                                    Application <span className="text-blue-600">Tracking</span>
                                </h1>
                                <span className="text-[7px] text-slate-400 font-bold uppercase tracking-[1px] opacity-60">Ref: {String(applicationId || '').slice(-6).toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                    {/* -- LEFT SIDEBAR: JOB CARD -- */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-white p-5 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
                            
                            <div className="relative z-10">
                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white mb-5 shadow-xl shadow-blue-500/20 rotate-3 group-hover:rotate-0 transition-all duration-500">
                                    <Briefcase size={22} />
                                </div>
                                <h2 className="text-base font-bold text-slate-800 tracking-wide mb-2 leading-tight group-hover:text-blue-600 transition-colors uppercase">
                                    {jobDetails?.title || 'Position'}
                                </h2>
                                
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-slate-500 group-hover:translate-x-1 transition-transform">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-blue-500 shadow-sm border border-slate-100">
                                            <Building2 size={12} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-40">Dept</span>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider">{jobDetails?.department || 'General'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500 group-hover:translate-x-1 transition-transform delay-75">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                                            <MapPin size={12} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-40">Loc</span>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider">{jobDetails?.company || 'Corporate'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100/50 space-y-1.5">
                                    {(jobDetails?.offerLetterUrl || jobDetails?.letterId) && (
                                        <button
                                            onClick={() => setShowOfferModal(true)}
                                            className="w-full bg-white border border-slate-200 text-slate-800 h-[40px] rounded-xl font-bold text-[9px] uppercase tracking-[1px] hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                                        >
                                            <FileText className="w-3.5 h-3.5" /> View Offer
                                        </button>
                                    )}

                                    {jobDetails?.joiningLetterUrl && (
                                        <button
                                            onClick={() => handleDownload(jobDetails.joiningLetterUrl, 'Joining Letter')}
                                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white h-[40px] rounded-xl font-bold text-[9px] uppercase tracking-[1px] shadow-lg shadow-blue-500/10 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Joining Letter
                                        </button>
                                    )}

                                    {!(jobDetails?.offerLetterUrl || jobDetails?.letterId) && (
                                        <button
                                            onClick={() => navigate(`/apply-job/${jobDetails?.id}?tenantId=${tenantId}`)}
                                            className="w-full bg-slate-50 text-slate-500 h-[40px] rounded-xl font-black text-[9px] uppercase tracking-[1px] hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" /> App Data
                                        </button>
                                    )}

                                    {isHR && !jobDetails?.joiningLetterId && (
                                        <button
                                            onClick={() => navigate(`/hr/job/${jobDetails?.requirementId?._id || 'all'}/candidates?id=${applicationId}&action=issue-joining`)}
                                            className="w-full bg-indigo-50 text-indigo-600 h-[40px] rounded-xl font-black text-[9px] uppercase tracking-[1px] hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-95 border border-indigo-100 mt-2"
                                        >
                                            <FileText className="w-3.5 h-3.5" /> Issue Joining Letter
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* OFFER ACTIONS CARD */}
                        {(jobDetails?.offerLetterUrl || jobDetails?.offerLetterId || (!jobDetails?.joiningLetterId && jobDetails?.letterId)) && (
                            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-white p-4 text-center animate-in slide-in-from-bottom-5 duration-700">
                                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mx-auto mb-3 shadow-inner">
                                    <FileText size={20} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
                                    {isOfferAccepted ? 'Accepted' : (isOfferExpired ? 'Expired' : 'Action')}
                                </h3>
                                <p className="text-slate-500 text-[10px] font-medium mb-4 px-2 leading-relaxed opacity-70">
                                    {isOfferAccepted
                                        ? "Offer accepted. Proceed below."
                                        : (isOfferExpired
                                            ? "Offer expired. Request new."
                                            : (isOfferRejected
                                                ? "Rejected offer."
                                                : (isRevisionRequested
                                                    ? "Pending revision."
                                                    : "Review and accept to proceed.")))
                                    }
                                </p>
                                <div className="flex flex-col gap-2">
                                    {(jobDetails?.offerLetterId || (!jobDetails?.joiningLetterId && jobDetails?.letterId)) && !signedStatus.isSigned && (
                                        <button
                                            onClick={() => {
                                                setSigningTarget({ id: jobDetails?.offerLetterId || jobDetails?.letterId, type: 'offer' });
                                                setShowSignModal(true);
                                            }}
                                            className="w-full bg-[#0F172A] text-white h-[40px] rounded-xl font-bold text-[9px] uppercase tracking-[1px] hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Check size={14} /> Sign Letter
                                        </button>
                                    )}

                                    {signedStatus.isSigned && (
                                        <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 bg-emerald-50/50 rounded-xl border border-emerald-100 mb-0.5">
                                            <CheckCircle2 size={14} className="animate-bounce" />
                                            <span className="text-[9px] font-bold uppercase tracking-[1px]">Signed</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setShowOfferModal(true)}
                                        className="w-full bg-white border border-slate-200 text-slate-800 h-[40px] rounded-xl font-bold text-[9px] uppercase tracking-[1px] transition-all hover:bg-slate-50 flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <ExternalLink size={14} /> View Doc
                                    </button>

                                    {!isOfferAccepted && !isOfferExpired && !isRevisionRequested && !isOfferRejected && (
                                        <div className="flex flex-col gap-1.5 mt-0.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={handleRejectOffer} className="h-[40px] bg-white border border-rose-100 text-rose-500 rounded-xl font-bold text-[9px] uppercase tracking-[1px] hover:bg-rose-50 transition-all active:scale-95">Reject</button>
                                                {!signedStatus.isSigned && (
                                                    <button
                                                        onClick={() => {
                                                            setSigningTarget({ id: jobDetails?.offerLetterId || jobDetails?.letterId, type: 'offer' });
                                                            setShowSignModal(true);
                                                        }}
                                                        className="h-[40px] bg-blue-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-[1px] hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        Sign Now
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isOfferExpired && !isOfferRejected && !isRevisionRequested && (
                                        <button
                                            onClick={handleRequestRevision}
                                            className="w-full bg-blue-600 text-white h-[40px] rounded-xl font-black text-[9px] uppercase tracking-[1px] shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                                        >
                                            Request Again
                                        </button>
                                    )}

                                    {isRevisionRequested && (
                                        <div className="py-3 px-6 bg-amber-50 rounded-xl border border-amber-100 text-amber-600 font-black text-[10px] uppercase tracking-[1px]">
                                            Revision Pending
                                        </div>
                                    )}



                                    {isOfferAccepted && (
                                        <div className="py-3 px-6 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600 font-black text-[10px] uppercase tracking-[1px] flex items-center justify-center gap-2 mt-2">
                                            <CheckCircle2 size={14} /> Offer Accepted
                                        </div>
                                    )}

                                    {offerExpiryAt && !isOfferAccepted && !isOfferRejected && (
                                        <div className="mt-6 pt-6 border-t border-slate-100/50">
                                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-[2px] mb-2 flex items-center justify-center gap-2">
                                                <Clock size={12} /> Expiry: {offerExpiryAt.format('DD MMM, HH:mm')}
                                            </div>
                                            {!isOfferExpired && <OfferCountdown expiryDate={offerExpiryAt.toDate()} />}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {/* JOINING LETTER ACTIONS CARD */}
                        {(jobDetails?.joiningLetterUrl || jobDetails?.joiningLetterId) && (
                            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-white p-4 text-center animate-in slide-in-from-bottom-5 duration-700">
                                <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-inner">
                                    <FileText size={20} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
                                    Joining Letter
                                </h3>
                                
                                <JoiningLetterWorkflowPanel
                                    letterId={jobDetails?.joiningLetterId}
                                    joiningLetterUrl={jobDetails?.joiningLetterUrl}
                                    workflow={{
                                        status: jobDetails?.joiningLetterStatus,
                                        isSigned: joiningSignedStatus.isSigned
                                    }}
                                    onSign={() => setShowJoiningSignModal(true)}
                                    onAction={(action, note) => {
                                        if (action === 'accept') handleAcceptJoining();
                                        if (action === 'reject') handleRejectJoining();
                                        if (action === 'request-revision') handleRequestRevision(note);
                                    }}
                                    loading={loading}
                                />
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-9">
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.04)] border border-white p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50 opacity-50 rounded-full -mr-24 -mt-24 -z-10 group-hover:scale-110 transition-transform duration-1000" />
                            
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-xl shadow-blue-500/40 rotate-6 group-hover:rotate-0 transition-transform duration-500">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800 tracking-wide uppercase">Journey <span className="text-blue-600">& Progress</span></h2>
                                        <p className="text-[7px] text-slate-400 font-black uppercase tracking-[2px]">Status Feed</p>
                                    </div>
                                </div>
                                <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-[1px]">Stage</span>
                                    <span className="text-sm font-bold text-slate-800 tracking-wide">{String(currentStageDisplay).toUpperCase()}</span>
                                </div>
                            </div>

                            <div className="relative pl-10 sm:pl-20">
                                <div className="absolute left-[30px] sm:left-[45px] top-4 bottom-4 w-[2px] bg-slate-100 rounded-full" />
                                <div className="space-y-8">
                                    {stages.map((stage, index) => {
                                        const progressStatus = normalizeKey(stage.progress?.status);
                                        const isCompletedByProgress = progressStatus === 'completed' || progressStatus === 'skipped';
                                        const isCurrentByProgress = progressStatus === 'in progress';
                                        const isCompleted = isFinalApplicationStatus
                                            ? index < stages.length - 1
                                            : (isCompletedByProgress || index < effectiveStatusIndex);
                                        const isCurrent = isFinalApplicationStatus
                                            ? index === stages.length - 1
                                            : (isCurrentByProgress || index === effectiveStatusIndex);
                                        const isFuture = !isCompleted && !isCurrent;
                                        const logs = timeline.filter(log => logMatchesStage(log, stage));
                                        const log = logs.length > 0 ? logs[logs.length - 1] : null;
                                        const timestamp = log?.timestamp || log?.actionDate || stage.progress?.completedAt || stage.progress?.enteredAt;
                                        const stageBadge = isCompleted
                                            ? (progressStatus === 'skipped' ? 'Skipped' : 'Completed')
                                            : (isCurrent ? 'In Review' : 'Next');

                                        return (
                                            <div key={index} className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between group/step">
                                                <div className="flex items-center gap-4 sm:gap-8">
                                                    <div className={clsx(
                                                            "w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl border-[3px] sm:border-[4px] flex items-center justify-center bg-white shadow-lg transition-all duration-700 relative",
                                                            isCurrent ? 'border-blue-600 ring-[6px] ring-blue-50 scale-110 z-20' : (isCompleted ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50')
                                                    )}>
                                                        {isCurrent ? (
                                                            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-600 rounded-full animate-pulse" />
                                                        ) : (
                                                            isCompleted ? <CheckCircle2 className="h-4 w-4 sm:h-6 sm:w-6 text-emerald-500" strokeWidth={3} /> : <div className="w-1 h-1 bg-slate-100 rounded-full" />
                                                        )}
                                                        
                                                        <div className={clsx(
                                                            "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border-2 border-white shadow-md",
                                                            isCompleted ? 'bg-emerald-500 text-white' : (isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400')
                                                        )}>
                                                            {index + 1}
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className={`font-bold text-xs sm:text-sm tracking-wide mb-0.5 sm:mb-1 uppercase transition-colors duration-500 truncate ${isFuture ? 'text-slate-300' : 'text-slate-800'} ${isCurrent ? 'text-blue-600 animate-pulse' : ''}`}>
                                                            {stage.label}
                                                        </h3>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                                                            <span className={clsx(
                                                                "text-[8px] font-black uppercase tracking-[1px] px-2 py-0.5 rounded-md w-fit",
                                                                isCompleted ? 'bg-emerald-50 text-emerald-600' : (isCurrent ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300')
                                                            )}>
                                                                {stageBadge}
                                                            </span>
                                                            {timestamp && (
                                                                <span className="text-[9px] font-bold text-slate-400 italic">
                                                                     {dayjs(timestamp).format('MMM DD, YYYY')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {!isFuture && (
                                                    <div className="mt-6 sm:mt-0 sm:ml-auto w-full sm:w-[320px] relative">
                                                        {logs.length > 0 ? (
                                                            <div className="space-y-3">
                                                                {logs.map((log, lIdx) => (
                                                                    <div key={lIdx} className="p-4 sm:p-5 bg-white border border-slate-100/50 rounded-[20px] sm:rounded-[20px] shadow-sm hover:shadow-xl hover:border-blue-500/20 transition-all duration-300 group/log">
                                                                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                                                                            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[1px] sm:tracking-[1.5px] text-blue-500 bg-blue-50/50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-xl">
                                                                                {log.status === 'Interview Scheduled' ? 'Schedule Fixed' : (log.status || log.stageName || stage.label)}
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-slate-300 uppercase">
                                                                                {dayjs(log.timestamp || log.actionDate).format('HH:mm A')}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[12px] text-slate-500 font-medium leading-relaxed italic border-l-2 border-slate-100 pl-4 py-1">
                                                                            {log.message || log.remarks || stage.description}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-[20px] text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                                                Waiting for activation...
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* RAW ACTIVITY TIMELINE FEED */}
                        {timeline && timeline.length > 0 && (
                            <div className="mt-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.04)] border border-white p-5 sm:p-8 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 opacity-50 rounded-full -mr-16 -mt-16 -z-10 group-hover:scale-110 transition-transform duration-1000" />
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="bg-slate-800 p-2.5 rounded-xl text-white shadow-xl shadow-slate-900/20 rotate-6 group-hover:rotate-0 transition-transform duration-500">
                                        <History className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800 tracking-wide uppercase">Activity <span className="text-slate-500">Log</span></h2>
                                        <p className="text-[7px] text-slate-400 font-black uppercase tracking-[2px]">Detailed Timeline</p>
                                    </div>
                                </div>
                                <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-100 space-y-6">
                                    {[...timeline].reverse().map((t, idx) => (
                                        <div key={`raw-log-${idx}`} className="relative group/logitem">
                                            <div className="absolute -left-[29px] sm:-left-[37px] top-1.5 h-3 w-3 sm:h-4 sm:w-4 rounded-full border-[3px] border-white bg-slate-400 shadow-sm group-hover/logitem:bg-blue-500 group-hover/logitem:scale-125 transition-all" />
                                            <div className="bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 p-4 rounded-xl border border-slate-100 transition-all duration-300">
                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2">
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{t.status || t.stageName || 'Update'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100 flex items-center gap-1.5">
                                                        <Clock size={10} className="text-slate-400" />
                                                        {dayjs(t.timestamp || t.actionDate).format('MMM DD, YYYY — HH:mm A')}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed bg-white/50 p-2 rounded-lg">
                                                    {t.message || t.remarks || `Application status updated.`}
                                                </p>
                                                {t.updatedBy && (
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <div className="h-4 w-4 rounded bg-slate-200 flex items-center justify-center text-[7px] font-black text-slate-500 uppercase">
                                                            {String(t.updatedBy).charAt(0)}
                                                        </div>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                            By: <span className="text-slate-600">{t.updatedBy}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* PHASE 3: Official Documents & Onboarding */}
                        <div className="space-y-12 animate-in slide-in-from-bottom-5 duration-1000 delay-300">
                            {/* BGV UPLOAD SECTION - INLINE */}
                            {isOfferAccepted && (
                                <div className="mt-8">
                                    <BGVUploadModal 
                                        isEmbedded={true} 
                                        applicationId={applicationId} 
                                        onSuccess={fetchTimeline}
                                    />
                                </div>
                            )}

                            {shouldShowOnboardingPanel && (
                                <div className="space-y-6">
                                    {onboardingToken ? (
                                        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-8 lg:p-12 rounded-[24px] sm:rounded-[48px] border border-emerald-100 shadow-[0_40px_100px_rgba(16,185,129,0.08)]">
                                            <div className="flex items-center gap-4 sm:gap-8 mb-8 sm:mb-10 border-b border-emerald-50 pb-6 sm:pb-8">
                                                <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-3 sm:p-5 rounded-[20px] sm:rounded-[20px] text-white shadow-xl shadow-emerald-500/20 flex-shrink-0">
                                                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight uppercase leading-none mb-2 truncate">Joining <span className="text-emerald-600">Formalities</span></h2>
                                                    <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[2px] sm:tracking-[3px]">Please complete all sections below</p>
                                                </div>
                                                <div className="ml-auto hidden md:block">
                                                    <div className="px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                                                        Secure Portal
                                                    </div>
                                                </div>
                                            </div>
                                            <EmployeeOnboardingPortal token={onboardingToken} isEmbedded={true} />
                                        </div>
                                    ) : (
                                        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 lg:p-14 rounded-[24px] sm:rounded-[48px] border border-emerald-100 shadow-[0_40px_100px_rgba(16,185,129,0.08)] relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-60 h-60 sm:w-80 sm:h-80 bg-emerald-50/60 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-1000"></div>

                                            <div className="flex items-center gap-4 sm:gap-8 mb-8 sm:mb-10">
                                                <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-4 sm:p-5 rounded-[20px] sm:rounded-[20px] text-white shadow-2xl shadow-emerald-500/30 ring-4 sm:ring-8 ring-emerald-50 flex-shrink-0">
                                                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-wide leading-none mb-2 uppercase">Employee <span className="text-emerald-600">Onboarding</span></h2>
                                                    <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[2px] sm:tracking-[3px]">Secure Portal Access</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
                                                <div className="max-w-2xl">
                                                    <p className="text-slate-500 leading-relaxed text-sm sm:text-[15px] font-medium opacity-80">
                                                        {openingOnboarding ? 'Preparing your secure onboarding environment...' : 'Your joining letter has been completed. Personal details, onboarding documents, bank proof, and policy acceptance will now be completed inside the onboarding portal.'}
                                                    </p>
                                                    <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                                        <ShieldCheck size={14} />
                                                        Status: {onboardingStatusLabel}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3">
                                                    <button
                                                        onClick={handleOpenOnboardingPortal}
                                                        disabled={openingOnboarding}
                                                        className="w-full sm:min-w-[240px] bg-gradient-to-r from-emerald-600 to-teal-600 text-white h-12 sm:h-[48px] rounded-[18px] sm:rounded-[14px] font-black text-[10px] sm:text-[11px] uppercase tracking-[2px] shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:hover:translate-y-0"
                                                    >
                                                        {openingOnboarding ? (
                                                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <ExternalLink className="w-4 h-4" />
                                                        )}
                                                        {openingOnboarding ? 'Syncing...' : 'Open Onboarding Portal'}
                                                    </button>
                                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[2px] text-center">
                                                        Upload Aadhaar, PAN, Bank Proof
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Offer Letter Modal - Advanced Architect View */}
            {showOfferModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[92vh] flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden border border-white/20">

                        {/* Modal Header */}
                        <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                        Document Review
                                    </h3>
                                    <div className="text-slate-400 text-[10px] font-bold uppercase mt-1 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                        {offerLetterViewId ? 'Secure Dynamic Document' : 'Official Document'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">

                                <button
                                    onClick={() => handleDownload(offerLetterViewId ? getLetterPdfUrl(offerLetterViewId, true) : jobDetails?.offerLetterUrl, 'Offer Letter')}
                                    className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                                >
                                    <Download size={16} /> Download PDF
                                </button>

                                <button
                                    onClick={() => { setShowOfferModal(false); }}
                                    className="p-4 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-400 transition-all group"
                                >
                                    <X size={28} className="group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Document Display */}
                        <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
                            {/* PDF Preview */}
                            <div className={`flex-1 p-6 lg:p-10 w-full flex flex-col`}>
                                <div className="flex-1 bg-white rounded-3xl shadow-inner border border-slate-200 overflow-hidden relative">
                                    <iframe
                                        src={offerLetterUrl ? `${offerLetterUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH` : undefined}
                                        className="w-full h-full border-0 bg-white"
                                        title="Offer Letter"
                                    />
                                </div>
                                <div className="mt-4 flex items-center justify-between px-2">
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Having trouble viewing? Use the download button or open in a new tab.
                                    </p>
                                    <a
                                        href={offerLetterUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <ExternalLink size={10} /> Open in New Tab
                                    </a>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Joining Letter Modal - Advanced Architect View */}
            {showJoiningOfferModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[92vh] flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden border border-white/20">

                        {/* Modal Header */}
                        <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                        Joining Document Review
                                    </h3>
                                    <div className="text-slate-400 text-[10px] font-bold uppercase mt-1 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                        {jobDetails?.joiningLetterId ? 'Secure Dynamic Document' : 'Official Document'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">

                                <button
                                    onClick={() => handleDownload(jobDetails?.joiningLetterId ? getLetterPdfUrl(jobDetails.joiningLetterId, true) : jobDetails?.joiningLetterUrl, 'Joining Letter')}
                                    className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                                >
                                    <Download size={16} /> Download PDF
                                </button>

                                <button
                                    onClick={() => { setShowJoiningOfferModal(false); }}
                                    className="p-4 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-400 transition-all group"
                                >
                                    <X size={28} className="group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Document Display */}
                        <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
                            {/* PDF Preview */}
                            <div className={`flex-1 p-6 lg:p-10 w-full flex flex-col`}>
                                <div className="flex-1 bg-white rounded-3xl shadow-inner border border-slate-200 overflow-hidden relative">
                                    <iframe
                                        src={joiningLetterUrl ? `${joiningLetterUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH` : undefined}
                                        className="w-full h-full border-0 bg-white"
                                        title="Joining Letter"
                                    />
                                </div>
                                <div className="mt-4 flex items-center justify-between px-2">
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Having trouble viewing? Use the download button or open in a new tab.
                                    </p>
                                    <a
                                        href={joiningLetterUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <ExternalLink size={10} /> Open in New Tab
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SignatureModal
                isOpen={showSignModal || showJoiningSignModal}
                onClose={() => { setShowSignModal(false); setShowJoiningSignModal(false); }}
                onSave={handleSignSave}
                pdfUrl={showJoiningSignModal ? joiningLetterUrl : offerLetterUrl}
                candidateName={user?.name || 'Candidate'}
                saving={loading}
                isJoiningLetter={showJoiningSignModal}
            />
            </div>
        </>
    );
}

