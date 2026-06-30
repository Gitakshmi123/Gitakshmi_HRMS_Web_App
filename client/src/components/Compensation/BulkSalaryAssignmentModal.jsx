import React, { useState, useRef } from 'react';
import * as XLSX from '@sheetjs/xlsx';
import { X, Upload, Check, AlertCircle, Calculator, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

export default function BulkSalaryAssignmentModal({ isOpen, onClose, onRefresh }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Employee ID': 'EMP-001', 'Proposed Annual CTC': 1200000, 'State': 'GUJARAT', 'Category': 'SKILLED', 'Effective Date': '2026-06-01' },
      { 'Employee ID': 'EMP-002', 'Proposed Annual CTC': 850000, 'State': 'MAHARASHTRA', 'Category': 'SEMI SKILLED', 'Effective Date': '2026-06-01' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Salary Assignment");
    XLSX.writeFile(wb, "Bulk_Salary_Assignment_Template.xlsx");
  };

  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);
        
        const mappedData = rawData.map(row => {
          const getVal = (keyNames) => {
             const foundKey = Object.keys(row).find(k => keyNames.some(kn => k.toLowerCase().includes(kn.toLowerCase())));
             return foundKey ? row[foundKey] : '';
          };

          return {
             employeeId: getVal(['employee id', 'empid', 'employee_id']),
             totalCTC: getVal(['proposed annual ctc', 'ctc', 'total ctc', 'annual ctc', 'proposed ctc']),
             state: getVal(['state', 'work state']),
             employeeCategory: getVal(['category', 'skill', 'employee category']),
             effectiveFrom: getVal(['effective date', 'date', 'effective from']) || undefined
          };
        }).filter(r => r.employeeId && r.totalCTC);

        setData(mappedData);
      } catch (err) {
        showToast('error', 'Error Parsing Excel', err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) processFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!data.length) return;
    try {
      setLoading(true);
      const res = await api.post('/compensation/bulk-setup', { employees: data });
      
      if (res.data.data && res.data.data.failedCount > 0) {
          console.error("Bulk Assignment Failed Rows:", res.data.data.errors);
          const errorMsg = res.data.data.errors.map(e => `Row ${e.row}: ${e.error}`).join('\n');
          showToast('error', `Failed for ${res.data.data.failedCount} rows`, errorMsg);
      } else {
          showToast('success', 'Bulk Assignment Processed', res.data.message || 'Complete');
          if (onRefresh) onRefresh();
          onClose();
      }
    } catch (err) {
      showToast('error', 'Bulk Assignment Failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <Calculator size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Salary Assignment</h2>
              <p className="text-xs text-slate-500">Calculate & assign dynamic CTC breakups for multiple employees instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            {!file ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl">
                        <div>
                            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">Download Standard Template</h4>
                            <p className="text-xs text-blue-700 dark:text-blue-300">Start by downloading our formatted Excel template, fill in the employee details and CTCs, and re-upload here.</p>
                        </div>
                        <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition">
                            <Download size={16} />
                            Download Template
                        </button>
                    </div>

                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                            isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-500">
                            <Upload size={32} />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-medium">Click to browse or drag Excel file here</p>
                        <p className="text-xs text-slate-400 mt-2">Supports .xlsx and .csv files</p>
                        <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} ref={fileInputRef} />
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="text-emerald-500" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{file.name}</h4>
                                <p className="text-xs text-slate-500">{data.length} valid employee rows found</p>
                            </div>
                        </div>
                        <button onClick={() => { setFile(null); setData([]); }} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg">
                            Upload Different File
                        </button>
                    </div>

                    {data.length > 0 ? (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700">Employee ID</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">Proposed CTC</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">State</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Category</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, 50).map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="p-3 text-xs font-medium text-slate-900 dark:text-slate-200">{row.employeeId}</td>
                                            <td className="p-3 text-xs font-bold text-emerald-600 text-right">₹{Number(row.totalCTC).toLocaleString('en-IN')}</td>
                                            <td className="p-3 text-xs text-slate-600 dark:text-slate-400 text-center">{row.state || '-'}</td>
                                            <td className="p-3 text-xs text-slate-600 dark:text-slate-400 text-center">{row.employeeCategory || '-'}</td>
                                            <td className="p-3 text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                                <Check size={12} /> Ready
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length > 50 && (
                                        <tr>
                                            <td colSpan={5} className="p-3 text-center text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800">
                                                ... and {data.length - 50} more rows
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : !parsing && (
                        <div className="p-8 text-center bg-amber-50 rounded-xl border border-amber-200">
                            <AlertCircle className="mx-auto text-amber-500 mb-2" size={24} />
                            <h4 className="text-sm font-bold text-amber-900">No Valid Data Found</h4>
                            <p className="text-xs text-amber-700 mt-1">Please make sure your Excel sheet has 'Employee ID' and 'Proposed Annual CTC' columns.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!data.length || loading}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm shadow-indigo-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            {loading ? 'Processing Breakups...' : 'Assign Salaries'}
          </button>
        </div>
      </div>
    </div>
  );
}
