import React, { useState, useRef } from 'react';
import api, { API_ROOT } from '../../utils/api';
import { Upload, Download, X, AlertCircle, CheckCircle, Loader2, Info, TrendingUp } from 'lucide-react';
import * as XLSX from '@sheetjs/xlsx';
import { showToast } from '../../utils/uiNotifications';

const BACKEND_URL = API_ROOT || '';

// Validation rules for required columns
const REQUIRED_COLUMNS = ['First Name', 'Last Name', 'Email', 'Joining Date'];
const OPTIONAL_COLUMNS = ['Employee ID', 'Middle Name', 'Contact No', 'Gender', 'Date of Birth', 'Department', 'Role', 'Job Type', 'Password'];

// Validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_REGEX = /^[+]?[\d\s\-()]{7,}$/;
const EMPLOYEE_ID_REGEX = /^[A-Za-z0-9\-_]{1,50}$/;

export default function EmployeeExcelUploadModal({ isOpen, onClose, onSuccess }) {
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

  const normalizeColumnName = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Validate individual row data
  const validateRow = (row, rowIndex) => {
    const errors = [];
    const warnings = [];

    // Extract values with flexible column matching
    let empId = '';
    let firstName = '';
    let lastName = '';
    let email = '';
    let joiningDate = null;

    // Field pattern definitions - must match validateFileStructure patterns
    const fieldPatterns = [
      { field: 'empId', patterns: ['employeeid', 'empid'] },
      { field: 'firstName', patterns: ['firstname', 'first'] },
      { field: 'lastName', patterns: ['lastname', 'last'] },
      { field: 'email', patterns: ['email', 'emailaddress'] },
      { field: 'joiningDate', patterns: ['joiningdate', 'doj'] }
    ];

    // Find values from row with flexible matching
    for (const key of Object.keys(row)) {
      const normKey = normalizeColumnName(key);
      const val = row[key];

      // Check each field pattern
      for (const { field, patterns } of fieldPatterns) {
        // Use includes for flexible matching - checks if normalized key contains any pattern
        if (patterns.some(p => normKey.includes(p) || normKey === p)) {
          if (field === 'empId') empId = val ? val.toString().trim() : '';
          else if (field === 'firstName') firstName = val ? val.toString().trim() : '';
          else if (field === 'lastName') lastName = val ? val.toString().trim() : '';
          else if (field === 'email') email = val ? val.toString().trim().toLowerCase() : '';
          else if (field === 'joiningDate') joiningDate = val;
          break; // Found match for this key, move to next key
        }
      }
    }

    // Employee ID validation (optional - will be auto-generated if missing)
    if (empId && !EMPLOYEE_ID_REGEX.test(empId)) {
      errors.push('Employee ID format invalid (alphanumeric, dash, underscore only)');
    }

    // First Name validation
    if (!firstName) {
      errors.push('First Name is required');
    } else if (firstName.length < 2) {
      warnings.push('First Name should be at least 2 characters');
    }

    // Last Name validation
    if (!lastName) {
      errors.push('Last Name is required');
    } else if (lastName.length < 2) {
      warnings.push('Last Name should be at least 2 characters');
    }

    // Email validation
    if (!email) {
      errors.push('Email is required');
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push('Invalid email format');
    }

    // Joining Date validation
    if (!joiningDate) {
      errors.push('Joining Date is required');
    } else {
      const joinDate = joiningDate;
      const dateStr = joinDate instanceof Date ? joinDate.toISOString().split('T')[0] : joinDate.toString().trim();
      if (!DATE_REGEX.test(dateStr)) {
        errors.push('Joining Date format must be YYYY-MM-DD');
      } else {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          errors.push('Invalid Joining Date');
        } else if (date > new Date()) {
          warnings.push('Joining Date is in the future');
        }
      }
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

    // Check required columns (flexible matching)
    const firstRow = data[0];
    const availableColumns = Object.keys(firstRow || {}).filter((col) => col !== undefined && col !== null && String(col).trim() !== '');
    const normalizedAvailable = availableColumns.map((col) => normalizeColumnName(col)).filter(Boolean);

    // Required columns with their normalizations (Employee ID is now optional)
    const requiredChecks = [
      { display: 'First Name', patterns: ['firstname', 'first'] },
      { display: 'Last Name', patterns: ['lastname', 'last'] },
      { display: 'Email', patterns: ['email', 'emailaddress'] },
      { display: 'Joining Date', patterns: ['joiningdate', 'doj'] }
    ];

    requiredChecks.forEach(({ display, patterns }) => {
      const found = normalizedAvailable.some((norm) => patterns.some((p) => norm.includes(p) || norm === p));
      if (!found) {
        errors.push(`Missing required column: ${display}`);
      }
    });

    // If columns are missing, don't validate individual rows yet
    if (errors.length > 0) {
      return { errors, warnings };
    }

    // Validate each row
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
      const res = await api.get('/hr/bulk/template', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Employee_Template_${new Date().getTime()}.xlsx`);
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

    // Validate file type
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

    // Validate file size (max 5MB)
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          setUploadErrors(['Excel file is empty. Please add employee records.']);
          setUploadedFile(null);
          return;
        }

        if (jsonData.length > 1000) {
          setUploadErrors(['File contains more than 1000 records. Please split into multiple files.']);
          setUploadedFile(null);
          return;
        }

        // Validate file structure and data
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

        // Prepare preview data (first 10 rows)
        const previewData = jsonData.slice(0, 10);

        setUploadedData({
          fileName: file.name,
          rowCount: jsonData.length,
          previewData: previewData,
          allData: jsonData,
          validationStats: {
            totalRecords: jsonData.length,
            warningCount: warnings.length
          }
        });

        setShowUploadPreview(true);
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

  // Handle Upload Confirmation
  const handleSubmitUpload = async () => {
    if (!uploadedData) return;

    try {
      setUploading(true);
      setUploadResult(null);

      const payload = {
        records: uploadedData.allData
      };

      const res = await api.post('/hr/bulk/upload', payload);

      // Handle response - success can be true (partial/full success) or false (all failed)
      if (res.data) {
        if (res.data.success === false) {
          const errorMessage = res.data.message || res.data.error || 'Failed to upload employees. Please try again.';
          const errors = Array.isArray(res.data.errors) && res.data.errors.length > 0
            ? res.data.errors
            : [errorMessage];
          setUploadErrors(errors);
          showToast(
            'error',
            res.data.error === 'USER_LIMIT_REACHED' ? 'User Limit Reached' : 'Upload Failed',
            errorMessage,
            6
          );
          return;
        }

        // Store result regardless of success status
        const result = {
          uploadedCount: res.data.uploadedCount || 0,
          failedCount: res.data.failedCount || 0,
          totalRecords: uploadedData.rowCount,
          successRate: uploadedData.rowCount > 0
            ? ((res.data.uploadedCount || 0) / uploadedData.rowCount * 100).toFixed(2)
            : '0.00',
          errors: res.data.errors || [],
          warnings: res.data.warnings || [],
          autoGeneratedIds: res.data.autoGeneratedIds || []
        };

        setUploadResult(result);
        setShowSuccessMessage(true);

        // Reset state
        setUploadedFile(null);
        setUploadPreview([]);
        setUploadErrors([]);
        setValidationWarnings([]);
        setUploadedData(null);
        setShowUploadPreview(false);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Call success callback
        if (onSuccess) onSuccess(result);
      } else {
        // Fallback if response structure is unexpected
        setUploadErrors(['Upload failed - unexpected response format']);
        showToast('error', 'Upload Failed', 'Upload failed due to an unexpected response. Please try again.');
      }
    } catch (err) {
      console.error('Upload failed:', err);

      // Try to extract detailed errors from error response
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        setUploadErrors(err.response.data.errors);
      } else {
        setUploadErrors([errorMessage || 'Failed to upload employees. Please try again.']);
      }
      showToast(
        'error',
        errorCode === 'USER_LIMIT_REACHED' ? 'User Limit Reached' : 'Upload Failed',
        errorMessage || 'Failed to upload employees. Please try again.',
        6
      );
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  // Show result message
  if (showSuccessMessage && uploadResult) {
    const isSuccess = uploadResult.failedCount === 0;
    const isPartial = uploadResult.uploadedCount > 0 && uploadResult.failedCount > 0;
    const isFailure = uploadResult.uploadedCount === 0;
    const hasAutoGenerated = uploadResult.autoGeneratedIds && uploadResult.autoGeneratedIds.length > 0;

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

          {hasAutoGenerated && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs font-black text-blue-700 dark:text-blue-400 mb-2">🔄 Auto-Generated IDs ({uploadResult.autoGeneratedIds.length})</p>
              <div className="text-xs text-blue-600 dark:text-blue-400 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {uploadResult.autoGeneratedIds.slice(0, 10).map((id, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded font-mono text-xs">
                      {id}
                    </span>
                  ))}
                  {uploadResult.autoGeneratedIds.length > 10 && (
                    <span className="text-blue-500 px-2 py-1">
                      +{uploadResult.autoGeneratedIds.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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
              setUploadPreview([]);
              setUploadErrors([]);
              setValidationWarnings([]);
              setUploadedData(null);
              setShowUploadPreview(false);
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
              <h3 className="text-lg font-bold text-white">Bulk Add Employees</h3>
              <p className="text-xs text-blue-100 mt-0.5">Import employee data from Excel or CSV</p>
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Step 1</p>
              <p className="text-xs font-semibold text-slate-700">Download Template</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
              <p className="text-xs font-semibold text-slate-700">Upload File</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
              <p className="text-xs font-semibold text-slate-700">Confirm & Import</p>
            </div>
          </div>

          {/* Template Download Section */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">Download template</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Includes all required columns and sample rows</p>
                </div>
              </div>
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {downloadingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download
                  </>
                )}
              </button>
            </div>
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
                  id="employee-file-upload"
                />
                <label htmlFor="employee-file-upload" className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-7 text-center hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition cursor-pointer group">
                    <div className="mb-3 flex justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 group-hover:bg-blue-100 transition">
                        <Upload className="w-7 h-7 text-slate-500 group-hover:text-blue-600 transition" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Supports: Excel (.xlsx, .xls) and CSV files • Max 5MB • Max 1000 records
                    </p>
                    <div className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                      Browse File
                    </div>
                  </div>
                </label>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                    <span className="text-lg">📄</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{uploadedFile.name}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {(uploadedFile.size / 1024).toFixed(2)} KB • {uploadedData?.rowCount} records
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUploadedFile(null);
                    setUploadPreview([]);
                    setUploadErrors([]);
                    setValidationWarnings([]);
                    setUploadedData(null);
                    setShowUploadPreview(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-2 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg transition text-slate-600 dark:text-slate-400"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Error Messages */}
          {uploadErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
              <p className="text-xs font-black text-red-700 dark:text-red-300 uppercase tracking-widest mb-2">❌ Validation Errors</p>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                {uploadErrors.slice(0, 8).map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
                {uploadErrors.length > 8 && <li>... and {uploadErrors.length - 8} more errors</li>}
              </ul>
            </div>
          )}

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && uploadErrors.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <p className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest mb-2">⚠️ Warnings ({validationWarnings.length})</p>
              <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-32 overflow-y-auto">
                {validationWarnings.slice(0, 8).map((warn, idx) => (
                  <li key={idx}>• {warn}</li>
                ))}
                {validationWarnings.length > 8 && <li>... and {validationWarnings.length - 8} more warnings</li>}
              </ul>
            </div>
          )}



          {/* Required Columns Info */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Upload Instructions</p>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">Required Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {['First Name', 'Last Name', 'Email', 'Joining Date'].map((item) => (
                    <span key={item} className="rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 text-[10px] font-medium">
                      {item}
                    </span>
                  ))}
                  <span className="rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-[10px] font-medium">
                    YYYY-MM-DD format
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Auto Generated</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Employee ID is auto-generated when blank.</p>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 md:col-span-2">
                <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider">Important: Intern ID Generation</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Use the <strong>Job Type</strong> column to control ID sequences. Enter <strong>Internship</strong> to generate an <strong>INTN</strong> ID, or <strong>Full-Time</strong> for a standard <strong>EMP</strong> ID.
                </p>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 md:col-span-2">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">Other Optional Columns</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Middle Name, Contact No, Gender, DOB, Department, Role, Marital Status, Bank Details, Address.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitUpload}
            disabled={!uploadedFile || uploading || uploadErrors.length > 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Records ({uploadedData?.rowCount || 0})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
