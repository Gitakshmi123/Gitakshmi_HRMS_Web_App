import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    App, Card, Input, Button, Checkbox,
    DatePicker, Switch, Modal, Tag, Spin, List, Avatar
} from 'antd';
import {
    Send, Video, Link as LinkIcon,
    Calendar, Upload as UploadIcon, X,
    Eye, FileText, Clock, CheckCircle, AlertCircle,
    Smartphone, Play, Music as MusicIcon, Search, Layout,
    Plus, ImagePlus
} from 'lucide-react';
import socialApi from '../services/social.api';
import CanvaEditor from '../components/CanvaEditor';
import debounce from 'lodash/debounce';
import dayjs from 'dayjs';
import usePagePermissions from '../../../hooks/usePagePermissions';

const { TextArea } = Input;

// ─── Platform meta ─────────────────────────────────────────────────────────────
const PLATFORM_META = {
    facebook:  { color: '#1877F2', bg: '#EBF3FF', label: 'Facebook',  icon: '𝔽' },
    instagram: { color: '#E4405F', bg: '#FFF0F3', label: 'Instagram', icon: '📸' },
    linkedin:  { color: '#0A66C2', bg: '#EBF4FF', label: 'LinkedIn',  icon: 'in' },
};

const PLATFORM_LIMITS = { facebook: 63206, instagram: 2200, linkedin: 3000 };

const POST_TYPES = [
    { value: 'post',  label: 'Post', icon: <FileText size={13}/>,  hint: null },
    { value: 'story', label: 'Story',        icon: <Smartphone size={13}/>, hint: '📱 Upload a video with audio — it will be posted as a Story directly.' },
    { value: 'reel',  label: 'Reel',         icon: <Play size={13}/>,       hint: '🎬 Upload a video with audio — it will be posted as a Reel directly.' },
];

const STATUS_CONFIG = {
    draft:     { color: '#6B7280', bg: '#F3F4F6', label: 'Draft',     icon: <FileText size={11}/> },
    scheduled: { color: '#F59E0B', bg: '#FFFBEB', label: 'Scheduled', icon: <Clock size={11}/> },
    published: { color: '#10B981', bg: '#ECFDF5', label: 'Published', icon: <CheckCircle size={11}/> },
};

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
        <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ color: cfg.color, background: cfg.bg }}
        >
            {cfg.icon}
            {cfg.label}
        </span>
    );
};

// ─── Drag & Drop Zone ──────────────────────────────────────────────────────────
const MediaDropZone = ({ onFile, uploading, disabled, postType }) => {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef();

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        const validFiles = files.filter(f => {
            const isImage = f.type.startsWith('image/');
            const isVideo = f.type.startsWith('video/');
            if (postType === 'post') return isImage;
            return isImage || isVideo;
        });

        if (validFiles.length < files.length) {
            alert(postType === 'post' ? 'Only images are allowed in standard posts.' : 'Images and videos are allowed.');
        }

        validFiles.forEach(onFile);
    }, [onFile, postType]);

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            className="group relative overflow-hidden rounded-2xl transition-all duration-500 cursor-pointer border-2 border-dashed"
            style={{
                borderColor: dragging ? '#6366F1' : '#E2E8F0',
                background:  dragging ? '#F5F7FF' : '#FBFBFF',
                opacity:     disabled ? 0.6 : 1,
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept={postType === 'post' ? "image/*" : "image/*,video/*"}
                className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files);
                    files.forEach(onFile);
                }}
                multiple
            />
            
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${dragging ? 'bg-indigo-600 rotate-6' : 'bg-white shadow-sm border border-slate-100 group-hover:-translate-y-1'}`}>
                    <ImagePlus size={32} className={`transition-colors duration-500 ${dragging ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                </div>
                <div className="text-center">
                    <p className="text-[15px] font-bold text-slate-700 m-0">
                        {dragging ? 'Drop to upload' : 'Upload Media Content'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Drag & drop or <span className="text-indigo-600 font-semibold underline underline-offset-2">browse files</span>
                    </p>
                </div>
            </div>

            {uploading && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-3" />
                    <p className="text-xs font-bold text-slate-600 animate-pulse uppercase tracking-widest">Processing Media...</p>
                </div>
            )}

            {/* Hover Decorative Element */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
        </div>
    );
};

// ─── Live Preview Component (Internal) ──────────────────────────────────────────
const PostPreview = ({ 
    formData, 
    activePlatform, 
    accounts, 
    loading, 
    canPublish, 
    setMusicModalVisible, 
    setUrlModalVisible, 
    mediaInputRef, 
    setDatePickerOpen, 
    setCanvaOpen, 
    handleRemoveMusic, 
    handleSubmit,
    setFormData 
}) => {
    const firstMedia = formData.media[0];
    const charCount   = formData.content.length;
    const currentLimit = PLATFORM_LIMITS[activePlatform] || 3000;
    const overLimit   = charCount > currentLimit;
    const selectedAcc = accounts.find(a => formData.accountIds.includes(a._id) && a.platform === activePlatform);
    const displayName = selectedAcc?.accountName || 'Your Page';

    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl relative group/preview">
            <div className="relative" style={{ height: ['story', 'reel'].includes(formData.postType) ? 780 : 650 }}>

                {/* Post Type Selector (Top Left) */}
                <div className="absolute top-4 left-4 z-20 flex gap-2 p-1.5 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg">
                    {POST_TYPES.map(pt => (
                        <button 
                            key={pt.value} 
                            onClick={() => setFormData(p => ({ ...p, postType: pt.value }))} 
                            className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300 flex items-center gap-2 ${
                                formData.postType === pt.value 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-slate-600 hover:bg-white/50'
                            }`}
                        >
                            {pt.icon}
                            {pt.label}
                        </button>
                    ))}
                </div>

                {/* Vertical Toolbar on Right */}
                <div className="absolute top-4 right-4 z-20 flex flex-col gap-4 p-2.5 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
                    {/* Music Icon */}
                    <div 
                        className={`relative p-2 rounded-xl transition-all duration-300 group cursor-pointer ${formData.musicId ? 'bg-pink-50 text-pink-600' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setMusicModalVisible(true)}
                        title="Add Music"
                    >
                        <MusicIcon size={19} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
                        {formData.musicId && <div className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full border-2 border-white animate-pulse" />}
                    </div>

                    {/* Link Icon */}
                    <div 
                        className="p-2 rounded-xl transition-all duration-300 group cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                        onClick={() => setUrlModalVisible(true)}
                        title="Add via URL"
                    >
                        <LinkIcon size={19} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
                    </div>

                    {/* Video Icon */}
                    <div 
                        className="p-2 rounded-xl transition-all duration-300 group cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                        onClick={() => mediaInputRef.current?.click()}
                        title="Upload Media"
                    >
                        <Video size={19} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
                    </div>

                    {/* Clock Icon */}
                    <div 
                        className={`relative p-2 rounded-xl transition-all duration-300 group cursor-pointer ${formData.scheduledAt ? 'bg-amber-50 text-amber-600' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setDatePickerOpen(true)}
                        title="Schedule Post"
                    >
                        <Clock size={19} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
                        {formData.scheduledAt && <div className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-white" />}
                    </div>

                    <div className="w-8 mx-auto h-px bg-slate-200/60" />

                    {/* Layout Icon */}
                    <div 
                        className="p-2 rounded-xl transition-all duration-300 group cursor-pointer hover:bg-indigo-50 text-indigo-500 hover:text-indigo-600"
                        onClick={() => setCanvaOpen(true)}
                        title="Edit with Canva"
                    >
                        <Layout size={19} strokeWidth={2.2} className="group-hover:scale-110 transition-transform" />
                    </div>

                    {/* Publish action is available as the single "Publish Post" button in the right panel */}
                </div>

                {formData.media?.length > 0 ? (
                    <div className="w-full h-full bg-slate-900 border-b border-slate-50">
                        {formData.media[0].type === 'image' ? (
                            <img src={formData.media[0].url} className="w-full h-full object-cover" alt="Preview" key={formData.media[0].url} />
                        ) : (
                            <video 
                                src={formData.media[0].url} 
                                className="w-full h-full object-cover" 
                                controls 
                                autoPlay 
                                muted 
                                loop
                            />
                        )}
                    </div>
                ) : <div className="h-full flex items-center justify-center text-slate-300 text-xs italic bg-slate-50">No media preview</div>}
            </div>
            {formData.music && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 flex items-center gap-3 rounded-full border border-white shadow-xl animate-in slide-in-from-bottom-2">
                    <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center animate-pulse">
                        <MusicIcon size={12} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-800 truncate font-bold m-0 leading-tight">{formData.music.title}</p>
                        <p className="text-[9px] text-slate-400 truncate m-0 leading-tight">{formData.music.artist}</p>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveMusic(); }} 
                        className="text-slate-400 hover:text-red-500 transition-colors p-0.5 hover:bg-slate-200 rounded-full"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
            
            <div className="mt-auto">

            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const CreatePost = ({ permissions }) => {
    const { notification } = App.useApp();
    const fallbackPerms = usePagePermissions('socialMedia.create');
    const { canCreate } = permissions || fallbackPerms;

    // ── State ──
    const [formData, setFormData] = useState({
        content:    '',
        postType:   'post',
        media:      [],   // [{ url, type, name }]
        scheduledAt: null,
        accountIds: [],
        music: null,
        musicId: null,
        separateContent: false,
        platformContent: { facebook: '', instagram: '', linkedin: '' },
        accountContent: {} // { accountId: 'content' }
    });
    const [uploading, setUploading]         = useState(false);
    const [loading,   setLoading]           = useState(false);
    const [accounts,  setAccounts]          = useState([]);
    const [accountSettings, setAccountSettings] = useState({});
    const [urlModalVisible, setUrlModalVisible] = useState(false);
    const [imageUrlInput,   setImageUrlInput]   = useState('');
    
    // Music state
    const [musicModalVisible, setMusicModalVisible] = useState(false);
    const [musicSearch, setMusicSearch] = useState('');
    const [musicResults, setMusicResults] = useState([]);
    const [isSearchingMusic, setIsSearchingMusic] = useState(false);
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = useRef(new Audio());
    const datePickerRef = useRef(null);
    const mediaInputRef = useRef(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [activePlatform, setActivePlatform] = useState('facebook');
    const [contentOpen, setContentOpen] = useState(false);
    const [canvaOpen, setCanvaOpen] = useState(false);
    
    // Derived
    const currentStatus = formData.scheduledAt ? 'scheduled'
        : (formData.content || formData.media.length ? 'draft' : 'draft');
    const canPublish = formData.accountIds.length > 0 &&
        (formData.content.trim() || formData.media.length > 0);

    const selectedPostType = POST_TYPES.find(pt => pt.value === formData.postType);

    const loadAccounts = async () => {
        try {
            const data = await socialApi.getAccounts();
            setAccounts(Array.isArray(data) ? data : []);
        } catch { console.error('Failed to load accounts'); }
    };

    useEffect(() => { loadAccounts(); }, []);

    if (!canCreate) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <AlertCircle size={40} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700">Access Restricted</h3>
                <p className="max-w-xs text-center mt-2 leading-relaxed">
                    You don't have permission to create social media posts. Please contact your administrator.
                </p>
            </div>
        );
    }
    // ── Music Functions ──
    const searchMusic = async (query) => {
        setIsSearchingMusic(true);
        try {
            const res = await socialApi.getMusic(query);
            if (Array.isArray(res)) {
                setMusicResults(res);
            } else if (res?.data && Array.isArray(res.data)) {
                setMusicResults(res.data);
            } else {
                setMusicResults([]);
            }
        } catch (err) {
            console.error('Error fetching music:', err);
        } finally {
            setIsSearchingMusic(false);
        }
    };

    const debouncedSearchMusic = useCallback(debounce(searchMusic, 300), []);

    useEffect(() => {
        if (musicModalVisible) {
            searchMusic(musicSearch);
        } else {
            if (!formData.musicId) {
                audioRef.current.pause();
                setPlayingAudioId(null);
            }
        }
    }, [musicModalVisible]);

    const handleSearchChange = (e) => {
        setMusicSearch(e.target.value);
        debouncedSearchMusic(e.target.value);
    };

    const togglePlayMusic = (music, e) => {
        if (e) e.stopPropagation();
        if (playingAudioId === music._id) {
            audioRef.current.pause();
            setPlayingAudioId(null);
        } else {
            audioRef.current.src = music.audioUrl;
            audioRef.current.play().catch(console.error);
            setPlayingAudioId(music._id);
        }
    };

    const handleSelectMusic = (music) => {
        setFormData(prev => ({ ...prev, musicId: music._id, music: music }));
        setMusicModalVisible(false);
        setMusicSearch('');
    };

    const handleRemoveMusic = () => {
        audioRef.current.pause();
        setPlayingAudioId(null);
        setFormData(prev => ({ ...prev, musicId: null, music: null }));
    };

    // ── Upload ──
    const uploadSingleFile = async (file) => {
        if (formData.media.length >= 5) {
            return notification.warning({ message: 'Maximum 5 files allowed' });
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('media', file);
            const res = await socialApi.uploadMedia(fd);
            if (res?.success) {
                setFormData(prev => ({ ...prev, media: [...prev.media, ...res.media].slice(0, 5) }));
                notification.success({ message: `✅ ${file.name.slice(0, 30)} uploaded`, duration: 2 });
            }
        } catch {
            notification.error({ message: 'Upload failed' });
        } finally { setUploading(false); }
    };

    const removeMedia = (index) =>
        setFormData(prev => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }));

    const handleAddByUrl = async () => {
        if (!imageUrlInput.trim()) return;
        if (!imageUrlInput.startsWith('http'))
            return notification.error({ message: 'URL must start with http or https' });
        if (formData.media.length >= 5) {
            return notification.warning({ message: 'Maximum 5 files allowed' });
        }

        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('imageUrl', imageUrlInput.trim());
            const res = await socialApi.uploadMedia(fd);
            if (res?.success) {
                setFormData(prev => ({ ...prev, media: [...prev.media, ...res.media].slice(0, 5) }));
                notification.success({ message: 'Image imported successfully', duration: 2 });
                setImageUrlInput('');
                setUrlModalVisible(false);
            }
        } catch (error) {
            notification.error({
                message: 'Image import failed',
                description: error?.response?.data?.message || error.message
            });
        } finally {
            setUploading(false);
        }
    };

    const handleCanvaExport = (dataUrl) => {
        // Convert dataUrl to blob then to File
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], `design_${Date.now()}.png`, { type: 'image/png' });
                uploadSingleFile(file);
                notification.success({ message: 'Design applied to post!' });
            });
    };

    const handleSubmit = async () => {
        if (!canPublish) return;
        const selected = accounts.filter(a => formData.accountIds.includes(a._id));
        const errors = [];
        selected.forEach(acc => {
            const settings = accountSettings[acc._id] || { useDefault: true, customCaption: '' };
            const caption  = settings.useDefault ? formData.content : settings.customCaption;
            if (acc.platform === 'linkedin' && !caption?.trim())
                errors.push(`LinkedIn (${acc.accountName}): text content is required`);
            if (acc.platform === 'instagram' && formData.media.length === 0)
                errors.push(`Instagram (${acc.accountName}): at least one media file is required`);
            if (['story', 'reel'].includes(formData.postType) && !formData.media.some(m => m.type === 'video'))
                errors.push(`${formData.postType} posts require at least one video file`);
        });
        if (errors.length) {
            return notification.error({
                message: 'Validation Failed',
                description: errors.map((e, i) => <div key={i}>{e}</div>)
            });
        }
        setLoading(true);
        try {
            const payload = {
                content:  formData.content,
                media:    formData.media,
                postType: formData.postType,
                accountIds: formData.accountIds,
                musicId: formData.musicId,
                accounts: formData.accountIds.map(id => ({
                    accountId:     id,
                    useDefault:    accountSettings[id]?.useDefault ?? true,
                    customCaption: accountSettings[id]?.customCaption || ''
                })),
                scheduledAt: formData.scheduledAt ? formData.scheduledAt.toISOString() : null
            };
            const res = await socialApi.createCampaign(payload);
            if (res?.success) {
                notification.success({
                    message: formData.scheduledAt ? 'Scheduled successfully' : 'Post queued successfully',
                    description: formData.scheduledAt
                        ? 'Your post will publish at the selected time.'
                        : 'Instagram publishing is running in the background. You can keep using the app.'
                });
                setFormData({ content: '', postType: 'post', media: [], scheduledAt: null, accountIds: [], musicId: null, music: null });
                setAccountSettings({});
                handleRemoveMusic();
                if (window.refreshSocialHistory) {
                    setTimeout(() => window.refreshSocialHistory(), 300);
                }
            }
        } catch (e) {
            notification.error({ message: 'Error', description: e?.response?.data?.message || e.message });
        } finally { setLoading(false); }
    };



    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
                <div className="bg-transparent">
                    <div className="space-y-4">
                        <div className="w-full">
                            <PostPreview 
                                formData={formData}
                                activePlatform={activePlatform}
                                accounts={accounts}
                                loading={loading}
                                canPublish={canPublish}
                                setMusicModalVisible={setMusicModalVisible}
                                setUrlModalVisible={setUrlModalVisible}
                                mediaInputRef={mediaInputRef}
                                setDatePickerOpen={setDatePickerOpen}
                                setCanvaOpen={setCanvaOpen}
                                handleRemoveMusic={handleRemoveMusic}
                                handleSubmit={handleSubmit}
                                setFormData={setFormData}
                            />
                        </div>
                        <div className="pt-2">
                            <div className="bg-white border border-slate-200 rounded-lg transition-all shadow-sm overflow-hidden">
                                <div 
                                    onClick={() => setContentOpen(!contentOpen)}
                                    className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                    <FileText size={16} className="text-slate-400" />
                                    <span className={`text-sm flex-1 truncate ${!formData.content ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                                        {formData.content || 'Content your post'}
                                    </span>
                                    <span className={`text-[10px] font-bold ${formData.content.length > (PLATFORM_LIMITS[activePlatform] || 3000) ? 'text-red-500' : 'text-slate-400'}`}>
                                        {formData.content.length} / {PLATFORM_LIMITS[activePlatform] || 3000}
                                    </span>
                                    <span className={`text-slate-300 transition-transform ${contentOpen ? 'rotate-180' : ''}`}>▼</span>
                                </div>
                                
                                {contentOpen && (
                                    <div className="px-4 pb-3 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center justify-between py-2 mb-2 bg-slate-50/50 px-2 rounded-md">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Different content for each platform?</span>
                                            <Switch 
                                                size="small" 
                                                checked={formData.separateContent} 
                                                onChange={checked => setFormData(p => ({ ...p, separateContent: checked }))} 
                                            />
                                        </div>

                                        {!formData.separateContent ? (
                                            <TextArea 
                                                placeholder="Type your content here..."
                                                autoSize={{ minRows: 2, maxRows: 10 }}
                                                value={formData.content} 
                                                autoFocus
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setFormData(prev => ({ ...prev, content: val }));
                                                }} 
                                                className="text-sm text-slate-700 leading-relaxed border-none focus:ring-0 resize-none w-full px-0 py-2 placeholder:italic"
                                            />
                                        ) : (
                                            <div className="space-y-4 pt-2">
                                                {['facebook', 'instagram', 'linkedin'].map(plt => (
                                                    <div key={plt} className="space-y-1.5 p-2 rounded-lg border border-slate-100 bg-white">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black uppercase" style={{ color: PLATFORM_META[plt].color }}>{plt}</span>
                                                            <span className={`text-[9px] font-bold ${(formData.platformContent[plt] || '').length > PLATFORM_LIMITS[plt] ? 'text-red-500' : 'text-slate-400'}`}>
                                                                {(formData.platformContent[plt] || '').length} / {PLATFORM_LIMITS[plt]}
                                                            </span>
                                                        </div>
                                                        <TextArea 
                                                            placeholder={`Content for ${plt}...`}
                                                            autoSize={{ minRows: 2, maxRows: 5 }}
                                                            value={formData.platformContent[plt]}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setFormData(p => ({
                                                                    ...p,
                                                                    platformContent: { ...p.platformContent, [plt]: val }
                                                                }));
                                                            }}
                                                            className="text-xs text-slate-600 border-none focus:ring-0 p-0"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Per-Account Content Option */}
                                        <div className="mt-4 pt-3 border-t border-slate-100 italic text-[10px] text-slate-400">
                                            Tip: You can also set unique content for individual accounts in the "Publish To" list below.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-5">
                <Card className="shadow-sm border-slate-200 rounded-xl" title={<span className="font-bold text-slate-700">Publish To</span>}>
                    <div className="space-y-3">
                        {['facebook', 'instagram', 'linkedin'].map(platform => {
                            const accs = accounts.filter(a => a.platform === platform);
                            return accs.map(acc => (
                                <div 
                                    key={acc._id} 
                                    className={`flex flex-col gap-2 p-2 rounded-lg border transition-all ${formData.accountIds.includes(acc._id) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setFormData(p => ({ ...p, accountIds: p.accountIds.includes(acc._id) ? p.accountIds.filter(id => id !== acc._id) : [...p.accountIds, acc._id] }))}>
                                        <Checkbox checked={formData.accountIds.includes(acc._id)} />
                                        <Avatar size="small" style={{ backgroundColor: PLATFORM_META[platform].color }}>{acc.accountName[0]}</Avatar>
                                        <span className="text-xs font-semibold flex-1">{acc.accountName}</span>
                                        {formData.accountIds.includes(acc._id) && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const hasLocal = !!formData.accountContent[acc._id];
                                                    if (hasLocal) {
                                                        const { [acc._id]: removed, ...rest } = formData.accountContent;
                                                        setFormData(p => ({ ...p, accountContent: rest }));
                                                    } else {
                                                        setFormData(p => ({ ...p, accountContent: { ...p.accountContent, [acc._id]: formData.content } }));
                                                    }
                                                }}
                                                className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter transition-colors ${formData.accountContent[acc._id] ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                            >
                                                {formData.accountContent[acc._id] ? 'Custom' : 'Set Custom'}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {formData.accountIds.includes(acc._id) && formData.accountContent[acc._id] !== undefined && (
                                        <div className="mt-1 animate-in zoom-in-95 duration-200">
                                            <TextArea 
                                                placeholder={`Unique content for ${acc.accountName}...`}
                                                autoSize={{ minRows: 1, maxRows: 4 }}
                                                value={formData.accountContent[acc._id]}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setFormData(p => ({
                                                        ...p,
                                                        accountContent: { ...p.accountContent, [acc._id]: val }
                                                    }) );
                                                }}
                                                className="text-[11px] bg-white border-slate-200 hover:border-indigo-300 focus:border-indigo-500 p-1.5 leading-tight placeholder:italic"
                                            />
                                            <div className="flex justify-end mt-1">
                                                <span className={`text-[8px] font-bold ${(formData.accountContent[acc._id] || '').length > PLATFORM_LIMITS[platform] ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {(formData.accountContent[acc._id] || '').length} / {PLATFORM_LIMITS[platform]}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ));
                        })}
                    </div>
                </Card>
                <Button type="primary" size="large" block className="h-12 rounded-xl font-bold font-sm" loading={loading} onClick={handleSubmit} disabled={!canPublish}>Publish Post</Button>
            </div>

            <Modal 
                title="Add Music" 
                open={musicModalVisible} 
                onCancel={() => setMusicModalVisible(false)} 
                footer={null} 
                width={400} 
                styles={{ body: { padding: 0 } }}
                destroyOnHidden
            >
                <div className="p-3 bg-slate-50 border-b">
                    <Input 
                        placeholder="Search Music..." 
                        prefix={<Search size={16} />} 
                        value={musicSearch} 
                        onChange={handleSearchChange} 
                    />
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {musicResults.map(m => (
                        <div key={m._id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b" onClick={() => handleSelectMusic(m)}>
                            <Avatar src={m.thumbnail} shape="square" />
                            <div className="flex-1">
                                <p className="text-sm font-bold m-0">{m.title}</p>
                                <p className="text-xs text-slate-400 m-0">{m.artist}</p>
                            </div>
                            <Button 
                                size="small" 
                                shape="circle" 
                                icon={playingAudioId === m._id ? <div className="w-2 h-2 bg-pink-500 rounded-full" /> : <Play size={10} />} 
                                onClick={(e) => togglePlayMusic(m, e)} 
                            />
                        </div>
                    ))}
                </div>
            </Modal>
            
            <Modal
                title="Add Image via URL"
                open={urlModalVisible}
                onCancel={() => { setUrlModalVisible(false); setImageUrlInput(''); }}
                onOk={handleAddByUrl}
                okText="Add Image"
                destroyOnHidden
            >
                <div className="py-4">
                    <p className="text-xs text-slate-500 mb-2">Paste a direct link to an image (jpg, png, etc.)</p>
                    <Input 
                        placeholder="https://example.com/image.jpg"
                        value={imageUrlInput}
                        onChange={e => setImageUrlInput(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>

            <DatePicker 
                ref={datePickerRef}
                open={datePickerOpen}
                onOpenChange={open => setDatePickerOpen(open)}
                showTime 
                format="YYYY-MM-DD HH:mm" 
                style={{ visibility: 'hidden', position: 'absolute', zIndex: -1 }}
                value={formData.scheduledAt} 
                onChange={val => setFormData(p => ({ ...p, scheduledAt: val }))} 
            />

            <input 
                ref={mediaInputRef}
                type="file" 
                accept={formData.postType === 'post' ? "image/*" : "image/*,video/*"}
                className="hidden" 
                onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const invalidFiles = formData.postType === 'post' 
                        ? files.filter(f => !f.type.startsWith('image/'))
                        : [];
                    
                    if (invalidFiles.length > 0) {
                        notification.error({ 
                            message: 'Invalid File Type', 
                            description: 'Standard posts only support image files. Use Reels or Stories for video content.' 
                        });
                        return;
                    }
                    
                    files.forEach(uploadSingleFile);
                }} 
                multiple 
            />

            <CanvaEditor 
                open={canvaOpen}
                onClose={() => setCanvaOpen(false)}
                onExport={handleCanvaExport}
            />
        </div>
    );
};

export default CreatePost;
