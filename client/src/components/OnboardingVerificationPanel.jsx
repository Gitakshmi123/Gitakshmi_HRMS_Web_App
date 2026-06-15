import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock, FileText, ExternalLink, MessageSquare, Shield, User } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function OnboardingVerificationPanel({ submission, onUpdate }) {
    const [verifying, setVerifying] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [verifiedDocs, setVerifiedDocs] = useState({});

    const handleVerifyDoc = (fieldId, status, docRemarks = '') => {
        setVerifiedDocs(prev => ({
            ...prev,
            [fieldId]: { status, remarks: docRemarks }
        }));
    };

    const submitVerification = async (finalStatus) => {
        setVerifying(true);
        try {
            const docArray = Object.keys(verifiedDocs).map(fid => ({
                fieldId: fid,
                status: verifiedDocs[fid].status,
                remarks: verifiedDocs[fid].remarks
            }));

            await api.post('/onboarding/verify-submission', {
                submissionId: submission._id,
                status: finalStatus,
                remarks,
                verifiedDocuments: docArray
            });

            toast.success(`Onboarding ${finalStatus.toLowerCase()}`);
            onUpdate?.();
        } catch (error) {
            toast.error('Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    if (!submission) return null;

    const sections = submission.templateId.sections;
    const responses = submission.responses;

    return (
        <div className="bg-slate-50 min-h-screen flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <User size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{submission.candidateId.name}</h2>
                        <p className="text-slate-500 text-xs font-medium">Onboarding Submission • {submission.templateId.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        submission.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 
                        submission.status === 'VERIFICATION' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {submission.status}
                    </span>
                </div>
            </div>

            <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
                {/* Left: Form Content */}
                <div className="lg:col-span-2 space-y-8">
                    {sections.map((section) => (
                        <div key={section.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">{section.title}</h3>
                            </div>
                            <div className="p-8 space-y-6">
                                {section.fields.map((field) => {
                                    const value = responses[field.id];
                                    const isFile = field.type === 'file';
                                    const docStatus = verifiedDocs[field.id]?.status;

                                    return (
                                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                            <div className="md:col-span-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{field.label}</p>
                                            </div>
                                            <div className="md:col-span-2">
                                                {isFile ? (
                                                    value ? (
                                                        <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all group">
                                                            <FileText size={18} />
                                                            <span className="text-xs font-bold truncate">View Attached Document</span>
                                                            <ExternalLink size={14} className="ml-auto opacity-0 group-hover:opacity-100" />
                                                        </a>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic font-medium">Not uploaded</p>
                                                    )
                                                ) : (
                                                    <p className="text-sm font-semibold text-slate-700">{value || '--'}</p>
                                                )}
                                            </div>
                                            <div className="md:col-span-1 flex justify-end gap-2">
                                                {isFile && value && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleVerifyDoc(field.id, 'APPROVED')}
                                                            className={`p-2 rounded-lg transition-all ${docStatus === 'APPROVED' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}
                                                        >
                                                            <CheckCircle size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleVerifyDoc(field.id, 'REJECTED')}
                                                            className={`p-2 rounded-lg transition-all ${docStatus === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500'}`}
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: Verification Action */}
                <div className="space-y-6">
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 sticky top-32">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Shield size={14} className="text-indigo-500" /> Final Decision
                        </h4>

                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                                <AlertCircle size={18} className="text-amber-500 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed">
                                    Ensure all mandatory documents are cross-verified before completing the onboarding.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">HR Remarks / Feedback</label>
                                <textarea 
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="Enter verification notes..."
                                    rows={4}
                                />
                            </div>

                            <div className="pt-4 space-y-3">
                                <button 
                                    onClick={() => submitVerification('COMPLETED')}
                                    disabled={verifying}
                                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                                >
                                    <CheckCircle size={18} />
                                    Mark as Completed
                                </button>
                                <button 
                                    onClick={() => submitVerification('REJECTED')}
                                    disabled={verifying}
                                    className="w-full py-4 bg-white border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                                >
                                    <XCircle size={18} />
                                    Reject Submission
                                </button>
                            </div>
                        </div>

                        {/* Audit Log Hint */}
                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="flex items-center gap-3 text-slate-400">
                                <Clock size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Last Activity: 2 hours ago</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
