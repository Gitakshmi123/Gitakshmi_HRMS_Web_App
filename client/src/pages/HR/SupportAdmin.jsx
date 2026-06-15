import React, { useState, useEffect } from 'react';
import { 
    Search, Filter, ChevronRight, User, 
    Calendar, Clock, CheckCircle, XCircle, 
    RefreshCw, MoreVertical, ArrowUpRight, Send, X,
    LayoutDashboard, Inbox, Zap, CheckSquare,
    ChevronDown, Trash2, ArrowLeft, Paperclip,
    ArrowRight, Image as ImageIcon, FileText, Video as VideoIcon, File,
    Download, Play, Building2
} from 'lucide-react';
import api, { API_ROOT } from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import usePagePermissions from '../../hooks/usePagePermissions';

export default function SupportAdmin() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const { canEdit, canCreate, canDelete } = usePagePermissions('support.tickets');
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const fileInputRef = React.useRef(null);
    const menuRef = React.useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getFileIcon = (type, name) => {
        if (type?.includes('image')) return <ImageIcon size={14} />;
        if (type?.includes('video')) return <VideoIcon size={14} />;
        if (type?.includes('pdf')) return <FileText size={14} className="text-rose-500" />;
        if (name?.endsWith('.doc') || name?.endsWith('.docx')) return <FileText size={14} className="text-blue-500" />;
        return <File size={14} />;
    };

    const renderAttachment = (att, isMe) => {
        if (!att) return null;
        const fileUrl = att.fileUrl?.startsWith('http') ? att.fileUrl : `${API_ROOT}${att.fileUrl}`;
        
        if (att.fileType?.startsWith('image/')) {
            return (
                <div className="mt-2 group/media relative">
                    <img 
                        src={fileUrl} 
                        alt="attachment" 
                        className="max-w-[180px] h-auto rounded-xl shadow-sm hover:brightness-90 transition-all cursor-pointer border border-slate-100"
                        onClick={() => window.open(fileUrl, '_blank')}
                    />
                </div>
            );
        }

        if (att.fileType?.startsWith('video/')) {
            return (
                <div className="mt-2 max-w-[180px]">
                    <video 
                        src={fileUrl} 
                        controls 
                        className="w-full rounded-xl shadow-sm border border-slate-100"
                    />
                </div>
            );
        }

        return (
            <div className={clsx(
                "mt-2 flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer group/att",
                isMe ? "bg-white/10 border-white/20 text-white" : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => window.open(fileUrl, '_blank')}>
                <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isMe ? "bg-white/20" : "bg-white border border-slate-100")}>
                    <FileText size={14} className={isMe ? "text-white" : "text-blue-600"} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold truncate leading-tight uppercase">{att.fileName}</p>
                    <p className={clsx("text-[8px] font-medium opacity-60", isMe ? "text-white" : "text-slate-400")}>
                        {att.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                    </p>
                </div>
                <Download size={12} className="opacity-40 group-hover/att:opacity-100" />
            </div>
        );
    };

    // Filters from Screenshot
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [dateFilter, setDateFilter] = useState('ALL TIME');
    const [personFilter, setPersonFilter] = useState('ALL EMPLOYEES');

    useEffect(() => {
        fetchAllTickets();
    }, []);

    const fetchAllTickets = async () => {
        try {
            setLoading(true);
            const res = await api.get('/tickets/admin/all');
            const data = Array.isArray(res.data) ? res.data : [];
            setTickets(data);
            
            if (selectedTicket) {
                const updated = data.find(t => t._id === selectedTicket._id);
                if (updated) setSelectedTicket(updated);
            }
        } catch (error) {
            console.error("Admin: Failed to load tickets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.patch(`/tickets/${id}/status`, { status, remark: `Ticket moved to ${status}` });
            showToast('success', 'Inbox Updated', `Ticket status synchronized as ${status}`);
            fetchAllTickets();
        } catch (error) {
            showToast('error', 'Update Failed', 'Server rejected the status change');
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() && !selectedFile) return;
        try {
            setPostingComment(true);
            const formData = new FormData();
            formData.append('text', newComment);
            formData.append('senderName', currentUser?.name || 'HR Admin');
            if (selectedFile) {
                formData.append('attachment', selectedFile);
            }

            const res = await api.post(`/tickets/${selectedTicket._id}/comments`, formData);
            
            setNewComment('');
            setSelectedFile(null);
            
            // Sync current view with new data immediately
            if (res.data.success && res.data.ticket) {
                setSelectedTicket(res.data.ticket);
            }
            fetchAllTickets(); 
        } catch (error) {
            showToast('error', 'Chat Error', 'Could not send the message');
        } finally {
            setPostingComment(false);
        }
    };

    const stats = {
        total: tickets.length,
        unread: tickets.filter(t => t.status === 'UNREAD').length,
        inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
        resolved: tickets.filter(t => t.status === 'DONE').length
    };

    const filteredTickets = tickets.filter(t => {
        // Status filter
        const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
        
        // Category filter
        const matchesCat = categoryFilter === 'ALL' || (t.category && t.category.toUpperCase() === categoryFilter);
        
        // Person filter: 'ALL EMPLOYEES' vs 'MY TICKETS' (assigned to current user)
        const matchesPerson = personFilter === 'ALL EMPLOYEES' || 
                             (t.assignedTo && (t.assignedTo._id === currentUser?.id || t.assignedTo === currentUser?.id));
        
        // Search filter (Title or Employee Name)
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = t.title ? t.title.toLowerCase().includes(searchLower) : false;
        
        let nameMatch = false;
        if (t.employee) {
            const firstName = t.employee.firstName || '';
            const lastName = t.employee.lastName || '';
            nameMatch = `${firstName} ${lastName}`.toLowerCase().includes(searchLower);
        } else if (searchLower === '') {
            nameMatch = true;
        }

        return matchesStatus && matchesCat && matchesPerson && (titleMatch || nameMatch);
    });

    const getPriorityColor = (p) => {
        switch(p) {
            case 'URGENT': return 'bg-rose-100/80 text-rose-700 border-rose-200';
            case 'HIGH': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'MEDIUM': return 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2]';
            case 'LOW': return 'bg-[#F3E5F5] text-[#4A148C] border-[#E1BEE7]';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    if (loading) return (
        <div className="p-8 animate-pulse space-y-10">
            <div className="grid grid-cols-4 gap-6">
                {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-3xl"></div>)}
            </div>
            <div className="h-48 bg-white border border-slate-100 rounded-[2.5rem]"></div>
        </div>
    );

    return (
        <div className="p-2.5 h-[calc(100vh-65px)] flex flex-col font-inter w-full animate-in fade-in duration-500 overflow-hidden relative">
            
            {!selectedTicket ? (
                <>

                    {/* 1. Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                        {[
                            { label: 'TOTAL', val: stats.total, color: 'text-slate-900', icon: <Inbox className="text-blue-600" size={24} />, bg: 'bg-blue-50' },
                            { label: 'UNREAD', val: stats.unread, color: 'text-slate-900', icon: <Clock className="text-rose-500" size={24} />, bg: 'bg-rose-50' },
                            { label: 'IN PROGRESS', val: stats.inProgress, color: 'text-slate-900', icon: <RefreshCw className="text-amber-500" size={24} />, bg: 'bg-amber-50' },
                            { label: 'RESOLVED', val: stats.resolved, color: 'text-slate-900', icon: <CheckSquare className="text-emerald-500" size={24} />, bg: 'bg-emerald-50' },
                        ].map((s, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all cursor-default">
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-semibold text-slate-900 uppercase tracking-widest">{s.label}</p>
                                    <h2 className={`text-2xl font-bold tracking-tighter ${s.color}`}>{s.val}</h2>
                                </div>
                                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-500`}>
                                    {s.icon}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4 flex-1 min-h-0 mt-[5px]">

                    {/* 2. Unified Control Bar */}
                    <div className="flex flex-col xl:flex-row items-center justify-between gap-4 w-full">
                        <div className="flex items-center gap-3 flex-1 w-full xl:w-auto">
                            <button 
                                onClick={fetchAllTickets}
                                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm group active:scale-95"
                                title="Refresh Tickets"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-600' : 'group-hover:rotate-180 transition-transform duration-500'} />
                            </button>
                            {/* Search Bar First */}
                            <div className="relative flex-1 xl:w-80">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Quick search tickets..." 
                                    className="w-full h-12 pl-12 pr-10 bg-white border border-slate-200 rounded-2xl text-[12px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all placeholder:text-slate-300 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Status Filters */}
                            <div className="flex items-center gap-1.5 p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                                {['ALL', 'UNREAD', 'OPEN', 'IN_PROGRESS', 'DONE'].map(st => (
                                    <button
                                        key={st}
                                        onClick={() => setFilterStatus(st)}
                                        className={clsx(
                                            "px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all relative shrink-0",
                                            filterStatus === st ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-900 hover:text-slate-600"
                                        )}
                                    >
                                        {st}
                                        {st === 'UNREAD' && stats.unread > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center border-2 border-white animate-pulse">
                                                {stats.unread}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                            {[
                                { val: categoryFilter, set: setCategoryFilter, options: ['ALL', 'GENERAL', 'PAYROLL', 'LEAVE', 'IT'] },
                                { val: dateFilter, set: setDateFilter, options: ['ALL TIME', 'TODAY', 'WEEKLY'] },
                                { val: personFilter, set: setPersonFilter, options: ['ALL EMPLOYEES', 'MY TICKETS'] },
                            ].map((f, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 px-4 h-12 rounded-2xl group cursor-pointer transition-all shadow-sm">
                                    <select 
                                        onChange={(e) => f.set(e.target.value)}
                                        value={f.val}
                                        className="bg-transparent text-[10px] font-semibold uppercase text-slate-900 outline-none cursor-pointer appearance-none pr-6 relative"
                                    >
                                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="text-slate-300 -ml-5 pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. High-Density Ticket Card Grid */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {(filteredTickets || []).map((t, idx) => (
                            <div key={t._id?.toString() || idx} onClick={() => setSelectedTicket(t)} className="group relative bg-white p-2 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col w-[150px] h-[100px] shrink-0">
                                
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className={clsx("px-1 py-0.5 rounded-md text-[5px] font-semibold uppercase tracking-widest shadow-sm border", getPriorityColor(t.priority))}>
                                        {t.priority}
                                    </span>
                                    <div className="flex items-center gap-1 text-[6px] font-bold text-slate-400 uppercase tracking-widest">
                                        {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        {t.status === 'UNREAD' && <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse"></div>}
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-w-0 mb-0.5">
                                    <h3 className="text-[10px] font-black text-slate-800 leading-tight mb-0.5 group-hover:text-indigo-600 transition-colors uppercase tracking-tight line-clamp-1">{t.title}</h3>
                                    <p className="text-[8px] font-medium text-slate-400 line-clamp-1 leading-tight opacity-60 italic">{t.description}</p>
                                </div>
                                
                                <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                                    <div className="flex items-center gap-1">
                                        <div className="w-5 h-5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                            {t.employee?.firstName?.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-black text-slate-800 uppercase tracking-tight leading-none truncate">{t.employee?.firstName} {t.employee?.lastName?.charAt(0)}.</p>
                                            <div className="px-1 py-0.5 rounded text-[4px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50/50 text-slate-400 mt-0.5 inline-block">{t.status}</div>
                                        </div>
                                    </div>
                                    <div className="w-5 h-5 rounded-lg bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                        <ChevronRight size={8} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </>
            ) : (
                /* Ticket Detail View - Matching New Screenshot */
                <div className="animate-in slide-in-from-right-10 duration-500 flex flex-col h-full overflow-hidden">
                    {/* Header Action Bar */}
                    <div className="flex items-center justify-between mb-1 pb-2 border-b border-slate-200/60 shrink-0">
                         <div className="flex items-center gap-6">
                            <button 
                                onClick={() => setSelectedTicket(null)}
                                className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <button 
                                onClick={fetchAllTickets}
                                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm group active:scale-95"
                                title="Refresh Tickets"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-600' : 'group-hover:rotate-180 transition-transform duration-500'} />
                            </button>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">REQ #{String(selectedTicket._id || '').slice(-6).toUpperCase()}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">OTHER</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{selectedTicket.employee?.firstName} {selectedTicket.employee?.lastName}</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            {canEdit && (
                                <div className="relative">
                                    <select className="h-12 px-6 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase outline-none pr-10 appearance-none shadow-sm min-w-[180px]">
                                        <option>MANUAL ASSIGN</option>
                                        <option>SURAJ JOSHI</option>
                                        <option>ANIKET SHAH</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                </div>
                            )}
                            <span className="px-5 h-12 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-black uppercase border border-rose-100 shadow-sm">
                                {selectedTicket.status}
                            </span>
                            {canEdit && (
                                <>
                                    <button 
                                        onClick={() => handleUpdateStatus(selectedTicket._id, 'DONE')}
                                        className="h-12 px-8 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2"
                                    >
                                        <CheckCircle size={14} /> RESOLVE
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateStatus(selectedTicket._id, 'REJECTED')}
                                        className="h-12 px-8 bg-white text-rose-500 border border-rose-100 rounded-2xl text-[10px] font-black uppercase hover:bg-rose-50 transition-all flex items-center gap-2"
                                    >
                                        <XCircle size={14} /> REJECT
                                    </button>
                                </>
                            )}
                         </div>
                    </div>

                    {/* Three Column View */}
                    <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                        
                        {/* Column 1: Description */}
                        <div className="col-span-12 lg:col-span-3 space-y-6">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Description</h4>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                        <User className="text-slate-300" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tight">{selectedTicket.employee?.firstName} {selectedTicket.employee?.lastName}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5">EMP#{String(selectedTicket.employee?._id || '').slice(-5).toUpperCase() || 'XXXX'}</p>
                                        {selectedTicket.tenant && (
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 opacity-80">
                                                <Building2 size={10} />
                                                {selectedTicket.tenant.companyName} ({selectedTicket.tenant.code})
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="p-1 min-h-[60px]">
                                    <p className="text-[14px] font-bold text-slate-500 leading-relaxed font-inter">{selectedTicket.description}</p>
                                </div>

                            {/* AI Context Analysis Card */}
                            <div className="bg-indigo-600 rounded-3xl p-5 text-white relative overflow-hidden group shadow-2xl shadow-indigo-600/20">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10"></div>
                                <div className="flex items-center gap-3 mb-4">
                                    <Zap size={18} className="text-white animate-pulse" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-100">AI Context Analysis</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-[10px] font-black">
                                         <span className="text-indigo-200 uppercase tracking-widest">Unit</span>
                                         <span className="px-3 py-1 bg-white/20 rounded-lg uppercase">{selectedTicket.category || 'OTHER'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black">
                                         <span className="text-indigo-200 uppercase tracking-widest">Rank</span>
                                         <span className="px-3 py-1 bg-white/20 rounded-lg uppercase">{selectedTicket.priority || 'LOW'}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-indigo-100 italic leading-relaxed pt-2 opacity-80 border-t border-white/10">
                                        "The message is a simple test entry with no specific issue or request reported."
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-12 lg:col-span-6 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden h-full">
                            <div className="p-3 border-b border-slate-50 text-center bg-white">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transmission</h4>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar bg-white">
                                <div className="flex items-center justify-center gap-3 py-2">
                                     <div className="h-[1px] bg-slate-100 flex-1"></div>
                                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Conversation History</span>
                                     <div className="h-[1px] bg-slate-100 flex-1"></div>
                                </div>

                                {(selectedTicket.comments || []).map((comm, idx) => {
                                    const isMe = comm.senderRole !== 'employee';
                                    return (
                                        <div key={idx} className={clsx("flex items-start gap-3", isMe ? "flex-row-reverse" : "")}>
                                            <div className="flex flex-col items-center">
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shadow-sm",
                                                    isMe ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-400"
                                                )}>
                                                    {comm.sender?.charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            <div className={clsx(
                                                "p-3 rounded-[1.2rem] shadow-sm max-w-[85%] relative animate-in slide-in-from-bottom-1 duration-300",
                                                isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                                            )}>
                                                <div className="whitespace-pre-wrap">{comm.text && <p className="text-[12px] font-medium leading-relaxed">{comm.text}</p>}</div>
                                                {comm.attachments?.map((att, i) => (
                                                    <div key={i}>
                                                        {renderAttachment(att, isMe)}
                                                    </div>
                                                ))}
                                                <div className={clsx("text-[8px] mt-2 font-bold flex items-center gap-1.5", isMe ? "text-blue-100" : "text-slate-400")}>
                                                    {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isMe && <CheckCircle size={10} className="text-blue-200" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Reply Footer */}
                            <div className="p-4 border-t border-slate-100 bg-white">
                                 {canCreate || canEdit ? (
                                     <div className="flex flex-col flex-1 gap-2">
                                        {selectedFile && (
                                            <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-slate-100 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Paperclip size={12} className="text-blue-600" />
                                                    <span className="text-[10px] font-black uppercase text-slate-600 truncate max-w-[200px]">{selectedFile.name}</span>
                                                </div>
                                                <button onClick={() => setSelectedFile(null)} className="text-rose-500 hover:text-rose-700">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-1.5 pl-4 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all w-full relative">
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                className="hidden" 
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setSelectedFile(file);
                                                    setShowAttachmentMenu(false);
                                                }}
                                            />
                                            <div className="relative" ref={menuRef}>
                                                <Paperclip 
                                                    size={18} 
                                                    className={clsx("cursor-pointer transition-colors", showAttachmentMenu ? "text-blue-600" : "text-[#94A3B8] hover:text-[#2563EB]")}
                                                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                                />
                                                
                                                {showAttachmentMenu && (
                                                    <div className="absolute bottom-full left-0 mb-4 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[200px] animate-in slide-in-from-bottom-2 duration-200 z-50">
                                                        <div className="grid grid-cols-1 gap-1">
                                                            {[
                                                                { label: 'Images', icon: <ImageIcon size={14} />, color: 'text-purple-500', bg: 'bg-purple-50', accept: 'image/*' },
                                                                { label: 'Videos', icon: <VideoIcon size={14} />, color: 'text-amber-500', bg: 'bg-amber-50', accept: 'video/*' },
                                                                { label: 'Documents', icon: <FileText size={14} />, color: 'text-blue-500', bg: 'bg-blue-50', accept: '.pdf,.doc,.docx' },
                                                            ].map((opt, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (fileInputRef.current) {
                                                                            fileInputRef.current.accept = opt.accept;
                                                                            fileInputRef.current.click();
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all group"
                                                                >
                                                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", opt.bg, opt.color)}>
                                                                        {opt.icon}
                                                                    </div>
                                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">{opt.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <input 
                                                type="text" 
                                                placeholder={selectedFile ? "Add a caption..." : "Message..."} 
                                                className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold text-slate-700 py-2"
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                            />
                                            <button 
                                                onClick={handlePostComment}
                                                disabled={postingComment || (!newComment.trim() && !selectedFile)}
                                                className={clsx(
                                                    "w-9 h-9 rounded-full text-white flex items-center justify-center transition-all shadow-md disabled:opacity-50",
                                                    (newComment.trim() || selectedFile) ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300"
                                                )}
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                     </div>
                                 ) : (
                                     <div className="p-3 text-center bg-amber-50 rounded-xl border border-amber-100">
                                         <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Read Only Mode</p>
                                     </div>
                                 )}
                            </div>
                        </div>

                        {/* Column 3: Activity Log */}
                        <div className="col-span-12 lg:col-span-3">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Activity Log</h4>
                            <div className="relative pl-8 space-y-6">
                                <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-slate-50"></div>
                                
                                <div className="relative">
                                    <div className="absolute -left-[26px] top-1 w-4 h-4 rounded-full border-2 border-indigo-600 bg-white shadow-sm shadow-indigo-500/20"></div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-slate-900 uppercase">Created</span>
                                            <span className="text-[9px] font-bold text-slate-300 uppercase">{formatDateDDMMYYYY(selectedTicket.createdAt)}, {new Date(selectedTicket.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-400 capitalize">Quick ticket submitted</p>
                                    </div>
                                </div>

                                {selectedTicket.comments?.filter(c => c.text.includes('[STATUS UPDATE]')).map((log, i) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[26px] top-1 w-4 h-4 rounded-full border-2 border-emerald-400 bg-white"></div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-900 uppercase">Updated</span>
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(log.createdAt).toLocaleDateString()}, {new Date(log.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400">{log.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
