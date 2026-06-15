import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import api from '../../../utils/api';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import {
    FileText, Download, Filter, Search, Eye, X,
    Settings2, AlertTriangle, ChevronLeft, ChevronRight,
    Receipt, Calendar, RefreshCw
} from 'lucide-react';
import PayrollCorrectionModal from '../../../components/Payroll/PayrollCorrectionModal';
import { Tooltip, Spin, Radio } from 'antd';
import { showToast } from '../../../utils/uiNotifications';
import usePagePermissions from '../../../hooks/usePagePermissions';

const ITEMS_PER_PAGE = 10;
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString('default', { month: 'long' })
);

export default function Payslips() {
    const { canView, canCreate, canEdit } = usePagePermissions('payroll.payslips');
    const canSeePayslips = canView || canEdit;
    const [payslips, setPayslips] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [correctionState, setCorrectionState] = useState({ visible: false, run: null });
    const [templates, setTemplates] = useState([]);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [selectedPayslipForDownload, setSelectedPayslipForDownload] = useState(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [activeMode, setActiveMode] = useState('download');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (canSeePayslips) loadPayslips();
        else setPayslips([]);
        if (canView || canCreate) loadTemplates();
    }, [selectedMonth, selectedYear, canSeePayslips, canView, canCreate]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedMonth, selectedYear]);

    async function loadTemplates() {
        try {
            const res = await api.get('/payslip-templates');
            const activeTemplates = (res.data?.data || []).filter(t => t.isActive);
            setTemplates(activeTemplates);
            const defaultTpl = activeTemplates.find(t => t.isDefault);
            if (defaultTpl) setSelectedTemplateId(defaultTpl._id);
            else if (activeTemplates.length > 0) setSelectedTemplateId(activeTemplates[0]._id);
        } catch (err) { console.error('Failed to load templates', err); }
    }

    async function loadPayslips() {
        if (!canSeePayslips) return;
        setLoading(true);
        try {
            const res = await api.get(`/payroll/payslips`);
            setPayslips(res.data?.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    // Filter Logic
    const filtered = payslips.filter(p => {
        if (p.year !== selectedYear) return false;
        if (selectedMonth && p.month !== selectedMonth) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const empName = p.employeeInfo?.name?.toLowerCase() || '';
            const empId = p.employeeInfo?.employeeId?.toLowerCase() || '';
            return empName.includes(term) || empId.includes(term);
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleDownloadClick = (payslip, mode = 'download') => {
        setSelectedPayslipForDownload(payslip);
        setActiveMode(mode);
        if (templates.length <= 1) {
            downloadPDF(payslip, templates[0]?._id, mode);
        } else {
            setShowTemplateModal(true);
        }
    };

    async function downloadPDF(payslip, templateId, mode = 'download') {
        if (!payslip) return;
        setDownloadingId(payslip._id);
        try {
            showToast('info', 'Processing', mode === 'view' ? 'Opening payslip...' : 'Generating your payslip PDF...');
            const endpoint = templateId
                ? `/payslip-templates/render/${payslip._id}`
                : `/payroll/payslips/${payslip._id}/generate-pdf`;
            const payload = templateId ? { templateId } : {};
            const res = await api.post(endpoint, payload, { responseType: 'blob' });
            let blob = res.data;
            if (blob.type === '' || blob.type === 'application/octet-stream') {
                blob = new Blob([blob], { type: 'application/pdf' });
            }
            console.log(`[PDF_CLIENT] Response received. Type: ${blob.type}, Size: ${blob.size} bytes`);
            if (blob.type.includes('json') || blob.type.includes('html')) {
                const text = await blob.text();
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.message || 'Server failed to generate PDF');
                } catch {
                    throw new Error('Server returned an error page instead of PDF. Please check backend logs.');
                }
            }
            if (blob.size < 1000) {
                console.warn('Possible small PDF/Error:', blob.size);
                const text = await blob.text();
                if (text.includes('error') || text.includes('not found')) {
                    throw new Error(`PDF Generation Warning: ${text.substring(0, 100)}`);
                }
            }
            const url = window.URL.createObjectURL(blob);
            if (mode === 'view') {
                const win = window.open('', '_blank');
                if (win) win.location.href = url;
                else window.location.href = url;
            } else {
                const link = document.createElement('a');
                link.href = url;
                const safeName = (payslip.employeeInfo?.name || 'Payslip').replace(/[^a-z0-9]/gi, '_');
                const fileName = `Payslip_${safeName}_${payslip.month}-${payslip.year}.pdf`;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 5000);
            showToast('success', mode === 'view' ? 'Preview Opened' : 'Downloaded', 'Payslip processed successfully');
            setShowTemplateModal(false);
        } catch (err) {
            console.error('PDF operation failed', err);
            let errorMessage = err.message || 'Could not process PDF.';
            if (err.hrms?.type === 'blob_error') {
                try {
                    const text = await err.hrms.blob.text();
                    const json = JSON.parse(text);
                    errorMessage = json.message || errorMessage;
                } catch {
                    errorMessage = 'Server error (HTML). Check template settings.';
                }
            }
            showToast('error', 'Operation Failed', errorMessage);
        } finally {
            setDownloadingId(null);
        }
    }

    return (
        <div className="space-y-4 p-4 animate-in fade-in duration-500 overflow-x-hidden w-full">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="relative rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="overflow-hidden bg-white dark:bg-slate-900 p-5 pr-44 rounded-2xl min-h-[72px] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] flex items-center justify-center border border-indigo-100 dark:border-indigo-800/40 shadow-sm shrink-0">
                        <Receipt size={18} strokeWidth={2.5} />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                            Payslips
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            View and download generated payslips
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-full bg-indigo-50/50 dark:bg-indigo-900/10 blur-3xl rounded-full pointer-events-none -mr-32 -mt-10" />
                </div>
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    <button
                        onClick={loadPayslips}
                        disabled={loading}
                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#4F46E5] hover:border-[#4F46E5] rounded-xl transition shadow-sm"
                        title="Refresh"
                    >
                        <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Filters + Search ───────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Filter icon */}
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <Filter size={12} strokeWidth={2.5} /> Filters
                </div>

                {/* Month select */}
                <div className="relative">
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(parseInt(e.target.value))}
                        className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-[#4F46E5] shadow-sm cursor-pointer"
                    >
                        <option value="">All Months</option>
                        {MONTH_NAMES.map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                    </select>
                    <Calendar size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Year select */}
                <div className="relative">
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-widest rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-[#4F46E5] shadow-sm cursor-pointer"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <Calendar size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[180px] relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2.5} />
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-200 placeholder-slate-300 focus:outline-none focus:border-[#4F46E5] shadow-sm"
                    />
                </div>

                {/* Count pill */}
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                    {filtered.length} Record{filtered.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* ── Table ──────────────────────────────────────────── */}
            <div className="overflow-x-auto w-full rounded-2xl no-scrollbar">
                <div style={{ minWidth: '760px' }} className="space-y-1.5">

                    {/* Column headers */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.3fr] px-4 py-2 opacity-60">
                        {['Employee', 'Period', 'Gross Pay', 'Net Pay', 'Generated On', 'Actions'].map((h, i) => (
                            <div key={h} className={`text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center ${i > 0 ? 'pl-3 border-l border-slate-200 dark:border-slate-800' : ''}`}>
                                {h}
                            </div>
                        ))}
                    </div>

                    {/* Loading */}
                    {loading ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 flex flex-col items-center gap-3 shadow-sm">
                            <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Payslips...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 flex flex-col items-center gap-4 shadow-sm">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-[#4F46E5]">
                                <FileText size={32} strokeWidth={1.5} />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                No payslips found for selected period
                            </p>
                        </div>
                    ) : paginated.map(p => (
                        <div
                            key={p._id}
                            className="bg-white dark:bg-slate-900 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.3fr] items-center px-4 py-3 rounded-2xl border border-transparent dark:border-slate-800/40 shadow-sm hover:shadow-[0_4px_12px_rgba(20,184,166,0.10)] hover:border-[#4F46E5]/20 transition-all group"
                        >
                            {/* Employee */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] flex items-center justify-center text-xs font-bold border border-indigo-100 dark:border-indigo-800/40 shadow-sm shrink-0">
                                    {(p.employeeInfo?.name || 'E').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase truncate group-hover:text-[#4F46E5] transition-colors leading-none">
                                        {p.employeeInfo?.name}
                                    </div>
                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-0.5 truncate">
                                        {p.employeeInfo?.employeeId}
                                    </div>
                                </div>
                            </div>

                            {/* Period */}
                            <div className="pl-3 border-l border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                    {new Date(0, p.month - 1).toLocaleString('default', { month: 'short' })} {p.year}
                                </span>
                            </div>

                            {/* Gross Pay */}
                            <div className="pl-3 border-l border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                    ₹{(p.grossEarnings || 0).toLocaleString()}
                                </span>
                            </div>

                            {/* Net Pay */}
                            <div className="pl-3 border-l border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-bold text-emerald-600">
                                    ₹{(p.netPay || 0).toLocaleString()}
                                </span>
                            </div>

                            {/* Generated On */}
                            <div className="pl-3 border-l border-slate-100 dark:border-slate-800">
                                <span className="text-[9px] font-bold text-slate-400">
                                    {formatDateDDMMYYYY(p.generatedAt)}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                                {canEdit && (
                                     <Tooltip title="Correct / Adjust in future payroll">
                                         <button
                                             onClick={() => setCorrectionState({
                                                 visible: true,
                                                 run: { _id: p.payrollRunId, month: p.month, year: p.year }
                                             })}
                                             className="flex items-center gap-1 px-2 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-500 hover:text-white rounded-xl border border-orange-100 dark:border-orange-800/40 text-[8px] font-bold uppercase tracking-widest transition shadow-sm"
                                         >
                                             <Settings2 size={9} /> Correct
                                         </button>
                                     </Tooltip>
                                 )}

                                 {canView && (
                                     <button
                                         onClick={() => handleDownloadClick(p, 'view')}
                                         disabled={downloadingId === p._id}
                                         className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-xl border border-emerald-100 dark:border-emerald-800/40 text-[8px] font-bold uppercase tracking-widest transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                     >
                                         {downloadingId === p._id && activeMode === 'view'
                                             ? <div className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                             : <Eye size={9} />
                                         }
                                         View PDF
                                     </button>
                                 )}

                                 {canCreate && (
                                     <button
                                         onClick={() => handleDownloadClick(p, 'download')}
                                         disabled={downloadingId === p._id}
                                         className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-500 hover:text-white rounded-xl border border-blue-100 dark:border-blue-800/40 text-[8px] font-bold uppercase tracking-widest transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                     >
                                         {downloadingId === p._id && activeMode === 'download'
                                             ? <div className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                             : <Download size={9} />
                                         }
                                         Download
                                     </button>
                                 )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Pagination Bar ─────────────────────────────────── */}
            {!loading && filtered.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronLeft size={14} strokeWidth={2.5} />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                            .reduce((acc, p, idx, arr) => {
                                if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, idx) =>
                                p === '...' ? (
                                    <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-[10px] font-bold text-slate-300 dark:text-slate-600">···</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-bold uppercase tracking-widest border transition shadow-sm ${currentPage === p
                                            ? 'bg-[#4F46E5] text-white border-transparent'
                                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4F46E5] hover:text-[#4F46E5]'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )
                        }

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            )}

            {/* Correction Modal */}
            <PayrollCorrectionModal
                visible={correctionState.visible}
                onCancel={() => setCorrectionState({ visible: false, run: null })}
                payrollRun={correctionState.run}
            />

            {/* ── Template Selection Modal (Portal) ─────────────── */}
            {showTemplateModal && selectedPayslipForDownload && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100">
                                    <FileText size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight leading-none">Choose Template</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Payslip Design</p>
                                </div>
                            </div>
                            <button onClick={() => setShowTemplateModal(false)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl transition">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                Select a design for{' '}
                                <span className="font-bold text-slate-800 dark:text-white">
                                    {selectedPayslipForDownload?.employeeInfo?.name}
                                </span>'s payslip
                            </p>

                            {templates.length === 0 ? (
                                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">No Active Templates</p>
                                        <p className="text-[9px] font-bold text-amber-700/70 mt-0.5">Generating with system default. Go to Payslip Templates to create one.</p>
                                    </div>
                                </div>
                            ) : (
                                <Radio.Group
                                    value={selectedTemplateId}
                                    onChange={e => setSelectedTemplateId(e.target.value)}
                                    className="w-full space-y-2"
                                >
                                    {templates.map(tpl => (
                                        <Radio
                                            key={tpl._id}
                                            value={tpl._id}
                                            className="w-full p-3 rounded-xl border border-slate-200 hover:border-[#4F46E5] hover:bg-indigo-50/50 shadow-sm transition-all"
                                        >
                                            <div className="inline-flex flex-col ml-2">
                                                <span className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-2">
                                                    {tpl.name}
                                                    {tpl.isDefault && (
                                                        <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-lg font-bold uppercase tracking-widest">
                                                            Default
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">
                                                    Type: {tpl.templateType} • Updated: {new Date(tpl.updatedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </Radio>
                                    ))}
                                </Radio.Group>
                            )}
                        </div>

                        <div className="flex gap-2 px-5 pb-5">
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-bold uppercase tracking-widest transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => downloadPDF(selectedPayslipForDownload, selectedTemplateId, activeMode)}
                                disabled={!selectedTemplateId || !!downloadingId}
                                className="flex-[2] py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#0d9488] text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center justify-center gap-2"
                            >
                                {downloadingId
                                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : activeMode === 'view' ? <Eye size={12} /> : <Download size={12} />
                                }
                                {activeMode === 'view' ? 'Preview & View' : 'Generate & Download'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
