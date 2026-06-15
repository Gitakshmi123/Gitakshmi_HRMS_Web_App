import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_ROOT } from '../../../utils/api';
import {
    FileText, Plus, Search, Filter, Mail, Eye, Download,
    CheckCircle, Clock, AlertCircle, FilePlus, ChevronRight, X,
    Trash2, RotateCcw, History, Settings
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import { showToast } from '../../../utils/uiNotifications';
import DocumentManagementPanel from '../../../components/DocumentManagementPanel';



export default function LetterDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalIssued: 0,
        pendingApprovals: 0,
        viewed: 0,
        sent: 0
    });
    const [recentLetters, setRecentLetters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLetterId, setSelectedLetterId] = useState(null);
    const [selectedLetter, setSelectedLetter] = useState(null);
    const userRole = localStorage.getItem('userRole') || 'employee';

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/letters/generated-letters');
            const letters = res.data.data;
            setRecentLetters(letters);

            // Calculate stats
            setStats({
                totalIssued: letters.length,
                pendingApprovals: letters.filter(l => l.status === 'pending').length,
                viewed: letters.filter(l => l.status === 'viewed').length,
                sent: letters.filter(l => l.status === 'sent').length
            });
        } catch (error) {
            console.error('Failed to fetch letters', error);
            showToast('error', 'Error', 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleLetterUpdated = (updatedLetter) => {
        if (!updatedLetter?._id) {
            fetchDashboardData();
            return;
        }
        setRecentLetters(recentLetters.map(l => l._id === updatedLetter._id ? updatedLetter : l));
        setSelectedLetter(updatedLetter);
        showToast('success', 'Success', 'Letter updated successfully');
    };

    const handleOpenManagement = (letter) => {
        setSelectedLetter(letter);
        setSelectedLetterId(letter._id);
    };

    const handleCloseManagement = () => {
        setSelectedLetterId(null);
        setSelectedLetter(null);
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            case 'sent': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'viewed': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const resolveLetterPdfUrl = (letter) => {
        if (!letter) return null;
        
        // If the backend already provided a pdfUrl (we updated the controller to do this)
        if (letter.pdfUrl) {
            if (/^https?:\/\//i.test(letter.pdfUrl)) return letter.pdfUrl;
            return `${API_ROOT}${letter.pdfUrl.startsWith('/') ? '' : '/'}${letter.pdfUrl}`;
        }

        // Fallback or explicit construction using ID-based route (SAFEST)
        const tenantId = localStorage.getItem('tenantId') || localStorage.getItem('companyId');
        return `${API_ROOT}/api/public/letters/${letter._id}/view-pdf?tenantId=${tenantId}&ts=${Date.now()}`;
    };

    const handleDownloadLetter = (letter) => {
        const baseUrl = resolveLetterPdfUrl(letter);
        if (!baseUrl) {
            showToast('error', 'Error', 'Letter URL not available');
            return;
        }

        // Add download flag if using the public view route
        const url = baseUrl.includes('?') ? `${baseUrl}&download=true` : `${baseUrl}?download=true`;
        if (!url) {
            showToast('error', 'Error', 'Letter URL not available');
            return;
        }

        const fileName = `${letter?.letterType || 'letter'}_${letter?._id || Date.now()}.pdf`;
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 space-y-6 w-full animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-medium text-slate-900 tracking-tight flex items-center gap-3">
                        Document Management
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                    <div className="relative w-full md:w-[320px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-[13px] font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => navigate('/hr/letter-templates')}
                        className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm"
                    >
                        <Settings size={16} /> Manage Templates
                    </button>
                    <button
                        onClick={() => navigate('/hr/letters/issue')}
                        className="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#0D9488] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                        <Plus size={18} /> Issue New Letter
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Issued', value: stats.totalIssued, icon: FileText, color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600' },
                    { label: 'Pending Approval', value: stats.pendingApprovals, icon: Clock, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600' },
                    { label: 'Sent to Recipients', value: stats.sent, icon: Mail, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                    { label: 'Viewed by Recipient', value: stats.viewed, icon: Eye, color: 'purple', bg: 'bg-purple-50', text: 'text-purple-600' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-2.5 rounded-2xl border border-slate-200/60 hover:border-indigo-200 transition-all shadow-sm hover:shadow-xl group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2.5 opacity-[0.03] group-hover:scale-110 transition-transform">
                            <stat.icon size={50} />
                        </div>
                        <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.text} flex items-center justify-center mb-1.5 group-hover:scale-110 transition-all border border-transparent group-hover:border-current/10 shadow-sm`}>
                            <stat.icon size={16} />
                        </div>
                        <div className="text-xl font-medium text-slate-900 mb-0 tracking-tight">{stat.value}</div>
                        <div className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.2em]">{stat.label}</div>
                    </div>
                ))}
            </div>


                <div className="w-full bg-white rounded-2xl p-0">
                    {/* Headers */}
                    <div className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1.2fr_0.8fr] items-center px-10 py-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Recipient identification</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Blueprint identifier</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Timeline sync</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Workflow status</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right">Registry</span>
                    </div>

                    <div className="space-y-2">
                        {loading && recentLetters.length === 0 ? (
                            <div className="p-20 text-center bg-white rounded-2xl border border-slate-100">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing communications...</span>
                                </div>
                            </div>
                        ) : recentLetters.length === 0 ? (
                            <div className="p-20 text-center bg-white rounded-2xl border border-slate-100 flex flex-col items-center gap-4">
                                <div className="p-6 bg-white rounded-3xl">
                                    <FilePlus className="text-slate-200" size={60} />
                                </div>
                                <div className="font-bold text-slate-400 uppercase tracking-widest text-sm">No operational records</div>
                                <p className="text-slate-400 text-xs italic">Initiate a NEW LETTER to begin tracking document lifecycle</p>
                            </div>
                        ) : (
                            recentLetters.filter(l =>
                                (l.employeeId?.firstName + ' ' + l.employeeId?.lastName + ' ' + l.employeeId?.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                l.templateId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map((letter, idx) => (
                                <div key={letter._id} className="group grid grid-cols-[1.5fr_1.5fr_1.2fr_1.2fr_0.8fr] items-center p-2 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xs ring-4 ring-slate-50 shadow-sm ${idx % 3 === 0 ? 'bg-gradient-to-br from-indigo-400 to-indigo-600' :
                                            idx % 3 === 1 ? 'bg-gradient-to-br from-violet-400 to-violet-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                                            }`}>
                                            {letter.employeeId ? letter.employeeId.firstName?.[0] : (letter.applicantId?.name?.[0] || 'U')}
                                        </div>
                                        <div className="min-w-0 pr-4">
                                            <div className="font-semibold text-slate-800 text-[14px] tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                                                {letter.employeeId ? `${letter.employeeId.firstName} ${letter.employeeId.lastName}` : letter.applicantId?.name}
                                            </div>
                                            <div className="text-[10px] text-[#4F46E5] font-bold uppercase tracking-[0.1em] mt-0.5 opacity-70">
                                                ID: {letter.employeeId?.employeeId || 'ATTACHED_ASSET'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors"></div>
                                        <div className="min-w-0 pr-4">
                                            <div className="font-semibold text-slate-600 text-xs uppercase tracking-tight truncate">
                                                {letter.templateId?.name || letter.letterType}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-0.5">Blueprint Layer</div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[11px] font-semibold text-slate-700">{formatDateDDMMYYYY(letter.createdAt)}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">Synchronized At</div>
                                    </div>

                                    <div>
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all border ${getStatusStyle(letter.status)}`}>
                                            <div className="w-1 h-1 rounded-full bg-current"></div>
                                            {letter.status}
                                        </span>
                                    </div>

                                    <div className="flex justify-end gap-2 pr-2">
                                        <button
                                            onClick={() => {
                                                const url = resolveLetterPdfUrl(letter);
                                                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                                else showToast('error', 'Error', 'Letter URL not available');
                                            }}
                                            className="w-8 h-8 rounded-xl bg-white text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-indigo-100 flex items-center justify-center"
                                            title="View Layer"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadLetter(letter)}
                                            className="w-8 h-8 rounded-xl bg-white text-slate-400 hover:text-emerald-600 hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-emerald-100 flex items-center justify-center"
                                            title="Download Snapshot"
                                        >
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            {/* Approval Workflow Teaser (If pending letters exist) */}
            {
                stats.pendingApprovals > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
                                <Clock size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-amber-900 dark:text-amber-400 uppercase tracking-tighter">Approval Required</h3>
                                <p className="font-bold text-amber-700 dark:text-amber-500 text-[11px]">You have {stats.pendingApprovals} letters waiting for your review.</p>
                            </div>
                        </div>
                        <button className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-amber-500/20">
                            View Pending Tasks
                        </button>
                    </div>
                )
            }

            {/* Document Management Modal/Panel */}
            {
                selectedLetterId && selectedLetter && (
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-start justify-end overflow-y-auto pt-4">
                        {/* Close on background click */}
                        <div
                            className="absolute inset-0 cursor-pointer"
                            onClick={handleCloseManagement}
                        />

                        {/* Side Panel */}
                        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-l-2xl shadow-2xl ml-4 mr-0 my-4 overflow-y-auto max-h-[calc(100vh-2rem)]">
                            {/* Close Button */}
                            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex justify-between items-center z-10">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                    Letter Management
                                </h2>
                                <button
                                    onClick={handleCloseManagement}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                >
                                    <X size={24} className="text-slate-600 dark:text-slate-400" />
                                </button>
                            </div>

                            {/* Document Management Panel */}
                            <div className="p-6">
                                <DocumentManagementPanel
                                    letter={selectedLetter}
                                    userRole={userRole}
                                    onLetterUpdated={handleLetterUpdated}
                                    showAuditTrail={true}
                                />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
