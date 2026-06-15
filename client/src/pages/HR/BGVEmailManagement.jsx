import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Mail, Search, Filter, Eye, RefreshCw, Send, Settings, FileText, ChevronRight, PlusSquare, Trash2, X, AlertCircle } from 'lucide-react';
import { showToast } from '../../utils/uiNotifications';
import BGVEmailTemplateModal from './BGV/BGVEmailTemplateModal';
import usePagePermissions from '../../hooks/usePagePermissions';

const BGVEmailManagement = () => {
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('bgv.emailLogs');
    const [activeTab, setActiveTab] = useState('logs');
    const [logs, setLogs] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);
    const [showLogModal, setShowLogModal] = useState(false);

    useEffect(() => {
        if (activeTab === 'logs') {
            fetchLogs();
        } else {
            fetchTemplates();
        }
    }, [activeTab]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/bgv/email-history-global');
            setLogs(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/bgv/email-templates');
            setTemplates(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInitializeTemplates = async () => {
        try {
            await api.post('/bgv/email-templates/initialize');
            showToast('success', 'Success', 'Default templates initialized');
            fetchTemplates();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to initialize templates';
            showToast('error', 'Error', msg);
        }
    };

    const handleManage = (template) => {
        setSelectedTemplate(template);
        setShowModal(true);
    };

    const handleCreate = () => {
        setSelectedTemplate(null);
        setShowModal(true);
    };

    const handleModalSuccess = () => {
        setShowModal(false);
        fetchTemplates();
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('Are you sure you want to remove this template? This cannot be undone.')) return;

        try {
            await api.delete(`/bgv/email-template/${id}`);
            showToast('success', 'Removed', 'Template has been deleted');
            fetchTemplates();
        } catch (err) {
            showToast('error', 'Error', 'Failed to remove template');
        }
    };

    const handleViewLog = (log) => {
        setSelectedLog(log);
        setShowLogModal(true);
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center m-6">
                <AlertCircle size={48} className="text-rose-500 mb-6" />
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Access Denied</h3>
                <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto text-center">You do not have permission to access BGV Email Management.</p>
            </div>
        );
    }

    return (
        <div className="px-5 py-6 font-inter">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Email Management
                </h1>

                <div className="flex items-center gap-4">
                    {/* Tabs now on the right */}
                    <div className="flex bg-slate-50/50 p-1 rounded-xl border border-slate-200/60 shadow-sm h-10 overflow-hidden">
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`px-6 h-full transition-all text-[10px] font-bold uppercase tracking-widest relative flex items-center gap-2 rounded-lg ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Mail size={12} />
                            Logs
                        </button>
                        <button
                            onClick={() => setActiveTab('templates')}
                            className={`px-6 h-full transition-all text-[10px] font-bold uppercase tracking-widest relative flex items-center gap-2 rounded-lg ${activeTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <FileText size={12} />
                            Templates
                        </button>
                    </div>

                    {activeTab === 'templates' && (
                        <div className="flex items-center gap-2">
                            {canEdit && templates.length === 0 && (
                                <button
                                    onClick={handleInitializeTemplates}
                                    className="flex items-center gap-2 bg-white text-slate-700 font-bold px-4 h-10 rounded-xl hover:bg-slate-50 transition-all border border-slate-200 text-[11px] uppercase tracking-wider"
                                >
                                    <Settings size={16} />
                                    Initialize Defaults
                                </button>
                            )}
                            {canCreate && (
                                <button
                                    onClick={handleCreate}
                                    className="flex items-center gap-2 bg-[#4F46E5] text-white font-bold px-5 h-10 rounded-xl shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-all text-[11px] uppercase tracking-wider"
                                >
                                    <PlusSquare size={16} />
                                    Create
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'logs' ? (
                /* Logs Content */
                <div className="space-y-4">
                    <div className="p-0 bg-transparent border-none shadow-none flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="relative w-full md:w-[450px]">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                placeholder="Search by recipient or subject layer..."
                                className="w-full pl-14 pr-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-semibold text-slate-600 text-xs focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="ALL">All Status</option>
                                    <option value="SENT">Sent</option>
                                    <option value="FAILED">Failed</option>
                                </select>
                            </div>
                            <button
                                onClick={fetchLogs}
                                className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-slate-100 hover:border-indigo-100"
                                title="Sync Logs"
                            >
                                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="w-full bg-transparent p-0 border-none shadow-none">
                        {/* Headers */}
                        <div className="grid grid-cols-[1fr_1.8fr_1fr_2fr_1fr_0.5fr] items-center px-6 py-4 mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Transmission Status</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Recipient Identification</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Blueprint Type</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Communication Layer</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Time Sync</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right">Registry</span>
                        </div>

                        <div className="space-y-3">
                            {loading && logs.length === 0 ? (
                                <div className="p-20 text-center bg-white rounded-[2rem] border border-slate-100">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-10 h-10 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div>
                                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing communications...</span>
                                    </div>
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="p-20 text-center bg-white rounded-[2rem] border border-slate-100">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-5 bg-slate-50 rounded-3xl">
                                            <Mail className="text-slate-300" size={56} />
                                        </div>
                                        <div className="font-bold text-slate-400 uppercase tracking-widest text-sm">No activity records found</div>
                                        <p className="text-slate-400 text-xs max-w-[240px] leading-relaxed">System logs for BGV-related emails will appear here automatically.</p>
                                    </div>
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div key={log._id} className="group grid grid-cols-[1fr_1.8fr_1fr_2fr_1fr_0.5fr] items-center p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300">
                                        <div>
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-transparent transition-all ${log.status === 'SENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                log.status === 'FAILED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-700 tracking-tight text-sm">{log.recipientEmail}</div>
                                            <div className="text-[9px] text-[#4F46E5] font-bold uppercase tracking-[0.1em] mt-1 opacity-70">Case Attachment: {log.recipientType}</div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{log.emailType}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-500 line-clamp-1 max-w-xs">{log.subject}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-semibold text-slate-700">{new Date(log.sentAt || log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(log.sentAt || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <div className="flex justify-end pr-2">
                                            <button
                                                onClick={() => handleViewLog(log)}
                                                className="w-10 h-10 inline-flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-lg rounded-xl transition-all border border-transparent hover:border-indigo-100"
                                                title="View Trace"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Templates Content */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading && templates.length === 0 ? (
                        <div className="col-span-full py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
                                <span className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading templates...</span>
                            </div>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="col-span-full py-24 bg-white rounded-3xl border-4 border-dashed border-slate-100 text-center flex flex-col items-center">
                            <div className="p-6 bg-slate-50 rounded-full mb-6">
                                <FileText className="text-slate-300" size={64} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Email Library Empty</h3>
                            <p className="text-slate-400 mt-2 max-w-sm mx-auto font-medium text-sm leading-relaxed px-8">
                                Standardize your BGV communications by creating templates for common verification events.
                            </p>
                            <div className="flex items-center gap-3 mt-8">
                                <button
                                    onClick={handleInitializeTemplates}
                                    className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                                >
                                    <Settings size={16} />
                                    Initialize Defaults
                                </button>
                                <div className="text-slate-300 font-black italic">OR</div>
                                <button
                                    onClick={handleCreate}
                                    className="px-8 py-3 bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 transition-all flex items-center gap-2"
                                >
                                    <PlusSquare size={16} />
                                    Build Template
                                </button>
                            </div>
                        </div>
                    ) : (
                        templates.map((template) => (
                            <div key={template._id} className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-200 hover:shadow-2xl hover:shadow-blue-100 transition-all group overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-white group-hover:bg-blue-50/10 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 truncate pr-4">
                                            {template.emailType}
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight line-clamp-1 group-hover:text-blue-700 transition-colors">
                                            {template.name}
                                        </h3>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl group-hover:bg-white group-hover:shadow-lg group-hover:shadow-blue-100 transition-all">
                                        <FileText size={22} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                                    </div>
                                </div>
                                <div className="p-6 flex-1 flex flex-col">
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-3 mb-6">
                                        {template.description}
                                    </p>
                                    <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Version {template.version}</div>
                                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter w-fit ${template.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {template.isActive ? 'Active' : 'Inactive'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDeleteTemplate(template._id)}
                                                    className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Remove Template"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleManage(template)}
                                                    className="px-5 py-2.5 bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 group/btn border border-slate-100 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-200"
                                                >
                                                    Manage <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )
            }

            {/* Log Detail Modal */}
            {
                showLogModal && selectedLog && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div>
                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Communication Detail</div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Email Transmission Log</h2>
                                </div>
                                <button onClick={() => setShowLogModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                        <div className={`text-sm font-black ${selectedLog.status === 'SENT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {selectedLog.status}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</div>
                                        <div className="text-sm font-black text-slate-900">#{selectedLog.emailType}</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipient Info</div>
                                        <div className="p-4 border-2 border-slate-100 rounded-2xl flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xl">
                                                {selectedLog.recipientEmail?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{selectedLog.recipientEmail}</div>
                                                <div className="text-xs text-slate-500 font-medium">Recipient Type: {selectedLog.recipientType}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject</div>
                                        <div className="p-4 bg-slate-50 rounded-2xl font-bold text-slate-700">
                                            {selectedLog.subject}
                                        </div>
                                    </div>

                                    {selectedLog.failureReason && (
                                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                                            <AlertCircle className="text-rose-600 shrink-0" size={20} />
                                            <div>
                                                <div className="text-xs font-black text-rose-700 uppercase tracking-widest mb-1">Failure Reason</div>
                                                <div className="text-sm text-rose-600 font-medium">{selectedLog.failureReason}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 flex justify-end">
                                <button
                                    onClick={() => setShowLogModal(false)}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                >
                                    Close Log
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Template Modal */}
            {
                showModal && (
                    <BGVEmailTemplateModal
                        template={selectedTemplate}
                        onClose={() => setShowModal(false)}
                        onSuccess={handleModalSuccess}
                    />
                )
            }
        </div >
    );
};

export default BGVEmailManagement;

