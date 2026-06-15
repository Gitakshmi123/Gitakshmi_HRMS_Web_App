import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Check, Upload, ArrowRight, ShieldCheck, FileText, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OnboardingPortal() {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [data, setData] = useState(null);
    const [responses, setResponses] = useState({});
    const [currentSectionIdx, setCurrentSectionIdx] = useState(0);

    useEffect(() => {
        const fetchPortal = async () => {
            try {
                const res = await api.get(`/onboarding/portal/${token}`);
                setData(res.data);
                // Initialize responses from existing ones if any
                setResponses(res.data.submission?.responses || {});
            } catch (err) {
                toast.error(err.response?.data?.message || 'Invalid or expired link');
            } finally {
                setLoading(false);
            }
        };
        fetchPortal();
    }, [token]);

    const handleFieldChange = (fieldId, value) => {
        setResponses(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleFileUpload = async (fieldId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fieldId', fieldId);
        formData.append('submissionId', data.submission._id);

        try {
            toast.loading('Uploading document...', { id: 'upload' });
            const res = await api.post(`/onboarding/portal/${token}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            handleFieldChange(fieldId, res.data.fileUrl);
            toast.success('Document uploaded!', { id: 'upload' });
        } catch (err) {
            toast.error('Upload failed', { id: 'upload' });
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await api.post(`/onboarding/portal/${token}/submit`, { responses });
            toast.success('Onboarding submitted successfully!');
            setData(prev => ({ ...prev, submission: { ...prev.submission, status: 'VERIFICATION' } }));
        } catch (err) {
            toast.error('Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
    );

    if (!data) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                <AlertCircle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-500 max-w-xs">This onboarding link is either invalid, expired, or has already been used.</p>
        </div>
    );

    if (data.submission.status === 'VERIFICATION' || data.submission.status === 'COMPLETED') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
                    <ShieldCheck size={48} />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Submission Received!</h1>
                <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you, <span className="font-bold text-slate-900">{data.candidate.name}</span>. Your details have been submitted and are currently being verified by our HR team. We will notify you once the process is complete.
                </p>
                <div className="mt-10 p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            {data.submission.status === 'VERIFICATION' ? '1' : '2'}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Current Status</p>
                            <p className="text-lg font-bold text-slate-900">
                                {data.submission.status === 'VERIFICATION' ? 'HR Verification in Progress' : 'Onboarding Completed'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const sections = data.template.sections;
    const currentSection = sections[currentSectionIdx];

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center py-12 px-4 md:px-8">
            <div className="max-w-4xl w-full">
                {/* Branding & Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-[0.2em] mb-3">
                            <ShieldCheck size={18} />
                            Secure Onboarding Portal
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Welcome, {data.candidate.name}</h1>
                        <p className="text-slate-500 mt-2 font-medium">Please complete the following details to finalize your joining.</p>
                    </div>
                    <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-200/60 flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                            <p className="text-sm font-black text-slate-900">{Math.round((currentSectionIdx / sections.length) * 100)}% Complete</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            {currentSectionIdx + 1}/{sections.length}
                        </div>
                    </div>
                </div>

                {/* Main Form Area */}
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden mb-12">
                    {/* Section Nav */}
                    <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/50">
                        {sections.map((sec, idx) => (
                            <button
                                key={sec.id}
                                onClick={() => idx <= currentSectionIdx && setCurrentSectionIdx(idx)}
                                className={`px-8 py-5 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                                    idx === currentSectionIdx 
                                        ? 'border-indigo-600 text-indigo-600 bg-white' 
                                        : idx < currentSectionIdx ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400'
                                }`}
                            >
                                <span className="mr-2 opacity-50">{idx + 1}.</span> {sec.title}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-10 md:p-16">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{currentSection.title}</h2>
                        <p className="text-slate-500 text-sm mb-12 font-medium">Please provide accurate information as per your official documents.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                            {currentSection.fields.filter(f => f.isPublic).map(field => (
                                <div key={field.id} className={field.type === 'textarea' || field.type === 'file' ? 'md:col-span-2' : ''}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
                                        {field.label} {field.isRequired && <span className="text-rose-500">*</span>}
                                    </label>
                                    
                                    {field.type === 'text' && (
                                        <input 
                                            type="text"
                                            value={responses[field.id] || ''}
                                            onChange={e => handleFieldChange(field.id, e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                            placeholder={`Enter ${field.label.toLowerCase()}`}
                                        />
                                    )}

                                    {field.type === 'textarea' && (
                                        <textarea 
                                            value={responses[field.id] || ''}
                                            onChange={e => handleFieldChange(field.id, e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                            placeholder={`Provide details for ${field.label.toLowerCase()}`}
                                            rows={4}
                                        />
                                    )}

                                    {field.type === 'file' && (
                                        <div className="relative group">
                                            <input 
                                                type="file"
                                                onChange={e => handleFileUpload(field.id, e.target.files[0])}
                                                className="hidden"
                                                id={`file-${field.id}`}
                                            />
                                            <label 
                                                htmlFor={`file-${field.id}`}
                                                className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all ${
                                                    responses[field.id] 
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                                        : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-indigo-50 group-hover:border-indigo-200 group-hover:text-indigo-600'
                                                }`}
                                            >
                                                {responses[field.id] ? (
                                                    <>
                                                        <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                                                            <Check className="text-emerald-500" size={24} />
                                                        </div>
                                                        <p className="text-sm font-bold">Document Uploaded Successfully</p>
                                                        <p className="text-[10px] uppercase font-bold mt-1 opacity-60">Click to replace</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                                                            <Upload size={24} />
                                                        </div>
                                                        <p className="text-sm font-bold">Click to Upload Document</p>
                                                        <p className="text-[10px] uppercase font-bold mt-1 opacity-60">PDF, JPG, PNG (Max 5MB)</p>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    )}

                                    {field.type === 'select' && (
                                        <select 
                                            value={responses[field.id] || ''}
                                            onChange={e => handleFieldChange(field.id, e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all appearance-none"
                                        >
                                            <option value="">Select Option</option>
                                            {field.options?.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    )}

                                    {field.type === 'date' && (
                                        <input 
                                            type="date"
                                            value={responses[field.id] || ''}
                                            onChange={e => handleFieldChange(field.id, e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer Actions */}
                        <div className="mt-20 pt-10 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck size={14} className="text-indigo-500" /> Secure Data Encryption Active
                            </p>
                            <div className="flex gap-4 w-full md:w-auto">
                                {currentSectionIdx > 0 && (
                                    <button 
                                        onClick={() => setCurrentSectionIdx(prev => prev - 1)}
                                        className="flex-1 md:px-10 py-5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                                    >
                                        Previous
                                    </button>
                                )}
                                {currentSectionIdx < sections.length - 1 ? (
                                    <button 
                                        onClick={() => setCurrentSectionIdx(prev => prev + 1)}
                                        className="flex-1 md:px-10 py-5 bg-slate-900 text-white rounded-[1.5rem] text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3"
                                    >
                                        Next Section
                                        <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="flex-1 md:px-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                                    >
                                        {submitting ? 'Submitting...' : 'Complete Submission'}
                                        <Check size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
                    Powered by GitakshmiHR SaaS Architecture
                </div>
            </div>
        </div>
    );
}
