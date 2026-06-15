import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Plus, Edit2, Trash2, Copy, ArrowLeft, FileImage, FileText, X, File, Upload, Settings, Eye, Palette, Download } from 'lucide-react';
import { Modal } from 'antd';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import OfferLetterEditor from '../../components/editor/OfferLetterEditor';

import usePagePermissions from '../../hooks/usePagePermissions';

const normalizeVariableKey = (value) => String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const humanizeVariableKey = (value) => {
    const key = normalizeVariableKey(value);
    if (!key) return 'Custom Field';
    return key.split('_').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const createBlankCustomField = () => ({
    id: Math.random().toString(36).substr(2, 9),
    key: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: ''
});

export default function LetterTemplates() {
    const navigate = useNavigate();
    const { canCreate, canEdit, canDelete } = usePagePermissions('hiring.offerTemplates');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showTemplateTypeModal, setShowTemplateTypeModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [activeTab, setActiveTab] = useState('offer');
    const [selectedTemplateType, setSelectedTemplateType] = useState(null);

    // Editor State
    const [currentTemplate, setCurrentTemplate] = useState({
        name: '',
        type: 'offer',
        templateType: 'BLANK',
        bodyContent: '',
        headerContent: '',
        footerContent: '',
        headerHeight: 40,
        footerHeight: 30,
        hasHeader: true,
        hasFooter: true,
        contentJson: {},
        pageLayout: {
            orientation: 'portrait',
            margins: { top: 25, bottom: 25, left: 25, right: 25 }
        },
        isDefault: false,
        isActive: true
    });
    const [isEditing, setIsEditing] = useState(false);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [hasLetterPad, setHasLetterPad] = useState(false);

    // Upload Modal State
    const [uploadForm, setUploadForm] = useState({
        name: '',
        version: 'v1.0',
        status: 'Active',
        file: null,
        customFields: []
    });

    async function fetchCompanyProfile() {
        try {
            const res = await api.get('/letters/company-profile');
            setCompanyProfile(res.data);
            const letterPadUrl = res.data?.branding?.letterheadBg || '';
            setHasLetterPad(!!letterPadUrl);
        } catch (error) {
            console.error('Failed to fetch company profile', error);
            setHasLetterPad(false);
        }
    }

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/letters/templates?type=${activeTab}`);
            setTemplates(res.data);
        } catch (error) {
            console.error('Failed to fetch templates', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchTemplates();
        fetchCompanyProfile();
    }, [activeTab, fetchTemplates]);

    const handleEdit = (tpl) => {
        if (tpl.templateType === 'WORD') {
            // For WORD templates, open upload modal to replace the template
            setUploadForm({
                name: tpl.name,
                version: tpl.version || 'v1.0',
                status: tpl.status || 'Active',
                file: null,
                customFields: (tpl.customFields || []).map(f => ({ ...f, id: f.id || Math.random().toString(36).substr(2, 9) }))
            });
            setCurrentTemplate({ ...tpl }); // Store template ID for update
            setIsEditing(true); // Mark as editing mode
            setShowUploadModal(true);
            return;
        }
        if (tpl.templateType === 'BUILDER') {
            navigate(`/hr/letter-builder/${tpl._id}`);
            return;
        }
        setCurrentTemplate({
            ...tpl,
            templateType: tpl.templateType || 'BLANK',
            contentJson: tpl.contentJson || {},
            headerContent: tpl.headerContent || '',
            footerContent: tpl.footerContent || '',
            headerHeight: tpl.headerHeight || 40,
            footerHeight: tpl.footerHeight || 30,
            hasHeader: tpl.hasHeader !== false,
            hasFooter: tpl.hasFooter !== false,
            pageLayout: tpl.pageLayout || {
                orientation: 'portrait',
                margins: { top: 45, bottom: 40, left: 30, right: 25 }
            }
        });
        setIsEditing(true);
        setShowEditor(true);
    };

    const handleCreate = () => {
        setSelectedTemplateType(null);
        setShowTemplateTypeModal(true);
    };

    const handleTemplateTypeSelect = (type) => {
        console.log('Template type selected:', type);
        setSelectedTemplateType(type);
    };

    const handleContinueToEditor = () => {
        if (!selectedTemplateType) {
            showToast('error', 'Error', 'Please select a template type');
            return;
        }

        if (selectedTemplateType === 'WORD') {
            setShowTemplateTypeModal(false);
            setShowUploadModal(true);
            return;
        }

        if (activeTab !== 'offer') {
            showToast('warning', 'Warning', 'Editor templates are only available for Offer Letters.');
            return;
        }

        if (selectedTemplateType === 'LETTER_PAD' && !hasLetterPad) {
            showConfirmToast({
                title: 'No Letter Pad Found',
                description: 'No letter pad image found. The template will be created but will show a blank page until you upload a letter pad. Continue?',
                okText: 'Continue',
                cancelText: 'Cancel',
                onConfirm: () => {
                    proceedWithCreation();
                }
            });
            return;
        }

        proceedWithCreation();
    };

    const proceedWithCreation = () => {

        if (selectedTemplateType === 'BUILDER') {
            navigate('/hr/letter-builder/new');
            return;
        }

        setCurrentTemplate({
            name: '',
            type: activeTab,
            templateType: selectedTemplateType,
            bodyContent: '<p>Dear {{candidate_name}},</p><p>We are pleased to offer you the position of <strong>{{designation}}</strong>...</p>',
            headerContent: '',
            footerContent: '',
            headerHeight: 40,
            footerHeight: 30,
            hasHeader: true,
            hasFooter: true,
            contentJson: {},
            pageLayout: {
                orientation: 'portrait',
                margins: { top: 45, bottom: 40, left: 30, right: 25 }
            },
            isDefault: false,
            isActive: true
        });
        setIsEditing(false);
        setShowTemplateTypeModal(false);
        setShowEditor(true);
    };

    const handleUploadTemplate = async () => {
        if (!uploadForm.name || !uploadForm.file) {
            showToast('error', 'Error', 'Please fill all fields and select a file');
            return;
        }

        const formData = new FormData();
        formData.append('wordFile', uploadForm.file);
        formData.append('name', uploadForm.name);
        formData.append('version', uploadForm.version);
        formData.append('status', uploadForm.status);
        formData.append('type', activeTab); // Send the current tab type (offer or joining)
        formData.append('isDefault', currentTemplate?.isDefault ? 'true' : 'false');
        formData.append('customFields', JSON.stringify(
            (uploadForm.customFields || [])
                .map(field => ({
                    ...field,
                    key: normalizeVariableKey(field.key || field.label),
                    label: field.label || humanizeVariableKey(field.key)
                }))
                .filter(field => field.key && field.label)
        ));

        try {
            setLoading(true);

            if (isEditing && currentTemplate._id && currentTemplate.templateType === 'WORD') {
                // Delete old template and create new one (WORD templates are replaced, not updated)
                await api.delete(`/letters/templates/${currentTemplate._id}`);
            }

            const uploadRes = await api.post('/letters/upload-word-template', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const detectedCount = uploadRes.data?.detectedVariables?.length || uploadRes.data?.placeholders?.length || 0;
            showToast('success', 'Success', `${isEditing ? 'Word template updated' : 'Word template uploaded'} successfully. ${detectedCount} variables detected.`);
            setShowUploadModal(false);
            setUploadForm({ name: '', version: 'v1.0', status: 'Active', file: null, customFields: [] });
            setIsEditing(false);
            setCurrentTemplate({
                name: '',
                type: 'offer',
                templateType: 'BLANK',
                bodyContent: '',
                headerContent: '',
                footerContent: '',
                headerHeight: 40,
                footerHeight: 30,
                hasHeader: true,
                hasFooter: true,
                contentJson: {},
                pageLayout: {
                    orientation: 'portrait',
                    margins: { top: 25, bottom: 25, left: 25, right: 25 }
                },
                isDefault: false,
                isActive: true
            });
            fetchTemplates();
        } catch (error) {
            console.error('Upload error:', error);
            showToast('error', 'Error', 'Failed to upload template: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const addUploadCustomField = () => {
        setUploadForm(prev => ({
            ...prev,
            customFields: [...(prev.customFields || []), createBlankCustomField()]
        }));
    };

    const updateUploadCustomField = (index, patch) => {
        setUploadForm(prev => ({
            ...prev,
            customFields: (prev.customFields || []).map((field, idx) => {
                if (idx !== index) return field;
                const next = { ...field, ...patch };
                if (Object.prototype.hasOwnProperty.call(patch, 'label')) {
                    next.key = normalizeVariableKey(patch.label);
                }
                next.required = true; // Always required as requested
                return next;
            })
        }));
    };

    const removeUploadCustomField = (index) => {
        setUploadForm(prev => ({
            ...prev,
            customFields: (prev.customFields || []).filter((_, idx) => idx !== index)
        }));
    };

    const handleDuplicate = async (template) => {
        if (template.templateType === 'WORD') {
            showToast('warning', 'Warning', 'Cannot duplicate Word templates. Please upload the file again.');
            return;
        }
        try {
            const duplicate = {
                ...template,
                name: `${template.name} (Copy)`,
                isDefault: false,
                _id: undefined
            };
            delete duplicate._id;
            delete duplicate.createdAt;
            delete duplicate.updatedAt;

            await api.post('/letters/templates', duplicate);
            fetchTemplates();
            showToast('success', 'Success', 'Template duplicated successfully');
        } catch (error) {
            console.error(error);
            showToast('error', 'Error', 'Failed to duplicate template');
        }
    };

    const handlePreviewPDF = async (template) => {
        // Navigate to the preview page
        navigate(`/hr/letter-templates/${template._id}/preview`);
    };

    const handleDownloadPDF = async (template) => {
        try {
            const response = await api.get(`/letters/templates/${template._id}/download-pdf`, {
                responseType: 'blob'
            });

            // Create download link
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${template.name}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download PDF error:', error);
            showToast('error', 'Error', 'Failed to download PDF: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDownloadWordTemplate = async (template) => {
        try {
            const response = await api.get(`/letters/templates/${template._id}/download-word`, {
                responseType: 'blob'
            });

            // Create download link
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${template.name || 'template'}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download Word template error:', error);
            showToast('error', 'Error', 'Failed to download Word template: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDelete = async (template) => {
        showConfirmToast({
            title: 'Delete Template',
            description: `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/letters/templates/${template._id}`);
                    fetchTemplates();
                    showToast('success', 'Success', 'Template deleted successfully');
                } catch (error) {
                    console.error('Failed to delete template', error);
                    showToast('error', 'Error', 'Failed to delete template: ' + (error.response?.data?.message || error.message));
                }
            }
        });
    };

    // --- RENDERERS ---

    if (showTemplateTypeModal) {
        return (
            <div
                className="fixed inset-0 bg-black/60 overflow-y-auto flex items-center justify-center z-50 p-4"
                onClick={() => setShowTemplateTypeModal(false)}
            >
                <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-auto p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Select Template Type</h2>
                        <button onClick={() => setShowTemplateTypeModal(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
                            <X size={20} />
                        </button>
                    </div>

                    <p className="text-sm text-slate-600 mb-6">
                        {activeTab === 'offer' ? 'Choose offer letter design or upload Word template.' : 'Upload Word template for joining letters.'}
                    </p>

                    <div className="space-y-3 mb-6">
                        {/* Letter Pad */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTemplateTypeSelect('LETTER_PAD');
                            }}
                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${selectedTemplateType === 'LETTER_PAD' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                            disabled={activeTab === 'joining'}
                        >
                            <div className="flex items-start gap-3">
                                <FileImage size={24} className={selectedTemplateType === 'LETTER_PAD' ? 'text-blue-600' : 'text-slate-400'} />
                                <div>
                                    <h3 className="font-semibold text-slate-800">Use Letter Pad</h3>
                                    <p className="text-xs text-slate-500">Overlay content on your letterhead image.</p>
                                </div>
                            </div>
                        </button>

                        {/* Blank Page */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTemplateTypeSelect('BLANK');
                            }}
                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${selectedTemplateType === 'BLANK' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                            disabled={activeTab === 'joining'}
                        >
                            <div className="flex items-start gap-3">
                                <FileText size={24} className={selectedTemplateType === 'BLANK' ? 'text-blue-600' : 'text-slate-400'} />
                                <div>
                                    <h3 className="font-semibold text-slate-800">Blank Page</h3>
                                    <p className="text-xs text-slate-500">Start with a plain white page.</p>
                                </div>
                            </div>
                        </button>

                        {/* Word Template */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTemplateTypeSelect('WORD');
                            }}
                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${selectedTemplateType === 'WORD' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-start gap-3">
                                <File size={24} className={selectedTemplateType === 'WORD' ? 'text-blue-600' : 'text-slate-400'} />
                                <div>
                                    <h3 className="font-semibold text-slate-800">Word Template (.docx)</h3>
                                    <p className="text-xs text-slate-500">Upload your own Word document template.</p>
                                </div>
                            </div>
                        </button>

                        {/* Visual Builder 2.0 */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTemplateTypeSelect('BUILDER');
                            }}
                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${selectedTemplateType === 'BUILDER' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-start gap-3">
                                <Palette size={24} className={selectedTemplateType === 'BUILDER' ? 'text-blue-600' : 'text-slate-400'} />
                                <div>
                                    <h3 className="font-semibold text-slate-800">Visual Builder 2.0</h3>
                                    <p className="text-xs text-slate-500">Premium drag-and-drop designer with live logic preview.</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowTemplateTypeModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={handleContinueToEditor} disabled={!selectedTemplateType} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Continue</button>
                    </div>
                </div>
            </div>
        );
    }

    if (showUploadModal) {
        return (
            <div className="fixed inset-0 bg-black/60 overflow-y-auto flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-auto p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800">{isEditing ? 'Update Word Template' : 'Upload Word Template'}</h2>
                        <button onClick={() => {
                            setShowUploadModal(false);
                            setIsEditing(false);
                            setUploadForm({ name: '', version: 'v1.0', status: 'Active', file: null, customFields: [] });
                            setCurrentTemplate({
                                name: '',
                                type: 'offer',
                                templateType: 'BLANK',
                                bodyContent: '',
                                headerContent: '',
                                footerContent: '',
                                headerHeight: 40,
                                footerHeight: 30,
                                hasHeader: true,
                                hasFooter: true,
                                contentJson: {},
                                pageLayout: {
                                    orientation: 'portrait',
                                    margins: { top: 25, bottom: 25, left: 25, right: 25 }
                                },
                                isDefault: false,
                                isActive: true
                            });
                        }} className="text-slate-500 hover:text-slate-700">✕</button>
                    </div>
                    {isEditing && (
                        <div className="mb-4 space-y-2 z-index-999">
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                Upload a new Word file to replace the existing template. The old template will be deleted.
                            </div>
                            {currentTemplate?._id && (
                                <button
                                    onClick={() => handleDownloadWordTemplate(currentTemplate)}
                                    className="w-full px-4 py-2 text-sm border border-blue-300 text-blue-600 bg-white rounded-lg hover:bg-blue-50 flex items-center justify-center gap-2"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7,10 12,15 17,10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download Current Template (.docx) to Edit
                                </button>
                            )}
                        </div>
                    )}
                    <div className="space-y-4 mb-6">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input value={uploadForm.name} onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Template Name" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
                                <input type="file" accept=".docx" onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })} className="w-full px-3 py-2 border rounded-lg" />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                                <input value={uploadForm.version} onChange={e => setUploadForm({ ...uploadForm, version: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select value={uploadForm.status} onChange={e => setUploadForm({ ...uploadForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">Custom Variables</div>
                                    </div>
                                <button
                                    type="button"
                                    onClick={addUploadCustomField}
                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                                >
                                    <Plus size={14} /> Add
                                </button>
                            </div>
                            {(uploadForm.customFields || []).length === 0 ? (
                                <button
                                    type="button"
                                    onClick={addUploadCustomField}
                                    className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-bold text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                                >
                                    Add field like Contact Number, Email Address, Reporting Manager
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    {(uploadForm.customFields || []).map((field, index) => (
                                        <div key={field.id || `field-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-[2]">
                                                    <input
                                                        value={field.label || ''}
                                                        onChange={e => updateUploadCustomField(index, { label: e.target.value })}
                                                        className="w-full rounded-lg border px-3 py-2 text-sm"
                                                        placeholder="Field Label"
                                                        required
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <select
                                                        value={field.type || 'text'}
                                                        onChange={e => updateUploadCustomField(index, { type: e.target.value })}
                                                        className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="textarea">Long Text</option>
                                                        <option value="date">Date</option>
                                                        <option value="number">Number</option>
                                                        <option value="email">Email</option>
                                                        <option value="phone">Phone</option>
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeUploadCustomField(index)}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                                                    aria-label="Remove custom variable"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowUploadModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                        <button onClick={handleUploadTemplate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Upload</button>
                    </div>
                </div>
            </div>
        );
    }

    if (showEditor) {
        return (
            <div className="h-full flex flex-col bg-white">
                <div className="border-b px-6 py-4 flex justify-between items-center bg-white z-20 shadow-sm">
                    <div className="flex items-center gap-4 flex-1">
                        <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{isEditing ? 'Edit Template' : 'New Template'}</h2>
                        </div>
                        <input
                            type="text"
                            value={currentTemplate.name}
                            onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                            className="flex-1 max-w-md ml-4 p-2 bg-slate-50 border rounded"
                            placeholder="Template Name..."
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-600">
                            <input
                                type="checkbox"
                                checked={currentTemplate.requiresApproval}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, requiresApproval: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded-lg"
                            />
                            Requires Approval
                        </label>
                        <label className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-600">
                            <input
                                type="checkbox"
                                checked={currentTemplate.isDefault}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, isDefault: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded-lg"
                            />
                            Set as Default
                        </label>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden bg-slate-100/50">
                    <div className="flex-1 bg-slate-100 relative overflow-auto p-4 flex justify-center">
                        <OfferLetterEditor
                            initialContent={currentTemplate.bodyContent}
                            initialHeader={currentTemplate.headerContent}
                            initialFooter={currentTemplate.footerContent}
                            initialHeaderHeight={currentTemplate.headerHeight}
                            initialFooterHeight={currentTemplate.footerHeight}
                            initialHasHeader={currentTemplate.hasHeader}
                            initialHasFooter={currentTemplate.hasFooter}
                            templateType={currentTemplate.templateType}
                            backgroundUrl={companyProfile?.branding?.letterheadBg}
                            companyProfile={companyProfile}
                            onSave={(data) => {
                                const finalTemplate = {
                                    ...currentTemplate,
                                    bodyContent: data.body,
                                    headerContent: data.header,
                                    footerContent: data.footer,
                                    headerHeight: data.headerHeight,
                                    footerHeight: data.footerHeight,
                                    hasHeader: data.hasHeader,
                                    hasFooter: data.hasFooter
                                };

                                if (!finalTemplate.name) {
                                    showToast('error', 'Error', "Please enter a template name.");
                                    return;
                                }

                                const promise = isEditing
                                    ? api.put(`/letters/templates/${currentTemplate._id}`, finalTemplate)
                                    : api.post('/letters/templates', finalTemplate);

                                promise.then(() => {
                                    showToast('success', 'Success', 'Template saved successfully');
                                    setShowEditor(false);
                                    fetchTemplates();
                                }).catch(err => {
                                    console.error(err);
                                    showToast('error', 'Error', 'Failed to save template');
                                });
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full mx-auto p-4 sm:p-5 lg:p-6 animate-in fade-in duration-500 bg-slate-50/50">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex gap-2 p-1.5 bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto custom-scrollbar whitespace-nowrap w-fit">
                    {[
                        { id: 'offer', label: 'OFF. OFFERS' },
                        { id: 'joining', label: 'JOINING' },
                        { id: 'probation_confirmation', label: 'PROBATION' },
                        { id: 'promotion', label: 'PROMOTION' },
                        { id: 'salary_revision', label: 'SALARY REV.' },
                        { id: 'exp_rel', label: 'EXP & REL' },
                        { id: 'warning', label: 'DISCIPLINARY' },
                        { id: 'other', label: 'OTHER/GEN' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.12em] transition-all ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {canCreate && (
                    <button
                        onClick={handleCreate}
                        className="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#0D9488] text-white rounded-xl font-bold text-xs uppercase tracking-[0.16em] transition-all flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 whitespace-nowrap"
                    >
                        {activeTab === 'joining' ? <Upload size={18} /> : <Plus size={18} />}
                        {activeTab === 'joining' ? 'Upload Word Doc' : 'Create Template'}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="py-14 text-center bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Blueprints...</span>
                    </div>
                </div>
            ) : templates.length === 0 ? (
                <div className="py-14 px-8 text-center bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center gap-4">
                    <div className="p-6 bg-slate-50 rounded-3xl">
                        <FileText className="text-slate-200" size={60} />
                    </div>
                    <div className="font-bold text-slate-400 uppercase tracking-widest text-sm">No operational blueprints</div>
                    <p className="text-slate-400 text-xs italic">Initialize a NEW TEMPLATE to begin standardizing communication</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(templates || []).map((tpl, idx) => (
                        <div key={tpl._id?.toString() || idx} className="group bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                                <FileText size={100} />
                            </div>

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-slate-800 text-[16px] tracking-tight truncate max-w-[180px] group-hover:text-indigo-600 transition-colors">{tpl.name}</h3>
                                    <div className="flex gap-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${tpl.isDefault ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                            {tpl.isDefault ? 'Default' : 'Regular'}
                                        </span>
                                        <span className="px-2.5 py-1 bg-violet-50 text-violet-600 border border-violet-100 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                                            {tpl.templateType === 'WORD' ? 'DOCX' : 'HTML'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl">
                                    {tpl.templateType === 'WORD' && (
                                        <button onClick={() => handlePreviewPDF(tpl)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Preview PDF">
                                            <Eye size={16} />
                                        </button>
                                    )}
                                    {tpl.templateType === 'WORD' && (
                                        <button onClick={() => handleDownloadPDF(tpl)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Download PDF">
                                            <Download size={16} />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => handleEdit(tpl)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => handleDuplicate(tpl)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all" title="Duplicate">
                                            <Copy size={16} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => handleDelete(tpl)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all" title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-[1.5rem] h-40 flex items-center justify-center mb-6 border border-slate-100 overflow-hidden relative group-hover:border-indigo-100 transition-colors">
                                {tpl.templateType === 'WORD' ? (
                                    <div className="text-center group-hover:scale-110 transition-transform">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-200">
                                            <FileText size={24} className="text-[#4F46E5]" />
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Blueprint Core</div>
                                        {tpl.placeholders && (
                                            <div className="text-[9px] text-[#4F46E5] font-bold mt-1 uppercase tracking-tight opacity-70">
                                                {tpl.placeholders.length} Logic Gates
                                            </div>
                                        )}
                                        {tpl.customFields?.length > 0 && (
                                            <div className="text-[9px] text-emerald-600 font-bold mt-1 uppercase tracking-tight opacity-80">
                                                {tpl.customFields.length} Custom Fields
                                            </div>
                                        )}
                                        {(tpl.detectedVariables || tpl.placeholders || []).length > 0 && (
                                            <div className="mt-3 w-44 rounded-lg border border-slate-200 bg-white px-2 py-1 text-left shadow-sm">
                                                <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">Detected Variables</div>
                                                <div className="max-h-12 space-y-0.5 overflow-y-auto font-mono text-[9px] font-semibold text-slate-600">
                                                    {(tpl.detectedVariables || tpl.placeholders || []).slice(0, 5).map((variable) => (
                                                        <div key={variable} className="truncate">{variable}</div>
                                                    ))}
                                                    {(tpl.detectedVariables || tpl.placeholders || []).length > 5 && (
                                                        <div className="text-indigo-500">+{(tpl.detectedVariables || tpl.placeholders || []).length - 5} more</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full h-full p-4 opacity-40 text-[6px] overflow-hidden pointer-events-none select-none bg-white scale-75 origin-top">
                                        <div dangerouslySetInnerHTML={{ __html: tpl.bodyContent }} />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                                <div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Synchronized</div>
                                    <div className="text-[11px] font-semibold text-slate-700">{new Date(tpl.createdAt).toLocaleDateString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-0.5">Identifier</div>
                                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">#{String(tpl._id || '').slice(-6)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
