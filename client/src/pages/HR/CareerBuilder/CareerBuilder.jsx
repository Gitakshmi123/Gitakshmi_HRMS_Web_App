import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Loader2, CheckCircle2, LayoutTemplate } from 'lucide-react';
import CareerPreview from './CareerPreview';
import CareerEditorPanel from './CareerEditorPanel';
import CareerLayerPanel from './CareerLayerPanel';

import api from '../../../utils/api';
import { message } from '../../../utils/antdGlobal';
import usePagePermissions from '../../../hooks/usePagePermissions';
import { buildCareerGradientValue, DEFAULT_CAREER_GRADIENT } from '../../../utils/careerGradient';

export default function CareerBuilder() {
    const { canView, canCreate, canEdit, canDelete, loading: permissionLoading } = usePagePermissions('portals.careerPage');
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastPublished, setLastPublished] = useState(null);
    const [previewMode, setPreviewMode] = useState("desktop");

    // Core State
    const [config, setConfig] = useState({
        sections: [],
        theme: {
            primaryColor: '#4F46E5',
            logoUrl: '',
            companyName: '',
            companyNameColor: '#111827',
            showHeader: true,
            logoHeight: 40,
            logoLink: ''
        }
    });

    const [selectedBlockId, setSelectedBlockId] = useState(null);

    // Live Data for Preview
    const [jobs, setJobs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const canAccess = canView || canCreate || canEdit || canDelete;
    const canPersist = canCreate || canEdit || canDelete;

    useEffect(() => {
        if (permissionLoading || !canAccess) {
            setLoading(false);
            return;
        }
        fetchConfig();
        fetchJobs();
    }, [permissionLoading, canAccess]);

    const fetchJobs = async () => {
        try {
            const res = await api.get('/requirements');
            if (res.data && res.data.requirements) {
                setJobs(res.data.requirements);
            } else if (Array.isArray(res.data)) {
                setJobs(res.data);
            }
        } catch (error) {
            console.error("Fetch jobs error:", error);
        }
    };

    const fetchConfig = async () => {
        try {
            setLoading(true);


            const res = await api.get('/career/draft');



            if (res.data) {
                // Ensure defaulting if fields missing
                const configData = {
                    sections: res.data.sections || [],
                    theme: {
                        primaryColor: '#4F46E5',
                        logoUrl: '',
                        companyName: '',
                        companyNameColor: '#111827',
                        showHeader: true,
                        logoHeight: 40,
                        logoLink: '',
                        ...(res.data.theme || {})
                    }
                };
                setConfig(configData);
                if (res.data.lastPublishedAt) setLastPublished(res.data.lastPublishedAt);

                // FORCE RESTORE 'openings' SECTION IF MISSING
                // User requirement: Must be visible by default for editing
                const hasOpenings = configData.sections.some(s => s.type === 'openings');
                if (!hasOpenings) {
                    configData.sections.push({
                        id: 'openings-default-' + Date.now(),
                        type: 'openings',
                        content: {
                            title: "Open Positions",
                            layout: "grid",
                            gridColumns: 3,
                            cardStyle: "rounded",
                            cardBackground: "#ffffff",
                            showDept: true,
                            showExperience: true,
                            showPostedDate: true,
                            showDescription: true,
                            applyButtonText: "Apply Now",
                            applyButtonStyle: "filled",
                            applyButtonColor: "#2563EB",
                            gap: 8,
                            enabled: true
                        },
                        order: 10
                    });
                }

                if (configData.sections.length > 0 && !selectedBlockId) {
                    setSelectedBlockId(configData.sections[0].id);
                }
            }
        } catch (error) {
            console.error("Fetch usage error:", error);
            message.warning("Could not load saved configuration. Loading defaults.");
            // Fallback to default if API fails
            setConfig({
                sections: [
                    {
                        id: 'hero-default',
                        type: 'hero',
                        content: {
                            title: "Join Our Amazing Team",
                            subtitle: "Innovate, grow, and build the future with us.",
                            bgType: "gradient",
                            bgColor: buildCareerGradientValue(DEFAULT_CAREER_GRADIENT),
                            ctaText: "Check Open Positions"
                        }
                    },
                    {
                        id: 'openings-default',
                        type: 'openings',
                        content: {
                            title: "Open Positions",
                            layout: "grid",
                            gridColumns: 3,
                            enabled: true
                        }
                    }
                ],
                theme: {
                    primaryColor: '#4F46E5',
                    logoUrl: '',
                    companyName: '',
                    companyNameColor: '#111827',
                    showHeader: true,
                    logoHeight: 40,
                    logoLink: ''
                }
            });
            if (!selectedBlockId) setSelectedBlockId('hero-default');
        } finally {
            setLoading(false);
        }
    };

    // ============= SAVE LOGIC =============

    const handleSaveSections = async () => {
        if (!canPersist) return;
        try {
            setSaving(true);

            // Clean payload (remove large assets if any slipped in)
            const cleanSections = config.sections.map(s => {
                const rest = { ...s };
                delete rest.preview;
                return rest;
            });

            await api.post('/career/sections/save', {
                sections: cleanSections,
                theme: config.theme
            });

            message.success("✅ Design saved to draft");
        } catch (error) {
            console.error("Save error:", error);
            message.error("Failed to save design: " + (error.response?.data?.error || error.message));
        } finally {
            setSaving(false);
        }
    };



    const handlePublish = async () => {
        if (!canPersist) return;
        try {
            setPublishing(true);

            if (config.sections.length === 0) {
                message.warning("⚠️ Page is empty. Add some sections!");
                return;
            }


            // 1. Force Save Current State First (Both SEO and Sections)
            const cleanSections = config.sections.map(s => {
                const rest = { ...s };
                delete rest.preview;
                return rest;
            });

            await api.post('/career/sections/save', { sections: cleanSections, theme: config.theme });

            // 2. Trigger Publish
            const res = await api.post('/career/publish');

            if (res.data && res.data.success) {
                message.success("🎉 Career Page Published Live!");
                setLastPublished(new Date());

                // Removed auto-redirect as per user request
                // The user can manually navigate to the public page
            } else {
                throw new Error("Publish response missing success flag");
            }
        } catch (error) {
            console.error("Publish error:", error);
            message.error("Publish failed: " + (error.response?.data?.error || error.message));
        } finally {
            setPublishing(false);
        }
    };

    // ============= EDITOR LOGIC =============

    const addBlock = (type) => {
        const newBlock = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            content: getDefaultContentForType(type)
        };
        setConfig(prev => ({
            ...prev,
            sections: [...prev.sections, newBlock]
        }));
        setSelectedBlockId(newBlock.id);
    };

    const updateBlock = (id, content) => {
        setConfig(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === id ? { ...s, content } : s)
        }));
    };

    const removeBlock = (id) => {
        setConfig(prev => ({
            ...prev,
            sections: prev.sections.filter(s => s.id !== id)
        }));
        if (selectedBlockId === id) setSelectedBlockId(null);
    };

    const reorderBlocks = (fromIndex, toIndex) => {
        const newSections = [...config.sections];
        const [movedItem] = newSections.splice(fromIndex, 1);
        newSections.splice(toIndex, 0, movedItem);
        setConfig(prev => ({ ...prev, sections: newSections }));
    };

    const getDefaultContentForType = (type) => {
        switch (type) {
            case 'hero': return {
                title: "Join Our Amazing Team",
                subtitle: "Innovate, grow, and build the future with us.",
                bgType: "gradient",
                bgColor: buildCareerGradientValue(DEFAULT_CAREER_GRADIENT),
                ctaText: "Check Open Positions"
            };
            case 'openings': return {
                title: "Open Positions",
                layout: "grid",
                gridColumns: 3,
                cardStyle: "rounded",
                cardBackground: "#ffffff",
                showDept: true,
                showExperience: true,
                showPostedDate: true,
                showDescription: true,
                applyButtonText: "Apply Now",
                applyButtonStyle: "filled",
                applyButtonColor: "#2563EB",
                gap: 8
            };
            case 'highlights': return {
                title: "Why Join Us?",
                cards: [
                    { id: 1, title: "Feature 1", description: "Description here" },
                    { id: 2, title: "Feature 2", description: "Description here" }
                ]
            };
            case 'faq': return {
                title: "Frequently Asked Questions",
                items: [
                    { id: 1, question: "What is the interview process?", answer: "We have a 3-step process..." },
                    { id: 2, question: "Do you offer remote work?", answer: "Yes, we are remote-first!" }
                ]
            };
            case 'testimonials': return {
                title: "What our team says",
                testimonials: [
                    { id: 1, name: "Sarah Johnson", role: "Software Engineer", quote: "The culture here is unmatched. I've grown more in 6 months than I did in 2 years at my previous job.", image: "https://i.pravatar.cc/150?u=sarah" },
                    { id: 2, name: "Michael Chen", role: "Product Manager", quote: "I love how everyone is encouraged to take ownership of their work and innovate.", image: "https://i.pravatar.cc/150?u=michael" },
                    { id: 3, name: "Emily Davis", role: "Design Lead", quote: "Working here gives me the creative freedom I always wanted. The team is incredibly supportive.", image: "https://i.pravatar.cc/150?u=emily" }
                ],
                bgColor: "#2563EB",
                textColor: "#ffffff"
            };
            case 'company-info': return {
                title: "About Us",
                description: "We are a great company committed to excellence and innovation. Our mission is to transform the industry through technology and compassion.",
                imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
                stats: [
                    { label: "Employees", value: "500+" },
                    { label: "Offices", value: "10" },
                    { label: "Countries", value: "5" }
                ],
                bgColor: "#f9fafb"
            };
            default: return { title: "New Section" };
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Loading Builder...</p>
            </div>
        );
    }

    if (!canAccess) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-white">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
                    <h2 className="text-lg font-black text-slate-900">No Portal Access</h2>
                    <p className="mt-2 text-sm text-slate-500">Career Page mate koi action enable nathi.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
            {/* Header */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-40 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <LayoutTemplate size={20} className="text-blue-600" />
                            Career Page Builder
                        </h1>
                        {lastPublished && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                    Last Live: {new Date(lastPublished).toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {canPersist && (
                        <>
                            <button
                                onClick={handleSaveSections}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 text-gray-700 font-bold hover:bg-gray-100 rounded-lg transition-all text-sm"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Save Draft
                            </button>

                            <button
                                onClick={handlePublish}
                                disabled={publishing}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg font-bold shadow-lg shadow-gray-200 hover:bg-black hover:shadow-xl transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                            >
                                {publishing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                {publishing ? 'Publishing...' : 'Publish Live'}
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Workspace */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel */}
                <CareerLayerPanel
                    sections={config.sections}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    onReorder={reorderBlocks}
                    onRemoveBlock={removeBlock}
                    canReorder={canEdit}
                    canDelete={canDelete}
                />

                {/* Canvas */}
                <div className="flex-1 bg-gray-200/50 relative overflow-hidden flex flex-col items-center">
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
                        <div className={`transition-all duration-500 ease-in-out ${previewMode === "mobile" ? "mobile-preview" : "desktop-preview max-w-[1440px] mx-auto"}`}>
                            <CareerPreview
                                config={config}
                                selectedBlockId={selectedBlockId}
                                onSelectBlock={setSelectedBlockId}
                                jobs={jobs.filter(j => j.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()))}
                                searchTerm={searchTerm}
                                onSearch={setSearchTerm}
                                isBuilder={true}
                                previewMode={previewMode}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <CareerEditorPanel
                    config={config}
                    selectedBlockId={selectedBlockId}
                    onAddBlock={addBlock}
                    onUpdateBlock={updateBlock}
                    onRemoveBlock={removeBlock}
                    onUpdateTheme={(theme) => setConfig(prev => ({ ...prev, theme }))}
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
