import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Send, Zap, Paperclip, X, Image as ImageIcon, 
    FileText, Video as VideoIcon, File 
} from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

export default function SubmitTicket() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
        description: ''
    });
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.description.trim()) {
            showToast('warning', 'Missing Details', 'Please provide both title and description');
            return;
        }

        try {
            setSubmitting(true);
            const data = new FormData();
            Object.keys(formData).forEach(key => data.append(key, formData[key]));
            if (selectedFile) {
                data.append('attachment', selectedFile);
            }
            await api.post('/tickets/create', data);
            showToast('success', 'Ticket Logged', 'Your support request has been initiated');
            navigate(-1);
        } catch {
            showToast('error', 'Submission Failed', 'Could not record your request at this time');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#F8FAFC] font-inter overflow-hidden relative">
            <div className="px-10 py-6 shrink-0 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#2563EB] hover:border-[#2563EB] transition-all shadow-sm group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-[20px] font-bold text-[#334155] tracking-tight">New Case Ticket</h1>
                        <p className="text-[11px] text-[#2563EB] font-bold uppercase tracking-widest mt-1 italic">Initiating Priority Support</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden px-10 relative z-10">
                <div className="max-w-4xl mx-auto h-full flex flex-col justify-center pb-20">
                    <div className="bg-white rounded-3xl p-8 border border-[#E2E8F0] shadow-xl shadow-blue-500/5 overflow-hidden">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Case Subject</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Briefly state your concern"
                                    className="w-full text-[16px] font-semibold text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-6 py-4 outline-none focus:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Category</label>
                                    <select
                                        className="w-full text-[14px] font-semibold text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-6 py-4 outline-none focus:bg-white focus:border-[#2563EB]"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="GENERAL">General</option>
                                        <option value="PAYROLL">Payroll</option>
                                        <option value="ATTENDANCE">Attendance</option>
                                        <option value="LEAVE">Leave</option>
                                        <option value="IT">IT</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Priority</label>
                                    <select
                                        className="w-full text-[14px] font-semibold text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-6 py-4 outline-none focus:bg-white focus:border-[#2563EB]"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em] px-1">Full Detailed Details</label>
                                <textarea
                                    required
                                    placeholder="Describe your issue in detail so the right team can pick it up quickly."
                                    className="w-full min-h-[160px] p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[14px] font-medium text-[#334155] outline-none focus:bg-white focus:border-[#2563EB] focus:ring-8 focus:ring-blue-500/[0.03] transition-all resize-none placeholder:text-slate-300 leading-relaxed"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="flex flex-col gap-4 pt-6 border-t border-[#F8FAFC]">
                                {selectedFile && (
                                    <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                <File size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black uppercase text-slate-600 truncate max-w-[300px]">{selectedFile.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setSelectedFile(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-all">
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
                                            className={`h-14 px-6 border border-slate-200 rounded-xl transition-all flex items-center gap-3 font-bold text-[12px] uppercase tracking-widest ${showAttachmentMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:border-indigo-600'}`}
                                        >
                                            {showAttachmentMenu ? <X size={16} /> : <Paperclip size={16} />}
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
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${opt.bg} ${opt.color}`}>
                                                                    {opt.icon}
                                                            </div>
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">{opt.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="hidden md:flex items-center gap-3 text-slate-300">
                                            <Zap size={14} className="text-amber-500" />
                                            <p className="text-[10px] font-bold uppercase tracking-wider italic opacity-60">Smart Queueing enabled</p>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="h-14 px-10 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center gap-3 active:scale-95 group"
                                    >
                                        Broadcast Case <Send size={16} className="transition-transform group-hover:translate-x-1" />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
