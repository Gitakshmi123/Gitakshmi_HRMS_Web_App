import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Eye, X, Upload, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { message } from '../../../utils/antdGlobal';
import api, { API_ROOT } from '../../../utils/api';

export default function SEOSettings({ config, onUpdateSEO, onSaveSEO, isSaving }) {
    // ... existing state ...

    // Helper to resolve image URL
    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${API_ROOT}${url}`;
        return url;
    };
    const [seoData, setSeoData] = useState({
        seo_title: '',
        seo_description: '',
        seo_keywords: [],
        seo_og_image: '',
        seo_slug: ''
    });

    const [keywordInput, setKeywordInput] = useState('');
    const [errors, setErrors] = useState({});
    const [preview, setPreview] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Initialize from config
    useEffect(() => {
        if (config?.seoSettings) {
            setSeoData({
                seo_title: config.seoSettings.seo_title || '',
                seo_description: config.seoSettings.seo_description || '',
                seo_keywords: config.seoSettings.seo_keywords || [],
                seo_og_image: config.seoSettings.seo_og_image || '',
                seo_slug: config.seoSettings.seo_slug || ''
            });
        }
    }, [config]);

    // Validation functions
    const validateSeoTitle = (value) => {
        if (!value) return 'SEO Title is required';
        if (value.length > 70) return 'Max 70 characters';
        return '';
    };

    const validateSeoDescription = (value) => {
        if (!value) return 'SEO Description is required';
        if (value.length > 160) return 'Max 160 characters';
        return '';
    };

    const validateSeoSlug = (value) => {
        if (!value) return 'Slug is required';
        const slugRegex = /^[a-z0-9-]*$/;
        if (!slugRegex.test(value)) return 'Lowercase, numbers, and hyphens only';
        return '';
    };

    const handleChange = (field, value) => {
        setSeoData(prev => ({ ...prev, [field]: value }));

        // Clear error when typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleAddKeyword = () => {
        if (keywordInput.trim()) {
            // Prevent duplicates
            if (seoData.seo_keywords.includes(keywordInput.trim())) {
                message.warning("Keyword already added");
                return;
            }
            setSeoData(prev => ({
                ...prev,
                seo_keywords: [...prev.seo_keywords, keywordInput.trim()]
            }));
            setKeywordInput('');
        }
    };

    const handleRemoveKeyword = (index) => {
        setSeoData(prev => ({
            ...prev,
            seo_keywords: prev.seo_keywords.filter((_, i) => i !== index)
        }));
    };

    // FIXED: Upload image to server instead of Base64
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate type
        if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
            message.error('Only JPG, PNG and WebP images are allowed');
            return;
        }

        // Validate size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            message.error('Image must be less than 2MB');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            // Correct endpoint matching app.js mounting (/api/uploads) + router path (/doc)
            const res = await api.post('/uploads/doc', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data && res.data.url) {
                // Ensure full URL if needed, or relative path
                const imageUrl = res.data.url;
                setSeoData(prev => ({ ...prev, seo_og_image: imageUrl }));
                message.success("Image uploaded successfully");
            } else {
                message.error("Upload failed: No URL returned");
            }
        } catch (error) {
            console.error("Upload error:", error);
            message.error("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = () => {
        // Validate all fields
        const titleError = validateSeoTitle(seoData.seo_title);
        const descError = validateSeoDescription(seoData.seo_description);
        const slugError = validateSeoSlug(seoData.seo_slug);

        if (titleError || descError || slugError) {
            setErrors({
                seo_title: titleError,
                seo_description: descError,
                seo_slug: slugError
            });
            message.error('Please fix validation errors before saving');
            return;
        }

        onSaveSEO(seoData); // Pass updated data back to parent
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-100 w-96 font-sans shadow-xl z-20">
            {/* Header */}
            <div className="p-4 border-b border-gray-50 bg-gradient-to-r from-blue-50 to-purple-50 sticky top-0 z-10 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <Save size={18} className="text-blue-600" /> SEO Settings
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Optimize for Google & Social Media</p>
                </div>
                <button
                    onClick={() => setPreview(!preview)}
                    className={`p-2 rounded-lg transition-colors ${preview ? 'bg-blue-100 text-blue-600' : 'hover:bg-white text-gray-500'}`}
                    title="Toggle Search Preview"
                >
                    <Eye size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 p-5 space-y-6">

                {/* SEO Title */}
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Page Title <span className="text-red-500">*</span></label>
                        <span className={`text-xs font-bold ${seoData.seo_title.length > 70 ? 'text-red-500' : 'text-gray-400'}`}>
                            {seoData.seo_title.length}/70
                        </span>
                    </div>
                    <input
                        type="text"
                        value={seoData.seo_title}
                        onChange={(e) => handleChange('seo_title', e.target.value)}
                        placeholder="e.g. Careers at Acme Corp"
                        className={`w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${errors.seo_title ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.seo_title && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={10} /> {errors.seo_title}</p>}
                </div>

                {/* SEO Description */}
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Meta Description <span className="text-red-500">*</span></label>
                        <span className={`text-xs font-bold ${seoData.seo_description.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                            {seoData.seo_description.length}/160
                        </span>
                    </div>
                    <textarea
                        value={seoData.seo_description}
                        onChange={(e) => handleChange('seo_description', e.target.value)}
                        placeholder="Briefly describe your company culture and open roles..."
                        rows={3}
                        className={`w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none resize-none transition-all ${errors.seo_description ? 'border-red-500' : 'border-gray-200'}`}
                    />
                    {errors.seo_description && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={10} /> {errors.seo_description}</p>}
                </div>

                {/* URL Slug */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">URL Slug <span className="text-red-500">*</span></label>
                    <div className={`flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg ${errors.seo_slug ? 'border-red-500' : 'border-gray-200'}`}>
                        <LinkIcon size={14} className="text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500 font-mono">/careers/</span>
                        <input
                            type="text"
                            value={seoData.seo_slug}
                            onChange={(e) => handleChange('seo_slug', e.target.value)}
                            placeholder="my-company"
                            className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 placeholder-gray-400 font-mono"
                        />
                    </div>
                    {errors.seo_slug ? (
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={10} /> {errors.seo_slug}</p>
                    ) : (
                        <p className="text-[10px] text-gray-400">Lowercase letters, numbers, and hyphens only.</p>
                    )}
                </div>

                {/* Keywords */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Keywords</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                            placeholder="Add keyword..."
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white outline-none focus:border-blue-500"
                        />
                        <button onClick={handleAddKeyword} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {seoData.seo_keywords.map((k, i) => (
                            <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded flex items-center gap-1 border border-blue-100">
                                {k} <X size={12} className="cursor-pointer hover:text-blue-900" onClick={() => handleRemoveKeyword(i)} />
                            </span>
                        ))}
                    </div>
                </div>

                {/* OG Image Upload */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Social Share Image</label>

                    <div className="relative group">
                        {seoData.seo_og_image ? (
                            <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <img src={getImageUrl(seoData.seo_og_image)} alt="OG Preview" className="w-full h-32 object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setSeoData(prev => ({ ...prev, seo_og_image: '' }))}
                                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'bg-gray-50 border-gray-300' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}>
                                {uploading ? (
                                    <Loader2 className="animate-spin text-blue-500" />
                                ) : (
                                    <>
                                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-2">
                                            <ImageIcon size={20} />
                                        </div>
                                        <p className="text-xs font-bold text-gray-600">Click to upload image</p>
                                        <p className="text-[10px] text-gray-400 mt-1">Recommended 1200x630px (Max 2MB)</p>
                                    </>
                                )}
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                            </label>
                        )}
                    </div>
                </div>

                {/* Live Preview Card */}
                {preview && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase">Google Search Preview</h3>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 font-arial">
                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-[10px]">🌐</div>
                                <span className="truncate">mysite.com › careers › {seoData.seo_slug || 'slug'}</span>
                            </div>
                            <h4 className="text-xl text-[#1a0dab] hover:underline cursor-pointer font-medium truncate">
                                {seoData.seo_title || 'Career Page Title'}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                                {seoData.seo_description || 'This description will appear in search results. Make it catchy to attract the best candidates to your company.'}
                            </p>
                        </div>
                    </div>
                )}

            </div>

            {/* Sticky Footer */}
            <div className="p-4 bg-white border-t border-gray-100 sticky bottom-0 z-10">
                <button
                    onClick={handleSave}
                    disabled={isSaving || uploading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {isSaving ? 'Saving Changes...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
