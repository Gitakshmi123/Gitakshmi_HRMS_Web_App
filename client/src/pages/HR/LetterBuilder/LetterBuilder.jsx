import React, { useState, useEffect, useCallback } from 'react';
import {
    Save, ArrowLeft, Loader2, CheckCircle2, LayoutTemplate,
    Plus, Trash2, Copy, MoveUp, MoveDown, Layers, Settings2,
    Type, Image as ImageIcon, Minus, Square, Columns, Table as TableIcon,
    User, Building2, Wallet, CreditCard, FileText, ChevronRight,
    Undo2, Redo2, Monitor, Smartphone, Download, Eye
} from 'lucide-react';
import { Modal, Input, Dropdown, Button } from 'antd';
import { message } from '../../../utils/antdGlobal';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../utils/api';

import BuilderLayerPanel from './BuilderLayerPanel';
import BuilderPreview from './BuilderPreview';
import BuilderEditorPanel from './BuilderEditorPanel';
import ErrorBoundary from './ErrorBoundary';
import { DragDropContext } from '@hello-pangea/dnd';

export default function LetterBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id || id === 'new';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [tempName, setTempName] = useState('');
    const [previewMode, setPreviewMode] = useState("desktop");
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Preview Data
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [previewData, setPreviewData] = useState(null);

    // Core State
    const [config, setConfig] = useState({
        name: "New Letter Template",
        sections: [],
        styles: {
            backgroundColor: '#ffffff',
            fontFamily: 'Inter',
            fontSize: '12px',
            color: '#000000',
            padding: '40px'
        }
    });

    // Variable definitions for Letters
    const variables = [
        { label: 'Candidate Name', value: '{{candidate_name}}', cat: 'Candidate' },
        { label: 'Designation', value: '{{designation}}', cat: 'Position' },
        { label: 'Department', value: '{{department}}', cat: 'Position' },
        { label: 'Joining Date', value: '{{joining_date}}', cat: 'Position' },
        { label: 'CTC (Annual)', value: '{{ctc}}', cat: 'Financial' },
        { label: 'Monthly Gross', value: '{{monthly_gross}}', cat: 'Financial' },
        { label: 'Location', value: '{{location}}', cat: 'Position' },
        { label: 'Company Name', value: '{{company_name}}', cat: 'Company' },
        { label: 'HR Name', value: '{{hr_name}}', cat: 'Company' },
        { label: 'Expiry Date', value: '{{expiry_date}}', cat: 'Period' },
    ];

    useEffect(() => {
        const initBuilder = async () => {
            let companyInfo = {
                name: 'Your Company Name',
                address: '123 Business Avenue, Suite 500\nAhmedabad, Gujarat - 380015'
            };

            try {
                const tenantRes = await api.get('/tenants/me');
                if (tenantRes.data) {
                    companyInfo.name = tenantRes.data.name || companyInfo.name;
                    if (tenantRes.data.meta?.address) {
                        companyInfo.address = tenantRes.data.meta.address;
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch tenant info:', e);
            }

            if (!isNew) {
                await fetchTemplate();
            } else {
                const defaultConfig = {
                    name: "New Letter Template",
                    sections: [
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'company-header',
                            content: {
                                showLogo: true,
                                logoSize: '80px',
                                companyName: companyInfo.name,
                                companyNameSize: '24px',
                                showAddress: true,
                                companyAddress: companyInfo.address
                            },
                            styles: { paddingTop: '20px', paddingBottom: '20px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'text',
                            content: {
                                text: 'OFFER LETTER',
                                align: 'center',
                                size: '20px',
                                weight: 'bold'
                            },
                            styles: { paddingTop: '20px', paddingBottom: '20px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'text',
                            content: {
                                text: 'Dear {{candidate_name}},\n\nWe are pleased to offer you the position of {{designation}} at {{company_name}}. We were impressed with your background and believe you will be a valuable addition to our team.',
                                align: 'left',
                                size: '14px',
                                weight: 'normal'
                            },
                            styles: { paddingTop: '10px', paddingBottom: '10px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'employee-details-grid',
                            content: {
                                title: 'Offer Details',
                                columns: 2,
                                fields: [
                                    { label: 'Role', value: '{{designation}}' },
                                    { label: 'Department', value: '{{department}}' },
                                    { label: 'Joining Date', value: '{{joining_date}}' },
                                    { label: 'Annual CTC', value: '{{ctc}}' }
                                ]
                            },
                            styles: { paddingTop: '20px', paddingBottom: '20px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'document-footer',
                            content: { text: '-- Best Regards, {{hr_name}} --' },
                            styles: { paddingTop: '40px', paddingBottom: '10px' }
                        }
                    ],
                    styles: {
                        backgroundColor: '#ffffff',
                        fontFamily: 'Inter',
                        fontSize: '12px',
                        color: '#000000',
                        padding: '40px'
                    }
                };
                setConfig(defaultConfig);
                saveToHistory(defaultConfig);
                setLoading(false);
            }
        };

        initBuilder();
        fetchCandidatesForPreview();
    }, [id, isNew]);

    const fetchCandidatesForPreview = async () => {
        try {
            // Fetching applicants for preview
            const res = await api.get('/requirements/applicants?limit=10');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setCandidates(res.data.data);
                if (res.data.data.length > 0) {
                    const first = res.data.data[0];
                    setSelectedCandidate(first);
                    setPreviewData({
                        candidate_name: `${first.firstName} ${first.lastName}`,
                        designation: first.appliedPosition?.title || 'Software Engineer',
                        department: first.appliedPosition?.department?.name || 'Technology',
                        joining_date: 'To be decided',
                        ctc: '₹ 12,00,000',
                        company_name: 'Gitakshmi',
                        hr_name: 'HR Manager'
                    });
                }
            }
        } catch (err) {
            console.warn('Failed to fetch candidates:', err?.message);
        }
    };

    const fetchTemplate = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/letters/templates/${id}`);
            if (res.data) {
                const template = res.data;
                if (template.templateType === 'BUILDER' && template.builderConfig) {
                    setConfig(template.builderConfig);
                    saveToHistory(template.builderConfig);
                } else {
                    const fallbackConfig = {
                        name: template.name || 'Letter Template',
                        sections: [],
                        styles: { backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Inter', fontSize: '12px', color: '#000000' }
                    };
                    setConfig(fallbackConfig);
                    saveToHistory(fallbackConfig);
                }
            }
        } catch (err) {
            console.error('Template load error:', err);
            message.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const saveToHistory = (newConfig) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newConfig)));
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1];
            setConfig(JSON.parse(JSON.stringify(prev)));
            setHistoryIndex(historyIndex - 1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1];
            setConfig(JSON.parse(JSON.stringify(next)));
            setHistoryIndex(historyIndex + 1);
        }
    };

    const handleSave = async () => {
        if (isNew) {
            setTempName(config.name === 'New Letter Template' ? '' : config.name);
            setSaveModalOpen(true);
            return;
        }
        await performSave(config.name);
    };

    const performSave = async (finalName) => {
        setSaving(true);
        try {
            const updatedConfig = { ...config, name: finalName };
            setConfig(updatedConfig);
            const payload = {
                name: finalName,
                templateType: 'BUILDER',
                builderConfig: updatedConfig,
                bodyContent: "<!-- BUILDER_GENERATED -->",
                type: 'offer' // Default type
            };

            if (isNew) {
                const res = await api.post('/letters/templates', payload);
                if (res.data) {
                    message.success("Template created successfully");
                    navigate(`/hr/letter-builder/${res.data._id}`);
                }
            } else {
                await api.put(`/letters/templates/${id}`, payload);
                message.success("Template saved successfully");
            }
        } catch (error) {
            message.error("Failed to save template");
        } finally {
            setSaving(false);
            setSaveModalOpen(false);
        }
    };

    const addBlock = (type) => {
        const blkId = Math.random().toString(36).substr(2, 9);
        const newBlock = {
            id: blkId,
            type,
            content: getDefaultContent(type),
            styles: getDefaultStyles(type)
        };
        const newConfig = { ...config, sections: [...config.sections, newBlock] };
        setConfig(newConfig);
        setSelectedBlockId(blkId);
        saveToHistory(newConfig);
    };

    const updateBlock = (blkId, newBlockData) => {
        const newConfig = {
            ...config,
            sections: config.sections.map(s => s.id === blkId ? { ...s, ...newBlockData } : s)
        };
        setConfig(newConfig);
        saveToHistory(newConfig);
    };

    const removeBlock = (blkId) => {
        const newConfig = {
            ...config,
            sections: config.sections.filter(s => s.id !== blkId)
        };
        setConfig(newConfig);
        if (selectedBlockId === blkId) setSelectedBlockId(null);
        saveToHistory(newConfig);
    };

    const duplicateBlock = (blkId) => {
        const index = config.sections.findIndex(s => s.id === blkId);
        if (index === -1) return;
        const original = config.sections[index];
        const copy = {
            ...JSON.parse(JSON.stringify(original)),
            id: Math.random().toString(36).substr(2, 9)
        };
        const newSections = [...config.sections];
        newSections.splice(index + 1, 0, copy);
        const newConfig = { ...config, sections: newSections };
        setConfig(newConfig);
        setSelectedBlockId(copy.id);
        saveToHistory(newConfig);
    };

    const moveBlock = (blkId, direction) => {
        const index = config.sections.findIndex(s => s.id === blkId);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === config.sections.length - 1) return;

        const newSections = [...config.sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];

        const newConfig = { ...config, sections: newSections };
        setConfig(newConfig);
        saveToHistory(newConfig);
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const { source, destination } = result;

        if (source.droppableId === 'layers' && destination.droppableId === 'layers') {
            if (source.index === destination.index) return;

            const items = Array.from(config.sections);
            const [reorderedItem] = items.splice(source.index, 1);
            items.splice(destination.index, 0, reorderedItem);

            const newConfig = { ...config, sections: items };
            setConfig(newConfig);
            saveToHistory(newConfig);
        }
    };

    const getDefaultContent = (type) => {
        switch (type) {
            case 'text': return { text: 'Enter your text here...', align: 'left', size: '14px', weight: 'normal' };
            case 'divider': return { thickness: '1px', color: '#e5e7eb', style: 'solid' };
            case 'spacer': return { height: '20px' };
            case 'company-header': return {
                showLogo: true,
                logoAlign: 'left',
                logoSize: '80px',
                companyName: '',
                companyNameSize: '24px',
                showAddress: true,
                companyAddress: ''
            };
            case 'employee-details-grid': return {
                title: 'Candidate Summary',
                columns: 2,
                fields: [
                    { label: 'Name', value: '{{candidate_name}}' },
                    { label: 'Designation', value: '{{designation}}' },
                    { label: 'Department', value: '{{department}}' },
                    { label: 'Annual CTC', value: '{{ctc}}' }
                ]
            };
            case 'image': return { url: '', width: '200px', align: 'center' };
            case 'document-footer': return { text: '-- Regards, {{hr_name}} --' };
            default: return {};
        }
    };

    const getDefaultStyles = (type) => ({
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingLeft: '0px',
        paddingRight: '0px',
        marginTop: '0px',
        marginBottom: '0px',
    });

    const exportToPDF = () => {
        window.print();
    };

    return (
        <ErrorBoundary>
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans select-none print:bg-white">
                {/* Top Navbar */}
                <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-40 print:hidden shrink-0">
                    <div className="flex items-center gap-6">
                        <button onClick={() => navigate('/hr/offer-templates')} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100">Visual Builder 2.0</span>
                                <h1 className="text-lg font-bold text-slate-800 tracking-tight">{config.name}</h1>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Letter Design Studio • {isNew ? 'Drafting' : 'Synchronized'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
                            <button onClick={undo} disabled={historyIndex <= 0} className="p-2 text-slate-500 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-30 transition-all"><Undo2 size={18} /></button>
                            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 text-slate-500 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-30 transition-all"><Redo2 size={18} /></button>
                        </div>

                        <button onClick={exportToPDF} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                            <Download size={16} /> Export
                        </button>

                        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isNew ? 'Create Blueprint' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Layers & Components */}
                    <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-30 shadow-sm print:hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <BuilderLayerPanel
                                sections={config.sections}
                                selectedId={selectedBlockId}
                                onSelect={setSelectedBlockId}
                                onAdd={addBlock}
                                onRemove={removeBlock}
                                onMove={moveBlock}
                                onDuplicate={duplicateBlock}
                            />
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 relative flex flex-col items-center bg-[#F8FAFC] print:bg-white overflow-y-auto p-12 custom-scrollbar">
                        {/* Device Toggle */}
                        <div className="mb-8 flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 shrink-0 print:hidden">
                            <button onClick={() => setPreviewMode('desktop')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === 'desktop' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>A4 Paper</button>
                            <button onClick={() => setPreviewMode('mobile')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === 'mobile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Digital Preview</button>
                        </div>

                        {/* Paper Sheet */}
                        <div className={`
                            bg-white shadow-2xl transition-all duration-500 origin-top border border-slate-200
                            ${previewMode === 'desktop' ? 'w-[210mm] min-h-[297mm]' : 'w-[400px] min-h-[600px] rounded-3xl p-4'}
                            print:shadow-none print:border-none print:w-full print:m-0 print:p-0
                        `}>
                            <BuilderPreview
                                config={config}
                                selectedBlockId={selectedBlockId}
                                onSelectBlock={setSelectedBlockId}
                                isBuilder={true}
                                previewMode={previewMode}
                                previewData={previewData}
                            />
                        </div>

                        <div className="h-20 shrink-0 print:hidden"></div>
                    </div>

                    {/* Right Panel: Property Editor */}
                    <div className="w-96 bg-white border-l border-slate-200 shrink-0 z-30 shadow-sm overflow-y-auto custom-scrollbar print:hidden">
                        <BuilderEditorPanel
                            selectedBlock={config.sections.find(s => s.id === selectedBlockId)}
                            onUpdate={(data) => updateBlock(selectedBlockId, data)}
                            globalStyles={config.styles}
                            onUpdateGlobalStyles={(s) => {
                                const newConfig = { ...config, styles: s };
                                setConfig(newConfig);
                                saveToHistory(newConfig);
                            }}
                            variables={variables}
                        />
                    </div>
                </div>

                {/* Save Modal */}
                <Modal
                    title={<span className="text-lg font-bold text-slate-800">Finalize Template Blueprint</span>}
                    open={saveModalOpen}
                    onCancel={() => setSaveModalOpen(false)}
                    onOk={() => performSave(tempName)}
                    okText="Initialize Blueprint"
                    okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700' }}
                    centered
                >
                    <div className="py-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Template Identity</label>
                        <Input
                            placeholder="e.g. Standard Offer Letter 2024"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="h-12 rounded-xl text-lg font-bold"
                            autoFocus
                        />
                        <p className="mt-4 text-xs text-slate-500 leading-relaxed italic">
                            This blueprint will be saved as a Visual Builder 2.0 template. You can link it to hiring pipelines for automated document generation.
                        </p>
                    </div>
                </Modal>
            </div>
            </DragDropContext>
        </ErrorBoundary>
    );
}
