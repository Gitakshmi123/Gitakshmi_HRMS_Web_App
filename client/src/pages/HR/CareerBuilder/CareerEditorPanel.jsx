import React, { useState } from 'react';
import {
    Plus,
    Trash2,
    Layout,
    Type,
    Image as ImageIcon,
    CheckCircle,
    PlusCircle,
    Grid,
    List,
    Eye,
    ChevronDown,
    Palette,
    Settings,
    MessageSquare,
    HelpCircle,
    Zap,
    Loader2
} from 'lucide-react';
import { message } from '../../../utils/antdGlobal';
import api, { API_ROOT } from '../../../utils/api';
import {
    buildCareerGradientValue,
    DEFAULT_CAREER_GRADIENT,
    parseCareerGradientValue,
    resolveCareerGradientBackground,
} from '../../../utils/careerGradient';

export default function CareerEditorPanel({
    config,
    selectedBlockId,
    onAddBlock,
    onUpdateBlock,
    onRemoveBlock,
    onUpdateTheme,
    previewMode,
    setPreviewMode,
    canCreate = false,
    canEdit = false,
    canDelete = false,
}) {
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const canModify = canCreate || canEdit;

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            message.error('Only JPG, PNG, and WebP images allowed');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            message.error('Image must be under 2MB');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/uploads/doc', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data && res.data.url) {
                onUpdateTheme({ ...config.theme, logoUrl: res.data.url });
                message.success("Logo uploaded successfully");
            } else {
                message.error("Upload failed");
            }
        } catch (error) {
            console.error("Upload error:", error);
            message.error("Failed to upload logo");
        } finally {
            setUploading(false);
        }
    };

    // Helper to resolve image URL
    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${API_ROOT}${url}`;
        return url;
    };

    const availableBlocks = [
        { type: 'hero', name: 'Hero Section', icon: <Layout className="w-5 h-5" />, desc: 'Large banner with title & CTA' },
        { type: 'openings', name: 'Current Openings', icon: <PlusCircle className="w-5 h-5" />, desc: 'Job listings grid/list' },
        { type: 'highlights', name: 'Highlights', icon: <Zap className="w-5 h-5" />, desc: 'Key features/metrics cards' },
        { type: 'company-info', name: 'Company Info', icon: <ImageIcon className="w-5 h-5" />, desc: 'About us text & media' },
        { type: 'testimonials', name: 'Testimonials', icon: <MessageSquare className="w-5 h-5" />, desc: 'Employee or client quotes' },
        { type: 'faq', name: 'FAQ Section', icon: <HelpCircle className="w-5 h-5" />, desc: 'Frequently asked questions' },
    ];

    const selectedBlock = config?.sections?.find(s => s.id === selectedBlockId);

    const updateContent = (updates) => {
        if (!selectedBlock) return;
        onUpdateBlock(selectedBlockId, { ...selectedBlock.content, ...updates });
    };

    const handleImageUpload = async (e, fieldName = 'imageUrl') => {
        const file = e.target.files[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            message.error('Only JPG, PNG, and WebP images allowed');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            message.error('Image must be under 2MB');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/uploads/doc', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data && res.data.url) {
                updateContent({ [fieldName]: res.data.url });
                message.success("Image uploaded successfully");
            } else {
                message.error("Upload failed");
            }
        } catch (error) {
            console.error("Upload error:", error);
            message.error("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const getButtonStyle = (mode) => {
        const isActive = previewMode === mode;
        return {
            height: '38px',
            padding: '0 20px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: isActive ? '#4A5DFF' : '#ffffff',
            color: isActive ? '#ffffff' : '#333333',
            border: isActive ? '1px solid #4A5DFF' : '1px solid #E0E0E0',
        };
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-100 w-80 font-sans shadow-xl z-20 overflow-hidden">
            {/* Preview Mode Switcher */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Preview Mode</label>
                <div className="flex items-center gap-[12px]">
                    <button
                        style={getButtonStyle('desktop')}
                        onClick={() => setPreviewMode('desktop')}
                    >
                        Desktop Preview
                    </button>
                    <button
                        style={getButtonStyle('mobile')}
                        onClick={() => setPreviewMode('mobile')}
                    >
                        Mobile Preview
                    </button>
                </div>
            </div>

            {/* Add Section Header */}
            <div className="p-4 border-b border-gray-50 bg-white">
                <div className="relative">
                    {canCreate && (
                        <button
                            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all font-bold text-sm active:scale-95"
                        >
                            <span className="flex items-center gap-2"><Plus size={16} /> Add New Section</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}

                    {canCreate && isAddMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsAddMenuOpen(false)}></div>
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-20 max-h-[400px] overflow-y-auto">
                                <div className="p-2 space-y-1">
                                    {availableBlocks.map(block => (
                                        <button
                                            key={block.type}
                                            onClick={() => {
                                                onAddBlock(block.type);
                                                setIsAddMenuOpen(false);
                                            }}
                                            className="w-full text-left p-3 rounded-xl hover:bg-gray-50 flex items-start gap-3 transition-colors group"
                                        >
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                {block.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{block.name}</p>
                                                <p className="text-xs text-gray-500 line-clamp-1">{block.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Block Settings Content */}
            {!canModify ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-300 mb-4 border border-gray-100">
                        <Settings size={32} />
                    </div>
                    <h3 className="text-gray-900 font-bold mb-1">Read Only / Delete Mode</h3>
                    <p className="text-xs text-gray-500">
                        {canDelete ? 'Delete permission active chhe. Left side mathi section remove kari shako cho.' : 'View-only access active chhe. Editing disabled chhe.'}
                    </p>
                </div>
            ) : selectedBlockId === 'global-branding' ? (
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                    <div className="p-4 border-b border-gray-50 sticky top-0 bg-white/95 backdrop-blur z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                Global
                            </span>
                        </div>
                        <h2 className="text-lg font-black text-gray-900">Page Branding</h2>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Company Name */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Company Name Override</label>
                            <input
                                type="text"
                                value={config.theme?.companyName || ''}
                                onChange={(e) => onUpdateTheme({ ...config.theme, companyName: e.target.value })}
                                className="w-full px-3 py-2.5 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none hover:bg-gray-100 transition-all font-medium text-sm"
                                placeholder="Override company name..."
                            />
                        </div>

                        {/* Company Name Color */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Company Name Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={config.theme?.companyNameColor || '#111827'}
                                    onChange={(e) => onUpdateTheme({ ...config.theme, companyNameColor: e.target.value })}
                                    className="h-10 w-12 rounded cursor-pointer border-none bg-transparent p-0"
                                />
                                <input
                                    type="text"
                                    value={config.theme?.companyNameColor || ''}
                                    onChange={(e) => onUpdateTheme({ ...config.theme, companyNameColor: e.target.value })}
                                    className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border-none text-sm font-mono text-gray-600 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    placeholder="#111827"
                                />
                            </div>
                        </div>

                        {/* Company Logo */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Company Logo</label>
                            {config.theme?.logoUrl && (
                                <div className="relative w-full h-32 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-4">
                                    <img src={getImageUrl(config.theme.logoUrl)} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                                    <button
                                        onClick={() => onUpdateTheme({ ...config.theme, logoUrl: '' })}
                                        className="absolute top-2 right-2 p-1.5 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg shadow transition-all"
                                        title="Remove logo"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer relative">
                                {uploading ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="animate-spin text-blue-500 mb-2" />
                                        <span className="text-xs text-gray-500">Uploading...</span>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={handleLogoUpload}
                                        />
                                        <span className="text-xs font-bold text-gray-500">
                                            {config.theme?.logoUrl ? 'Change Logo' : 'Upload Logo'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Logo Height */}
                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Logo Height</label>
                                <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                    {config.theme?.logoHeight || 40}px
                                </span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="150"
                                value={config.theme?.logoHeight || 40}
                                onChange={(e) => onUpdateTheme({ ...config.theme, logoHeight: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Logo Redirect URL */}
                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Logo Redirect URL</label>
                            <input
                                type="text"
                                value={config.theme?.logoLink || ''}
                                onChange={(e) => onUpdateTheme({ ...config.theme, logoLink: e.target.value })}
                                className="w-full px-3 py-2.5 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none hover:bg-gray-100 transition-all font-medium text-sm"
                                placeholder="https://yourwebsite.com"
                            />
                        </div>

                        {/* Navigation Header Toggle */}
                        <div className="pt-4 border-t border-gray-100">
                            <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                <div className="flex flex-col pr-2">
                                    <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900">Show Header Navbar</span>
                                    <span className="text-[10px] text-gray-400">Display top navbar with company logo/name</span>
                                </div>
                                <div className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${config.theme?.showHeader !== false ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={config.theme?.showHeader !== false}
                                        onChange={(e) => onUpdateTheme({ ...config.theme, showHeader: e.target.checked })}
                                        className="hidden"
                                    />
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${config.theme?.showHeader !== false ? 'left-6' : 'left-1'}`}></div>
                                </div>
                            </label>
                        </div>

                        {/* Primary Color */}
                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Primary Theme Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={config.theme?.primaryColor || '#4F46E5'}
                                    onChange={(e) => onUpdateTheme({ ...config.theme, primaryColor: e.target.value })}
                                    className="h-10 w-12 rounded cursor-pointer border-none bg-transparent p-0"
                                />
                                <input
                                    type="text"
                                    value={config.theme?.primaryColor || ''}
                                    onChange={(e) => onUpdateTheme({ ...config.theme, primaryColor: e.target.value })}
                                    className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border-none text-sm font-mono text-gray-600"
                                    placeholder="#4F46E5"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : !selectedBlock ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-300 mb-4 border border-gray-100">
                        <Settings size={32} />
                    </div>
                    <h3 className="text-gray-900 font-bold mb-1">No Selection</h3>
                    <p className="text-xs text-gray-500">Select a section from the preview to edit settings.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                    <div className="p-4 border-b border-gray-50 sticky top-0 bg-white/95 backdrop-blur z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                {selectedBlock.type}
                            </span>
                        </div>
                        <h2 className="text-lg font-black text-gray-900">Customization</h2>
                    </div>

                    <div className="p-5 space-y-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section Heading</label>
                            <input
                                type="text"
                                value={selectedBlock.content?.title || ''}
                                onChange={(e) => updateContent({ title: e.target.value })}
                                className="w-full px-3 py-2.5 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none hover:bg-gray-100 transition-all font-medium text-sm"
                                placeholder="e.g., Our Openings"
                            />
                        </div>

                        {/* HERO SETTINGS */}
                        {selectedBlock.type === 'hero' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Headline Text</label>
                                    <textarea
                                        value={selectedBlock.content?.subtitle || ''}
                                        onChange={(e) => updateContent({ subtitle: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none hover:bg-gray-100 transition-all font-medium text-sm h-24 resize-none"
                                        placeholder="Subtitle..."
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Button Label</label>
                                    <input
                                        type="text"
                                        value={selectedBlock.content?.ctaText || ''}
                                        onChange={(e) => updateContent({ ctaText: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg border-none text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-3 pt-2 border-t border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Background Style</label>
                                    <div className="flex p-1 bg-gray-100 rounded-lg">
                                        {['gradient', 'solid', 'image'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    let newBgColor = selectedBlock.content?.bgColor;
                                                    // Set defaults if switching types and current color format is wrong
                                                    if (type === 'gradient' && !resolveCareerGradientBackground(newBgColor)) {
                                                        newBgColor = buildCareerGradientValue(DEFAULT_CAREER_GRADIENT);
                                                    } else if (type === 'solid' && (!newBgColor || String(newBgColor).includes('gradient(') || String(newBgColor).includes('from-'))) {
                                                        newBgColor = '#4F46E5';
                                                    }
                                                    updateContent({ bgType: type, bgColor: newBgColor });
                                                }}
                                                className={`flex-1 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${selectedBlock.content?.bgType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedBlock.content?.bgType === 'gradient' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400">From</label>
                                                    <input
                                                        type="color"
                                                        value={parseCareerGradientValue(selectedBlock.content?.bgColor).from}
                                                        onChange={(e) => {
                                                            const current = parseCareerGradientValue(selectedBlock.content?.bgColor);
                                                            updateContent({
                                                                bgColor: buildCareerGradientValue({
                                                                    from: e.target.value,
                                                                    via: current.via,
                                                                    to: current.to,
                                                                }),
                                                            });
                                                        }}
                                                        className="w-full h-8 rounded cursor-pointer border-none bg-transparent"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400">Via</label>
                                                    <input
                                                        type="color"
                                                        value={parseCareerGradientValue(selectedBlock.content?.bgColor).via}
                                                        onChange={(e) => {
                                                            const current = parseCareerGradientValue(selectedBlock.content?.bgColor);
                                                            updateContent({
                                                                bgColor: buildCareerGradientValue({
                                                                    from: current.from,
                                                                    via: e.target.value,
                                                                    to: current.to,
                                                                }),
                                                            });
                                                        }}
                                                        className="w-full h-8 rounded cursor-pointer border-none bg-transparent"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400">To</label>
                                                    <input
                                                        type="color"
                                                        value={parseCareerGradientValue(selectedBlock.content?.bgColor).to}
                                                        onChange={(e) => {
                                                            const current = parseCareerGradientValue(selectedBlock.content?.bgColor);
                                                            updateContent({
                                                                bgColor: buildCareerGradientValue({
                                                                    from: current.from,
                                                                    via: current.via,
                                                                    to: e.target.value,
                                                                }),
                                                            });
                                                        }}
                                                        className="w-full h-8 rounded cursor-pointer border-none bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={selectedBlock.content?.bgColor || ''}
                                                onChange={(e) => updateContent({ bgColor: e.target.value })}
                                                className="w-full text-[10px] font-mono px-3 py-2 bg-gray-50 rounded-lg border-none text-gray-400"
                                                placeholder="linear-gradient(90deg, #4F46E5, #9333EA, #EC4899)"
                                            />
                                        </div>
                                    )}

                                    {selectedBlock.content?.bgType === 'solid' && (
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400">Color</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        value={selectedBlock.content?.bgColor?.startsWith('#') ? selectedBlock.content?.bgColor : '#4F46E5'}
                                                        onChange={(e) => updateContent({ bgColor: e.target.value })}
                                                        className="h-10 w-12 rounded cursor-pointer border-none bg-transparent p-0"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={selectedBlock.content?.bgColor || ''}
                                                        onChange={(e) => updateContent({ bgColor: e.target.value })}
                                                        className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border-none text-sm font-mono text-gray-600"
                                                        placeholder="#hex or color name"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedBlock.content?.bgType === 'image' && (
                                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer relative">
                                            {uploading ? (
                                                <div className="flex flex-col items-center">
                                                    <Loader2 className="animate-spin text-blue-500 mb-2" />
                                                    <span className="text-xs text-gray-500">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        onChange={(e) => handleImageUpload(e, 'imageUrl')}
                                                    />
                                                    <span className="text-xs font-bold text-gray-500">
                                                        {selectedBlock.content?.imageUrl ? 'Change Image' : 'Upload Image'}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* OPENINGS SETTINGS */}
                        {selectedBlock.type === 'openings' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Layout Mode</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => updateContent({ layout: 'grid' })}
                                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold text-sm transition-all ${selectedBlock.content?.layout === 'grid' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <Grid size={14} /> Grid
                                        </button>
                                        <button
                                            onClick={() => updateContent({ layout: 'list' })}
                                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold text-sm transition-all ${selectedBlock.content?.layout === 'list' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <List size={14} /> List
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-4 border-t border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Apply Button</label>
                                    <input
                                        type="text"
                                        placeholder="Button Text"
                                        value={selectedBlock.content?.applyButtonText || 'Apply Now'}
                                        onChange={e => updateContent({ applyButtonText: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border-none mb-2"
                                    />
                                    <div className="grid grid-cols-3 gap-1">
                                        {['filled', 'outline', 'soft'].map(btnStyle => (
                                            <button
                                                key={btnStyle}
                                                onClick={() => updateContent({ applyButtonStyle: btnStyle })}
                                                className={`py-1.5 text-[10px] font-bold uppercase rounded border ${selectedBlock.content?.applyButtonStyle === btnStyle ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500'}`}
                                            >
                                                {btnStyle}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2 pt-4 border-t border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Display Fields</label>
                                    {[
                                        ['showDept', 'Department'],
                                        ['showExperience', 'Experience'],
                                        ['showPostedDate', 'Posted Date'],
                                        ['showDescription', 'Description'],
                                        ['showLocation', 'Location']
                                    ].map(([key, label]) => (
                                        <label key={key} className="flex items-center justify-between cursor-pointer group p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                            <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{label}</span>
                                            <div className={`w-10 h-5 rounded-full relative transition-colors ${selectedBlock.content?.[key] !== false ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedBlock.content?.[key] !== false}
                                                    onChange={(e) => updateContent({ [key]: e.target.checked })}
                                                    className="hidden"
                                                />
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${selectedBlock.content?.[key] !== false ? 'left-6' : 'left-1'}`}></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* HIGHLIGHTS SETTINGS */}
                        {selectedBlock.type === 'highlights' && (
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cards</label>
                                {selectedBlock.content?.cards?.map((card, idx) => (
                                    <div key={card.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 relative group">
                                        {canDelete && (
                                            <button
                                                onClick={() => {
                                                    const newCards = [...(selectedBlock.content.cards || [])];
                                                    newCards.splice(idx, 1);
                                                    updateContent({ cards: newCards });
                                                }}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                        <input
                                            value={card.title}
                                            onChange={e => {
                                                const newCards = [...(selectedBlock.content.cards || [])];
                                                newCards[idx] = { ...card, title: e.target.value };
                                                updateContent({ cards: newCards });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm font-bold mb-2"
                                            placeholder="Card Title"
                                        />
                                        <textarea
                                            value={card.description}
                                            onChange={e => {
                                                const newCards = [...(selectedBlock.content.cards || [])];
                                                newCards[idx] = { ...card, description: e.target.value };
                                                updateContent({ cards: newCards });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                                            rows={2}
                                            placeholder="Description"
                                        />
                                    </div>
                                ))}
                                {canCreate && (
                                    <button
                                        onClick={() => {
                                            const newCards = [...(selectedBlock.content.cards || [])];
                                            newCards.push({ id: Date.now(), title: "New Item", description: "Describe it" });
                                            updateContent({ cards: newCards });
                                        }}
                                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 font-bold text-xs"
                                    >
                                        + Add Item
                                    </button>
                                )}
                            </div>
                        )}

                        {/* COMPANY INFO */}
                        {selectedBlock.type === 'company-info' && (
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">About Us Content</label>
                                <textarea
                                    value={selectedBlock.content?.description || ''}
                                    onChange={(e) => updateContent({ description: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border-none text-sm h-32"
                                    placeholder="Company description..."
                                />
                                
                                <div className="border-t border-gray-100 pt-4 space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Background Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={selectedBlock.content?.bgColor === 'bg-gray-50' ? '#f9fafb' : selectedBlock.content?.bgColor || '#f9fafb'}
                                            onChange={(e) => {
                                                const bgColor = e.target.value === '#f9fafb' ? 'bg-gray-50' : e.target.value;
                                                updateContent({ bgColor });
                                            }}
                                            className="h-10 w-12 rounded cursor-pointer border-none"
                                        />
                                        <span className="text-xs text-gray-500 font-mono">{selectedBlock.content?.bgColor || 'bg-gray-50'}</span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-4 space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section Image</label>
                                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer relative">
                                        {uploading ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 className="animate-spin text-blue-500 mb-2" />
                                                <span className="text-xs text-gray-500">Uploading...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => handleImageUpload(e, 'imageUrl')}
                                                />
                                                <span className="text-xs font-bold text-gray-500">
                                                    {selectedBlock.content?.imageUrl ? 'Change Image' : 'Upload Image'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* TESTIMONIALS SETTINGS */}
                        {selectedBlock.type === 'testimonials' && (
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section Title</label>
                                <input
                                    type="text"
                                    value={selectedBlock.content?.title || ''}
                                    onChange={(e) => updateContent({ title: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-blue-500 outline-none text-sm font-medium"
                                    placeholder="Section title..."
                                />

                                <div className="border-t border-gray-100 pt-4 space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Testimonials</label>
                                    {selectedBlock.content?.testimonials?.map((testimonial, idx) => (
                                        <div key={testimonial.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 relative space-y-2">
                                            {canDelete && (
                                                <button
                                                    onClick={() => {
                                                        const newTestimonials = [...(selectedBlock.content.testimonials || [])];
                                                        newTestimonials.splice(idx, 1);
                                                        updateContent({ testimonials: newTestimonials });
                                                        message.success('Testimonial removed');
                                                    }}
                                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            
                                            <textarea
                                                value={testimonial.quote || ''}
                                                onChange={(e) => {
                                                    const newTestimonials = [...(selectedBlock.content.testimonials || [])];
                                                    newTestimonials[idx] = { ...testimonial, quote: e.target.value };
                                                    updateContent({ testimonials: newTestimonials });
                                                }}
                                                className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs h-16 resize-none"
                                                placeholder="Testimonial quote..."
                                            />
                                            
                                            <input
                                                type="text"
                                                value={testimonial.name || ''}
                                                onChange={(e) => {
                                                    const newTestimonials = [...(selectedBlock.content.testimonials || [])];
                                                    newTestimonials[idx] = { ...testimonial, name: e.target.value };
                                                    updateContent({ testimonials: newTestimonials });
                                                }}
                                                className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm font-bold"
                                                placeholder="Author name"
                                            />
                                            
                                            <input
                                                type="text"
                                                value={testimonial.role || ''}
                                                onChange={(e) => {
                                                    const newTestimonials = [...(selectedBlock.content.testimonials || [])];
                                                    newTestimonials[idx] = { ...testimonial, role: e.target.value };
                                                    updateContent({ testimonials: newTestimonials });
                                                }}
                                                className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                                                placeholder="Author role/title"
                                            />

                                            <div className="border-t border-gray-200 pt-2">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Profile Photo</label>
                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer relative group">
                                                    {testimonial.image ? (
                                                        <img src={getImageUrl(testimonial.image)} alt={testimonial.name} className="w-10 h-10 rounded-full mx-auto mb-1 object-cover" />
                                                    ) : null}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            if (!file) return;
                                                            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                                                                message.error('Only JPG, PNG, WebP allowed');
                                                                return;
                                                            }
                                                            if (file.size > 2 * 1024 * 1024) {
                                                                message.error('Image must be under 2MB');
                                                                return;
                                                            }
                                                            const formData = new FormData();
                                                            formData.append('file', file);
                                                            setUploading(true);
                                                            api.post('/uploads/doc', formData, {
                                                                headers: { 'Content-Type': 'multipart/form-data' }
                                                            }).then(res => {
                                                                if (res.data?.url) {
                                                                    const newTestimonials = [...(selectedBlock.content.testimonials || [])];
                                                                    newTestimonials[idx] = { ...testimonial, image: res.data.url };
                                                                    updateContent({ testimonials: newTestimonials });
                                                                    message.success('Photo uploaded');
                                                                }
                                                            }).catch(() => message.error('Upload failed')).finally(() => setUploading(false));
                                                        }}
                                                    />
                                                    <span className="text-[10px] font-bold text-gray-400">
                                                        {testimonial.image ? 'Change Photo' : 'Upload Photo'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {canCreate && (
                                        <button
                                            onClick={() => {
                                                const newTestimonials = [...(selectedBlock.content.testimonials || [])];
                                                newTestimonials.push({
                                                    id: Date.now(),
                                                    quote: 'Great experience working here!',
                                                    name: 'John Doe',
                                                    role: 'Team Member',
                                                    image: ''
                                                });
                                                updateContent({ testimonials: newTestimonials });
                                                message.success('New testimonial added');
                                            }}
                                            className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 font-bold text-xs hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                        >
                                            + Add Testimonial
                                        </button>
                                    )}
                                </div>

                                <div className="border-t border-gray-100 pt-4 space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section Background Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={selectedBlock.content?.bgColor === 'bg-blue-600' ? '#2563eb' : selectedBlock.content?.bgColor || '#2563eb'}
                                            onChange={(e) => {
                                                const bgColor = e.target.value === '#2563eb' ? 'bg-blue-600' : e.target.value;
                                                updateContent({ bgColor });
                                            }}
                                            className="h-10 w-12 rounded cursor-pointer border-none"
                                        />
                                        <span className="text-xs text-gray-500 font-mono">{selectedBlock.content?.bgColor || 'bg-blue-600'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* FAQ SETTINGS */}
                        {selectedBlock.type === 'faq' && (
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">FAQs</label>
                                {selectedBlock.content?.faqs?.map((faq, idx) => (
                                    <div key={faq.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 relative">
                                        {canDelete && (
                                            <button
                                                onClick={() => {
                                                    const newFaqs = [...(selectedBlock.content.faqs || [])];
                                                    newFaqs.splice(idx, 1);
                                                    updateContent({ faqs: newFaqs });
                                                }}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                        <input
                                            value={faq.question}
                                            onChange={e => {
                                                const newFaqs = [...(selectedBlock.content.faqs || [])];
                                                newFaqs[idx] = { ...faq, question: e.target.value };
                                                updateContent({ faqs: newFaqs });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm font-bold mb-2"
                                        />
                                        <textarea
                                            value={faq.answer}
                                            onChange={e => {
                                                const newFaqs = [...(selectedBlock.content.faqs || [])];
                                                newFaqs[idx] = { ...faq, answer: e.target.value };
                                                updateContent({ faqs: newFaqs });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                                            rows={2}
                                        />
                                    </div>
                                ))}
                                {canCreate && (
                                    <button
                                        onClick={() => {
                                            const newFaqs = [...(selectedBlock.content.faqs || [])];
                                            newFaqs.push({ id: Date.now(), question: "New Question?", answer: "Answer" });
                                            updateContent({ faqs: newFaqs });
                                        }}
                                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 font-bold text-xs"
                                    >
                                        + Add FAQ
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="pt-8 mt-4 border-t border-gray-100">
                            {canDelete && (
                                <button
                                    onClick={() => onRemoveBlock(selectedBlockId)}
                                    className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <Trash2 size={16} /> Remove Section
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
