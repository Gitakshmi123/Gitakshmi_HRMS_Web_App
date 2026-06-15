import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import {
    Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle,
    Trash2, Eye, Download, RefreshCw, Shield
} from 'lucide-react';
import dayjs from 'dayjs';

const DOCUMENT_TYPES = [
    { value: 'AADHAAR', label: 'Aadhaar Card', checkType: 'IDENTITY' },
    { value: 'PAN', label: 'PAN Card', checkType: 'IDENTITY' },
    { value: 'PASSPORT', label: 'Passport', checkType: 'IDENTITY' },
    { value: 'DRIVING_LICENSE', label: 'Driving License', checkType: 'IDENTITY' },
    { value: 'VOTER_ID', label: 'Voter ID', checkType: 'IDENTITY' },
    { value: 'DEGREE_CERTIFICATE', label: 'Degree Certificate', checkType: 'EDUCATION' },
    { value: 'MARKSHEET', label: 'Marksheet', checkType: 'EDUCATION' },
    { value: 'EXPERIENCE_LETTER', label: 'Experience Letter', checkType: 'EMPLOYMENT' },
    { value: 'PAYSLIP', label: 'Payslip', checkType: 'EMPLOYMENT' },
    { value: 'RELIEVING_LETTER', label: 'Relieving Letter', checkType: 'EMPLOYMENT' },
    { value: 'ADDRESS_PROOF', label: 'Address Proof', checkType: 'ADDRESS' },
    { value: 'POLICE_VERIFICATION', label: 'Police Verification', checkType: 'CRIMINAL' },
    { value: 'REFERENCE_LETTER', label: 'Reference Letter', checkType: 'REFERENCE' },
    { value: 'OTHER', label: 'Other', checkType: null }
];

const CandidateDocumentUpload = ({ candidateId }) => {
    const [bgvCase, setBgvCase] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState('');

    useEffect(() => {
        fetchBGVStatus();
    }, [candidateId]);

    const fetchBGVStatus = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/bgv/candidate/${candidateId}`);
            setBgvCase(res.data.data);
            setDocuments(res.data.data.documents || []);
        } catch (err) {
            console.error('Failed to fetch BGV status:', err);
            if (err.response?.status !== 404) {
                showToast('error', 'Error', 'Failed to load BGV status');
            }
        } finally {
            setLoading(false);
        }
    };

    const onDrop = useCallback(async (acceptedFiles) => {
        if (!selectedDocType) {
            showToast('error', 'Error', 'Please select document type first');
            return;
        }

        if (!bgvCase) {
            showToast('error', 'Error', 'No active BGV case found');
            return;
        }

        const file = acceptedFiles[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('documentType', selectedDocType);

            const docTypeInfo = DOCUMENT_TYPES.find(d => d.value === selectedDocType);
            if (docTypeInfo?.checkType) {
                formData.append('checkType', docTypeInfo.checkType);
            }

            await api.post(`/bgv/case/${bgvCase._id}/upload-document`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            showToast('success', 'Success', 'Document uploaded successfully');
            setSelectedDocType('');
            await fetchBGVStatus();
        } catch (err) {
            console.error('Failed to upload document:', err);
            showToast('error', 'Error', err.response?.data?.message || 'Failed to upload document');
        } finally {
            setUploading(false);
        }
    }, [selectedDocType, bgvCase]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: false
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!bgvCase) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center">
                <Shield size={64} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">No Active BGV Case</h3>
                <p className="text-slate-600">
                    Background verification has not been initiated yet. Please contact HR.
                </p>
            </div>
        );
    }

    if (bgvCase.isClosed) {
        return (
            <div className="bg-purple-50 rounded-2xl border-2 border-purple-200 p-12 text-center">
                <CheckCircle size={64} className="mx-auto text-purple-600 mb-4" />
                <h3 className="text-2xl font-black text-purple-900 mb-2">BGV Case Closed</h3>
                <p className="text-purple-700 mb-4">
                    Your background verification has been completed and closed.
                </p>
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold">
                    Status: {bgvCase.overallStatus}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                        <Shield size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black">Document Upload</h1>
                        <p className="text-blue-100 mt-1">Upload required documents for background verification</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 mt-6 pt-6 border-t border-white/20">
                    <div>
                        <div className="text-sm text-blue-100">Case ID</div>
                        <div className="text-xl font-black">{bgvCase.caseId}</div>
                    </div>
                    <div>
                        <div className="text-sm text-blue-100">Package</div>
                        <div className="text-xl font-black">{bgvCase.package}</div>
                    </div>
                    <div>
                        <div className="text-sm text-blue-100">Status</div>
                        <div className="text-xl font-black">{bgvCase.overallStatus}</div>
                    </div>
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                <h2 className="text-2xl font-black text-slate-900 mb-6">Upload New Document</h2>

                {/* Document Type Selector */}
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                        Select Document Type
                    </label>
                    <select
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none font-medium"
                    >
                        <option value="">-- Select Document Type --</option>
                        {DOCUMENT_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dropzone */}
                <div
                    {...getRootProps()}
                    className={`border-3 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragActive
                        ? 'border-blue-500 bg-blue-50'
                        : selectedDocType
                            ? 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
                            : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                        }`}
                >
                    <input {...getInputProps()} disabled={!selectedDocType || uploading} />
                    <Upload size={64} className={`mx-auto mb-4 ${isDragActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {uploading ? (
                        <div>
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                            <p className="text-lg font-bold text-blue-600">Uploading...</p>
                        </div>
                    ) : isDragActive ? (
                        <p className="text-lg font-bold text-blue-600">Drop the file here...</p>
                    ) : selectedDocType ? (
                        <div>
                            <p className="text-lg font-bold text-slate-900 mb-2">
                                Drag & drop your file here, or click to browse
                            </p>
                            <p className="text-sm text-slate-500">
                                Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
                            </p>
                        </div>
                    ) : (
                        <p className="text-lg font-bold text-slate-400">
                            Please select a document type first
                        </p>
                    )}
                </div>
            </div>

            {/* Uploaded Documents */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-slate-900">Uploaded Documents</h2>
                    <button
                        onClick={fetchBGVStatus}
                        className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-bold hover:bg-blue-200 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>

                {documents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <FileText size={64} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-bold">No documents uploaded yet</p>
                        <p className="text-sm mt-2">Upload your first document to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {documents.map((doc) => (
                            <div
                                key={doc._id}
                                className="border-2 border-slate-200 rounded-xl p-6 hover:shadow-lg transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="p-3 bg-blue-100 rounded-xl">
                                            <FileText size={24} className="text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-black text-slate-900">
                                                    {doc.documentType?.replace(/_/g, ' ')}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${doc.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                                                    doc.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                                        doc.status === 'UNDER_REVIEW' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {doc.status === 'VERIFIED' && <CheckCircle size={12} className="inline mr-1" />}
                                                    {doc.status === 'REJECTED' && <XCircle size={12} className="inline mr-1" />}
                                                    {doc.status === 'UNDER_REVIEW' && <Clock size={12} className="inline mr-1" />}
                                                    {doc.status}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-600 mb-1">{doc.originalName}</div>
                                            <div className="text-xs text-slate-400">
                                                Uploaded {dayjs(doc.uploadedAt).format('MMM DD, YYYY HH:mm')} •
                                                Version {doc.version} •
                                                {(doc.fileSize / 1024).toFixed(2)} KB
                                            </div>
                                            {doc.verificationRemarks && (
                                                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Remarks</p>
                                                    <p className="text-sm text-slate-700">{doc.verificationRemarks}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => window.open(doc.filePath, '_blank')}
                                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                                            title="View"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = doc.filePath;
                                                link.download = doc.originalName;
                                                link.click();
                                            }}
                                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-all"
                                            title="Download"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Required Documents Checklist */}
            {bgvCase.checks && bgvCase.checks.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-8">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <AlertCircle size={24} className="text-blue-600" />
                        Required Verifications
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bgvCase.checks.map((check) => (
                            <div
                                key={check._id}
                                className="bg-white rounded-xl p-4 border-2 border-slate-200"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-900">{check.type?.replace(/_/g, ' ')}</span>
                                    {check.status === 'VERIFIED' ? (
                                        <CheckCircle size={20} className="text-emerald-600" />
                                    ) : check.status === 'FAILED' ? (
                                        <XCircle size={20} className="text-rose-600" />
                                    ) : (
                                        <Clock size={20} className="text-amber-600" />
                                    )}
                                </div>
                                <div className={`text-xs font-bold uppercase ${check.status === 'VERIFIED' ? 'text-emerald-600' :
                                    check.status === 'FAILED' ? 'text-rose-600' :
                                        'text-amber-600'
                                    }`}>
                                    {check.status}
                                </div>
                                {check.candidateRemarks && (
                                    <div className="mt-2 text-xs text-slate-600">
                                        {check.candidateRemarks}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CandidateDocumentUpload;
