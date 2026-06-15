import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Info, AlertCircle, Code, List, Sparkles, BookOpen, Layers, Settings2, CheckCircle2, Layout, Database, Terminal, Cpu } from 'lucide-react';
import { showToast } from '../../../utils/uiNotifications';
import api from '../../../utils/api';

const PRESETS = [
    {
        id: 'INITIATION',
        icon: <Sparkles size={20} />,
        name: 'Welcome & Invitation',
        category: 'Flow: Initiation',
        description: 'Standard invitation to start BGV process',
        emailType: 'BGV_IN_PROGRESS',
        subject: 'Welcome to the Team! Let\'s Start Your Verification',
        htmlBody: `<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f8fafc; border-radius: 2.5rem; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #0d9488 0%, #4F46E5 100%); padding: 50px 40px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.025em; text-transform: uppercase;">Background Verification</h1>
        <p style="color: #ccfbf1; margin-top: 10px; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.2em;">Secure Onboarding Protocol</p>
    </div>
    <div style="padding: 50px 40px; background: white;">
        <p style="font-size: 18px; font-weight: 800; tracking: tight; color: #0f172a;">DEAR {{candidate_name}},</p>
        <p style="line-height: 1.7; color: #475569; font-weight: 500;">We are thrilled to have you join our mission. To formalize your onboarding for the <strong>{{job_title}}</strong> role, we require a standard background certification.</p>
        <div style="margin: 35px 0; padding: 25px; background: #f0fdfa; border-radius: 1.5rem; border: 1px solid #99f6e4;">
            <p style="margin: 0; font-size: 9px; font-weight: 900; color: #0d9488; letter-spacing: 0.1em; text-transform: uppercase;">Reference UID</p>
            <p style="margin: 8px 0 0; font-weight: 900; font-size: 18px; color: #134e4a; letter-spacing: -0.025em;">{{bgv_case_id}}</p>
        </div>
        <p style="line-height: 1.7; color: #475569; font-weight: 500;">A dedicated verification specialist may contact you for supporting documentation. Please ensure your digital dossier is prepared for review.</p>
        <div style="margin-top: 45px; padding-top: 30px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="font-size: 10px; font-weight: 900; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase;">Authenticated By</p>
            <p style="font-weight: 800; color: #0f172a; margin-top: 5px;">ONBOARDING FACILITATION TEAM</p>
        </div>
    </div>
</div>`
    },
    {
        id: 'REMINDER',
        icon: <AlertCircle size={20} />,
        name: 'Urgent Reminder',
        category: 'Flow: Intervention',
        description: 'Request missing documents from candidate',
        emailType: 'DOCUMENT_PENDING',
        subject: 'Action Required: Pending Verification Documents',
        htmlBody: `<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #fff5f5; border-radius: 2.5rem; overflow: hidden; border: 1px solid #fee2e2;">
    <div style="background: #e11d48; padding: 40px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase;">ACTION REQUIRED</h1>
    </div>
    <div style="padding: 50px 40px; background: white;">
        <p style="font-weight: 800; color: #9f1239; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px;">SYSTEM STATUS: ON HOLD</p>
        <p style="font-size: 16px; font-weight: 700; color: #0f172a;">HI {{candidate_name}},</p>
        <p style="line-height: 1.7; color: #475569;">Your verification portal indicates missing mandatory data. We require the following to proceed:</p>
        <div style="background: #fff1f2; padding: 25px; border-radius: 1.5rem; color: #9f1239; font-weight: 800; border: 1px solid #fecaca; font-size: 14px; margin: 25px 0;">
            {{pending_documents}}
        </div>
        <p style="line-height: 1.7; color: #475569;">Please upload these via your portal by <strong>{{sla_date}}</strong>. Failure to comply may delay your projected commencement date.</p>
    </div>
</div>`
    },
    {
        id: 'SUCCESS',
        icon: <CheckCircle2 size={20} />,
        name: 'Verified - Success',
        category: 'Flow: Completion',
        description: 'Congratulatory email on passing BGV',
        emailType: 'BGV_COMPLETED_VERIFIED',
        subject: 'Verification Successful - Welcome Aboard!',
        htmlBody: `<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f0fdf4; border-radius: 2.5rem; overflow: hidden; border: 1px solid #dcfce7;">
    <div style="background: #059669; padding: 50px 40px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 15px;">🌟</div>
        <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em;">Verification Certified</h1>
    </div>
    <div style="padding: 50px 40px; background: white; text-align: center;">
        <p style="font-size: 22px; font-weight: 900; color: #065f46; letter-spacing: -0.025em; margin-bottom: 15px;">EXCELLENT NEWS, {{candidate_name}}!</p>
        <p style="line-height: 1.7; color: #475569; font-weight: 500;">Your background certification process has reached final completion with <strong>zero discrepancies</strong> detected.</p>
        <div style="display: inline-block; margin-top: 35px; background: #f0fdf4; padding: 12px 30px; border-radius: 50px; color: #059669; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; border: 1px solid #86efac;">
            STATUS: 100% AUTHENTICATED
        </div>
    </div>
</div>`
    }
];

const BGVEmailTemplateModal = ({ template, onClose, onSuccess }) => {
    const isEditing = !!template;
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [formData, setFormData] = useState({
        emailType: '',
        name: '',
        description: '',
        subject: '',
        htmlBody: '',
        supportedVariables: ['candidate_name', 'bgv_case_id', 'job_title']
    });

    useEffect(() => {
        if (template) {
            setFormData({
                emailType: template.emailType || '',
                name: template.name || '',
                description: template.description || '',
                subject: template.subject || '',
                htmlBody: template.htmlBody || '',
                supportedVariables: template.supportedVariables || []
            });
        }
    }, [template]);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || typeof document === 'undefined') return null;

    const applyPreset = (preset) => {
        setFormData(prev => ({
            ...prev,
            emailType: preset.emailType,
            name: preset.name,
            description: preset.description,
            subject: preset.subject,
            htmlBody: preset.htmlBody
        }));
        showToast('info', 'Template Applied', `Blueprint "${preset.name}" imported into editor`);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.post('/bgv/email-template', formData);
            showToast('success', 'Success', `Email template ${isEditing ? 'updated' : 'created'} successfully`);
            onSuccess();
        } catch (err) {
            console.error('Failed to save template:', err);
            const msg = err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} template`;
            showToast('error', 'Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-[10000] p-4 font-sans">
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-7xl w-full max-h-[94vh] overflow-hidden flex flex-col border border-white/20">
                {/* Modern Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-[#4F46E5] px-12 py-10 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="flex items-center gap-8 relative z-10">
                        <div className="w-20 h-20 bg-white/20 rounded-[2rem] backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xl">
                            <Layers size={40} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-bold text-white tracking-tight uppercase leading-none">
                                {isEditing ? 'Edit Template' : 'Create Template'}
                            </h2>
                            <p className="text-indigo-50 font-semibold tracking-[0.25em] uppercase text-xs opacity-80 mt-3 flex items-center gap-3">
                                <Cpu size={14} /> Email Template Management
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-14 h-14 flex items-center justify-center hover:bg-white/20 rounded-[1.5rem] transition-all border border-transparent hover:border-white/30 text-white relative z-10"
                    >
                        <X size={32} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50/50">
                    {/* Left Panel: Blueprint Discovery */}
                    {!isEditing && (
                        <div className="w-full lg:w-96 bg-white border-r border-slate-200/60 p-10 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center gap-3 mb-8">
                                <BookOpen size={20} className="text-[#4F46E5]" />
                                <span className="font-bold text-xs uppercase tracking-[0.2em] text-slate-900">Templates</span>
                            </div>

                            <div className="space-y-5">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => applyPreset(preset)}
                                        className="w-full text-left p-6 bg-slate-50 rounded-[2.5rem] border-2 border-transparent hover:border-[#4F46E5] hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group scale-100 active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="p-3 bg-white rounded-2xl group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm border border-slate-100 group-hover:border-indigo-400">
                                                {preset.icon}
                                            </div>
                                            <div className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-widest">{preset.category}</div>
                                        </div>
                                        <h4 className="font-bold text-slate-800 uppercase tracking-tight group-hover:text-[#4F46E5] transition-colors">{preset.name}</h4>
                                        <p className="text-[11px] font-semibold text-slate-400 mt-2 line-clamp-2 leading-relaxed italic">"{preset.description}"</p>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3 text-indigo-400 flex items-center gap-2">
                                    <Terminal size={12} /> TIP
                                </p>
                                <p className="text-xs font-semibold leading-relaxed text-slate-300">
                                    Selecting a template will replace your current content. Use custom parameters <code className="text-indigo-400">{"{{variable}}"}</code> for dynamic injection.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Right Panel: Logic Editor */}
                    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-10">
                            <div className="grid grid-cols-1 gap-10">
                                {/* Subject Stream */}
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 px-2">
                                        <Layout size={16} className="text-[#4F46E5]" />
                                        <span className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.25em]">Email Subject</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        placeholder="Enter email subject..."
                                        className="w-full px-8 py-6 bg-white border border-slate-200 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/5 rounded-[1.5rem] outline-none transition-all font-bold text-xl text-slate-900 shadow-sm"
                                        required
                                    />
                                </div>

                                {/* Body Synthesis */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <label className="flex items-center gap-3">
                                            <Code size={16} className="text-[#4F46E5]" />
                                            <span className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.25em]">Email Body (HTML)</span>
                                        </label>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none">HTML Editor</span>
                                        </div>
                                    </div>
                                    <div className="relative group">
                                        <textarea
                                            name="htmlBody"
                                            value={formData.htmlBody}
                                            onChange={handleChange}
                                            placeholder="Write HTML or select a template..."
                                            className="w-full px-10 py-8 bg-slate-900 border-2 border-slate-800 focus:border-[#4F46E5] rounded-[2.5rem] outline-none transition-all font-mono text-sm leading-relaxed resize-none h-[500px] shadow-2xl text-indigo-400/90 custom-scrollbar scrollbar-invert"
                                            required
                                        />
                                        <div className="absolute top-6 right-8 text-[10px] font-bold text-white/20 uppercase tracking-widest pointer-events-none">HTML Input</div>
                                    </div>
                                </div>
                            </div>

                            {/* Meta Configuration */}
                            <div className="pt-10 border-t border-slate-200/60">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className={`flex items-center gap-3 py-3 px-6 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all ${showAdvanced ? 'bg-[#4F46E5] text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Settings2 size={16} />
                                    {showAdvanced ? 'CLOSE SETTINGS' : 'ADVANCED SETTINGS'}
                                </button>

                                {showAdvanced && (
                                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-10 p-10 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl animate-in slide-in-from-top-6 duration-500">
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Template Name</label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-50 px-6 py-4 rounded-xl border border-slate-100 text-sm font-bold text-slate-900 shadow-inner"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">System Identifier (Email Type)</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        name="emailType"
                                                        value={formData.emailType}
                                                        onChange={handleChange}
                                                        disabled={isEditing}
                                                        className="w-full bg-slate-50 px-6 py-4 rounded-xl border border-slate-100 text-sm font-bold text-slate-900 shadow-inner disabled:opacity-50 font-mono"
                                                        required
                                                    />
                                                    <Database className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Description</label>
                                                <textarea
                                                    name="description"
                                                    value={formData.description}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-50 px-6 py-4 rounded-xl border border-slate-100 text-sm font-semibold text-slate-600 resize-none shadow-inner"
                                                    rows="5"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modern Footer Action Bar */}
                <div className="bg-white px-12 py-8 border-t border-slate-100 flex items-center justify-between flex-shrink-0 z-20 shadow-[0_-4px_30px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 italic">
                            <Info className="text-[#4F46E5]" size={20} />
                        </div>
                        <div className="max-w-xs text-[10px] font-semibold text-slate-400 leading-relaxed uppercase tracking-tight">
                            Templates are used to send automated emails to candidates.
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-10 py-5 rounded-[1.5rem] font-bold text-[11px] text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="h-16 px-12 bg-slate-900 text-white rounded-[1.75rem] font-bold text-[12px] shadow-2xl shadow-slate-900/30 hover:bg-[#4F46E5] hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.25em] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-4"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save size={20} strokeWidth={2.5} />
                            )}
                            {isEditing ? 'UPDATE TEMPLATE' : 'SAVE TEMPLATE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BGVEmailTemplateModal;
