import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import ApplyPreview from './ApplyPreview';
import ApplyEditorPanel from './ApplyEditorPanel';
import ApplyLayerPanel from './ApplyLayerPanel';
import api from '../../../utils/api';
import { message } from '../../../utils/antdGlobal';
import usePagePermissions from '../../../hooks/usePagePermissions';

export default function ApplyPageBuilder() {
    const { canView, canCreate, canEdit, canDelete, loading: permissionLoading } = usePagePermissions('portals.applyPage');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        sections: [],
        banner: { title: "Join Our Team", subtitle: "We are looking for talented individuals to join our journey.", bgType: "gradient", bgColor: "from-indigo-600 via-purple-600 to-pink-500" },
        theme: { primaryColor: '#4F46E5' }
    });
    const [selectedSectionId, setSelectedSectionId] = useState(null);
    const [previewMode, setPreviewMode] = useState("desktop");
    const canAccess = canView || canCreate || canEdit || canDelete;
    const canPersist = canCreate || canEdit || canDelete;

    useEffect(() => {
        if (permissionLoading || !canAccess) {
            setLoading(false);
            return;
        }
        fetchConfig();
    }, [permissionLoading, canAccess]);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/hr/career/apply/customize');
            // We assume the backend stores a generic JSON. 
            // We'll look for `applyPageConfig` within it, or if it's not structured, we might have to improvise.
            // Requirement says "Copy ALL UI patterns".
            // Since we must use the SAME endpoint, we'll try to store this in a property inside the main customization object
            // OR checks if the backend returns the whole object.
            // If the backend returns { sections: [...] } for Career Page, we need to be careful not to overwrite it.
            // Let's assume the response is the whole object.

            if (res.data) {
                // Check if we have apply page config. If not, use defaults.
                // We'll save it under a key 'applyPage' if possible, but if the root object IS the career config, 
                // we might need to nest them. 
                // For now, let's assume we can merge it. 
                // However, to avoid breaking Career Builder, let's try to see if we can use a separate key.
                // If the previous Career Builder reads `res.data.sections`, we should keep that.
                // We will add `res.data.applySections`.

                const currentConfig = res.data;
                const applyConfig = currentConfig.applyPage || getDefaultConfig();

                setConfig({
                    ...applyConfig,
                    banner: applyConfig.banner || getDefaultConfig().banner,
                    _fullConfig: currentConfig
                });

                if (applyConfig.sections?.length > 0) {
                    setSelectedSectionId(applyConfig.sections[0].id);
                }
            } else {
                const defaults = getDefaultConfig();
                setConfig(defaults);
                setSelectedSectionId(defaults.sections[0].id);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            message.error("Failed to load configuration");
            // Fallback to default
            const defaults = getDefaultConfig();
            setConfig(defaults);
            setSelectedSectionId(defaults.sections[0].id);
        } finally {
            setLoading(false);
        }
    };

    const getDefaultConfig = () => ({
        theme: { primaryColor: '#4F46E5' },
        banner: {
            title: "Join Our Team",
            subtitle: "We are looking for talented individuals to join our journey.",
            bgType: "gradient",
            bgColor: "from-indigo-600 via-purple-600 to-pink-500"
        },
        sections: [
            {
                id: 'personal_details',
                type: 'group',
                title: "Personal Details",
                fixed: true, // Cannot delete core groups
                fields: [
                    { id: 'name', label: "Full Name", type: "text", required: true, width: "full", placeholder: "e.g. John Doe" },
                    { id: 'fatherName', label: "Father's Full Name", type: "text", required: true, width: "half", placeholder: "e.g. Sr. John Doe" },
                    { id: 'email', label: "Email Address", type: "email", required: true, width: "half", placeholder: "john@example.com" },
                    { id: 'mobile', label: "Mobile Number", type: "tel", required: true, width: "half", placeholder: "+91 98765 43210" },
                    { id: 'dob', label: "Date of Birth", type: "date", required: true, width: "half" },
                    { id: 'gender', label: "Gender", type: "select", options: ["Male", "Female", "Other"], required: false, width: "third" },
                ]
            },
            {
                id: 'address',
                type: 'group',
                title: "Address",
                fields: [
                    { id: 'address', label: "Full Address", type: "textarea", required: true, width: "full", placeholder: "Street, City, State, Zip" },
                    { id: 'location', label: "Current City", type: "text", required: true, width: "half", placeholder: "Ahmedabad, Gujarat" }
                ]
            },
            {
                id: 'professional_details',
                type: 'group',
                title: "Professional Details",
                fields: [
                    { id: 'experience', label: "Total Experience", type: "text", required: true, width: "half", placeholder: "e.g. 2 Years" },
                    { id: 'currentCompany', label: "Current Company", type: "text", required: false, width: "half", placeholder: "e.g. Tech Corp" },
                    { id: 'currentDesignation', label: "Current Designation", type: "text", required: false, width: "half", placeholder: "e.g. Developer" },
                    { id: 'expectedCTC', label: "Expected CTC", type: "text", required: true, width: "half", placeholder: "e.g. 5 LPA" },
                    { id: 'linkedin', label: "LinkedIn URL", type: "url", required: false, width: "half", placeholder: "https://linkedin.com/in/..." }
                ]
            },
            {
                id: 'resume_section',
                type: 'group',
                title: "Resume & Portfolio",
                fields: [
                    { id: 'resume', label: "Upload Resume", type: "file", required: true, width: "full", helpText: "PDF, DOCX up to 5MB" },
                    { id: 'portfolio', label: "Portfolio URL", type: "url", required: false, width: "full" },
                ]
            }
        ]
    });

    const handleSave = async () => {
        if (!canPersist) return;
        try {
            setSaving(true);

            // Sanitize field IDs to ensure no empty IDs are saved
            const sanitizedSections = config.sections.map(section => {
                if (section.fields) {
                    const fields = section.fields.map((field, idx) => {
                        if (!field.id || field.id.trim() === '') {
                            const normalizedId = field.label
                                ? field.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
                                : `field_${section.id}_${idx + 1}`;
                            return { ...field, id: normalizedId || `field_${section.id}_${idx + 1}` };
                        }
                        return field;
                    });
                    return { ...section, fields };
                }
                return section;
            });

            // We need to merge with existing career config to not lose it
            const fullPayload = {
                ...config._fullConfig, // Preserve existing Career/SEO data
                applyPage: {
                    sections: sanitizedSections,
                    banner: config.banner,
                    theme: config.theme
                }
            };


            // Clean internal helpers before sending to API
            delete fullPayload._fullConfig;

            await api.post('/hr/career/apply/publish', fullPayload);
            await api.post('/hr/career/apply/customize', fullPayload);

            message.success("Apply Page published successfully!");

            // Update internal state to match newly published config
            const nextConfig = {
                ...config,
                _fullConfig: {
                    ...fullPayload
                }
            };
            setConfig(nextConfig);

        } catch (error) {
            console.error("Save error:", error);
            message.error("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const addSection = () => {
        const newSection = {
            id: `section_${Date.now()}`,
            type: 'group',
            title: "New Section",
            fields: []
        };
        setConfig(prev => ({
            ...prev,
            sections: [...prev.sections, newSection]
        }));
        setSelectedSectionId(newSection.id);
    };

    const updateSection = (id, updates) => {
        if (id === 'hero') {
            setConfig(prev => ({
                ...prev,
                banner: { ...prev.banner, ...updates }
            }));
            return;
        }
        setConfig(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
    };

    const removeSection = (id) => {
        setConfig(prev => ({
            ...prev,
            sections: prev.sections.filter(s => s.id !== id)
        }));
        if (selectedSectionId === id) setSelectedSectionId(null);
    };

    const reorderSections = (fromIndex, toIndex) => {
        const newSections = [...config.sections];
        const [movedItem] = newSections.splice(fromIndex, 1);
        newSections.splice(toIndex, 0, movedItem);
        setConfig(prev => ({ ...prev, sections: newSections }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Builder...</p>
            </div>
        );
    }

    if (!canAccess) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-white">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
                    <h2 className="text-lg font-black text-slate-900">No Portal Access</h2>
                    <p className="mt-2 text-sm text-slate-500">Apply Page mate koi action enable nathi.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100 overflow-hidden font-sans">
            {/* Top Toolbar */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-40 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 tracking-tight">Apply Page Builder</h1>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Editing Application Form
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-medium mr-2">Changes auto-saved locally</span>
                    {canPersist && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg font-bold shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-sm"
                        >
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                            Publish Live
                        </button>
                    )}
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex flex-1 overflow-hidden">

                {/* LEFT: Navigation / Layers */}
                <ApplyLayerPanel
                    sections={config.sections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    onReorder={reorderSections}
                    onRemoveSection={removeSection}
                    onAddSection={addSection}
                    canCreate={canCreate}
                    canReorder={canEdit}
                    canDelete={canDelete}
                />

                {/* CENTER: Canvas / Preview */}
                <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col items-center">
                    <style>{`
                        .mobile-preview {
                            width: 390px;
                            height: 844px;
                            margin: 20px auto;
                            border: 12px solid #1a1a1a;
                            border-radius: 40px;
                            box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                            overflow-y: auto;
                            overflow-x: hidden;
                            background: white;
                            position: relative;
                            scrollbar-width: none;
                        }
                        .mobile-preview::-webkit-scrollbar {
                            display: none;
                        }
                        .mobile-preview::before {
                            content: '';
                            position: sticky;
                            top: 0;
                            left: 50%;
                            transform: translateX(-50%);
                            width: 150px;
                            height: 25px;
                            background: #1a1a1a;
                            border-bottom-left-radius: 20px;
                            border-bottom-right-radius: 20px;
                            z-index: 100;
                        }
                        .desktop-preview {
                            width: 100%;
                            border: none;
                            box-shadow: none;
                        }
                    `}</style>
                    <div className="w-full h-full p-8 overflow-y-auto scrollbar-hide flex justify-center">
                        <div className={`transition-all duration-500 ease-in-out ${previewMode === "mobile" ? "mobile-preview" : "desktop-preview max-w-[800px] mx-auto pb-20"}`}>
                            <ApplyPreview
                                config={config}
                                selectedSectionId={selectedSectionId}
                                onSelectSection={setSelectedSectionId}
                                previewMode={previewMode}
                                onUpdateSection={updateSection}
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT: Editor Panel */}
                <ApplyEditorPanel
                    config={config}
                    selectedSectionId={selectedSectionId}
                    onUpdateSection={updateSection}
                    previewMode={previewMode}
                    setPreviewMode={setPreviewMode}
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />

            </div>
        </div>
    );
}
