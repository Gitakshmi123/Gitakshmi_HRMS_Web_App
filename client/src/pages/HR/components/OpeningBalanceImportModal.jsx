import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, X } from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import * as XLSX from '@sheetjs/xlsx';

export default function OpeningBalanceImportModal({ isOpen, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    // Generate CSV template for download
    const downloadTemplate = () => {
        const headers = 'employeeId,leaveType,openingBalance,year\n';
        const rows = [
            'EMP-26-27-1000,EL,10,2026',
            'EMP-26-27-1000,CL,8,2026',
            'EMP-26-27-1000,SL,5,2026'
        ].join('\n');
        
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'opening_balance_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const ext = selectedFile.name.split('.').pop().toLowerCase();
            if (['csv', 'xlsx', 'xls'].includes(ext)) {
                setErrorMsg('');
                setFile(selectedFile);
                setResult(null);
            } else {
                setErrorMsg('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
                setFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        setErrorMsg('');

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length < 2) {
                        setErrorMsg('No valid rows found in the file.');
                        setLoading(false);
                        return;
                    }

                    const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
                    const empIdx = headers.findIndex(h => h.includes('employee') || h.includes('emp'));
                    const typeIdx = headers.findIndex(h => h.includes('leave') || h.includes('type'));
                    const balIdx = headers.findIndex(h => h.includes('opening') || h.includes('balance') || h.includes('bal'));
                    const yearIdx = headers.findIndex(h => h.includes('year') || h.includes('yr'));

                    if (empIdx === -1 || typeIdx === -1 || balIdx === -1) {
                        setErrorMsg('Required columns not found. Ensure sheet has Employee Code/ID, Leave Type, and Opening Balance.');
                        setLoading(false);
                        return;
                    }

                    const parsedData = [];
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;
                        
                        const isRowEmpty = row.every(val => val === null || val === undefined || String(val).trim() === '');
                        if (isRowEmpty) continue;

                        const employeeId = String(row[empIdx] || '').trim();
                        const leaveType = String(row[typeIdx] || '').trim();
                        const openingBalance = parseFloat(row[balIdx]);
                        const year = yearIdx !== -1 ? parseInt(row[yearIdx]) || new Date().getFullYear() : new Date().getFullYear();

                        parsedData.push({
                            employeeId,
                            leaveType,
                            openingBalance,
                            year
                        });
                    }

                    if (parsedData.length === 0) {
                        setErrorMsg('No valid rows found in the file.');
                        setLoading(false);
                        return;
                    }

                    const res = await api.post('/hr/leaves/analytics/import-opening-balances', parsedData);
                    setResult(res.data);
                    showToast('success', 'Import Done', `Processed ${parsedData.length} records.`);
                    onSuccess?.();
                } catch (err) {
                    console.error(err);
                    setErrorMsg(err.response?.data?.error || 'Failed to import records.');
                } finally {
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            console.error(err);
            setErrorMsg('Failed to read file.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Bulk Import Opening Balances</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Upload Excel/CSV sheets to set balances in bulk</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    
                    {/* Template download link */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex gap-3">
                            <Download className="text-blue-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">Need the CSV Template?</h4>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Download our standardized CSV template structure before editing.</p>
                            </div>
                        </div>
                        <button 
                            onClick={downloadTemplate}
                            className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                            Download
                        </button>
                    </div>

                    {/* File Dropzone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-3xl p-8 text-center bg-slate-50/30 hover:bg-slate-50/70 transition-all relative">
                        <input 
                            type="file" 
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-400">
                                <Upload size={22} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-700">
                                    {file ? file.name : 'Select or Drag CSV/Excel File'}
                                </h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    {file ? `${(file.size / 1024).toFixed(2)} KB` : 'CSV, XLSX, XLS files supported'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl flex gap-3 items-start">
                            <AlertCircle className="shrink-0 mt-0.5" size={16} />
                            <span className="text-xs font-semibold">{errorMsg}</span>
                        </div>
                    )}

                    {/* Result Summary */}
                    {result && (
                        <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/30">
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-tight flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                Import Summary
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center">
                                    <div className="text-emerald-700 font-bold text-xl">{result.successCount}</div>
                                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Successfully Imported</div>
                                </div>
                                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-center">
                                    <div className="text-rose-700 font-bold text-xl">{result.failCount}</div>
                                    <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Failed Rows</div>
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Errors</h4>
                                    <div className="max-h-[150px] overflow-y-auto text-xs text-rose-600 bg-rose-50/30 border border-rose-100/50 p-3 rounded-xl font-medium divide-y divide-rose-100/50">
                                        {result.errors.map((err, idx) => (
                                            <div key={idx} className="py-1 first:pt-0 last:pb-0">{err}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50/50 justify-end">
                    <button 
                        onClick={onClose} 
                        className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                        Close
                    </button>
                    <button 
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Importing...
                            </>
                        ) : 'Import Now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
