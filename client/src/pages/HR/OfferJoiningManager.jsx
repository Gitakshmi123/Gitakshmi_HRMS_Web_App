import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import dayjs from 'dayjs';
import { 
    FileText, User, Mail, Calendar, 
    Download, Eye, CheckCircle2, Clock, 
    ChevronRight, Search, Filter, RefreshCw,
    Check, X, AlertCircle, Trash2, Send
} from 'lucide-react';
import { Modal, Button, Tooltip, Tag, Empty } from 'antd';
import { notification } from '../../utils/antdGlobal';

export default function OfferJoiningManager() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    
    const [loading, setLoading] = useState(true);
    const [applicants, setApplicants] = useState([]);
    const [searchQuery, setSearchQuery] = useState(queryParams.get('search') || '');
    const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'Offer Pending'); // Offer Pending, Offer Issued, Offer Accepted, Signing, Ready to Join, Joined
    const [selectedReqId, setSelectedReqId] = useState(queryParams.get('reqId') || 'all');
    const [requirements, setRequirements] = useState([]);

    // Tabs for Offer & Joining Workflow
    const tabs = [
        { id: 'Offer Pending', label: 'Offer Pending', icon: <Clock size={16} /> },
        { id: 'Offer Issued', label: 'Offer Issued', icon: <Send size={16} /> },
        { id: 'Offer Accepted', label: 'Offer Accepted', icon: <CheckCircle2 size={16} /> },
        { id: 'Joining Issued', label: 'Joining Issued', icon: <FileText size={16} /> },
        { id: 'Joined', label: 'Joined', icon: <User size={16} /> }
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [appsRes, reqRes] = await Promise.all([
                api.get('/hr/applicants'),
                api.get('/requirements')
            ]);
            
            if (appsRes.data.success) {
                // Filter for candidates who have reached terminal hiring stages or started onboarding
                const onboardingStatuses = [
                    'Selected', 'Salary Assigned', 'Offer Generated', 'Offer Issued', 
                    'Offer Accepted', 'Offer Rejected', 'Offer Expired',
                    'Joining Letter Issued', 'Ready to Join', 'Hired', 'Joined',
                    'Fully Signed', 'Offer Accepted – Awaiting Company Approval'
                ];
                
                const filteredApps = appsRes.data.data.filter(a => 
                    onboardingStatuses.includes(a.status) || 
                    a.onboardingInstanceId ||
                    a.offerLetterStatus || 
                    a.joiningLetterStatus
                );
                
                setApplicants(filteredApps);
            }
            
            if (reqRes.data.success) {
                setRequirements(reqRes.data.data);
            }
        } catch (error) {
            console.error("Fetch data error:", error);
            notification.error({ message: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    const getAppStatusCategory = (app) => {
        const s = app.status;
        const offerStatus = String(app.offerLetterStatus || '').toUpperCase();
        const joiningStatus = String(app.joiningLetterStatus || '').toUpperCase();

        if (s === 'Joined' || s === 'Hired') return 'Joined';
        if (s === 'Joining Letter Issued' || joiningStatus === 'SENT' || joiningStatus === 'ACCEPTED' || joiningStatus === 'SIGNED') return 'Joining Issued';
        if (s === 'Offer Accepted' || offerStatus === 'ACCEPTED' || offerStatus === 'SIGNED') return 'Offer Accepted';
        if (s === 'Offer Issued' || offerStatus === 'SENT') return 'Offer Issued';
        return 'Offer Pending';
    };

    const filteredData = useMemo(() => {
        let data = applicants.filter(a => getAppStatusCategory(a) === activeTab);

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(a => 
                a.name.toLowerCase().includes(q) || 
                a.email.toLowerCase().includes(q) ||
                (a.requirementId?.jobTitle || '').toLowerCase().includes(q)
            );
        }

        if (selectedReqId !== 'all') {
            data = data.filter(a => String(a.requirementId?._id || a.requirementId) === selectedReqId);
        }

        return data;
    }, [applicants, activeTab, searchQuery, selectedReqId]);

    const stats = useMemo(() => {
        const counts = {
            'Offer Pending': 0,
            'Offer Issued': 0,
            'Offer Accepted': 0,
            'Joining Issued': 0,
            'Joined': 0
        };
        applicants.forEach(a => {
            const cat = getAppStatusCategory(a);
            if (counts[cat] !== undefined) counts[cat]++;
        });
        return counts;
    }, [applicants]);

    const handleAction = (app, action) => {
        // Navigate back to applicants with specific flags to open modals
        // or implement dedicated modals here if needed.
        // For now, let's navigate to applicants with deep link
        const baseUrl = `/hr/job/${app.requirementId?._id || 'all'}/candidates`;
        navigate(`${baseUrl}?id=${app._id}&action=${action}`);
    };

    return (
        <div className="min-h-screen bg-white p-3">
            {/* Header section removed per user request */}

            {/* Unified Control Bar: Tabs (Left) & Search/Filter (Right) */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-10 px-2">
                {/* Tabs (Left) */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const count = stats[tab.id] || 0;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-300 text-xs ${
                                    isActive 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {tab.icon && React.cloneElement(tab.icon, { size: 14 })}
                                <span>{tab.label}</span>
                                {count > 0 && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-4">
                    {/* Vertical Divider for desktop */}
                    <div className="hidden lg:block w-px h-6 bg-slate-200 mx-2" />

                    {/* Filter */}
                    <div className="relative w-full lg:w-[160px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <select 
                            value={selectedReqId}
                            onChange={(e) => setSelectedReqId(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-2 pl-8 pr-8 appearance-none outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-bold text-slate-700 text-xs cursor-pointer"
                        >
                            <option value="all">All Jobs</option>
                            {requirements.map(req => (
                                <option key={req._id} value={req._id}>{req.jobTitle}</option>
                            ))}
                        </select>
                        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 rotate-90" size={12} />
                    </div>

                    {/* Search */}
                    <div className="relative w-full lg:w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-2 pl-8 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-slate-600 text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Offer Data...</p>
                </div>
            ) : filteredData.length === 0 ? (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm py-24 flex flex-col items-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                        <User className="text-slate-200" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Candidates Found</h3>
                    <p className="text-slate-400 font-medium">No candidates currently matching the <b>{activeTab}</b> status.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredData.map((app) => (
                        <div 
                            key={app._id}
                            className="group bg-white rounded-[2.5rem] border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-600/5 transition-all duration-500 overflow-hidden"
                        >
                            <div className="p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-slate-900/10 transition-transform group-hover:scale-110 duration-500">
                                            {(app.name || 'CN').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-slate-900 text-lg leading-tight m-0">{app.name}</h4>
                                                {app.jobCategory === 'Intern' ? (
                                                    <Tag color="purple" className="rounded-full px-2 text-[8px] font-black uppercase m-0 border-none bg-purple-50 text-purple-600">Intern</Tag>
                                                ) : (
                                                    <Tag color="blue" className="rounded-full px-2 text-[8px] font-black uppercase m-0 border-none bg-blue-50 text-blue-600">Full Time</Tag>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {app.requirementId?.jobTitle || 'General'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Tooltip title="View Profile">
                                        <button 
                                            onClick={() => handleAction(app, 'view')}
                                            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </Tooltip>
                                </div>

                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <Mail size={16} className="text-slate-300" />
                                        <span className="text-sm font-medium truncate">{app.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <Calendar size={16} className="text-slate-300" />
                                        <span className="text-sm font-medium">Applied {dayjs(app.createdAt).format('MMM D, YYYY')}</span>
                                    </div>
                                </div>

                                {/* Status Progress Tracker */}
                                <div className="bg-slate-50 rounded-2xl p-5 mb-8 border border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Onboarding Health</span>
                                        <span className="text-xs font-bold text-indigo-600">{app.status}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4].map((step) => {
                                            const status = getAppStatusCategory(app);
                                            const stepOrder = ['Offer Pending', 'Offer Issued', 'Offer Accepted', 'Joining Issued', 'Joined'];
                                            const currentIdx = stepOrder.indexOf(status);
                                            const isDone = currentIdx >= step;
                                            return (
                                                <div 
                                                    key={step} 
                                                    className={`h-1.5 flex-1 rounded-full transition-all duration-1000 ${isDone ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                                ></div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    {activeTab === 'Offer Pending' && (
                                        <>
                                            <button 
                                                onClick={() => handleAction(app, 'schedule-salary')}
                                                className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                                            >
                                                Assign Salary
                                            </button>
                                            <button 
                                                onClick={() => handleAction(app, 'generate-offer')}
                                                className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/10 px-2"
                                            >
                                                Create Offer
                                            </button>
                                        </>
                                    )}
                                    {activeTab === 'Offer Issued' && (
                                        <>
                                            <button 
                                                onClick={() => handleAction(app, 'view-offer')}
                                                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                                            >
                                                View Offer
                                            </button>
                                            <button 
                                                onClick={() => handleAction(app, 'mark-accepted')}
                                                className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10 px-2"
                                            >
                                                Accept Offer
                                            </button>
                                        </>
                                    )}
                                    {activeTab === 'Offer Accepted' && (
                                        <button 
                                            onClick={() => handleAction(app, 'issue-joining')}
                                            className="col-span-2 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                        >
                                            <FileText size={18} /> Issue Joining Letter
                                        </button>
                                    )}
                                    {activeTab === 'Joining Issued' && (
                                        <>
                                            <button 
                                                onClick={() => handleAction(app, 'download-joining')}
                                                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Download size={14} /> Download
                                            </button>
                                            <button 
                                                onClick={() => handleAction(app, 'mark-joined')}
                                                className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10"
                                            >
                                                Mark Joined
                                            </button>
                                        </>
                                    )}
                                    {activeTab === 'Joined' && (
                                        <button 
                                            onClick={() => navigate(`/hr/employees/${app.employeeId?._id || app.employeeId || ''}/profile`)}
                                            className="col-span-2 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2"
                                        >
                                            <User size={18} /> View Employee Profile
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
