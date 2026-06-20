import React, { useState, useRef } from 'react';
import api from '../../utils/api';
import { Upload, Download, X, AlertCircle, CheckCircle, Loader2, TrendingUp } from 'lucide-react';
import * as XLSX from '@sheetjs/xlsx';
import { showToast } from '../../utils/uiNotifications';

export default function DesignationExcelUploadModal({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedData, setUploadedData] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const normalizeColumnName = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const getFieldValue = (row, patterns) => {
    for (const key of Object.keys(row)) {
      const normKey = normalizeColumnName(key);
      if (patterns.some(p => normKey === p || normKey.startsWith(p))) {
        const val = String(row[key] || '').trim();
        if (val) return val;
      }
    }
    return '';
  };

  const validateRow = (row, rowIndex) => {
    const errors = [];
    const warnings = [];

    const title = getFieldValue(row, ['designationtitle', 'designationname', 'title', 'name']);
    const deptCode = getFieldValue(row, ['departmentcode', 'department', 'deptcode']);

    if (!title) errors.push('Designation Title is missing (Required)');
    else if (title.length < 2) warnings.push('Designation Title should be at least 2 characters');

    if (!deptCode) errors.push('Department Code is missing (Required for mapping)');

    return { errors, warnings };
  };

  const validateFileStructure = (data) => {
    const errors = [];
    const warnings = [];

    if (!data || data.length === 0) {
      errors.push('Excel file is empty. Please fill in the downloaded template and upload it.');
      return { errors, warnings };
    }

    const firstRow = data[0];
    const availableColumns = Object.keys(firstRow || {}).filter(col => col !== undefined && col !== null && String(col).trim() !== '');
    const normalizedAvailable = availableColumns.map(col => normalizeColumnName(col)).filter(Boolean);

    const requiredChecks = [
      { display: 'Designation Title', patterns: ['designationtitle', 'designationname', 'title', 'name'] },
      { display: 'Department Code', patterns: ['departmentcode', 'department', 'deptcode'] }
    ];

    const missingCols = [];
    requiredChecks.forEach(({ display, patterns }) => {
      const found = normalizedAvailable.some(norm => patterns.some(p => norm === p || norm.startsWith(p)));
      if (!found) missingCols.push(display);
    });

    if (missingCols.length > 0) {
      errors.push(`Missing required columns: ${missingCols.join(', ')}.`);
      return { errors, warnings };
    }

    data.forEach((row, idx) => {
      const { errors: rowErrors, warnings: rowWarnings } = validateRow(row, idx + 2);
      rowErrors.forEach(err => errors.push(`Row ${idx + 2}: ${err}`));
      rowWarnings.forEach(warn => warnings.push(`Row ${idx + 2}: ${warn}`));
    });

    return { errors, warnings };
  };

  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'Designation Title': 'Software Engineer',
          'Designation Code': 'SE',
          'Department Code': 'ENG'
        },
        {
          'Designation Title': 'HR Executive',
          'Designation Code': 'HR-EXEC',
          'Department Code': 'HR'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Highlight headers
      ws['!cols'] = [ { wch: 25 }, { wch: 20 }, { wch: 20 } ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Designations");
      XLSX.writeFile(wb, `Designation_Template_${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error('Template download failed:', err);
      showToast('error', 'Download Failed', 'Failed to generate template.');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setUploadErrors(['Please select a file to upload']);
      setUploadedFile(null);
      return;
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const validExtensions = /\.(xlsx|xls|csv)$/i;

    if (!validExtensions.test(file.name) && !validTypes.includes(file.type)) {
      setUploadErrors(['Invalid file format. Please upload .xlsx, .xls, or .csv file']);
      setUploadedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadErrors(['File size exceeds 5MB limit']);
      setUploadedFile(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        const jsonData = rawData.filter(row => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(v => String(v).trim());
        });

        if (jsonData.length === 0) {
          setUploadErrors(['Excel file is empty. Please add designation records.']);
          setUploadedFile(null);
          return;
        }

        if (jsonData.length > 1000) {
          setUploadErrors(['File contains more than 1000 records. Please split into multiple files.']);
          setUploadedFile(null);
          return;
        }

        const { errors, warnings } = validateFileStructure(jsonData);

        if (errors.length > 0) {
          setUploadErrors(errors);
          setValidationWarnings([]);
          setUploadedFile(null);
          setUploadedData(null);
          return;
        }

        setUploadErrors([]);
        setValidationWarnings(warnings);
        setUploadedFile(file);

        setUploadedData({
          fileName: file.name,
          rowCount: jsonData.length,
          allData: jsonData
        });

      } catch (err) {
        console.error('File parsing error:', err);
        setUploadErrors([err?.message || 'Failed to read file. Make sure it is a valid Excel file.']);
        setUploadedFile(null);
      }
    };

    reader.onerror = () => {
      setUploadErrors(['Failed to read the file']);
      setUploadedFile(null);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSubmitUpload = async () => {
    if (!uploadedData) return;

    try {
      setUploading(true);
      setUploadResult(null);

      const payload = {
        records: uploadedData.allData
      };

      const res = await api.post('/designations/bulk-upload', payload);

      if (res.data) {
        if (res.data.success === false) {
          const errorMessage = res.data.message || 'Failed to upload designations. Please try again.';
          const errors = Array.isArray(res.data.errors) && res.data.errors.length > 0
            ? res.data.errors
            : [errorMessage];
          setUploadErrors(errors);
          showToast('error', 'Upload Failed', errorMessage, 6);
          return;
        }

        const result = {
          uploadedCount: res.data.uploadedCount || 0,
          failedCount: res.data.failedCount || 0,
          totalRecords: uploadedData.rowCount,
          successRate: uploadedData.rowCount > 0
            ? ((res.data.uploadedCount || 0) / uploadedData.rowCount * 100).toFixed(2)
            : '0.00',
          errors: res.data.errors || [],
          warnings: res.data.warnings || []
        };

        setUploadResult(result);
        setShowSuccessMessage(true);

        setUploadedFile(null);
        setUploadErrors([]);
        setValidationWarnings([]);
        setUploadedData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (onSuccess) onSuccess(result);
      } else {
        setUploadErrors(['Upload failed - unexpected response format']);
        showToast('error', 'Upload Failed', 'Unexpected response format.');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        setUploadErrors(err.response.data.errors);
      } else {
        setUploadErrors([errorMessage || 'Failed to upload designations. Please try again.']);
      }
      showToast('error', 'Upload Failed', errorMessage || 'Failed to upload designations.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  if (showSuccessMessage && uploadResult) {
    const isFailure = uploadResult.uploadedCount === 0;
    const isPartial = uploadResult.uploadedCount > 0 && uploadResult.failedCount > 0;

    let title = "Upload Successful! ✅";
    let icon = <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />;
    let bgPulse = "bg-green-400/20";
    let bgCircle = "bg-green-100 dark:bg-green-900/30";

    if (isFailure) {
      title = "Upload Failed! ❌";
      icon = <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />;
      bgPulse = "bg-red-400/20";
      bgCircle = "bg-red-100 dark:bg-red-900/30";
    } else if (isPartial) {
      title = "Completed with Errors ⚠️";
      icon = <TrendingUp className="w-12 h-12 text-amber-600 dark:text-amber-400" />;
      bgPulse = "bg-amber-400/20";
      bgCircle = "bg-amber-100 dark:bg-amber-900/30";
    }

    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className={`absolute inset-0 ${bgPulse} rounded-full blur-lg`}></div>
              <div className={`relative p-4 ${bgCircle} rounded-full`}>
                {icon}
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{title}</h2>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-2xl font-black text-green-600 dark:text-green-400">{uploadResult.uploadedCount}</div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">Uploaded</div>
              </div>
              <div>
                <div className="text-2xl font-black text-red-600 dark:text-red-400">{uploadResult.failedCount}</div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{uploadResult.successRate}%</div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">Success</div>
              </div>
            </div>
          </div>

          {uploadResult.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-left max-h-48 overflow-y-auto">
              <p className="text-xs font-black text-red-700 dark:text-red-400 mb-2">❌ Errors ({uploadResult.errors.length})</p>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                {uploadResult.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx} className="truncate">• {err}</li>
                ))}
                {uploadResult.errors.length > 5 && <li className="text-red-500">... and {uploadResult.errors.length - 5} more</li>}
              </ul>
            </div>
          )}

          {uploadResult.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 text-left max-h-48 overflow-y-auto">
              <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-2">⚠️ Warnings ({uploadResult.warnings.length})</p>
              <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                {uploadResult.warnings.slice(0, 5).map((warn, idx) => (
                  <li key={idx} className="truncate">⚠️ {warn}</li>
                ))}
                {uploadResult.warnings.length > 5 && <li className="text-amber-500">... and {uploadResult.warnings.length - 5} more</li>}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setShowSuccessMessage(false);
              setUploadedFile(null);
              setUploadErrors([]);
              setValidationWarnings([]);
              setUploadedData(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              onClose();
            }}
            className="w-full py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 p-4 border-b border-blue-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Bulk Add Designations</h3>
              <p className="text-xs text-blue-100 mt-0.5">Import designation data from Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Template Download Section */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Download className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Download template</p>
                <p className="text-xs text-slate-600 mt-0.5">Includes required columns: Designation Title, Department Code</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* File Upload Section */}
          <div>
            {!uploadedFile ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="desig-file-upload"
                />
                <label htmlFor="desig-file-upload" className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-7 text-center hover:border-blue-500 hover:bg-blue-50/40 transition">
                    <div className="mb-3 flex justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                        <Upload className="w-7 h-7 text-slate-500" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1.5">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500">Supports: Excel (.xlsx, .xls) and CSV files</p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><span className="text-lg">📄</span></div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{uploadedFile.name}</p>
                    <p className="text-xs text-slate-600">{(uploadedFile.size / 1024).toFixed(2)} KB • {uploadedData?.rowCount} records</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUploadedFile(null);
                    setUploadErrors([]);
                    setValidationWarnings([]);
                    setUploadedData(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-2 hover:bg-blue-200 rounded-lg transition"
                >✕</button>
              </div>
            )}
          </div>

          {/* Error/Warning Messages */}
          {uploadErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-black text-red-700 uppercase mb-2">❌ Validation Errors</p>
              <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {uploadErrors.slice(0, 8).map((err, idx) => <li key={idx}>• {err}</li>)}
                {uploadErrors.length > 8 && <li>... and {uploadErrors.length - 8} more errors</li>}
              </ul>
            </div>
          )}

          {validationWarnings.length > 0 && uploadErrors.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-black text-amber-700 uppercase mb-2">⚠️ Warnings ({validationWarnings.length})</p>
              <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-y-auto">
                {validationWarnings.slice(0, 8).map((warn, idx) => <li key={idx}>• {warn}</li>)}
                {validationWarnings.length > 8 && <li>... and {validationWarnings.length - 8} more warnings</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-lg text-sm transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitUpload}
            disabled={!uploadedFile || uploadErrors.length > 0 || uploading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/20"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
