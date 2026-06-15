import React, { useState, useEffect } from 'react';
import { 
    Search, Plus, LayoutGrid, ListFilter, 
    Send, Bolt, ChevronRight, X, 
    Ticket as TicketIcon, Clock, CheckCircle, 
    AlertCircle, MessageSquare, Briefcase, Zap,
    RefreshCw, ArrowLeft, User, Calendar, 
    Paperclip, Trash2, ArrowRight, Clock3, 
    CheckCircle2, Target, HelpCircle, FileText,
    Image as ImageIcon, Video as VideoIcon, File,
    Download, Play, ArrowUpRight
} from 'lucide-react';
import api, { API_ROOT } from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';
import { useAuth } from '../../context/AuthContext';
import { useRBAC } from '../../context/RBACContext';
import clsx from 'clsx';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

export default function MyTickets() {
    const { user: currentUser } = useAuth();
    const { hasPermission, loading: permissionLoading } = useRBAC();
    
    // Normalize user role for administrative seniority bypass
    const userRole = (
        currentUser?.roleName || 
        (currentUser?.role && typeof currentUser.role === 'object' ? currentUser.role.name : currentUser?.role) || 
        ''
    ).toLowerCase();

    // Standardized admin roles list
    const ADMIN_ROLES = ['admin', 'hr', 'manager', 'company_super_admin', 'company_admin', 'human_resource', 'hr manager', 'hr_manager', 'hr_admin', 'super_admin', 'psa'];
    const isAdmin = ADMIN_ROLES.includes(userRole);

    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const fileInputRef = React.useRef(null);
    const menuRef = React.useRef(null);

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getFileIcon = (type, name) => {
        if (type?.includes('image')) return <ImageIcon size={14} className="text-emerald-500" />;
        if (type?.includes('video')) return <VideoIcon size={14} className="text-purple-500" />;
        if (type?.includes('pdf')) return <FileText size={14} className="text-rose-500" />;
        if (name?.toLowerCase().endsWith('.doc') || name?.toLowerCase().endsWith('.docx') || type?.includes('word')) return <FileText size={14} className="text-blue-500" />;
        return <File size={14} className="text-slate-400" />;
    };

    const renderAttachment = (att, isMe) => {
        if (!att) return null;
        const isImage = att.fileType?.toLowerCase().includes('image');
        const isVideo = att.fileType?.toLowerCase().includes('video');
        const isDoc = att.fileType?.toLowerCase().includes('pdf') || att.fileName?.toLowerCase().endsWith('.doc') || att.fileName?.toLowerCase().endsWith('.docx') || att.fileType?.toLowerCase().includes('word');
        const fileUrl = att.fileUrl?.startsWith('http') ? att.fileUrl : `${API_ROOT}${att.fileUrl}`;

         if (isImage) {
             return (
                 <div className="mt-2 group relative max-w-[160px]">
                     <div className="rounded-xl overflow-hidden border border-slate-200/50 shadow-sm bg-slate-50">
                         <img 
                             src={fileUrl} 
                             alt={att.fileName} 
                             className="w-full h-auto object-cover cursor-pointer hover:scale-105 transition-transform duration-500 shadow-xl"
                             onClick={() => window.open(fileUrl, '_blank')}
                             onError={(e) => { e.target.src = 'https://placehold.co/400x300?text=Image+Unavailable'; }}
                         />
                     </div>
                 </div>
             );
         }
 
         if (isVideo) {
             return (
                 <div className="mt-2 rounded-xl border border-slate-200/50 bg-black overflow-hidden relative group max-w-[180px] aspect-video flex items-center justify-center">
                    <video className="w-full h-full" preload="metadata">
                        <source src={fileUrl} type={att.fileType} />
                    </video>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all cursor-pointer" onClick={() => window.open(fileUrl, '_blank')}>
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center text-white border border-white/30 shadow-2xl">
                            <Play size={20} fill="currentColor" />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <a 
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                    "flex gap-4 p-4 mt-3 rounded-[1.2rem] border transition-all group/att",
                    isMe 
                        ? "bg-white/20 border-white/30 text-white hover:bg-white/30" 
                        : "bg-white border-slate-100 text-indigo-900 hover:border-indigo-300 shadow-sm"
                )}
            >
                <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover/att:scale-110",
                    isMe ? "bg-white/20" : "bg-indigo-50"
                )}>
                    {getFileIcon(att.fileType, att.fileName)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-[13px] truncate tracking-tight uppercase">{att.fileName}</p>
                    <p className={clsx("text-[9px] opacity-70 mt-0.5 font-black uppercase tracking-widest", isMe ? "text-indigo-100" : "text-slate-400")}>
                        {att.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                    </p>
                </div>
                <Download size={14} className="opacity-50" />
            </a>
        );
    };
    
    // Permission logic with Admin bypass
    const canAccessTickets = isAdmin || hasPermission('employee.tickets', 'any');
    const canViewTickets = isAdmin || hasPermission('employee.tickets', 'view') || hasPermission('employee.tickets', 'any');
    const canCreateTickets = isAdmin || hasPermission('employee.tickets', 'create') || canViewTickets;
    const canEditTickets = isAdmin || hasPermission('employee.tickets', 'edit') || canCreateTickets;

    // Simplified Form State
    const [formData, setFormData] = useState({
        title: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
        description: ''
    });

    useEffect(() => {
        if (permissionLoading || !canViewTickets) {
            setLoading(false);
            setTickets([]);
            return;
        }
        fetchTickets();
    }, [canViewTickets, permissionLoading]);

    const fetchTickets = async () => {
        if (!canViewTickets) return;
        try {
            setLoading(true);
            const res = await api.get('/tickets/my-tickets');
            const data = Array.isArray(res.data) ? res.data : [];
            setTickets(data);
            
            if (selectedTicket) {
                const updated = data.find(t => t._id === selectedTicket._id);
                if (updated) setSelectedTicket(updated);
            }
        } catch (error) {
            console.error("Failed to load tickets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canCreateTickets) return;
        if (!formData.title.trim() || !formData.description.trim()) {
            showToast('warning', 'Missing Details', 'Please provide both title and description');
            return;
        }
        try {
            setSubmitting(true);
            const data = new FormData();
            data.append('title', formData.title);
            data.append('category', formData.category);
            data.append('priority', formData.priority);
            data.append('description', formData.description);
            if (selectedFile) {
                data.append('attachment', selectedFile);
            }

            await api.post('/tickets/create', data);
            showToast('success', 'Ticket Logged', 'Your support request has been initiated');
            setFormData({ title: '', category: 'GENERAL', priority: 'MEDIUM', description: '' });
            setSelectedFile(null);
            setIsCreating(false);
            fetchTickets();
        } catch (error) {
            showToast('error', 'Submission Failed', 'Could not record your request at this time');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePostComment = async () => {
        if (!canEditTickets || !selectedTicket) return;
        if (!newComment.trim() && !selectedFile) return;
        try {
            setPostingComment(true);
            const formData = new FormData();
            formData.append('text', newComment);
            formData.append('senderName', currentUser?.name || 'Employee');
            if (selectedFile) {
                formData.append('attachment', selectedFile);
            }

            const res = await api.post(`/tickets/${selectedTicket._id}/comments`, formData);
            setNewComment('');
            setSelectedFile(null);
            
            // Sync current view with new data immediately
            if (res.data.success && res.data.ticket) {
                // Ensure attachments is present in the updated ticket
                const updatedTicket = res.data.ticket;
                setSelectedTicket(updatedTicket);
                
                // Also update the local tickets list
                setTickets(prev => prev.map(t => t._id === updatedTicket._id ? updatedTicket : t));
            } else {
                fetchTickets(); 
            }
        } catch (error) {
            showToast('error', 'Chat Error', 'Could not send the message');
        } finally {
            setPostingComment(false);
        }
    };

    const stats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status !== 'DONE').length,
        resolved: tickets.filter(t => t.status === 'DONE').length
    };

    const filteredTickets = tickets.filter(t => {
        const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             t.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const getStatusStyle = (status) => {
        const styles = {
            'OPEN': 'text-[#2563EB] bg-blue-50 border-blue-100',
            'IN_PROGRESS': 'text-violet-600 bg-violet-50 border-violet-100',
            'DONE': 'text-[#16A34A] bg-[#ECFDF5] border-[#D1FAE5]',
            'REJECTED': 'text-[#DC2626] bg-[#FEF2F2] border-[#FEE2E2]'
        };
        return styles[status] || styles['OPEN'];
    };

    if (permissionLoading) return null;

    if (!canAccessTickets) {
        return (
            <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
                <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                        <HelpCircle size={28} />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#334155]">Support Access Restricted</h3>
                    <p className="mt-2 text-sm font-medium text-[#64748B]">
                        You do not currently have permission to open support tickets in this workspace.
                    </p>
                </div>
            </div>
        );
    }

    if (loading && tickets.length === 0) return <div className="p-3 animate-pulse text-slate-300 font-bold uppercase tracking-widest text-xs">Syncing with support...</div>;

    if (isCreating) return (
        <div className="h-full flex flex-col bg-white font-inter overflow-hidden relative">
             <div className="p-3 shrink-0 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsCreating(false)}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#2563EB] hover:border-[#2563EB] transition-all shadow-sm group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-[20px] font-bold text-[#334155] tracking-tight">New Ticket</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-3 relative z-10">
                <div className="max-w-4xl mx-auto h-full flex flex-col justify-center">
                    <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xl shadow-blue-500/5 overflow-hidden">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Subject</label>
                                <input 
                                    type="text" required
                                    placeholder="Briefly state your concern (e.g., Payslip calculation error)"
                                    className="w-full text-[14px] font-semibold text-[#334155] bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Description</label>
                                <textarea 
                                    required 
                                    placeholder="Describe your situation in full detail here..."
                                    className="w-full min-h-[140px] p-4 bg-white border border-[#E2E8F0] rounded-xl text-[14px] font-medium text-[#334155] outline-none focus:bg-white focus:border-[#2563EB] focus:ring-8 focus:ring-blue-500/[0.03] transition-all resize-none placeholder:text-slate-300 leading-relaxed"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>

                            <div className="flex flex-col gap-4 pt-6 border-t border-slate-100">
                                {selectedFile && (
                                    <div className="flex items-center justify-between bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-900">
                                                <File size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black uppercase text-slate-600 truncate max-w-[300px]">{selectedFile.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setSelectedFile(null)} className="text-rose-500">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 relative" ref={menuRef}>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={(e) => {
                                                setSelectedFile(e.target.files[0]);
                                                setShowAttachmentMenu(false);
                                            }}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                            className={`h-11 px-4 border border-slate-200 rounded-xl transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest ${showAttachmentMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:border-indigo-600'}`}
                                        >
                                            {showAttachmentMenu ? <X size={14} /> : <Paperclip size={14} />}
                                            {showAttachmentMenu ? 'CANCEL' : 'ATTACH FILE'}
                                        </button>

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
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">{opt.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        type="submit"
                                        disabled={submitting}
                                        style={{ backgroundColor: '#4f46e5', color: 'white' }}
                                        className="h-12 px-10 hover:bg-indigo-700 disabled:opacity-60 rounded-xl text-[13px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-3 active:scale-95 group"
                                    >
                                        {submitting ? 'Submitting...' : 'Raise Ticket'} <Send size={16} className={clsx("transition-transform", !submitting && "group-hover:translate-x-1")} />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-3 h-[calc(100vh-70px)] flex flex-col bg-white font-inter overflow-hidden gap-4 animate-in fade-in duration-500">
            
            {!selectedTicket ? (
                <>
                    {/* Header: Exact Dashboard Style */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shrink-0">
                        <div className="flex items-center gap-4">
                             <div>
                                 <h1 className="text-[22px] font-bold text-[#334155] tracking-tight">Support Requests</h1>
                             </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative group flex-1 sm:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] transition-colors group-focus-within:text-[#2563EB]" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Find a request..." 
                                    className="w-full h-11 pl-11 pr-4 bg-white border border-[#E2E8F0] rounded-xl text-[13px] font-medium text-[#334155] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {canCreateTickets && (
                                <button 
                                    onClick={() => setIsCreating(true)}
                                    className="h-11 px-6 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-[13px] font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
                                >
                                    <Plus size={18} /> New Ticket
                                </button>
                            )}
                        </div>
                    </div>

                    {canViewTickets ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                                {[
                                    { label: 'Total Tickets', val: stats.total, icon: <TicketIcon size={16} />, color: 'text-[#2563EB] bg-blue-50' },
                                    { label: 'Pending Response', val: stats.pending, icon: <Clock3 size={16} />, color: 'text-orange-500 bg-orange-50' },
                                    { label: 'Resolved', val: stats.resolved, icon: <CheckCircle2 size={16} />, color: 'text-[#16A34A] bg-[#ECFDF5]' }
                                ].map((s, i) => (
                                    <div key={i} className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between min-h-[100px] hover:shadow-md hover:border-[#CBD5E1] transition-all group">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[12px] font-medium text-[#64748B] tracking-tight">{s.label}</span>
                                            <div className={clsx("p-2 rounded-lg transition-transform group-hover:scale-110 duration-300", s.color)}>
                                                {s.icon}
                                            </div>
                                        </div>
                                        <h2 className="text-[24px] font-bold text-[#334155] tracking-tight leading-none">{s.val}</h2>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
                                {filteredTickets.length > 0 ? (
                                    filteredTickets.map(t => (
                                        <div key={t._id} onClick={() => setSelectedTicket(t)} className="bg-white px-4 py-3 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 hover:shadow-md hover:border-[#CBD5E1] transition-all group cursor-pointer animate-in slide-in-from-left-2 duration-300">
                                            <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
                                                 <div className={clsx("w-1.5 h-10 rounded-full shrink-0", getStatusStyle(t.status).split(' ')[0].replace('text-', 'bg-'))}></div>
                                                 <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-[14px] font-bold text-[#334155] group-hover:text-[#2563EB] transition-colors uppercase truncate">{t.title}</h3>
                                                        <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest shrink-0">• {t.category}</span>
                                                    </div>
                                                    <p className="text-[11px] font-medium text-[#64748B] opacity-60 italic truncate">{t.description}</p>
                                                 </div>
                                            </div>
                                            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                                                 <div className="text-left sm:text-right flex flex-col sm:items-end">
                                                    <span className={clsx("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border w-fit", getStatusStyle(t.status))}>{t.status}</span>
                                                    <span className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-widest">{formatDateDDMMYYYY(t.createdAt)}</span>
                                                 </div>
                                                 <ChevronRight size={14} className="text-slate-200 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-1 flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-blue-500/5 flex items-center justify-center text-blue-500 mb-6">
                                            <TicketIcon size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-2">No support tickets found</h3>
                                        <p className="text-sm text-slate-500 mb-8 max-w-sm text-center font-medium">Need assistance? Create your first ticket and our support team will get back to you shortly.</p>
                                        {canCreateTickets && (
                                            <button 
                                                onClick={() => setIsCreating(true)}
                                                className="h-12 px-8 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-3 active:scale-95"
                                            >
                                                <Plus size={20} /> Create Your First Ticket
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 items-center justify-center">
                            <div className="w-full max-w-2xl rounded-2xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center shadow-sm">
                                <HelpCircle size={32} className="mx-auto mb-4 text-slate-300" />
                                <h3 className="text-[18px] font-semibold text-[#334155]">View access is disabled</h3>
                                <p className="mt-2 text-sm font-medium text-[#64748B]">
                                    This workspace can create tickets, but existing ticket data is hidden by access control.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Detail View Refined - Matching Dashboard Internal Sections */
                <div className="animate-in slide-in-from-right-10 h-full flex flex-col">
                    {/* Detail Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 shrink-0 border-b border-[#E2E8F0]">
                         <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSelectedTicket(null)}
                                className="w-9 h-9 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#334155] hover:border-[#CBD5E1] transition-all shadow-sm"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <div className="flex flex-col">
                                <h4 className="text-[13px] font-bold text-[#334155]">#{String(selectedTicket._id || '').slice(-6).toUpperCase()} Request</h4>
                                <p className="text-[9px] text-[#64748B] font-bold uppercase tracking-widest">{selectedTicket.category || 'GENERAL'}</p>
                            </div>
                         </div>
                         <div className={clsx("px-4 h-8 flex items-center justify-center rounded-xl text-[9px] font-bold uppercase tracking-widest border shadow-sm", getStatusStyle(selectedTicket.status))}>
                            {selectedTicket.status}
                         </div>
                    </div>

                    {/* Three Column Grid - Consistent with Dashboard Proportions */}
                    <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                        {/* Col 1: Details */}
                        <div className="col-span-12 xl:col-span-3 space-y-3 flex flex-col">
                            <h5 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest px-1">Description</h5>
                            <div className="p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex-1 overflow-y-auto custom-scrollbar">
                                <p className="text-[13px] font-medium text-[#334155] leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                            </div>
                        </div>

                        {/* Col 2: Chat - Exact "Log Timeline" Vibe */}
                        <div className="col-span-12 xl:col-span-6 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#F8FAFC] flex items-center justify-center gap-3">
                                <div className="h-[1px] bg-[#E2E8F0] flex-1"></div>
                                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.2em]">Transmission</span>
                                <div className="h-[1px] bg-[#E2E8F0] flex-1"></div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 custom-scrollbar">
                                {(selectedTicket.comments || []).map((comm, idx) => {
                                    const isHR = comm.senderRole === 'admin' || comm.senderRole === 'HR' || comm.senderRole === 'hr';
                                    return (
                                        <div key={idx} className={clsx("flex items-start gap-6", !isHR ? "flex-row-reverse" : "")}>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className={clsx(
                                                    "w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold shadow-sm transition-all relative overflow-hidden",
                                                    isHR ? "bg-[#F1F5F9] text-[#2563EB] border border-[#E2E8F0]" : "bg-[#334155] text-white"
                                                )}>
                                                    <span className="relative z-10">{isHR ? 'HR' : (comm.sender?.charAt(0)?.toUpperCase() || 'U')}</span>
                                                    {isHR && <div className="absolute inset-x-0 bottom-0 h-1 bg-[#2563EB] opacity-10"></div>}
                                                </div>
                                            </div>
                                            <div className={clsx(
                                                "p-4 rounded-xl shadow-sm max-w-[85%] relative animate-in slide-in-from-bottom-2 duration-300",
                                                isHR ? "bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155]" : "bg-[#2563EB] text-white"
                                            )}>
                                                {isHR && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[9px] font-bold text-[#2563EB] uppercase tracking-wider">Support Agent</span>
                                                        <Zap size={10} className="text-amber-500 fill-amber-500" />
                                                    </div>
                                                )}
                                                <div className="whitespace-pre-wrap">{comm.text}</div>
                                                {comm.attachments?.map((att, i) => (
                                                    <div key={i}>
                                                        {renderAttachment(att, !isHR)}
                                                    </div>
                                                ))}
                                                <div className={clsx("text-[9px] mt-4 font-bold flex items-center gap-2", isHR ? "text-[#94A3B8]" : "text-blue-200")}>
                                                    {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {!isHR && <CheckCircle size={10} />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                             <div className="px-5 py-4 bg-white border-t border-[#E2E8F0]">
                                  {selectedFile && (
                                     <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 mb-3 animate-in zoom-in-95 duration-200">
                                         <div className="flex items-center gap-2">
                                             <Paperclip size={12} className="text-indigo-900" />
                                             <span className="text-[10px] font-black uppercase text-slate-600 truncate max-w-[200px]">{selectedFile.name}</span>
                                         </div>
                                         <button onClick={() => setSelectedFile(null)} className="text-rose-500 hover:text-rose-700">
                                             <X size={14} />
                                         </button>
                                     </div>
                                  )}
                                  <div className="flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-xl p-1.5 pl-4 focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-blue-500/5 transition-all shadow-sm relative">
                                     <input 
                                         type="file" 
                                         ref={fileInputRef} 
                                         className="hidden" 
                                         onChange={(e) => {
                                             setSelectedFile(e.target.files[0]);
                                             setShowAttachmentMenu(false);
                                         }}
                                     />
                                     
                                     <div className="relative" ref={menuRef}>
                                         <Paperclip 
                                             size={18} 
                                             className={clsx("cursor-pointer transition-colors", showAttachmentMenu ? "text-indigo-900" : "text-[#94A3B8] hover:text-[#2563EB]")}
                                             onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                         />
                                         
                                         {showAttachmentMenu && (
                                             <div className="absolute bottom-full left-0 mb-4 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[200px] animate-in slide-in-from-bottom-2 duration-200 z-50">
                                                 <div className="grid grid-cols-1 gap-1">
                                                     {[
                                                         { label: 'Images', icon: <ImageIcon size={14} />, color: 'text-purple-500', bg: 'bg-purple-50', accept: 'image/*' },
                                                         { label: 'Videos', icon: <VideoIcon size={14} />, color: 'text-amber-500', bg: 'bg-amber-50', accept: 'video/*' },
                                                         { label: 'Documents', icon: <FileText size={14} />, color: 'text-blue-500', bg: 'bg-blue-50', accept: '.pdf,.doc,.docx' },
                                                         { label: 'Camera', icon: <VideoIcon size={14} />, color: 'text-rose-500', bg: 'bg-rose-50', accept: 'image/*', capture: 'environment' },
                                                     ].map((opt, i) => (
                                                         <button
                                                             key={i}
                                                             type="button"
                                                             onClick={() => {
                                                                 if (fileInputRef.current) {
                                                                     fileInputRef.current.accept = opt.accept;
                                                                     if (opt.capture) fileInputRef.current.capture = opt.capture;
                                                                     else fileInputRef.current.removeAttribute('capture');
                                                                     fileInputRef.current.click();
                                                                 }
                                                             }}
                                                             className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all group"
                                                         >
                                                             <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", opt.bg, opt.color)}>
                                                                 {opt.icon}
                                                             </div>
                                                             <span className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">{opt.label}</span>
                                                         </button>
                                                     ))}
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                     <input 
                                         type="text" 
                                         placeholder="Add to conversation..." 
                                         className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-[#334155] py-1.5 placeholder:text-[#CBD5E1]"
                                         value={newComment}
                                         onChange={(e) => setNewComment(e.target.value)}
                                         onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                     />
                                     <button 
                                         onClick={handlePostComment}
                                         disabled={postingComment || (!newComment.trim() && !selectedFile)}
                                         className="w-9 h-9 rounded-lg bg-[#2563EB] text-white flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 active:scale-95"
                                     >
                                         <Send size={16} />
                                     </button>
                                  </div>
                             </div>
                        </div>

                        {/* Col 3: Journey Log */}
                        <div className="col-span-12 xl:col-span-3">
                            <h5 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest px-1 mb-4">Process Audit</h5>
                            <div className="relative pl-6 space-y-6">
                                <div className="absolute left-[9px] top-2 bottom-2 w-[1.5px] bg-[#E2E8F0]"></div>
                                
                                <div className="relative animate-in slide-in-from-left-2 duration-300">
                                    <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-[#2563EB] bg-white shadow-sm"></div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-[#334155]">INITIATED</span>
                                            <span className="text-[8px] text-[#94A3B8] font-bold">{new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-[10px] font-medium text-[#64748B]">Case officially registered</p>
                                    </div>
                                </div>

                                {selectedTicket.comments?.filter(c => c.text.includes('[STATUS UPDATE]')).map((log, i) => (
                                    <div key={i} className="relative animate-in slide-in-from-left-2 duration-400">
                                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full border-2 border-[#16A34A] bg-white shadow-sm"></div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[13px] font-bold text-[#334155]">UPDATE</span>
                                                <span className="text-[9px] text-[#94A3B8] font-bold">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-[11px] font-medium text-[#64748B] bg-slate-50 p-3 rounded-xl border border-[#E2E8F0]">
                                                {log.text.replace('[STATUS UPDATE]', '').trim()}
                                            </p>
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
