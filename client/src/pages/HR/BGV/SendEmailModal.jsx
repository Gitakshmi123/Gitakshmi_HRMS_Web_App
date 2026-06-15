import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import { X, Mail, Send, AlertCircle, Info, Eye, EyeOff, Layout, User, Globe, MessageSquare, ChevronDown, CheckCircle } from 'lucide-react';

const SendEmailModal = ({ caseData, onClose, onEmailSent, initialEmailType = '' }) => {
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedEmailType, setSelectedEmailType] = useState(initialEmailType || '');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [recipientType, setRecipientType] = useState('CANDIDATE');
    const [sendToMode, setSendToMode] = useState('CANDIDATE'); // CANDIDATE | CUSTOM | CANDIDATE_AND_CUSTOM
    const [externalEmails, setExternalEmails] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [previewMode, setPreviewMode] = useState(false);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || !caseData || typeof document === 'undefined') return null;

    const candidateName = caseData.candidateId?.name || caseData.candidateName || 'N/A';
    const candidateEmail = caseData.candidateId?.email || caseData.candidateEmail || '';
    const recipientTypeLabel =
        sendToMode === 'CUSTOM'
            ? 'CUSTOM'
            : sendToMode === 'CANDIDATE_AND_CUSTOM'
                ? 'CANDIDATE + CUSTOM'
                : recipientType;

    const parseEmailList = (raw) => {
        if (!raw) return [];
        return String(raw)
            .split(/[;,]/)
            .map(s => s.trim())
            .filter(Boolean);
    };

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // Filter available types from the fetched templates based on BGV status
    const availableEmailTypes = templates.filter(t => {
        const type = t.emailType;
        if (caseData.overallStatus === 'PENDING') return ['DOCUMENT_PENDING', 'BGV_IN_PROGRESS'].includes(type);
        if (caseData.overallStatus === 'IN_PROGRESS') return ['DOCUMENT_PENDING', 'BGV_IN_PROGRESS', 'DISCREPANCY_RAISED'].includes(type);
        if (caseData.overallStatus === 'VERIFIED') return ['BGV_COMPLETED_VERIFIED'].includes(type);
        if (caseData.overallStatus === 'FAILED') return ['BGV_COMPLETED_FAILED'].includes(type);
        return true;
    });

    useEffect(() => {
        fetchTemplates();
    }, []);

    useEffect(() => {
        setSelectedEmailType(initialEmailType || '');
        setCustomMessage('');
        setPreviewMode(false);
        setSelectedTemplate(null);
        setSendToMode('CANDIDATE');
        setExternalEmails('');
    }, [initialEmailType, caseData?._id]);

    useEffect(() => {
        if (selectedEmailType) {
            fetchTemplateByType(selectedEmailType);
            const template = templates.find(t => t.emailType === selectedEmailType);
            if (template) {
                setRecipientType(template.defaultRecipientType || 'CANDIDATE');
            }
            setSendToMode('CANDIDATE');
            setExternalEmails('');
        }
    }, [selectedEmailType]);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/bgv/email-templates');
            setTemplates(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        }
    };

    const fetchTemplateByType = async (emailType) => {
        try {
            const res = await api.get(`/bgv/email-template/${emailType}`);
            setSelectedTemplate(res.data.data);
        } catch (err) {
            console.error('Failed to fetch template:', err);
        }
    };

    const handleSendEmail = async () => {
        if (!selectedEmailType) {
            showToast('error', 'Error', 'Please select an email type');
            return;
        }

        const externalList = parseEmailList(externalEmails);
        if ((sendToMode === 'CUSTOM' || sendToMode === 'CANDIDATE_AND_CUSTOM')) {
            if (externalList.length === 0) {
                showToast('error', 'Error', 'Please enter at least one external email address');
                return;
            }

            const invalid = externalList.filter(e => !isValidEmail(e));
            if (invalid.length > 0) {
                showToast('error', 'Error', `Invalid email address(es): ${invalid.join(', ')}`);
                return;
            }

            if (externalList.length > 10) {
                showToast('error', 'Error', 'Too many external recipients (max 10)');
                return;
            }
        }

        const payload = {
            emailType: selectedEmailType,
            recipientType,
            customMessage: customMessage.trim() || undefined
        };

        if (sendToMode === 'CUSTOM') {
            payload.recipientType = 'CUSTOM';
            payload.customRecipientEmail = externalEmails;
        }

        if (sendToMode === 'CANDIDATE_AND_CUSTOM') {
            payload.recipientType = 'CANDIDATE';
            payload.additionalRecipients = externalEmails;
        }

        setLoading(true);
        try {
            await api.post(`/bgv/case/${caseData._id}/send-email`, payload);

            showToast('success', 'Success', 'Email sent successfully');
            onEmailSent && onEmailSent();
            onClose();
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.message || 'Failed to send email');
        } finally {
            setLoading(false);
        }
    };

    const getPreviewHtml = () => {
        if (!selectedTemplate) return '';

        // Simple variable replacement for preview
        let html = selectedTemplate.htmlBody || '';
        const variables = {
            candidate_name: caseData.candidateId?.name || caseData.candidateName || 'Candidate Name',
            bgv_case_id: caseData.caseId || caseData._id,
            job_title: caseData.jobTitle || 'Position',
            bgv_status: caseData.overallStatus || 'IN_PROGRESS',
            sla_date: caseData.sla?.dueDate ? new Date(caseData.sla.dueDate).toLocaleDateString() : 'N/A',
            completion_date: caseData.completedAt ? new Date(caseData.completedAt).toLocaleDateString() : 'N/A',
            pending_documents: 'Sample pending documents list'
        };

        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, value);
        });

        return html;
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-[#4F46E5] px-10 py-8 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center border border-white/30">
                            <Mail size={32} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Send Email</h2>
                            <p className="text-indigo-50 font-semibold tracking-widest uppercase text-[10px] opacity-90 mt-1">Send communication to candidate or external recipient</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all border border-transparent hover:border-white/30 text-white relative z-10"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {/* Status Warning */}
                        {caseData.isClosed && (
                            <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 flex items-start gap-5">
                                <AlertCircle className="text-rose-500 shrink-0 mt-1" size={24} />
                                <div>
                                    <p className="text-xs font-bold text-rose-900 uppercase tracking-widest mb-1">Case Closed</p>
                                    <p className="text-sm font-semibold text-rose-700 leading-relaxed">
                                        This case is closed. You can only send a final closure email at this stage.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Template Selection */}
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm transition-all hover:border-indigo-200">
                            <div className="flex items-center gap-3 mb-6">
                                <Layout size={18} className="text-[#4F46E5]" />
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em]">Select Template</h3>
                            </div>

                            {availableEmailTypes.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                                        <Info size={32} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No templates available for the current status</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <select
                                            value={selectedEmailType}
                                            onChange={(e) => setSelectedEmailType(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-[#4F46E5] focus:bg-white transition-all outline-none font-bold text-xs uppercase tracking-widest text-slate-700 appearance-none cursor-pointer shadow-inner"
                                        >
                                            <option value="">-- Choose Template --</option>
                                            {availableEmailTypes.map((type) => (
                                                <option key={type._id} value={type.emailType}>
                                                    {type.name} (Code: {type.emailType})
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#4F46E5] transition-colors" />
                                    </div>

                                    {selectedEmailType && (
                                        <div className="p-6 bg-indigo-50 rounded-[1.5rem] border border-indigo-100 animate-in slide-in-from-top-4 duration-300">
                                            {(() => {
                                                const selected = templates.find(t => t.emailType === selectedEmailType);
                                                return selected ? (
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-indigo-200 shadow-sm shrink-0">
                                                            <CheckCircle size={20} className="text-[#4F46E5]" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-900 tracking-tight uppercase mb-1">{selected.name}</div>
                                                            <div className="text-[11px] font-semibold text-indigo-700/70 leading-relaxed italic">"{selected.description || selected.subject}"</div>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Recipient Logistics */}
                        {selectedEmailType && (
                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <Globe size={18} className="text-[#4F46E5]" />
                                    <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em]">Recipients</h3>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                    <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex flex-col justify-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">CANDIDATE</div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 font-bold text-slate-300">
                                                {candidateName[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 tracking-tight uppercase leading-none mb-1">{candidateName}</div>
                                                <div className="text-[10px] font-semibold text-slate-400 tracking-wide">{candidateEmail || 'UNAVAILABLE'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">SEND TO</div>
                                        <div className="relative">
                                            <select
                                                value={sendToMode}
                                                onChange={(e) => setSendToMode(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#4F46E5] focus:bg-white transition-all outline-none text-[10px] font-bold uppercase tracking-widest text-slate-600 appearance-none shadow-inner"
                                            >
                                                <option value="CANDIDATE">Candidate</option>
                                                <option value="CUSTOM">Custom Emails Only</option>
                                                <option value="CANDIDATE_AND_CUSTOM">Candidate + Custom Emails</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {(sendToMode === 'CUSTOM' || sendToMode === 'CANDIDATE_AND_CUSTOM') && (
                                    <div className="space-y-3 animate-in fade-in duration-300">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">CUSTOM EMAIL ADDRESSES</div>
                                        <input
                                            value={externalEmails}
                                            onChange={(e) => setExternalEmails(e.target.value)}
                                            placeholder="person1@example.com, person2@example.com..."
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:border-[#4F46E5] focus:bg-white transition-all outline-none font-semibold text-sm text-slate-900 shadow-inner"
                                        />
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2">
                                            <Info size={10} /> MAX RECIPIENTS: 10 (COMMA SEPARATED)
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Custom Enrichment */}
                        {selectedEmailType && (
                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm transition-all hover:border-indigo-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <MessageSquare size={18} className="text-[#4F46E5]" />
                                    <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em]">Add Custom Message</h3>
                                </div>
                                <textarea
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="Add a custom message to the email..."
                                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:border-[#4F46E5] focus:bg-white transition-all outline-none text-sm font-medium h-32 resize-none shadow-inner"
                                />
                            </div>
                        )}

                        {/* Preview Control */}
                        {selectedEmailType && selectedTemplate && (
                            <div className="flex justify-center">
                                <button
                                    onClick={() => setPreviewMode(!previewMode)}
                                    className={`flex items-center gap-3 px-8 py-3 rounded-[1.25rem] font-bold text-[10px] uppercase tracking-widest transition-all ${previewMode ? 'bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-slate-400 border border-slate-200 hover:text-[#4F46E5] hover:border-[#4F46E5]'}`}
                                >
                                    {previewMode ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
                                    {previewMode ? 'HIDE PREVIEW' : 'VIEW PREVIEW'}
                                </button>
                            </div>
                        )}

                        {/* HTML Preview Sandbox */}
                        {previewMode && selectedTemplate && (
                            <div className="bg-white rounded-[2.5rem] border-2 border-[#4F46E5]/20 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                                <div className="bg-slate-900 px-8 py-4 flex items-center justify-between border-b border-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                    </div>
                                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">EMAIL PREVIEW</div>
                                    <div></div>
                                </div>
                                <div className="bg-slate-50 p-6 border-b border-slate-100 flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase w-16">Subject:</span>
                                        <span className="text-xs font-bold text-slate-900 tracking-tight">{selectedTemplate.subject}</span>
                                    </div>
                                </div>
                                <div className="bg-white p-10 max-h-[40rem] overflow-y-auto custom-scrollbar">
                                    <div
                                        className="preview-content font-sans"
                                        dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="bg-white px-10 py-8 border-t border-slate-100 flex items-center justify-between flex-shrink-0 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center gap-3 text-slate-400">
                        {selectedEmailType && (
                            <>
                                <CheckCircle size={16} className="text-emerald-500" />
                                <span className="text-[9px] font-bold uppercase tracking-widest">EMAIL WILL BE LOGGED</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-8 py-4 text-slate-400 hover:text-slate-600 font-bold text-[11px] uppercase tracking-widest transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSendEmail}
                            disabled={!selectedEmailType || loading}
                            className="h-14 px-10 bg-slate-900 text-white rounded-[1.25rem] font-bold text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-[#4F46E5] hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-slate-300 transition-all flex items-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>SENDING...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={18} strokeWidth={2.5} />
                                    <span>SEND EMAIL</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SendEmailModal;
