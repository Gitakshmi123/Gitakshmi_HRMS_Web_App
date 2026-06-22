import React, { useState, useRef } from 'react';
import api, { API_ROOT } from '../../utils/api';
import { Upload, Download, X, AlertCircle, CheckCircle, Loader2, Info, TrendingUp } from 'lucide-react';
import * as XLSX from '@sheetjs/xlsx';
import { showToast } from '../../utils/uiNotifications';

const BACKEND_URL = API_ROOT || '';

// Validation rules for required columns (matches new comprehensive template)
const REQUIRED_COLUMNS = [
  'First Name', 'Last Name', 'Official Email', 'Joining Date',
  'Gender', 'Date of Birth', 'Contact Number', 'Blood Group',
  'Marital Status', 'Nationality', 'Emergency Contact Name', 'Emergency Contact Number',
  'Department', 'Grade', 'Band', 'Employee Type',
  'Education Type', 'Aadhar Number', 'PAN Number',
  'Bank Name', 'Account Number', 'IFSC Code', 'Branch Name', 'Password'
];
const OPTIONAL_COLUMNS = [
  'Employee ID', 'Middle Name', 'Personal Email', 'Place of Birth', 'Height', 'Weight',
  'Cast Category', 'Hobbies', 'Physical Disability Sickness', 'Disability Details',
  'Designation', 'Manager Employee ID', 'Work Mode', 'Employment Type', 'Shift Name',
  'Leave Policy', 'Sub Company', 'Branch', 'Division',
  'University Institution', '10th Marks Percentage', '12th Marks Percentage',
  'Year of Passing', 'CGPA or Percentage Degree', 'Highest Qualification',
  'Last Company Name', 'Experience From Date', 'Experience To Date', 'Last Drawn Salary',
  'Reporting Person Name', 'Reporting Person Email', 'Reporting Person Contact',
  'Bank Location City', 'Languages Known', 'Language Speak', 'Language Read', 'Language Write',
  'Previous Interview with Company', 'Role Access Level'
];

// Validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_REGEX = /^[+]?[\d\s\-()]{7,}$/;
const EMPLOYEE_ID_REGEX = /^[A-Za-z0-9\-_]{1,50}$/;
const AADHAR_REGEX = /^\d{12}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_REGEX = /^\d{9,18}$/;

// Known valid values for enum fields
const VALID_GENDER = ['male','female','other'];
const VALID_BLOOD_GROUP = ['a+','a-','b+','b-','o+','o-','ab+','ab-'];
const VALID_MARITAL = ['single','married','divorced','widowed'];
const VALID_EMP_TYPE = ['full-time','part-time','intern','internship','contract','consultant'];
const VALID_EDU_TYPE = ['regular','diploma'];
const VALID_WORK_MODE = ['work from office (wfo)','wfo','work from home (wfh)','wfh','hybrid','field','onsite'];
const VALID_ROLE = ['employee','hr','admin'];
const VALID_YES_NO = ['yes','no'];

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

  const parseFlexibleDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    
    // Check if it's a number (Excel date serial number)
    if (typeof dateVal === 'number' || (!isNaN(dateVal) && !isNaN(parseFloat(dateVal)))) {
      const serial = parseFloat(dateVal);
      const d = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    
    const dateStr = String(dateVal).trim().replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces
    if (!dateStr) return null;
    
    // Try YYYY-MM-DD
    const matchYmd = dateStr.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (matchYmd) {
      const year = parseInt(matchYmd[1], 10);
      const month = parseInt(matchYmd[2], 10) - 1;
      const day = parseInt(matchYmd[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d;
    }
    
    // Try DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
    const matchDmy = dateStr.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (matchDmy) {
      const day = parseInt(matchDmy[1], 10);
      const month = parseInt(matchDmy[2], 10) - 1; // 0-indexed month
      const year = parseInt(matchDmy[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d;
    }
    
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    return null;
  };

  // Helper: get a cell value from a row by normalized key patterns
  const getFieldValue = (row, patterns) => {
    for (const key of Object.keys(row)) {
      const normKey = normalizeColumnName(key);
      if (patterns.some(p => normKey === p)) {
        const val = String(row[key] || '').trim();
        if (val) return val;
      }
    }
    return '';
  };

  // Validate individual row data
  const validateRow = (row, rowIndex) => {
    const errors = [];
    const warnings = [];

    // ── Extract key fields ──────────────────────────────────────────────────
    let firstName    = getFieldValue(row, ['firstname','first']);
    let lastName     = getFieldValue(row, ['lastname','last']);
    
    // Fallback: If no explicit first/last name, try to split a single 'name' column
    if (!firstName && !lastName) {
       const fullName = getFieldValue(row, ['name', 'employeename', 'fullname', 'empname']);
       if (fullName) {
          const parts = fullName.trim().split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || 'Unknown';
       }
    }
    
    const officialEmail= getFieldValue(row, ['officialemail','email','companymailid','mailid','emailaddress','emailid','loginemail','employeeemail','username','personalemail','personalemailid']);
    const joiningDate  = getFieldValue(row, ['joiningdate','joining','doj','dateofjoining']);
    const gender       = getFieldValue(row, ['gender']);
    const dob          = getFieldValue(row, ['dateofbirth','dob','birthdate','birthyear','yearofbirth','birth']);
    const contact      = getFieldValue(row, ['contactnumber','contactno','mobile','phone']);
    const bloodGroup   = getFieldValue(row, ['bloodgroup','blood']);
    const marital      = getFieldValue(row, ['maritalstatus','marital']);
    const nationality  = getFieldValue(row, ['nationality']);
    const ecName       = getFieldValue(row, ['emergencycontactname','emergencyname','ecname']);
    const ecNumber     = getFieldValue(row, ['emergencycontactnumber','emergencynumber','ecnumber','eccontact']);
    const dept         = getFieldValue(row, ['department','dept']);
    const grade        = getFieldValue(row, ['grade']);
    const band         = getFieldValue(row, ['band']);
    let empType        = getFieldValue(row, ['employeetype','emptype','jobtype']);
    if (!empType) empType = 'Full-Time'; // Default to Full-Time if missing
    
    const eduType      = getFieldValue(row, ['educationtype','education']);
    const aadhar       = getFieldValue(row, ['aadharnumber','aadhar','adhaar']);
    const pan          = getFieldValue(row, ['pannumber','pan','panno']);
    const bankName     = getFieldValue(row, ['bankname','bank']);
    const accountNo    = getFieldValue(row, ['accountnumber','accountno','acno']);
    const ifsc         = getFieldValue(row, ['ifsccode','ifsc']);
    const branchName   = getFieldValue(row, ['branchname','branch']);
    const password     = getFieldValue(row, ['password','pwd']);
    const empId        = getFieldValue(row, ['employeeid', 'empid', 'employeecode']);

    // ── Required field checks ────────────────────────────────────────────────
    if (!firstName) {
      warnings.push('First Name is missing — system will default to "Employee"');
    } else if (firstName.length < 2) {
      warnings.push('First Name should be at least 2 characters');
    }

    if (!lastName) {
      warnings.push('Last Name is missing — system will default to placeholder');
    } else if (lastName.length < 2) {
      warnings.push('Last Name should be at least 2 characters');
    }

    if (!officialEmail) {
      warnings.push('Official Email is missing — system will auto-generate a placeholder');
    } else if (!EMAIL_REGEX.test(officialEmail)) {
      warnings.push(`Official Email format invalid: "${officialEmail}" — system will auto-correct`);
    }

    // Password validation - default password set to Employee ID if missing
    if (!password && !empId) {
      warnings.push('Password is missing — system will default to Employee ID');
    } else if (password && password.length < 6) {
      warnings.push('Password should be at least 6 characters');
    }

    // Joining Date
    const parsedJoinDate = parseFlexibleDate(joiningDate);
    if (!joiningDate) {
      warnings.push('Joining Date is missing — will default to today\'s date');
    } else if (!parsedJoinDate) {
      warnings.push(`Joining Date format invalid: "${joiningDate}" — will default to today's date`);
    if (!joiningDate) {
       warnings.push('Joining Date is missing (Will default to today)');
    } else {
       const parsedJoinDate = parseFlexibleDate(joiningDate);
       if (!parsedJoinDate) errors.push(`Joining Date format invalid: "${joiningDate}" — use YYYY-MM-DD`);
    }

    if (dob) {
      const parsedDob = parseFlexibleDate(dob);
      if (!parsedDob) warnings.push(`Date of Birth format invalid: "${dob}" — use format YYYY-MM-DD`);
    }

      warnings.push(`Blood Group "${bloodGroup}" not recognized — use: A+ / A- / B+ / B- / O+ / O- / AB+ / AB-`);
    }

    // Marital Status
    if (marital && !VALID_MARITAL.includes(marital.toLowerCase())) {
      warnings.push(`Marital Status "${marital}" not recognized — use: Single / Married / Divorced / Widowed`);
    }

    // Employee Type
    if (empType && !VALID_EMP_TYPE.includes(empType.toLowerCase())) {
      warnings.push(`Employee Type "${empType}" not recognized — use: Full-Time / Part-Time / Intern / Contract / Consultant`);
    }

    // Education Type
    if (eduType && !VALID_EDU_TYPE.includes(eduType.toLowerCase())) {
      warnings.push(`Education Type "${eduType}" not recognized — use: Regular / Diploma`);
    }

    // Aadhar Number
    if (aadhar && !AADHAR_REGEX.test(aadhar.replace(/\s/g,''))) {
      warnings.push(`Aadhar Number "${aadhar}" must be exactly 12 digits`);
    }

    // PAN Number
    if (pan && !PAN_REGEX.test(pan.toUpperCase())) {
      warnings.push(`PAN Number "${pan}" format invalid — example: ABCDE1234F`);
    }

    // IFSC Code
    if (ifsc && !IFSC_REGEX.test(ifsc.toUpperCase())) {
      warnings.push(`IFSC Code "${ifsc}" format invalid — example: SBIN0001234`);
    }

    // Account Number
    if (accountNo && !ACCOUNT_REGEX.test(accountNo.replace(/\s/g,''))) {
      warnings.push(`Account Number "${accountNo}" should be 9-18 digits`);
    }

    // Contact Number
    if (contact && !PHONE_REGEX.test(contact)) {
      warnings.push(`Contact Number "${contact}" format appears invalid`);
    }

    return { errors, warnings };
  };

  // Validate file structure — checks that the template contains required fields (flexible)
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

    // 1. Name Check (Strictly Required - either FirstName + LastName, or Name/FullName)
    const hasFirstName = normalizedAvailable.some(norm => ['firstname','first'].includes(norm));
    const hasLastName = normalizedAvailable.some(norm => ['lastname','last'].includes(norm));
    const hasFullName = normalizedAvailable.some(norm => ['name','employeename','fullname','empname'].includes(norm));

    if (!hasFullName && (!hasFirstName || !hasLastName)) {
      errors.push('Name column is missing. The spreadsheet must contain either "First Name" and "Last Name", or a single "Name" column.');
    }

    // Minimum required column presence checks
    const requiredChecks = [
      { display: 'First Name (or Name)',    patterns: ['firstname','first', 'name', 'employeename', 'fullname'] },
    ];

    const missingCols = [];
    requiredChecks.forEach(({ display, patterns }) => {
      const found = normalizedAvailable.some(norm => patterns.some(p => norm === p));
      if (!found) missingCols.push(display);
    });

    if (missingCols.length > 0) {
      errors.push(`Missing required columns: ${missingCols.join(', ')}. Please use the official GT HRMS template downloaded from this screen.`);
    }

    // 2. Other key columns check (Warn instead of blocking)
    const columnChecks = [
      { display: 'Official Email', patterns: ['officialemail','email','emailaddress','companymailid','mailid','personalemail','personalemailid','personalmailid'], warnMsg: 'Email column is missing - system will auto-generate placeholder emails.' },
      { display: 'Joining Date', patterns: ['joiningdate','doj','dateofjoining','joining'], warnMsg: 'Joining Date is missing - will default to today\'s date.' },
      { display: 'Department', patterns: ['department','dept'], warnMsg: 'Department is missing - can be assigned later.' }
    ];

    columnChecks.forEach(({ display, patterns, warnMsg }) => {
      const found = normalizedAvailable.some(norm => patterns.some(p => norm === p));
      if (!found && warnMsg) warnings.push(warnMsg);
    });

    // Validate first 50 rows for warnings
    const rowsToValidate = data.slice(0, 50);
    rowsToValidate.forEach((row, idx) => {
      const { errors: rowErrors, warnings: rowWarnings } = validateRow(row, idx);
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


        // 1. Read sheet as 2D array first to find the header row dynamically
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // Normalize helper for local matching
        const localNormalize = (value) => {
          if (value === null || value === undefined) return '';
          return String(value)
            .replace(/\([^)]*\)/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s/g, '')
            .replace(/[^a-z0-9]/g, '');
        };

        const HEADER_INDICATORS = [
          'firstname', 'lastname', 'name', 'fullname', 'employeename', 'empname',
          'email', 'officialemail', 'companymailid', 'personalemailid', 'personalemail',
          'joiningdate', 'doj', 'dateofjoining', 'department', 'designation', 'role',
          'employeetype', 'emptype', 'jobtype', 'employeeid', 'empid', 'employeecode',
          'mobile', 'phone', 'contactnumber', 'gender', 'dob', 'dateofbirth',
          'password', 'aadhar', 'pan', 'bloodgroup'
        ];

        let headerRowIndex = 0;
        let maxMatches = 0;

        // Scan the first 15 rows to find the headers row
        const scanLimit = Math.min(rawRows.length, 15);
        for (let i = 0; i < scanLimit; i++) {
          const rowCells = rawRows[i];
          if (!Array.isArray(rowCells)) continue;

          let matches = 0;
          rowCells.forEach(cell => {
            const norm = localNormalize(cell);
            if (norm && HEADER_INDICATORS.some(ind => norm === ind || norm.includes(ind))) {
              matches++;
            }
          });

          if (matches > maxMatches && matches >= 2) {
            maxMatches = matches;
            headerRowIndex = i;
          }
        }

        // Now parse the sheet starting from headerRowIndex
        const rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

        // Check if the row immediately following the header contains tags like [Required]/[Optional]
        let dataRows = rawData;
        if (rawData.length > 0) {
          const firstRow = rawData[0];
          const keys = Object.keys(firstRow);
          let tagMatches = 0;
          keys.forEach(k => {
            const val = String(firstRow[k] || '').toLowerCase();
            if (val.includes('required') || val.includes('optional') || val.includes('conditional')) {
              tagMatches++;
            }
          });

          if (keys.length > 0 && (tagMatches / keys.length) > 0.3) {
            // It's a tag row, skip it
            dataRows = rawData.slice(1);
          }
        }
        const filteredData = dataRows.filter(row => Object.values(row).some(v => v !== null && String(v).trim() !== ''));

        // Pre-process and enrich rows
        const jsonData = filteredData.map(row => {
          const enrichedRow = { ...row };

          // 1. Full name splitting
          const firstName = getFieldValue(enrichedRow, ['firstname', 'first']);
          const lastName = getFieldValue(enrichedRow, ['lastname', 'last']);
          if (!firstName || !lastName) {
            const fullName = getFieldValue(enrichedRow, ['name', 'employeename', 'fullname', 'empname']);
            if (fullName) {
              const parts = fullName.split(/\s+/).filter(Boolean);
              let fName = '', mName = '', lName = '';
              if (parts.length >= 3) {
                fName = parts[0];
                mName = parts[1];
                lName = parts.slice(2).join(' ');
              } else if (parts.length === 2) {
                fName = parts[0];
                lName = parts[1];
              } else if (parts.length === 1) {
                fName = parts[0];
                lName = 'Doe';
              }
              if (!firstName) enrichedRow['First Name'] = fName;
              if (!lastName) enrichedRow['Last Name'] = lName;
              if (mName && !getFieldValue(enrichedRow, ['middlename', 'middle'])) enrichedRow['Middle Name'] = mName;
            }
          }

          // 2. Email mapping / fallback
          const officialEmail = getFieldValue(enrichedRow, ['officialemail', 'email', 'companymailid', 'mailid', 'emailaddress']);
          const personalEmail = getFieldValue(enrichedRow, ['personalemail', 'personalemailid', 'personalmailid']);
          if (!officialEmail && personalEmail) {
            enrichedRow['Official Email'] = personalEmail;
          }

          // 3. Generate preview credentials
          let finalFirstName = firstName || enrichedRow['First Name'] || '';
          let finalLastName = lastName || enrichedRow['Last Name'] || '';
          let dob = getFieldValue(enrichedRow, ['dob', 'dateofbirth']);
          let empId = getFieldValue(enrichedRow, ['empid', 'employeeid', 'employeecode']);
          let password = getFieldValue(enrichedRow, ['password']);

          enrichedRow._generatedEmpCode = empId || 'Auto-generated';
          enrichedRow._generatedEmail = officialEmail || personalEmail || 'Auto-generated';
          
          if (!password) {
             let sSur = (finalLastName || '').toLowerCase().substring(0, 3) || 'emp';
             let sFirst = (finalFirstName || '').toLowerCase().substring(0, 3) || 'usr';
             let birthYear = '1995';
             if (dob) {
                const match = String(dob).match(/\b(19|20)\d{2}\b/);
                if (match) birthYear = match[0];
             }
             enrichedRow._generatedPassword = `${sSur}${sFirst}@${birthYear}`;
          } else {
             enrichedRow._generatedPassword = password;
          }

          return enrichedRow;
        });

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
          autoGeneratedIds: res.data.autoGeneratedIds || [],
          generatedCredentials: res.data.extractedCredentials || []
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

          {uploadResult.uploadedCount > 0 && uploadResult.generatedCredentials && uploadResult.generatedCredentials.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 text-left max-h-48 overflow-y-auto">
              <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2">🔐 Generated Credentials</p>
              <table className="w-full text-xs text-left">
                 <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                       <th className="pb-1 font-semibold">Emp Code</th>
                       <th className="pb-1 font-semibold">Email</th>
                       <th className="pb-1 font-semibold">Password</th>
                    </tr>
                 </thead>
                 <tbody>
                    {uploadResult.generatedCredentials.map((cred, idx) => (
                       <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 text-slate-600 dark:text-slate-400">
                          <td className="py-1.5">{cred._generatedEmpCode || 'Unknown'}</td>
                          <td className="py-1.5">{cred._generatedEmail || 'N/A'}</td>
                          <td className="py-1.5 font-mono">{cred._generatedPassword || 'N/A'}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
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

          {/* Data Preview */}
          {uploadedFile && uploadedData?.allData?.length > 0 && uploadErrors.length === 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3 flex justify-between items-center">
                <span className="uppercase tracking-widest">🔐 Extracted Credentials</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">{uploadedData.allData.length} records</span>
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-left">
                   <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                         <th className="px-3 py-2 font-semibold">Emp Code</th>
                         <th className="px-3 py-2 font-semibold">Email</th>
                         <th className="px-3 py-2 font-semibold">Password</th>
                      </tr>
                   </thead>
                   <tbody>
                      {uploadedData.allData.map((emp, idx) => (
                         <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                            <td className="px-3 py-2 font-medium">{emp._generatedEmpCode}</td>
                            <td className="px-3 py-2">{emp._generatedEmail || 'N/A'}</td>
                            <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">{emp._generatedPassword || 'N/A'}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
              </div>
            </div>
          )}

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
            <div className="grid grid-cols-1 gap-2">
              {/* Required */}
              <div className="rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 p-2">
                <p className="text-[11px] font-bold text-red-700 dark:text-red-400 mb-1.5 uppercase tracking-wider">🔴 Required Fields (Must Fill)</p>
                <div className="flex flex-wrap gap-1">
                  {['First Name','Last Name','Official Email','Password','Joining Date','Department','Grade','Band','Employee Type','Gender','Date of Birth','Contact Number','Blood Group','Marital Status','Nationality','Emergency Contact Name','Emergency Contact Number','Education Type','Aadhar Number','PAN Number','Bank Name','Account Number','IFSC Code','Branch Name'].map(item => (
                    <span key={item} className="rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 text-[10px] font-medium border border-red-200">{item}</span>
                  ))}
                </div>
              </div>

              {/* Conditional */}
              <div className="rounded-lg bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-800 p-2">
                <p className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400 mb-1.5 uppercase tracking-wider">🟡 Conditional Fields (Fill when applicable)</p>
                <div className="flex flex-wrap gap-1">
                  {['Disability Details (if disability=yes)','Employee ID (if manual config)','Experience From/To Date (if company filled)','Reporting Person Name & Email (if company filled)','Previous Interview Date/Location (if prev interview=yes)','Related Employee Name & Relation (if related=yes)'].map(item => (
                    <span key={item} className="rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 text-[10px] font-medium border border-yellow-200">{item}</span>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1 uppercase tracking-wider">📋 Important Notes</p>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 list-disc list-inside">
                  <li>Use <strong>YYYY-MM-DD</strong> for all dates (e.g. 1990-01-15)</li>
                  <li>Employee ID is auto-generated if blank</li>
                  <li>Employee Type controls ID prefix: <strong>Internship → INTN</strong>, others → <strong>EMP</strong></li>
                  <li>Aadhar = 12 digits &nbsp;|&nbsp; PAN = 10 chars (e.g. ABCDE1234F) &nbsp;|&nbsp; IFSC = SBIN0001234</li>
                  <li>File uploads (photos, documents) must be done after employee creation</li>
                </ul>
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
