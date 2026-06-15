import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    FileText, Download, Eye, Search,
    Calendar, CheckCircle, Clock, ShieldCheck,
    Info, ExternalLink, Filter, ArrowUpRight
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { showToast } from '../../utils/uiNotifications';
import clsx from 'clsx';
import { useRBAC } from '../../context/RBACContext';

const Card = ({ children, className = "" }) => (
  <div className={clsx("bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 transition-all hover:shadow-md", className)}>
    {children}
  </div>
);

export default function MyDocuments() {
    const { hasPermission, loading: permissionLoading } = useRBAC();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const canViewDocuments = hasPermission('employee.documents', 'view');

    useEffect(() => {
        if (permissionLoading || !canViewDocuments) {
            setLoading(false);
            setDocuments([]);
            return;
        }
        fetchDocuments();
    }, [canViewDocuments, permissionLoading]);

    const fetchDocuments = async () => {
        if (!canViewDocuments) return;
        try {
            setLoading(true);
            const res = await api.get('/letters/generated-letters'); 
            setDocuments(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch documents', error);
            showToast('error', 'Sync Failed', 'Could not retrieve your documents');
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredDocs = documents.filter(doc => 
        (doc.templateId?.name || doc.letterType || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (permissionLoading) {
        return null;
    }

    if (!canViewDocuments) {
        return (
            <div className="w-full min-h-screen bg-white p-3 font-inter">
                <div className="flex min-h-[320px] items-center justify-center">
                    <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                            <Info size={28} />
                        </div>
                        <h3 className="text-[20px] font-semibold text-[#334155]">Documents Access Restricted</h3>
                        <p className="mt-2 text-sm font-medium text-[#64748B]">
                            You do not currently have permission to view official documents.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white min-h-screen p-3 font-inter animate-in fade-in duration-500">
            <div className="w-full space-y-6">
                
                {/* 1. Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
                    <div className="space-y-1">
                        <h1 className="text-[24px] font-semibold text-[#334155] tracking-tight">Official Documents</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2563EB] transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                className="w-full md:w-64 h-[40px] pl-10 pr-4 bg-white border border-[#E2E8F0] rounded-lg text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="h-[40px] px-4 rounded-lg bg-white border border-[#E2E8F0] text-[#334155] text-xs font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                            <Filter size={14} className="text-[#64748B]" /> Latest First
                        </button>
                    </div>
                </div>

                {/* 2. Main Content Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-48 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <div className="bg-white border border-dashed border-[#E2E8F0] rounded-xl py-24 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 mb-4 border border-[#E2E8F0] shadow-inner">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#334155]">No Documents Found</h3>
                        <p className="text-[13px] text-[#64748B] font-medium mt-1">Check back later for any issued letters from HR.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDocs.map((doc) => (
                            <div key={doc._id} className="group bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all duration-300 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-lg flex items-center justify-center border border-blue-100/50 group-hover:scale-110 transition-transform">
                                            <FileText size={24} />
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-2 py-0.5 bg-slate-100 text-[#334155] text-[10px] font-bold uppercase tracking-wider rounded-md">
                                                {doc.letterType || 'Letter'}
                                            </span>
                                            <span className="text-[11px] font-medium text-[#64748B] flex items-center gap-1 opacity-60 italic">
                                                <Calendar size={10} /> {formatDateDDMMYYYY(doc.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-[16px] font-semibold text-[#334155] leading-tight mb-1 group-hover:text-[#2563EB] transition-colors">
                                            {doc.templateId?.name || 'Official Communication'}
                                        </h3>
                                        <p className="text-[13px] text-[#64748B] font-medium line-clamp-2 leading-relaxed opacity-70 italic">
                                            Authorized document issued by HR for your personal and professional record.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center gap-3">
                                    <button
                                        onClick={() => window.open(doc.pdfUrl, '_blank')}
                                        className="flex-1 h-[38px] flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] text-[#334155] rounded-lg text-xs font-semibold hover:bg-white hover:border-[#CBD5E1] transition-all active:scale-[0.98]"
                                    >
                                        <Eye size={14} /> Preview
                                    </button>
                                    <button
                                        className="w-[38px] h-[38px] flex items-center justify-center bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 transition-all shadow-blue-500/10 active:scale-[0.98]"
                                        title="Download Copy"
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
