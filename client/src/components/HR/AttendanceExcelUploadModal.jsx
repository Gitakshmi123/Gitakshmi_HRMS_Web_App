import React, { useState, useRef } from 'react';
import api, { API_ROOT } from '../../utils/api';
import { Upload, Download, X, AlertCircle, CheckCircle, Loader2, Info, TrendingUp } from 'lucide-react';
import * as XLSX from '@sheetjs/xlsx';

// Validation rules for required columns
const REQUIRED_COLUMNS = ['Employee ID', 'Date', 'Status'];
const OPTIONAL_COLUMNS = ['Check In', 'Check Out'];

// Validation patterns
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/; // HH:MM:SS
const EMPLOYEE_ID_REGEX = /^[A-Za-z0-9\-_]{1,50}$/;

const parseExcelDate = (val) => {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const s = val.toString().trim();
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // If DD-MM-YYYY
    const dm = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dm) return `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    // If DD/MM/YYYY
    const ds = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ds) return `${ds[3]}-${ds[2].padStart(2, '0')}-${ds[1].padStart(2, '0')}`;
    return s;
};

export default function AttendanceExcelUploadModal({ isOpen, onClose, onSuccess }) {
    const fileInputRef = useRef(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState([]);
    const [uploadErrors, setUploadErrors] = useState([]);
    const [validationWarnings, setValidationWarnings] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadedData, setUploadedData] = useState(null);
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    // Validate individual row data
    const validateRow = (row, rowIndex) => {
        const errors = [];
        const warnings = [];

        // Helper: Normalize column names
        const normalize = (s) => {
            if (!s) return '';
            return s.toString()
                .replace(/\([^)]*\)/g, '')
                .toLowerCase()
                .replace(/\s/g, '')
                .replace(/[^a-z0-9]/g, '');
        };

        // Extract values with flexible column matching
        let empId = '';
        let date = '';
        let status = '';
        let checkIn = '';
        let checkOut = '';

        const fieldPatterns = [
            { field: 'empId', patterns: ['employeeid', 'empid'] },
            { field: 'date', patterns: ['date', 'attendancedate', 'punchdate'] },
            { field: 'status', patterns: ['status'] },
            { field: 'checkIn', patterns: ['checkin', 'punchin', 'in'] },
            { field: 'checkOut', patterns: ['checkout', 'punchout', 'out'] }
        ];

        for (const key of Object.keys(row)) {
            const normKey = normalize(key);
            const val = row[key];

            for (const { field, patterns } of fieldPatterns) {
                if (patterns.some(p => normKey.includes(p) || normKey === p)) {
                    if (field === 'empId') empId = val ? val.toString().trim() : '';
                    else if (field === 'date') date = val;
                    else if (field === 'status') status = val ? val.toString().trim().toLowerCase() : '';
                    else if (field === 'checkIn') checkIn = val;
                    else if (field === 'checkOut') checkOut = val;
                    break;
                }
            }
        }

        // Employee ID validation
        if (!empId) {
            errors.push('Employee ID is required');
        } else if (!EMPLOYEE_ID_REGEX.test(empId)) {
            errors.push('Employee ID format invalid');
        }

        // Date validation
        if (!date) {
            errors.push('Date is required');
        } else {
            const dateStr = parseExcelDate(date);
            if (!DATE_REGEX.test(dateStr)) {
                errors.push(`Invalid date format: ${date}. Use YYYY-MM-DD or DD-MM-YYYY`);
            }
        }

        // Status validation
        const validStatuses = ['present', 'absent', 'leave', 'holiday', 'weekly_off', 'half_day', 'missed_punch'];
        if (!status) {
            errors.push('Status is required');
        } else if (!validStatuses.includes(status)) {
            errors.push(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
        }

        return { errors, warnings };
    };

    // Validate file structure
    const validateFileStructure = (data) => {
        const errors = [];
        const warnings = [];

        if (!data || data.length === 0) {
            errors.push('Excel file is empty');
            return { errors, warnings };
        }

        const normalize = (s) => {
            if (!s) return '';
            return s.toString()
                .replace(/\([^)]*\)/g, '')
                .toLowerCase()
                .replace(/\s/g, '')
                .replace(/[^a-z0-9]/g, '');
        };

        const firstRow = data[0];
        const availableColumns = Object.keys(firstRow);
        const normalizedAvailable = availableColumns.map(col => normalize(col));

        const requiredChecks = [
            { display: 'Employee ID', patterns: ['employeeid', 'empid'] },
            { display: 'Date', patterns: ['date', 'attendancedate', 'punchdate'] },
            { display: 'Status', patterns: ['status'] }
        ];

        requiredChecks.forEach(({ display, patterns }) => {
            const found = normalizedAvailable.some(norm => patterns.some(p => norm.includes(p) || norm === p));
            if (!found) {
                errors.push(`Missing required column: ${display}`);
            }
        });

        if (errors.length > 0) {
            return { errors, warnings };
        }

        data.forEach((row, idx) => {
            const { errors: rowErrors, warnings: rowWarnings } = validateRow(row, idx + 2);
            rowErrors.forEach(err => errors.push(`Row ${idx + 2}: ${err}`));
            rowWarnings.forEach(warn => warnings.push(`Row ${idx + 2}: ${warn}`));
        });

        return { errors, warnings };
    };

    // Handle Template Download
    const handleDownloadTemplate = async () => {
        try {
            setDownloadingTemplate(true);
            const res = await api.get('/attendance/bulk/template', {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Template_${new Date().getTime()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Template download failed:', err);
            alert('❌ Failed to download template. Please try again.');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    // Handle File Upload
    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            setUploadErrors(['Please select a file to upload']);
            setUploadedFile(null);
            return;
        }

        const validExtensions = /\.(xlsx|xls|csv)$/i;
        if (!validExtensions.test(file.name)) {
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
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawJsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                const normalizeKey = (s) => s ? s.toString().replace(/\([^)]*\)/g, '').toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '') : '';
                
                const jsonData = rawJsonData.map(row => {
                    const newRow = { ...row };
                    for (const key of Object.keys(newRow)) {
                        const normKey = normalizeKey(key);
                        if (['date', 'attendancedate', 'punchdate'].some(p => normKey.includes(p) || normKey === p)) {
                            newRow[key] = parseExcelDate(newRow[key]);
                        }
                    }
                    return newRow;
                });

                if (jsonData.length === 0) {
                    setUploadErrors(['Excel file is empty. Please add attendance records.']);
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
                    previewData: jsonData.slice(0, 10),
                    allData: jsonData
                });

                setShowUploadPreview(true);
            } catch (err) {
                console.error('File parsing error:', err);
                setUploadErrors(['Failed to read file. Make sure it is a valid Excel file.']);
                setUploadedFile(null);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Handle Upload Confirmation
    const handleSubmitUpload = async () => {
        if (!uploadedData) return;

        try {
            setUploading(true);
            const payload = {
                records: uploadedData.allData
            };

            const res = await api.post('/attendance/bulk-upload', payload);

            if (res.data) {
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
                setUploadedData(null);
                setShowUploadPreview(false);
                if (onSuccess) onSuccess(result);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
            setUploadErrors([errorMessage || 'Failed to upload attendance. Please try again.']);
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    if (showSuccessMessage && uploadResult) {
        const isSuccess = uploadResult.failedCount === 0;
        const isPartial = uploadResult.uploadedCount > 0 && uploadResult.failedCount > 0;
        const isFailure = uploadResult.uploadedCount === 0;

        let title = "Upload Successful! ✅";
        let icon = <CheckCircle className="w-12 h-12 text-green-600" />;

        if (isFailure) {
            title = "Upload Failed! ❌";
            icon = <AlertCircle className="w-12 h-12 text-red-600" />;
        } else if (isPartial) {
            title = "Completed with Errors ⚠️";
            icon = <TrendingUp className="w-12 h-12 text-amber-600" />;
        }

        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center max-h-[90vh] overflow-y-auto m-auto">
                    <div className="flex justify-center mb-4">
                        {icon}
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">{title}</h2>

                    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-2xl font-black text-green-600 dark:text-green-400">{uploadResult.uploadedCount}</div>
                                <div className="text-xs font-bold text-slate-600 mt-1">Uploaded</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-red-600 dark:text-red-400">{uploadResult.failedCount}</div>
                                <div className="text-xs font-bold text-slate-600 mt-1">Failed</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{uploadResult.successRate}%</div>
                                <div className="text-xs font-bold text-slate-600 mt-1">Success</div>
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
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setShowSuccessMessage(false);
                            onClose();
                        }}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col m-auto">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 border-b border-blue-500 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Upload className="w-6 h-6 text-white" />
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Bulk Upload Attendance</h3>
                            <p className="text-xs text-blue-100 mt-1 font-bold">Import attendance records from Excel</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-xl transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
                    <div className="bg-white border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="font-bold text-slate-800">Download Template</p>
                                <p className="text-xs text-slate-600 mt-1">Get the required Excel format</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm uppercase tracking-widest transition disabled:opacity-50"
                        >
                            {downloadingTemplate ? '...' : 'Download'}
                        </button>
                    </div>

                    {!uploadedFile ? (
                        <label className="block cursor-pointer">
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 transition group bg-white">
                                <Upload className="w-12 h-12 text-slate-400 group-hover:text-blue-500 mx-auto mb-4" />
                                <p className="text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Click to upload or drag and drop</p>
                                <p className="text-xs text-slate-500 font-bold">Excel (.xlsx, .xls) or CSV • Max 5MB</p>
                            </div>
                        </label>
                    ) : (
                        <div className="bg-white border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📄</span>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{uploadedFile.name}</p>
                                    <p className="text-xs text-slate-600 font-bold">{uploadedData?.rowCount} records</p>
                                </div>
                            </div>
                            <button onClick={() => setUploadedFile(null)} className="p-2 hover:bg-blue-200 rounded-lg transition text-slate-600">✕</button>
                        </div>
                    )}

                    {uploadErrors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-2">❌ Validation Errors</p>
                            <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                {uploadErrors.slice(0, 8).map((err, idx) => (
                                    <li key={idx}>• {err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="bg-white border border-blue-200 rounded-xl p-4">
                        <div className="flex gap-3">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-700 font-bold leading-relaxed">
                                <span className="font-black block mb-1">📝 Required Columns:</span>
                                <span>Employee ID, Date (YYYY-MM-DD), Status (present, absent, leave, etc.)</span>
                                <span className="font-black block mt-2 mb-1">💡 Optional Columns:</span>
                                <span>Check In, Check Out, Working Hours, Overtime Hours</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-200 p-6 bg-white flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-colors">Cancel</button>
                    <button
                        onClick={handleSubmitUpload}
                        disabled={!uploadedFile || uploading || uploadErrors.length > 0}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-colors"
                    >
                        {uploading ? 'Uploading...' : `Upload ${uploadedData?.rowCount || 0} Records`}
                    </button>
                </div>
            </div>
        </div>
    );
}
