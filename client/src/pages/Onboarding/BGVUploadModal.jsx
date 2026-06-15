import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, ExternalLink, ShieldCheck, CheckCircle2, Trash2 } from 'lucide-react';
import api, { API_ROOT } from '../../utils/api';
import toast from 'react-hot-toast';

function BGVUploadModal({ isOpen, onClose, applicationId, isEmbedded = false }) {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [removingDocId, setRemovingDocId] = useState(null);

    const docTypes = [
        { key: 'aadhaar', label: 'Aadhaar Card', sub: 'Front & Back preferred' },
        { key: 'pan', label: 'PAN Card', sub: 'Official government card' },
        { key: 'bank_proof', label: 'Bank Proof', sub: 'Passbook or Cancelled Cheque' },
        { key: 'education', label: 'Education Docs', sub: 'Latest Degree or Marksheet' },
        { key: 'experience', label: 'Experience Proof', sub: 'Relieving or Experience Letter' }
    ];

    useEffect(() => {
        if ((isOpen || isEmbedded) && applicationId) {
            fetchExistingDocs();
        }
    }, [isOpen, isEmbedded, applicationId]);

    useEffect(() => {
        if (!isEmbedded && isOpen) {
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100%';
        } else {
            document.documentElement.style.overflow = 'unset';
            document.body.style.overflow = 'unset';
            document.body.style.height = 'auto';
        }
        return () => {
            document.documentElement.style.overflow = 'unset';
            document.body.style.overflow = 'unset';
            document.body.style.height = 'auto';
        };
    }, [isOpen, isEmbedded]);

    const fetchExistingDocs = async () => {
        try {
            const response = await api.get(`/candidate/application/bgv-documents/${applicationId}`);
            if (response.data.success) {
                setDocuments(response.data.documents || []);
            }
        } catch (error) {
            console.error('Fetch BGV Docs Error:', error);
        }
    };

    const handleFileUpload = async (file, type) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('type', type);
        formData.append('document', file);

        setUploading(true);
        try {
            const response = await api.post(`/candidate/application/bgv-documents/${applicationId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                toast.success(`${type.replace('_', ' ')} uploaded`);
                fetchExistingDocs();
            }
        } catch (error) {
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveDocument = async (existing) => {
        const documentId = existing?.id || existing?._id;
        if (!documentId || removingDocId) return;

        const ok = window.confirm('Remove this uploaded document?');
        if (!ok) return;

        setRemovingDocId(documentId);
        try {
            await api.delete(`/candidate/application/bgv-documents/${applicationId}/${documentId}`);
            toast.success('Document removed');
            fetchExistingDocs();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Remove failed');
        } finally {
            setRemovingDocId(null);
        }
    };

    if (!isOpen && !isEmbedded) return null;

    const content = (
        <div className={`bg-white rounded-2xl w-full ${isEmbedded ? '' : 'max-w-2xl max-h-[85vh] flex flex-col shadow-[0_32px_80px_rgba(0,0,0,0.4)] overflow-hidden border border-white/20'}`}>
            
            {/* Header - Very Compact */}
            <div className={`px-6 py-3 border-b border-slate-50 flex items-center justify-between bg-white/50 relative overflow-hidden ${isEmbedded ? 'rounded-t-2xl' : ''}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-30" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
                        <ShieldCheck size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">Background <span className="text-blue-600">Verification</span></h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <p className="text-[7px] text-slate-400 font-bold uppercase tracking-[1.5px]">Secure Document Portal</p>
                        </div>
                    </div>
                </div>
                {!isEmbedded && (
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-all group relative z-10">
                        <X size={20} className="group-hover:rotate-90 transition-transform" />
                    </button>
                )}
            </div>

            {/* Content - Compact Two Column Grid */}
            <div className={`flex-1 overflow-y-auto no-scrollbar p-5 bg-slate-50/50`}>
                {docTypes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {docTypes.map(doc => {
                            const existing = documents.find(d => (d.name || d.documentType || '').toLowerCase() === doc.key.toLowerCase());
                            return (
                                <div key={doc.key} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-[110px]">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${existing ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'} transition-colors`}>
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-[10px] font-bold text-slate-800 tracking-wide uppercase">{doc.label}</h4>
                                            <p className="text-[8px] text-slate-400 font-medium truncate">{doc.sub}</p>
                                        </div>
                                        {existing && (
                                            <div className="ml-auto bg-emerald-500/10 text-emerald-600 p-0.5 rounded-full">
                                                <CheckCircle2 size={10} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            type="file"
                                            id={`modal-file-${doc.key}`}
                                            className="hidden"
                                            onChange={e => handleFileUpload(e.target.files[0], doc.key)}
                                        />
                                        
                                        {existing ? (
                                            <div className="flex-1 flex items-center justify-between bg-emerald-50/50 p-1.5 rounded-xl border border-emerald-100 shadow-sm">
                                                <div className="flex items-center gap-2 pl-1">
                                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-100">
                                                        <CheckCircle2 size={14} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-emerald-700 uppercase tracking-wider">
                                                            {existing.status === 'VERIFIED' ? 'Verified' : 
                                                             existing.status === 'REJECTED' ? 'Action' : 
                                                             'Uploaded'}
                                                        </span>
                                                        <span className="text-[6px] text-emerald-600/60 font-bold uppercase tracking-tight">
                                                            {existing.status === 'VERIFIED' ? 'Validated' : 
                                                             existing.status === 'REJECTED' ? 'Rejected' : 
                                                             'Encrypted'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    {/* View button removed as requested */}
                                                    <label
                                                        htmlFor={`modal-file-${doc.key}`}
                                                        className="w-7 h-7 flex items-center justify-center bg-white text-slate-400 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer transition-all active:scale-95"
                                                        title="Replace"
                                                    >
                                                        <Upload size={12} />
                                                    </label>
                                                    {existing.status !== 'VERIFIED' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDocument(existing)}
                                                            disabled={removingDocId === (existing.id || existing._id)}
                                                            className="w-7 h-7 flex items-center justify-center bg-white text-rose-500 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50"
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <label
                                                htmlFor={`modal-file-${doc.key}`}
                                                className={`cursor-pointer h-8 w-full rounded-lg font-black text-[8px] uppercase tracking-[1px] transition-all flex items-center justify-center gap-2 bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0`}
                                            >
                                                {uploading ? (
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                                        <span>...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload size={14} />
                                                        <span>Upload</span>
                                                    </>
                                                )}
                                            </label>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer - Very Slim */}
            <div className="px-5 py-3 border-t border-slate-50 bg-white flex items-center justify-between">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[1.5px] flex items-center gap-1.5">
                    <ShieldCheck size={10} className="text-emerald-500" />
                    Secure Encrypted Submission
                </p>
                {!isEmbedded && (
                    <button
                        onClick={onClose}
                        className="px-4 h-8 bg-slate-900 text-white rounded-lg font-black text-[9px] uppercase tracking-[1.5px] hover:bg-blue-600 transition-all active:scale-95"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );

    if (isEmbedded) return content;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-500">
            {content}
        </div>
    );
}

export default BGVUploadModal;
