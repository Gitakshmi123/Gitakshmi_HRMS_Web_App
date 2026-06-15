import React, { useState, useEffect, useRef } from 'react';
import api, { API_ROOT } from '../../utils/api';
import { Save, Upload, Trash2, FileImage, Settings, FileText } from 'lucide-react';

/**
 * Letter Settings - SIMPLIFIED VERSION
 * 
 * ONLY ONE OPTION: Upload Letter Pad (A4 size: 210 × 297 mm)
 * 
 * Letter Pad image already contains:
 * - Logo
 * - Footer
 * - Company details
 * 
 * No separate management needed.
 */
export default function LetterSettings() {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [letterPadUrl, setLetterPadUrl] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchLetterPad();
    }, []);

    const fetchLetterPad = async () => {
        try {
            const res = await api.get('/letters/company-profile');
            if (res.data?.branding?.letterheadBg) {
                setLetterPadUrl(res.data.branding.letterheadBg);
            }
        } catch {
            console.log('Letter pad not set up yet');
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large. Max 5MB allowed.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const res = await api.post('/uploads/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                const loadUrl = res.data.url.startsWith('http')
                    ? res.data.url
                    : `${API_ROOT}${res.data.url}`;

                setLetterPadUrl(loadUrl);

                // Auto-save
                await saveLetterPad(loadUrl);
            }
        } catch (error) {
            console.error('Upload failed', error);
            alert('Failed to upload letter pad image');
        } finally {
            setUploading(false);
        }
    };

    const saveLetterPad = async (url) => {
        setLoading(true);
        try {
            // Only save letter pad URL in branding.letterheadBg
            const profileData = {
                branding: {
                    letterheadBg: url || letterPadUrl
                }
            };

            await api.post('/letters/company-profile', profileData);
            alert('Letter pad saved successfully!');
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save letter pad');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('Remove letter pad? Templates using "Use Letter Pad" will show blank pages.')) {
            return;
        }

        setLoading(true);
        try {
            const profileData = {
                branding: {
                    letterheadBg: ''
                }
            };

            await api.post('/letters/company-profile', profileData);
            setLetterPadUrl('');
            alert('Letter pad removed successfully!');
        } catch (error) {
            console.error('Remove error:', error);
            alert('Failed to remove letter pad');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 w-full mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 bg-slate-50/50 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-medium text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20">
                            <Settings className="text-white" size={28} />
                        </div>
                        Letter Settings
                    </h1>
                    <p className="text-slate-400 font-medium mt-2 text-sm tracking-wide">Configure global communication blueprints and letterheads</p>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="px-10 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                        <FileImage size={24} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 text-lg uppercase tracking-tight">Main Letter Pad Blueprint</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">A4 Standard: 210 × 297 mm</p>
                    </div>
                </div>

                <div className="p-10">
                    <div className="max-w-3xl mx-auto">
                        {/* Upload Area */}
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/30 hover:bg-slate-50 hover:border-indigo-300 transition-all group relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleUpload}
                                className="hidden"
                                accept="image/png, image/jpeg, image/jpg"
                            />

                            {letterPadUrl ? (
                                <div className="relative w-full">
                                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 group-hover:border-indigo-100 transition-colors">
                                        <img
                                            src={letterPadUrl}
                                            alt="Letter Pad Preview"
                                            className="w-full h-auto max-h-[500px] object-contain mx-auto rounded-lg"
                                        />
                                    </div>
                                    <div className="mt-8 flex items-center justify-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading || loading}
                                            className="px-8 py-3 bg-[#4F46E5] hover:bg-[#0D9488] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                                        >
                                            <Upload size={18} />
                                            {uploading ? 'Syncing...' : 'Update Blueprint'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemove}
                                            disabled={loading}
                                            className="px-8 py-3 bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                                        >
                                            <Trash2 size={18} />
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-indigo-100 shadow-sm group-hover:scale-110 transition-all">
                                        {uploading ? (
                                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600/10 border-t-indigo-600"></div>
                                        ) : (
                                            <Upload size={32} />
                                        )}
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-800 mb-2">
                                        {uploading ? 'Syncing Letter Pad...' : 'Upload Blueprint Image'}
                                    </h3>
                                    <p className="text-sm font-medium text-slate-400">
                                        PNG, JPG, or JPEG • Max 5MB • (210mm × 297mm)
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="mt-10 p-8 bg-indigo-50/30 border border-indigo-100 rounded-[2rem]">
                            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <FileText size={16} /> Technical Guidelines
                            </h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    'Standard A4 Dimensions (210mm × 297mm)',
                                    'Includes integrated Logo, Footer, and Contact details',
                                    'Select "Use Letter Pad" in templates to apply this background',
                                    'High-Resolution PNG or JPG recommended for clarity'
                                ].map((step, idx) => (
                                    <li key={idx} className="flex gap-3 text-xs font-medium text-indigo-800/80">
                                        <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold">
                                            {idx + 1}
                                        </div>
                                        {step}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
