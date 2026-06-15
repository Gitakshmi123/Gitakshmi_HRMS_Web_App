import React, { useState, useEffect, useCallback } from 'react';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import {
    User, Mail, Phone, MapPin, FileText,
    Edit3, CheckCircle2, CloudUpload, ShieldCheck,
    Calendar, Shield, AlertCircle, Download, X, ExternalLink,
    Linkedin, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { API_ROOT } from '../../utils/api'; // Centralized axios instance with auth & tenant headers
import Cropper from 'react-easy-crop';
import { Modal, Slider } from 'antd';
import dayjs from 'dayjs';

const OfferCountdown = ({ expiryDate }) => {
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        const calculateTimeLeft = () => {
            if (!expiryDate) return null;
            const difference = new Date(expiryDate) - new Date();
            if (difference > 0) {
                return {
                    hours: Math.floor(difference / (1000 * 60 * 60)),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60),
                };
            }
            return null;
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [expiryDate]);

    if (!timeLeft) return null;

    return (
        <div className="mt-1.5 text-[10px] text-blue-500 font-black uppercase tracking-wider animate-pulse transition-all">
            {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s valid
        </div>
    );
};

export default function CandidateProfile() {
    const { candidate, refreshCandidate } = useJobPortalAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editFields, setEditFields] = useState({ name: '', email: '', phone: '', professionalTier: '', linkedinUrl: '', portfolioUrl: '' });

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [profileImage, setProfileImage] = useState(null);
    const [profileImageUrl, setProfileImageUrl] = useState('');
    const [showOfferModal, setShowOfferModal] = useState(false);
    const offerExpiryAt = profileData?.offerExpiryAt ? new Date(profileData.offerExpiryAt) : null;
    const isOfferExpired = Boolean(
        profileData?.offerStatus === 'EXPIRED' ||
        (offerExpiryAt && Date.now() > offerExpiryAt.getTime())
    );
    const isOfferRejected = profileData?.offerStatus === 'REJECTED';

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/candidate/profile');
            if (res.data) setProfileData(res.data);
        } catch (err) {
            console.error("Profile fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDownload = async (url, title) => {
        if (!url) return;
        try {
            const finalUrl = url.startsWith('http') ? url : `${API_ROOT}${url}`;
            // Direct open without HEAD check to avoid CORS/Auth issues on static files
            window.open(finalUrl, '_blank');
        } catch (err) {
            console.error(`Download failed for ${title}:`, err);
            alert(`Sorry! This ${title} is not yet available on the server. Please check back later or contact HR.`);
        }
    };

    const handleAcceptOffer = async () => {
        const appId = profileData?.bgvApplicationId || profileData?.applicationId;
        if (!appId) {
            alert("Application ID not found. Please try refreshing the page.");
            return;
        }
        if (!window.confirm("Are you sure you want to ACCEPT this offer? Once accepted, you can proceed with background verification.")) return;

        // Frontend guard: block accept if expired
        if (isOfferExpired) {
            alert("This offer has expired. Please request a revised offer from HR.");
            return;
        }

        try {
            setLoading(true);
            const res = await api.patch(`/candidate/offer/respond`, { applicationId: appId, action: 'ACCEPT' });
            if (res.data.success) {
                alert("Offer Accepted! You can now upload your BGV documents.");
                setShowOfferModal(false);
                await fetchProfile();
            }
        } catch (err) {
            console.error("Failed to accept offer:", err);
            alert(err.response?.data?.error || err.response?.data?.message || "Failed to accept offer. Please try again.");
            setLoading(false);
        }
    };

    const handleRejectOffer = async () => {
        const appId = profileData?.bgvApplicationId || profileData?.applicationId;
        if (!appId) {
            alert("Application ID not found. Please try refreshing the page.");
            return;
        }
        if (!window.confirm("Are you sure you want to REJECT this offer? This cannot be undone.")) return;

        try {
            setLoading(true);
            const res = await api.patch(`/candidate/offer/respond`, { applicationId: appId, action: 'REJECT' });
            if (res.data.success) {
                alert("Offer Rejected.");
                setShowOfferModal(false);
                await fetchProfile();
            }
        } catch (err) {
            console.error(err);
            alert("Failed to reject offer.");
            setLoading(false);
        }
    };

    const handleRequestRevision = async () => {
        const appId = profileData?.latestApplicationId || profileData?.bgvApplicationId;
        if (!appId) {
            alert("Application ID not found. Please try refreshing the page.");
            return;
        }
        if (!window.confirm("Request a revised offer from HR? They will be notified.")) return;
        try {
            setLoading(true);
            const res = await api.post(`/candidate/application/request-offer-revision/${appId}`);
            if (res.data.success) {
                alert("Revision request sent to HR successfully!");
                await fetchProfile();
            }
        } catch (err) {
            console.error("Failed to request revision:", err);
            alert(err.response?.data?.error || "Failed to request revision.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    // When profileData loads, set editFields
    useEffect(() => {
        if (candidate || profileData) {
            // Priority: profileData.profilePic > candidate.profilePic > placeholders
            let picPath = profileData?.profilePic || candidate?.profilePic || '';

            if (picPath && !picPath.startsWith('http') && !picPath.startsWith('blob:')) {
                picPath = `${API_ROOT}/${picPath}`;
            }

            setProfileImageUrl(picPath);
            setEditFields({
                name: profileData?.name || candidate?.name || '',
                email: profileData?.email || candidate?.email || '',
                phone: profileData?.mobile || profileData?.phone || '',
                professionalTier: profileData?.professionalTier || 'Technical Leader',
                linkedinUrl: profileData?.linkedinUrl || '',
                portfolioUrl: profileData?.portfolioUrl || '',
            });
        }
    }, [candidate, profileData]);



    const handleEditClick = () => setEditMode(true);
    const handleCancelEdit = () => {
        if (profileImageUrl && profileImageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(profileImageUrl);
        }
        setEditMode(false);
        setEditFields({
            name: profileData?.name || candidate?.name || '',
            email: profileData?.email || candidate?.email || '',
            phone: profileData?.mobile || profileData?.phone || '',
            professionalTier: profileData?.professionalTier || 'Technical Leader',
            linkedinUrl: profileData?.linkedinUrl || '',
            portfolioUrl: profileData?.portfolioUrl || '',
        });
        let picPath = profileData?.profilePic || candidate?.profilePic || '';
        if (picPath && !picPath.startsWith('http') && !picPath.startsWith('blob:')) {
            picPath = `${API_ROOT}/${picPath}`;
        }
        setProfileImageUrl(picPath);
        setProfileImage(null);
    };

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        setEditFields((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async () => {
        try {
            const formData = new FormData();
            formData.append('name', editFields.name);
            formData.append('email', editFields.email);
            formData.append('phone', editFields.phone);
            formData.append('professionalTier', editFields.professionalTier);
            formData.append('linkedinUrl', editFields.linkedinUrl);
            formData.append('portfolioUrl', editFields.portfolioUrl);

            if (profileImage) {
                formData.append('profileImage', profileImage);
            }

            // Update profile info
            await api.put('/candidate/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (profileImageUrl && profileImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(profileImageUrl);
            }

            setEditMode(false);
            setProfileImage(null);
            await fetchProfile();
            await refreshCandidate();
        } catch (err) {
            console.error("Save error:", err);
            alert('Failed to update profile.');
        }
    };

    const handleResumeUpload = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("File size exceeds 5MB limit.");
            return;
        }

        const formData = new FormData();
        formData.append('resume', file);

        try {
            setLoading(true);
            const res = await api.put('/candidate/profile/resume', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                alert("Resume uploaded successfully!");
                await fetchProfile();
            }
        } catch (err) {
            console.error("Resume upload failed:", err);
            alert(err.response?.data?.error || err.response?.data?.message || "Failed to upload resume.");
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageToCrop(reader.result);
                setShowCropper(true);
            });
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createCropImage = async () => {
        try {
            const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
            const blobUrl = URL.createObjectURL(croppedImage);
            setProfileImageUrl(blobUrl);
            setProfileImage(croppedImage);
            setShowCropper(false);
        } catch (e) {
            console.error(e);
        }
    };

    const getCroppedImg = (imageSrc, pixelCrop) => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = imageSrc;
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = pixelCrop.width;
                canvas.height = pixelCrop.height;

                ctx.drawImage(
                    image,
                    pixelCrop.x,
                    pixelCrop.y,
                    pixelCrop.width,
                    pixelCrop.height,
                    0,
                    0,
                    pixelCrop.width,
                    pixelCrop.height
                );

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas is empty'));
                        return;
                    }
                    resolve(blob);
                }, 'image/jpeg');
            };
            image.onerror = reject;
        });
    };




    if (loading) return (
        <div className="h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Profile...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-200 pb-10">
            {/* Luxury Profile Header Banner - Shrinked */}
            <div className="relative overflow-hidden bg-premium-gradient rounded-2xl h-24 shadow-lg shadow-blue-200/50">
                {/* Minimal Background Elements */}
                <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-white/10 rounded-full blur-[40px] -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-[100px] h-[100px] bg-blue-400/10 rounded-full blur-[30px] -ml-12 -mb-12"></div>

                <div className="absolute inset-0 px-5 flex items-center">
                    <div className="relative z-10 w-full flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <div className="h-14 w-14 rounded-xl bg-white p-0.5 shadow-xl relative z-10 overflow-hidden">
                                    {profileImageUrl ? (
                                        <img
                                            src={profileImageUrl}
                                            alt="Profile"
                                            className="w-full h-full rounded-xl object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-inner">
                                            {candidate?.name?.charAt(0)?.toUpperCase() || 'C'}
                                        </div>
                                    )}

                                    {editMode && (
                                        <label className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <CloudUpload className="text-white" size={18} />
                                            <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                                        </label>
                                    )}
                                </div>
                            </div>
                            <div className="text-white">
                                <h1 className="text-xl lg:text-2xl font-black tracking-tight leading-none text-white flex items-center gap-1.5">
                                    {candidate?.name || 'Your Profile'}<span className="text-emerald-400">.</span>
                                </h1>
                                <p className="text-[8px] font-bold text-blue-100 uppercase tracking-[0.1em] mt-1 opacity-80">Verified Identity</p>
                            </div>
                        </div>
                        {!editMode ? (
                            <button
                                className="flex items-center gap-2 bg-white/10 hover:bg-white text-white hover:text-blue-600 border border-white/20 px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest shadow-lg transition-all active:scale-95 group"
                                onClick={handleEditClick}
                            >
                                <Edit3 size={12} className="group-hover:rotate-12 transition-transform" /> Edit
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition-all active:scale-95"
                                    onClick={handleSaveEdit}
                                >Save</button>
                                <button
                                    className="bg-white/10 text-white border border-white/20 px-4 py-2 rounded-lg font-bold text-[9px] uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
                                    onClick={handleCancelEdit}
                                >Cancel</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Side: Stats & Info */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white p-5 lg:p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-3">
                            <div className="bg-slate-100 p-1.5 rounded-lg text-blue-600">
                                <User size={16} />
                            </div>
                            Personal Overview
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            {!editMode ? (
                                <>
                                    {/* Name */}
                                    <div className="group relative text-slate-800">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <User size={12} className="text-blue-600" />
                                            Full Name
                                        </p>
                                        <p className="text-xs font-semibold text-slate-800">{profileData?.name || candidate?.name || 'Not provided'}</p>
                                    </div>

                                    {/* Email */}
                                    <div className="group relative text-slate-800">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Mail size={12} className="text-blue-600" />
                                            Email Address
                                        </p>
                                        <p className="text-xs font-semibold text-slate-800">{profileData?.email || candidate?.email || 'Not provided'}</p>
                                    </div>

                                    {/* Phone */}
                                    <div className="group relative text-slate-800">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Phone size={12} className="text-blue-600" />
                                            Phone Number
                                        </p>
                                        <p className="text-xs font-semibold text-slate-800">{profileData?.mobile || profileData?.phone || 'Not provided'}</p>
                                    </div>

                                    {/* Tier */}
                                    <div className="group relative text-slate-800">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <ShieldCheck size={12} className="text-blue-600" />
                                            Professional Tier
                                        </p>
                                        <p className="text-xs font-semibold text-slate-800">{profileData?.professionalTier || 'Not provided'}</p>
                                    </div>

                                    {/* LinkedIn URL */}
                                    <div className="group relative text-slate-800">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Linkedin size={12} className="text-blue-600" />
                                            LinkedIn Profile
                                        </p>
                                        {profileData?.linkedinUrl ? (
                                            <a
                                                href={profileData.linkedinUrl.startsWith('http') ? profileData.linkedinUrl : `https://${profileData.linkedinUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline"
                                            >
                                                View Profile <ExternalLink size={12} />
                                            </a>
                                        ) : (
                                            <p className="text-xs font-normal text-slate-400 italic">Not provided</p>
                                        )}
                                    </div>

                                    {/* Portfolio URL */}
                                    <div className="group relative text-slate-800">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Globe size={12} className="text-blue-600" />
                                            Personal Portfolio
                                        </p>
                                        {profileData?.portfolioUrl ? (
                                            <a
                                                href={profileData.portfolioUrl.startsWith('http') ? profileData.portfolioUrl : `https://${profileData.portfolioUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-800 text-xs font-semibold hover:underline"
                                            >
                                                View Portfolio <ExternalLink size={12} />
                                            </a>
                                        ) : (
                                            <p className="text-xs font-normal text-slate-400 italic">Not provided</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Name Input */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <User size={12} className="text-blue-600" />
                                            Full Name
                                        </p>
                                        <input
                                            type="text"
                                            name="name"
                                            value={editFields.name}
                                            onChange={handleFieldChange}
                                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {/* Email Input */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Mail size={12} className="text-blue-600" />
                                            Email Address
                                        </p>
                                        <input
                                            type="email"
                                            name="email"
                                            value={editFields.email}
                                            onChange={handleFieldChange}
                                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {/* Phone Input */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Phone size={12} className="text-blue-600" />
                                            Phone Number
                                        </p>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={editFields.phone}
                                            onChange={handleFieldChange}
                                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {/* Tier Input */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <ShieldCheck size={12} className="text-blue-600" />
                                            Professional Tier
                                        </p>
                                        <input
                                            type="text"
                                            name="professionalTier"
                                            value={editFields.professionalTier}
                                            onChange={handleFieldChange}
                                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {/* LinkedIn URL Input */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Linkedin size={12} className="text-blue-600" />
                                            LinkedIn Profile URL
                                        </p>
                                        <input
                                            type="text"
                                            name="linkedinUrl"
                                            placeholder="e.g. linkedin.com/in/username"
                                            value={editFields.linkedinUrl}
                                            onChange={handleFieldChange}
                                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {/* Portfolio URL Input */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-2">
                                            <Globe size={12} className="text-blue-600" />
                                            Personal Portfolio URL
                                        </p>
                                        <input
                                            type="text"
                                            name="portfolioUrl"
                                            placeholder="e.g. github.com/username"
                                            value={editFields.portfolioUrl}
                                            onChange={handleFieldChange}
                                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-3">
                            <div className="bg-emerald-400/20 p-1.5 rounded-lg text-emerald-600">
                                <FileText size={16} />
                            </div>
                            Professional Assets
                        </h3>

                        {profileData?.resume ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center group transition-all">
                                <div className="bg-white w-10 h-10 rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3">
                                    <FileText size={18} className="text-emerald-600" />
                                </div>
                                <h4 className="text-xs font-bold text-slate-800 mb-1">Your Resume</h4>
                                <p className="text-[9px] text-slate-500 font-medium mb-4">Uploaded successfully</p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => handleDownload(profileData.resume, 'Resume')}
                                        className="bg-white text-emerald-600 px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors flex items-center gap-1"
                                    >
                                        <Download size={10} /> View / Download
                                    </button>
                                    <label className="bg-white text-blue-600 px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                                        Change
                                        <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <label className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center group cursor-pointer hover:border-blue-400 transition-all block">
                                <div className="bg-white w-10 h-10 rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3 group-hover:rotate-6 transition-transform">
                                    <CloudUpload size={18} className="text-blue-600" />
                                </div>
                                <h4 className="text-xs font-bold text-slate-800 mb-1">Resume</h4>
                                <p className="text-[9px] text-slate-500 font-medium mb-4">PDF, DOC, DOCX (Max 5MB)</p>
                                <span className="inline-block bg-white text-blue-600 px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest shadow-sm border border-slate-100">
                                    Upload
                                </span>
                                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} />
                            </label>
                        )}
                    </div>

                </div>

                {/* Right Side: Quick Stats */}
                <div className="lg:col-span-4">
                    <div className="bg-blue-600 p-5 rounded-2xl text-white shadow-lg shadow-blue-200">
                        <div className="bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3 border border-white/20">
                            <AlertCircle size={20} className="text-white" />
                        </div>
                        <h4 className="text-sm font-bold tracking-tight mb-1.5 leading-tight text-white">Complete Profile</h4>
                        <p className="text-white/95 text-[10px] font-medium mb-3 leading-relaxed">Profiles with 100% completion are 4x more likely to be noticed.</p>
                        <button className="w-full bg-white text-blue-600 py-2 rounded-xl font-bold text-[9px] uppercase tracking-widest shadow-lg hover:bg-slate-50 transition-all">Finish Now</button>
                    </div>
                </div>
            </div>

            {/* Cropper Modal */}
            <Modal
                title="Adjust your profile picture"
                open={showCropper}
                onOk={createCropImage}
                onCancel={() => setShowCropper(false)}
                okText="Apply Crop"
                width={600}
                centered
            >
                <div className="relative h-80 w-full bg-slate-100 rounded-xl overflow-hidden mb-6">
                    <Cropper
                        image={imageToCrop}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>
                <div className="px-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Zoom Intensity</p>
                    <Slider
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        onChange={(v) => setZoom(v)}
                    />
                </div>
            </Modal>

            {/* Offer Letter Modal */}
            {showOfferModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden ring-1 ring-white/20">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Offer Letter</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Review your document</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => handleDownload(profileData?.offerLetterUrl, 'Offer Letter')}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                                >
                                    <Download size={16} /> Download
                                </button>
                                <button
                                    onClick={() => setShowOfferModal(false)}
                                    className="p-3 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-200"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-slate-100 p-6 overflow-hidden relative">
                            <iframe
                                src={profileData?.offerLetterUrl?.startsWith('http') ? profileData?.offerLetterUrl : `${API_ROOT}${profileData?.offerLetterUrl}`}
                                className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                                title="Offer Letter"
                            />
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

