import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { 
    ArrowLeft, Clock, CheckCircle2, AlertCircle, FileText,
    Calendar, MessageSquare, RefreshCw
} from 'lucide-react';
import { notification } from '../../utils/antdGlobal';
import { getHiringRoute } from '../../utils/navigation';

export default function HiringActionPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Determine action type from URL
    const actionType = location.pathname.split('/')[2]; // review, interview, interview-round, offer
    const panelPrefix = location.state?.panelPrefix === '/tenant' ? '/tenant' : '/hr';
    const applicantsPath = location.state?.applicantsPath || `${panelPrefix}/applicants`;

    useEffect(() => {
        const fetchApplication = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/applications/${id}`);
                if (res.data.success) {
                    setApplication(res.data.data);
                } else {
                    setError("Application not found");
                }
            } catch (err) {
                console.error("Fetch application error:", err);
                setError(err.response?.data?.error || "Failed to load application details.");
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchApplication();
    }, [id]);

    useEffect(() => {
        if (!application?._id) return;

        const preferredRoute = getHiringRoute(application, {
            panelPrefix,
            applicantsPath
        });

        if (!preferredRoute.startsWith('/hiring/')) {
            const currentRoute = `${location.pathname}${location.search}`;
            if (currentRoute !== preferredRoute) {
                navigate(preferredRoute, { replace: true });
            }
        }
    }, [application, applicantsPath, location.pathname, location.search, navigate, panelPrefix]);

    const updateStatus = async (status) => {
        setActionLoading(true);
        try {
            const res = await api.patch(`/applications/${id}/status`, { status });
            if (res.data.success) {
                notification.success({
                    message: 'Status Updated',
                    description: `Candidate has been moved to ${status}`,
                    placement: 'topRight'
                });
                
                // Determine new route
                const newRoute = getHiringRoute({ _id: id, status }, {
                    panelPrefix,
                    applicantsPath
                });
                if (window.location.pathname !== newRoute) {
                    navigate(newRoute, { replace: true });
                } else {
                    // Just reload if on same route
                    const updatedRes = await api.get(`/applications/${id}`);
                    if (updatedRes.data.success) setApplication(updatedRes.data.data);
                }
            }
        } catch (err) {
            console.error("Update status error:", err);
            notification.error({
                message: 'Update Failed',
                description: err.response?.data?.message || err.message,
                placement: 'topRight'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleGenerateOffer = () => {
        if (!application.salarySnapshotId && !application.salarySnapshot) {
            notification.warning({
                message: 'Salary Required',
                description: 'Please assign a salary structure before generating an offer letter.',
                placement: 'topRight'
            });
            navigate(`${panelPrefix}/salary-structure/${id}?type=applicant`);
            return;
        }
        // If salary exists, go to letter generation or handle it here
        // For now, let's navigate to the wizard or applicants page with modal open
        navigate(`${applicantsPath}?id=${id}&action=generate-offer`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Action Portal...</p>
                </div>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center">
                    <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Error</h2>
                    <p className="text-slate-500 mb-8">{error || "The application you are looking for does not exist or has been removed."}</p>
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={18} /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    const renderActionContent = () => {
        switch (actionType) {
            case 'review':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <FileText className="text-indigo-600" /> Review Application
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Candidate Details</h4>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="font-bold text-slate-900 text-lg mb-1">{application.name}</p>
                                        <p className="text-slate-500 font-medium">{application.email}</p>
                                        <p className="text-slate-500 font-medium">{application.phone}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Applied For</h4>
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <p className="font-bold text-indigo-900 text-lg mb-1">{application.requirementId?.jobTitle || 'N/A'}</p>
                                        <p className="text-indigo-600 font-bold text-sm">{application.requirementId?.department || 'General'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => updateStatus('Rejected')}
                                disabled={actionLoading}
                                className="flex-1 bg-white border-2 border-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? 'Processing...' : 'Reject'}
                            </button>
                            <button 
                                onClick={() => updateStatus('Shortlisted')}
                                disabled={actionLoading}
                                className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin inline mr-2" size={18} /> : null}
                                Shortlist Candidate
                            </button>
                        </div>
                    </div>
                );
            case 'interview':
                return (
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-10 h-10 text-amber-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-4">Schedule Interview</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">Set up an interview for {application.name} to continue the hiring process.</p>
                        <button 
                            onClick={() => updateStatus('Interview')}
                            disabled={actionLoading}
                            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {actionLoading ? 'Scheduling...' : 'Launch Scheduler'}
                        </button>
                    </div>
                );
            case 'interview-round':
                return (
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                         <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <MessageSquare className="text-purple-600" /> Interview Feedback
                            </h3>
                            <div className="space-y-6">
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Interviewer Evaluation</label>
                                    <textarea 
                                        className="w-full bg-white border border-slate-200 rounded-xl p-4 min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="Add evaluation remarks..."
                                    ></textarea>
                                </div>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => updateStatus('Interview Round')}
                                        disabled={actionLoading}
                                        className="flex-1 bg-white border-2 border-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all disabled:opacity-50"
                                    >
                                        Move to Next Round
                                    </button>
                                    <button 
                                        onClick={() => updateStatus('Selected')}
                                        disabled={actionLoading}
                                        className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                    >
                                        Select for Offer
                                    </button>
                                </div>
                            </div>
                    </div>
                );
            case 'offer':
                return (
                    <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-4">Generate Offer</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">Candidate {application.name} has been selected. You can now generate and send the official offer letter.</p>
                        <button 
                            onClick={handleGenerateOffer}
                            disabled={actionLoading}
                            className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                            {actionLoading ? 'Processing...' : 'Create Offer Letter'}
                        </button>
                    </div>
                );
            default:
                return (
                    <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">
                        Unknown Action Type
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* Action Header */}
            <div className="bg-white border-b border-slate-100 px-6 py-6 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => navigate(-1)}
                            className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all border border-slate-100"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                    actionType === 'offer' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                                }`}>Hiring Portal</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{actionType} Stage</span>
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                {application.name} <span className="text-slate-300 mx-2 font-normal">|</span> <span className="text-slate-400 text-lg">{application.requirementId?.jobTitle || 'N/A'}</span>
                            </h1>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Status</p>
                            <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">{application.status || 'Applied'}</p>
                        </div>
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                             <Clock className="text-slate-300" size={20} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8">
                        {renderActionContent()}
                    </div>
                    <div className="lg:col-span-4 space-y-8">
                         {/* Quick Info */}
                         <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-2xl rounded-full -mr-10 -mt-10"></div>
                             <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-6">Pipeline Position</h4>
                             
                             <div className="space-y-6">
                                 {['Applied', 'Shortlisted', 'Interview', 'Selected', 'Hired'].map((s, i) => {
                                     const isCurrent = (application.status || 'Applied').toLowerCase().includes(s.toLowerCase());
                                     return (
                                         <div key={s} className={`flex items-center gap-4 ${isCurrent ? 'opacity-100' : 'opacity-40'}`}>
                                             <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                                                 isCurrent ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-white/20 text-white/40'
                                             }`}>
                                                 {i + 1}
                                             </div>
                                             <span className={`text-xs font-bold uppercase tracking-widest ${isCurrent ? 'text-white' : 'text-white/40'}`}>
                                                 {s}
                                             </span>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
