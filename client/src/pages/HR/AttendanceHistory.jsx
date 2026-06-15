import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, TrendingUp, Users, Download, Filter, Search,
  ChevronLeft, ChevronRight, UserCheck, AlertCircle, MapPin,
  MoreVertical, Edit2, FileText, BarChart3, PieChart,
  Camera, CheckCircle, XCircle, Trash2, RefreshCw, Loader2, Upload, X
} from 'lucide-react';
import * as XLSX from '@sheetjs/xlsx';
import { Select, Dropdown } from 'antd';
import api from '../../utils/api';
import { Can } from '../../components/rbac/PermissionGate';

export default function AttendanceHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 0, 1)); // Default to Jan 2026
  const selectedMonth = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [attendance, setAttendance] = useState([]);
  const [newAttendance, setNewAttendance] = useState({});
  const [faceStatusMap, setFaceStatusMap] = useState({});
  const [loadingFaceStatus, setLoadingFaceStatus] = useState({});
  const [deletingFaceId, setDeletingFaceId] = useState(null);
  const [showFaceRegistrationModal, setShowFaceRegistrationModal] = useState(false);
  const [selectedEmployeeForFace, setSelectedEmployeeForFace] = useState(null);
  const [registeringFaceId, setRegisteringFaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const pageSize = 10;

  const openEmployeeProfile = (employee) => {
    if (!employee?._id) return;
    const basePath = location.pathname.startsWith('/tenant') ? '/tenant/employees' : '/hr/employees';
    navigate(`${basePath}/${employee._id}/profile`, { state: { employee } });
  };

  const stats = React.useMemo(() => {
    if (Object.keys(newAttendance).length === 0) {
      return [
        { label: 'Total Employees', value: '0', icon: Users, color: 'indigo', bgColor: 'bg-indigo-600' },
        { label: 'Avg Attendance', value: '0%', icon: TrendingUp, color: 'emerald', bgColor: 'bg-emerald-500' },
        { label: 'Total Working Hours', value: '0h', icon: Clock, color: 'amber', bgColor: 'bg-amber-500' },
      ];
    }

    const employees = Object.values(newAttendance);
    const totalEmployees = employees.length;
    const avgAttendance = Math.round(
      employees.reduce((sum, emp) => sum + (emp.attendanceRate || 0), 0) / employees.length
    );
    const totalWorkingHours = employees.reduce((sum, emp) => sum + (emp.workingHours || 0), 0);

    return [
      { label: 'Total Employees', value: totalEmployees.toString(), icon: Users, color: 'indigo', bgColor: 'bg-indigo-600' },
      { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: TrendingUp, color: 'emerald', bgColor: 'bg-emerald-500' },
      { label: 'Total Working Hours', value: `${totalWorkingHours.toFixed(1)}h`, icon: Clock, color: 'amber', bgColor: 'bg-amber-500' },
    ];
  }, [newAttendance]);

  const calculateDepartmentStats = () => {
    if (Object.keys(newAttendance).length === 0) return [];

    const deptMap = {};
    Object.values(newAttendance).forEach(emp => {
      const d = emp.role || 'Unassigned';
      if (!deptMap[d]) {
        deptMap[d] = {
          department: d,
          present: 0,
          absent: 0,
          leave: 0,
          late: 0,
          total: 0,
          workingHours: 0,
          employees: 0,
          attendanceRateSum: 0,
        };
      }
      deptMap[d].employees += 1;

      const p = emp.presentDays ? emp.presentDays.size : 0;
      const a = emp.absentDays ? emp.absentDays.size : 0;
      const l = emp.leaveDays ? emp.leaveDays.size : 0;

      deptMap[d].present += p;
      deptMap[d].absent += a;
      deptMap[d].leave += l;
      deptMap[d].late += emp.lateArrivals || 0;
      deptMap[d].total += (p + a + l);
      deptMap[d].workingHours += emp.workingHours || 0;
      deptMap[d].attendanceRateSum += (emp.attendanceRate || 0);
    });

    return Object.values(deptMap).map(d => {
      const avgRate = Math.round(d.attendanceRateSum / Math.max(d.employees, 1));
      let totalPresentDays = d.present;
      const avgHoursPerDay = totalPresentDays > 0 ? (d.workingHours / totalPresentDays).toFixed(1) : 0;

      return {
        ...d,
        rate: `${avgRate}%`,
        rateNum: Number(avgRate),
        avgHours: `${avgHoursPerDay}h`,
      };
    }).sort((a, b) => b.present - a.present);
  };

  const departmentStatsAll = calculateDepartmentStats();
  const departmentStats = departmentStatsAll.slice(0, 5);

  // Export to Excel functionality
  const handlePrevMonth = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
    setCurrentPage(1);
  };

  const handleExportReport = async () => {
    try {
      setExporting(true);
      console.log(newAttendance);
      // Prepare data for export
      const exportData = Object.values(newAttendance).map((emp, i) => ({
        'Sr No.': i + 1,
        'Employee Name': emp.name,
        'Employee ID': emp.employeeId,
        'Role': emp.role,
        'Present Days': emp.presentDays.size,
        'Absent Days': emp.absentDays.size,
        'Leave Days': emp.leaveDays.size,
        'Holiday Days': emp.holidayDays.size,
        // 'Weekly Offs': emp.weeklyOffDays.size,
        'Half Day': emp.halfDayDays.size,
        'Total Working Hours': emp.workingHours.toFixed(2),
        'Attendance Rate (%)': emp.attendanceRate,
        'Late Arrivals': emp.lateArrivals,
        'Total Days': emp.days.size
      }));

      if (exportData.length === 0) {
        alert('No attendance data to export');
        setExporting(false);
        return;
      }

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

      // Add summary sheet
      const summaryData = [
        ['Attendance Report Summary'],
        ['Report Generated Date', new Date().toLocaleDateString('en-IN')],
        ['Report Month', selectedMonth],
        ['Total Employees', Object.keys(newAttendance).length],
        ['Average Attendance Rate', stats[1].value],
        ['Total Working Hours', stats[2].value],
        // ['Total Weekly Offs', stats[3].value]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Generate filename with date
      const fileName = `Attendance_Report_${selectedMonth.replace(/\\s+/g, '_')}_${new Date().getTime()}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);

      console.log('✅ Report exported successfully');
      alert('Report exported successfully!');
    } catch (error) {
      console.error('❌ Error exporting report:', error);
      alert('Error exporting report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getEmployeeAttendance = async () => {
    try {
      const res = await api.get('/attendance/all');
      console.log('Attendance API Response:', res.data);
      return res.data;
    } catch (error) {
      console.log('Error fetching attendance data:', error);
      throw error;
    }
  };

  // Refresh attendance data manually
  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Manually refreshing attendance data...');
      const newData = await getEmployeeAttendance();
      console.log('✅ Fresh data received:', newData.length, 'records');
      setAttendance(newData);
      processAttendanceData(newData);
      alert('✅ Data refreshed successfully!');
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      alert('Error refreshing data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch employee face registration status
  const checkFaceRegistration = async (employeeId) => {
    try {
      setLoadingFaceStatus(prev => ({ ...prev, [employeeId]: true }));
      const res = await api.get(`/attendance/face/status?employeeId=${employeeId}`);
      setFaceStatusMap(prev => ({
        ...prev,
        [employeeId]: res.data.isRegistered
      }));
      return res.data.isRegistered;
    } catch (err) {
      console.error('Error checking face status:', err);
      setFaceStatusMap(prev => ({
        ...prev,
        [employeeId]: false
      }));
      return false;
    } finally {
      setLoadingFaceStatus(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  // Delete face registration for an employee
  const handleDeleteFace = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee\'s face registration?')) {
      return;
    }

    try {
      setDeletingFaceId(employeeId);
      const res = await api.delete(`/attendance/face/delete?employeeId=${employeeId}`);

      if (res.data.success) {
        setFaceStatusMap(prev => ({
          ...prev,
          [employeeId]: false
        }));
        alert('Face registration deleted successfully');
      }
    } catch (err) {
      console.error('Error deleting face:', err);
      alert(err.response?.data?.message || 'Failed to delete face registration');
    } finally {
      setDeletingFaceId(null);
    }
  };

  // Refresh face registration status
  const handleRefreshFaceStatus = async (employeeId) => {
    await checkFaceRegistration(employeeId);
  };

  // Handle face registration button click
  const handleRegisterFace = (employee) => {
    setSelectedEmployeeForFace(employee);
    setShowFaceRegistrationModal(true);
  };

  // Handle closing the face registration modal
  const closeFaceRegistrationModal = () => {
    setShowFaceRegistrationModal(false);
    setSelectedEmployeeForFace(null);
  };

  // Submit face registration
  const handleSubmitFaceRegistration = async () => {
    if (!selectedEmployeeForFace) return;

    try {
      setRegisteringFaceId(selectedEmployeeForFace._id);
      const res = await api.post(`/attendance/face/register`, {
        employeeId: selectedEmployeeForFace._id,
        status: 'pending'
      });

      if (res.data.success) {
        alert('Face registration initiated. Please ask the employee to complete registration.');
        closeFaceRegistrationModal();
        await checkFaceRegistration(selectedEmployeeForFace._id);
      }
    } catch (err) {
      console.error('Error initiating face registration:', err);
      alert(err.response?.data?.message || 'Failed to initiate face registration');
    } finally {
      setRegisteringFaceId(null);
    }
  };

  // Handle viewing employee report
  const handleViewReport = (empId) => {
    const employee = newAttendance[empId];
    if (employee) {
      setSelectedEmployeeForDetails(employee);
      setShowReportModal(true);
    }
  };

  // Close report modal
  const closeReportModal = () => {
    setShowReportModal(false);
    setSelectedEmployeeForDetails(null);
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setUploadErrors(['Please select a file to upload']);
      setUploadedFile(null);
      return;
    }

    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    const validExtensions = /\.(xlsx|xls|csv)$/i;

    if (!validExtensions.test(file.name) && !validTypes.includes(file.type)) {
      setUploadErrors(['Invalid file format. Please upload Excel (.xlsx, .xls) or CSV (.csv) file']);
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    setUploadErrors([]);

    // Read and preview file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setUploadErrors(['File is empty or corrupted. Please check your Excel file']);
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate data
        if (jsonData.length === 0) {
          setUploadErrors(['File is empty. Please check your Excel file']);
          return;
        }

        // Check required columns (more flexible - check for partial matches)
        const fileColumns = Object.keys(jsonData[0]);
        const requiredColumns = ['Employee ID', 'Date', 'Status', 'Check In', 'Check Out'];
        const missingColumns = requiredColumns.filter(col =>
          !fileColumns.some(fc => fc.toLowerCase().includes(col.toLowerCase()))
        );

        if (missingColumns.length > 0) {
          setUploadErrors([
            'Missing required columns:',
            ...missingColumns.map(col => `• ${col}`)
          ]);
          setUploadedFile(null);
          return;
        }

        // Check what months are in the data
        const dateColumn = Object.keys(jsonData[0]).find(col => col.toLowerCase().includes('date'));
        const dataMonths = new Set();
        let firstDate = null;
        let lastDate = null;

        jsonData.forEach(row => {
          try {
            if (row[dateColumn]) {
              let date = new Date(row[dateColumn]);
              // Handle Excel date numbers
              if (typeof row[dateColumn] === 'number') {
                date = new Date(Math.round((row[dateColumn] - 25569) * 86400 * 1000));
              }
              if (!isNaN(date.getTime())) {
                dataMonths.add(`${date.getMonth() + 1}/${date.getFullYear()}`);
                if (!firstDate || date < firstDate) firstDate = date;
                if (!lastDate || date > lastDate) lastDate = date;
              }
            }
          } catch {
            // Skip invalid dates
          }
        });

        const currentMonth = `${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;
        const warnings = [];
        if (dataMonths.size > 0 && !dataMonths.has(currentMonth)) {
          warnings.push(`⚠️ Month Mismatch: File has data for ${Array.from(dataMonths).join(', ')} but you're on month ${currentMonth}`);
        }

        // Show preview (first 5 rows)
        setUploadPreview(jsonData.slice(0, 5));
        setUploadErrors(warnings);


      } catch (error) {
        console.error('File read error:', error);
        setUploadErrors([`Error reading file: ${error.message}`]);
        setUploadedFile(null);
      }
    };

    reader.onerror = () => {
      setUploadErrors(['Error reading file. Please try again.']);
      setUploadedFile(null);
    };

    reader.readAsArrayBuffer(file);
  };

  // Submit upload
  const handleSubmitUpload = async () => {
    if (!uploadedFile) {
      setUploadErrors(['Please select a file first']);
      return;
    }

    if (uploadErrors.length > 0) {
      alert('Please fix the errors in your file before uploading');
      return;
    }

    try {
      setUploading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          let jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Validate data before sending
          if (jsonData.length === 0) {
            setUploadErrors(['File is empty']);
            setUploading(false);
            return;
          }

          // Normalize dates to UTC ISO strings - CRITICAL FIX
          jsonData = jsonData.map(row => {
            const normalized = { ...row };
            for (const key in normalized) {
              const val = normalized[key];
              // Check if this is a date field
              if (key.toLowerCase().includes('date') || key.toLowerCase().includes('punch')) {
                let date = null;

                if (val instanceof Date) {
                  date = val;
                } else if (typeof val === 'number') {
                  // Excel date serial number format
                  date = new Date(Math.round((val - 25569) * 86400 * 1000));
                } else if (typeof val === 'string') {
                  // Try DD-MM-YYYY or DD-MM-YYYY HH:MM:SS (common Indian Excel format)
                  const ddmmyyyy = val.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
                  if (ddmmyyyy) {
                    const [, dd, mm, yyyy] = ddmmyyyy;
                    date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                  } else {
                    date = new Date(val);
                  }
                } else {
                  continue;
                }

                if (date && !isNaN(date.getTime())) {
                  // Convert to UTC midnight for date fields
                  // IMPORTANT: Use LOCAL date parts (getFullYear/getMonth/getDate) NOT UTC parts.
                  // Excel serial numbers represent dates in the user's LOCAL timezone (IST).
                  // e.g., 01-07-2025 00:00:00 IST = 30-06-2025 18:30 UTC → getUTCDate()=30 (WRONG!)
                  // Using local parts: getDate()=1, getMonth()=6 (July) → correct!
                  if (key.toLowerCase().includes('date') && !key.toLowerCase().includes('time')) {
                    const utcDate = new Date(
                      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
                    );
                    normalized[key] = utcDate.toISOString();
                  } else {
                    // For time fields, keep the full timestamp
                    normalized[key] = date.toISOString();
                  }
                }
              }
            }
            return normalized;
          });

          console.log('📋 Normalized data sample:', jsonData[0]);

          // Send to backend
          const response = await api.post('/attendance/bulk-upload', {
            records: jsonData
          });

          console.log('📤 Upload response:', {
            success: response.data.success,
            uploadedCount: response.data.uploadedCount,
            failedCount: response.data.failedCount,
            errors: response.data.errors
          });

          if (response.data.success) {
            alert(`✅ Successfully uploaded ${response.data.uploadedCount} attendance records`);
            if (response.data.errors?.length > 0) {
              alert(`⚠️ ${response.data.errors.length} records failed:\n${response.data.errors.slice(0, 5).join('\n')}`);
            }

            // Wait longer for backend to process
            console.log('⏳ Waiting for backend to process...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Refresh attendance data
            const newData = await getEmployeeAttendance();
            console.log('📥 Fresh data from API after upload:', {
              totalRecords: newData.length,
              uniqueEmployees: new Set(newData.map(d => d.employee?._id)).size,
              dateRange: newData.length > 0 ? `${new Date(newData[newData.length - 1]?.date).toLocaleDateString()} to ${new Date(newData[0]?.date).toLocaleDateString()}` : 'N/A'
            });

            // Extract what months are in the fresh data
            const monthsInData = new Set();
            const datesInData = new Set();
            newData.forEach(record => {
              const date = new Date(record.date);
              monthsInData.add(`${date.getMonth() + 1}/${date.getFullYear()}`);
              datesInData.add(record.date.split('T')[0]);
            });

            console.log('📅 Months in uploaded data:', Array.from(monthsInData).join(', '));
            console.log('📊 Total unique dates:', datesInData.size);

            // Store raw data AND process it
            setAttendance(newData);
            processAttendanceData(newData);

            // Navigate to first available month in the uploaded data
            if (monthsInData.size > 0) {
              const firstMonth = Array.from(monthsInData)[0];
              const [month, year] = firstMonth.split('/');
              const targetDate = new Date(year, parseInt(month) - 1, 1);
              if (targetDate.getTime() !== selectedDate.getTime()) {
                console.log(`🔄 Auto-navigating to month: ${firstMonth}`);
                setSelectedDate(targetDate);
              }
            }

            // Close modal and reset
            setTimeout(() => {
              setShowUploadModal(false);
              setUploadedFile(null);
              setUploadPreview([]);
              setUploadErrors([]);
            }, 300);

          } else {
            setUploadErrors([response.data.message || 'Upload failed']);
          }
        } catch (error) {
          console.error('Upload error:', error);
          setUploadErrors([error.response?.data?.message || error.message || 'Error uploading file']);
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadErrors(['Error reading file']);
        setUploading(false);
      };

      reader.readAsArrayBuffer(uploadedFile);
    } catch (error) {
      setUploadErrors([error.message]);
      setUploading(false);
    }
  };

  // Close upload modal
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadedFile(null);
    setUploadPreview([]);
    setUploadErrors([]);
  };

  // Process attendance data
  const processAttendanceData = (data) => {
    try {
      // Use local month/year for the selected date (user-facing calendar month)
      // Item dates are compared using UTC to match how MongoDB stores them
      const selMonth = selectedDate.getMonth();
      const selYear = selectedDate.getFullYear();

      const result = data.reduce((acc, item) => {
        try {
          // Validate item has required fields
          if (!item || !item.employee || !item.date) {
            console.warn('⚠️ Skipping invalid attendance record:', item);
            return acc;
          }

          // Use UTC methods to avoid IST timezone shifting dates to wrong month
          const itemDate = new Date(item.date);
          const itemMonth = itemDate.getUTCMonth();
          const itemYear = itemDate.getUTCFullYear();

          // Filter by selected month/year (UTC-based to match stored dates)
          if (itemMonth !== selMonth || itemYear !== selYear) {
            return acc;
          }

          const empId = item.employee._id;
          const empName = `${item.employee.firstName || ''} ${item.employee.lastName || ''}`.trim();
          const empRole = item.employee.role || 'N/A';
          // Use UTC date parts to build the day key (avoids IST shifting date string)
          const utcY = itemDate.getUTCFullYear();
          const utcM = String(itemDate.getUTCMonth() + 1).padStart(2, '0');
          const utcD = String(itemDate.getUTCDate()).padStart(2, '0');
          const day = `${utcY}-${utcM}-${utcD}`;
          const status = item.status || 'unknown';
          const employeeId = item.employee.employeeId;

          if (!acc[empId]) {
            acc[empId] = {
              _id: empId,
              empId: item.employee.empId || empId,
              name: empName,
              role: empRole,
              employeeId: employeeId,
              avatar: item.employee.firstName?.charAt(0).toUpperCase() || 'E',
              days: new Set(),
              presentDays: new Set(),
              absentDays: new Set(),
              leaveDays: new Set(),
              holidayDays: new Set(),
              weeklyOffDays: new Set(),
              halfDayDays: new Set(),
              missedPunchDays: new Set(),
              lateArrivals: 0,
              leaves: 0,
              workingHours: 0,
              attendanceRate: 0
            };
          }

          acc[empId].days.add(day);

          // Calculate working hours:
          // Priority 1: Use DB-stored workingHours (set from Excel "Working Hours" column)
          // Priority 2: Compute from checkIn/checkOut timestamps
          if (item.workingHours && item.workingHours > 0) {
            // DB value takes top priority - it's the authoritative source (from Excel or manual entry)
            acc[empId].workingHours += parseFloat(item.workingHours);
          } else if (item.checkIn && item.checkOut) {
            // Fallback: compute from punch times
            const checkInTime = new Date(item.checkIn);
            const checkOutTime = new Date(item.checkOut);
            let hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
            // Handle cross-midnight shift (checkout next day stored in UTC)
            if (hoursWorked < 0) hoursWorked += 24;
            if (hoursWorked > 0 && hoursWorked <= 24) {
              acc[empId].workingHours += parseFloat(hoursWorked.toFixed(2));
            }
          }

          // Track status by category
          if (status === 'present') {
            acc[empId].presentDays.add(day);
          } else if (status === 'absent') {
            acc[empId].absentDays.add(day);
          } else if (status === 'leave') {
            acc[empId].leaveDays.add(day);
          } else if (status === 'holiday') {
            acc[empId].holidayDays.add(day);
          } else if (status === 'weekly_off') {
            acc[empId].weeklyOffDays.add(day);
          } else if (status === 'half_day') {
            acc[empId].halfDayDays.add(day);
          } else if (status === 'missed_punch') {
            acc[empId].missedPunchDays.add(day);
          }

          return acc;
        } catch (itemError) {
          console.error('❌ Error processing individual attendance record:', itemError, item);
          return acc;
        }
      }, {});

      // Calculate attendance rates
      Object.keys(result).forEach(empId => {
        const employee = result[empId];
        const totalDays = employee.days.size;
        const presentDays = employee.presentDays.size + employee.halfDayDays.size * 0.5;
        const workingDays = totalDays - employee.weeklyOffDays.size - employee.holidayDays.size;

        // Use working days for attendance rate, fallback to total days if no working days calculated
        employee.attendanceRate = workingDays > 0
          ? Math.round((employee.presentDays.size / workingDays) * 100)
          : (totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0);
      });

      setNewAttendance(result);
    } catch (error) {
      console.error('❌ Error processing attendance data:', error);
      setNewAttendance({});
    }
  };

  // Re-process when selected month changes
  useEffect(() => {
    if (attendance.length > 0) {
      processAttendanceData(attendance);
    }
  }, [selectedDate]);

  // Load face status for all employees when attendance data is loaded
  useEffect(() => {
    if (Object.keys(newAttendance).length > 0) {
      Object.keys(newAttendance).forEach(empId => {
        if (!Object.prototype.hasOwnProperty.call(faceStatusMap, empId)) {
          checkFaceRegistration(empId);
        }
      });
    }
  }, [newAttendance]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const data = await getEmployeeAttendance();

        if (!data || !Array.isArray(data)) {
          console.error('Invalid attendance data received:', data);
          setAttendance([]);
          setNewAttendance({});
          setLoading(false);
          return;
        }

        // Store raw data for filtering by month later
        setAttendance(data);

        // Process with month filter on initial load
        processAttendanceData(data);

      } catch (err) {
        console.error('Error fetching attendance:', err);
        setAttendance([]);
        setNewAttendance({});
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  // Helper function to get status category based on attendance rate
  const getStatusCategory = (rate) => {
    if (rate >= 95) return 'Excellent (95%+)';
    if (rate >= 85) return 'Good (85%+)';
    if (rate >= 75) return 'Average (75%+)';
    return 'Poor (<75%)';
  };

  // Filter employees based on search term, department, and status
  const filteredEmployees = Object.keys(newAttendance).filter((empId) => {
    const employee = newAttendance[empId];
    const searchLower = searchTerm.toLowerCase();

    // Search filter
    const matchesSearch =
      employee.name.toLowerCase().includes(searchLower) ||
      employee.empId.toLowerCase().includes(searchLower) ||
      employee.role.toLowerCase().includes(searchLower);

    // Department filter
    const matchesDepartment =
      selectedDepartment === 'All Departments' ||
      employee.role === selectedDepartment;

    // Status filter
    let matchesStatus = true;
    if (selectedStatus !== 'All Status') {
      const employeeStatus = getStatusCategory(employee.attendanceRate);
      matchesStatus = employeeStatus === selectedStatus;
    }

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);
  const paginatedEmployees = filteredEmployees
    .slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-lg font-bold">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 space-y-2">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const accent = stat.color === 'indigo' ? 'border-l-indigo-500 bg-indigo-50/50' : stat.color === 'emerald' ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-amber-500 bg-amber-50/50';
          const iconBg = stat.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' : stat.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600';
          return (
            <div key={index} className={`border-l-4 ${accent} border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm hover:shadow transition-shadow`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-semibold text-slate-800 dark:text-white mt-1">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                  <Icon size={20} strokeWidth={2} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Department Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <PieChart className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">Department Overview</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAnalyticsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Analytics
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {departmentStats.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No department data available</p>
          ) : (
            departmentStats.map((dept, index) => (
              <div key={index} className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{dept.department}</p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{dept.employees}</span>
                  <span className="text-xs font-medium text-slate-500">Employees</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mb-3">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: dept.rate }}
                  ></div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-slate-500">{dept.rate} Attendance</p>
                  <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">{dept.avgHours} avg</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search employee name or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 text-slate-700 dark:text-slate-200"
              />
            </div>
            <Select
              value={selectedDepartment}
              onChange={(value) => {
                setSelectedDepartment(value);
                setCurrentPage(1); // Reset to first page when filtering
              }}
              style={{ minHeight: '40px' }}
              className="w-full sm:w-44 font-medium text-sm rounded-lg"
              options={[
                { value: 'All Departments', label: 'All Departments' },
                { value: 'Engineering', label: 'Engineering' },
                { value: 'Sales', label: 'Sales' },
                { value: 'Marketing', label: 'Marketing' },
                { value: 'Finance', label: 'Finance' },
                { value: 'HR', label: 'HR' },
                { value: 'Design', label: 'Design' },
              ]}
            />
            <Select
              value={selectedStatus}
              onChange={(value) => {
                setSelectedStatus(value);
                setCurrentPage(1); // Reset to first page when filtering
              }}
              style={{ minHeight: '40px' }}
              className="w-full sm:w-40 font-medium text-sm rounded-lg"
              options={[
                { value: 'All Status', label: 'All Status' },
                { value: 'Excellent (95%+)', label: 'Excellent (95%+)' },
                { value: 'Good (85%+)', label: 'Good (85%+)' },
                { value: 'Average (75%+)', label: 'Average (75%+)' },
                { value: 'Poor (<75%)', label: 'Poor (<75%)' },
              ]}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 w-full sm:w-auto justify-between sm:justify-start">
              <button type="button" onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition">
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <span className="font-medium text-slate-700 dark:text-slate-300 px-2 text-xs min-w-[100px] text-center">{selectedMonth}</span>
              <button type="button" onClick={handleNextMonth} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition">
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Can module="attendance.dashboard" action="view">
                <button
                  type="button"
                  onClick={handleRefreshData}
                  disabled={refreshing || loading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 rounded-lg font-medium text-sm hover:bg-slate-700 dark:hover:bg-slate-300 transition disabled:opacity-50"
                  title="Refresh attendance data"
                >
                  {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </Can>
              <Can module="attendance.dashboard" action="view">
                <button
                  type="button"
                  onClick={handleExportReport}
                  disabled={exporting || Object.keys(newAttendance).length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
              </Can>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">Monthly Attendance History</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedMonth} — Complete records</p>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {filteredEmployees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredEmployees.length)} of {filteredEmployees.length}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Table Header */}
              <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_1.5fr_1fr] px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg border-b border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Employee</div>
                <div className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 pl-4">Present</div>
                <div className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 pl-4">Absent</div>
                <div className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 pl-4">Late</div>
                <div className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 pl-4">Hours</div>
                <div className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 pl-4">Face</div>
                <div className="text-right text-xs font-semibold text-slate-600 dark:text-slate-400 pr-2">Actions</div>
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto custom-scrollbar">
                {paginatedEmployees.map((empId) => {
                  const employee = newAttendance[empId];
                  return (
                    <div
                      key={empId}
                      className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_1.5fr_1fr] items-center px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => handleViewReport(empId)}
                    >
                      {/* Employee Col */}
                      <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); openEmployeeProfile(employee); }}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0">
                          {employee.avatar}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white truncate group-hover:text-slate-900 transition-colors leading-none">{employee.name}</p>
                          <p className="text-[11px] font-medium text-slate-500 mt-1 truncate opacity-70">{employee.employeeId}</p>
                        </div>
                      </div>

                      {/* Present Days Col */}
                      <div className="pl-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 leading-none">{employee.presentDays.size}</span>
                          <span className="text-[11px] font-medium text-slate-500 mt-1">days</span>
                        </div>
                      </div>

                      {/* Absent Col */}
                      <div className="pl-4">
                        <span className="text-lg font-semibold text-rose-500 dark:text-rose-400 leading-none">{employee.absentDays.size}</span>
                      </div>

                      {/* Late Arrivals Col */}
                      <div className="pl-4">
                        <span className="text-lg font-semibold text-orange-500 dark:text-orange-400 leading-none">{employee.lateArrivals}</span>
                      </div>

                      {/* Total Hours Col */}
                      <div className="pl-4">
                        <p className="text-lg font-semibold text-slate-800 dark:text-white leading-none">
                          {parseFloat(employee.workingHours).toFixed(2)}
                          <span className="text-[11px] font-medium text-slate-500 ml-1 inline-block mt-0.5">hrs</span>
                        </p>
                      </div>

                      {/* Face Registration Col */}
                      <div className="pl-4">
                        {loadingFaceStatus[empId] ? (
                          <div className="flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin text-indigo-600" />
                            <span className="text-[11px] font-medium text-slate-500">Checking...</span>
                          </div>
                        ) : faceStatusMap[empId] ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg w-fit">
                            <CheckCircle size={10} className="text-emerald-600 dark:text-emerald-400" />
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Registered</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-lg w-fit">
                            <XCircle size={10} className="text-rose-500 dark:text-rose-400" />
                            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-300">Not Registered</span>
                          </div>
                        )}
                      </div>

                      {/* Actions Col */}
                      <div className="flex justify-end gap-1.5 pl-4 pr-1" onClick={(e) => e.stopPropagation()}>
                        <Can module="people.employees" action="view">
                          <button onClick={() => openEmployeeProfile(employee)} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 text-slate-400 hover:text-emerald-600 border border-transparent hover:border-emerald-200 transition-all shadow-sm" title="Open Profile">
                            <UserCheck size={14} />
                          </button>
                        </Can>
                        <Can module="attendance.dashboard" action="view">
                          <button onClick={() => handleViewReport(empId)} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-500 border border-transparent hover:border-indigo-200 transition-all shadow-sm" title="View Report">
                            <FileText size={14} />
                          </button>
                        </Can>
                        {faceStatusMap[empId] && (
                          <Can module="attendance.dashboard" action="delete">
                            <button onClick={() => handleDeleteFace(empId)} disabled={deletingFaceId === empId} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 border border-transparent hover:border-rose-200 transition-all shadow-sm disabled:opacity-50" title="Delete Face Registration">
                              {deletingFaceId === empId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </Can>
                        )}
                        {faceStatusMap[empId] && (
                          <Can module="attendance.dashboard" action="view">
                            <button onClick={() => handleRefreshFaceStatus(empId)} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-500 border border-transparent hover:border-indigo-200 transition-all shadow-sm" title="Refresh Face Status">
                              <RefreshCw size={14} />
                            </button>
                          </Can>
                        )}
                        <Can module="attendance.dashboard" action="edit">
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'register_face',
                                  label: 'Register Face',
                                  icon: <Camera size={14} />,
                                  onClick: () => handleRegisterFace(employee),
                                },
                              ],
                            }}
                            trigger={['click']}
                            placement="bottomRight"
                          >
                            <button className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200 transition-all shadow-sm" title="More Options">
                              <MoreVertical size={14} />
                            </button>
                          </Dropdown>
                        </Can>
                      </div>
                    </div>
                  );
                })}

                {paginatedEmployees.length === 0 && (
                  <div className="py-16 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                      {Object.keys(newAttendance).length === 0 ? 'No attendance records' : 'No matching employees'}
                    </p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm max-w-sm text-center">
                      {Object.keys(newAttendance).length === 0
                        ? 'Attendance data will appear here once records are available.'
                        : `Try adjusting filters or search.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/30 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Page {currentPage} of {Math.max(1, totalPages)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Face Registration Modal */}
      {showFaceRegistrationModal && selectedEmployeeForFace && createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-8 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Face Registration
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Register face for <span className="font-bold text-slate-800 dark:text-white">{selectedEmployeeForFace.name}</span>
              </p>
            </div>

            {/* Employee Info */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg">
                  {selectedEmployeeForFace.avatar}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                    {selectedEmployeeForFace.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {selectedEmployeeForFace.empId} • {selectedEmployeeForFace.role}
                  </p>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-bold">
                <span className="block font-black mb-1">📸 Registration Process</span>
                Click "Start Registration" to initiate the face registration process. The employee will need to use their camera to capture face data.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={closeFaceRegistrationModal}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFaceRegistration}
                disabled={registeringFaceId === selectedEmployeeForFace._id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {registeringFaceId === selectedEmployeeForFace._id ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    Start Registration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Report Modal */}
      {showReportModal && selectedEmployeeForDetails && createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-900 px-6 py-4 border-b border-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-lg">
                    {selectedEmployeeForDetails.avatar}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">
                      Attendance Report - {selectedEmployeeForDetails.name}
                    </p>
                    <p className="text-sm text-emerald-100">
                      {selectedEmployeeForDetails.employeeId} • {selectedEmployeeForDetails.role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeReportModal}
                  className="text-white hover:bg-white/20 p-2 rounded-xl transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Key Metrics */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  📊 Key Metrics
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Attendance Rate</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedEmployeeForDetails.attendanceRate}%</p>
                    </div>
                    <div className="text-right">
                      {selectedEmployeeForDetails.attendanceRate >= 95 && <span className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-black">Excellent</span>}
                      {selectedEmployeeForDetails.attendanceRate >= 85 && selectedEmployeeForDetails.attendanceRate < 95 && <span className="inline-block px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black">Good</span>}
                      {selectedEmployeeForDetails.attendanceRate >= 75 && selectedEmployeeForDetails.attendanceRate < 85 && <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-black">Average</span>}
                      {selectedEmployeeForDetails.attendanceRate < 75 && <span className="inline-block px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full text-xs font-black">Poor</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  📋 Attendance Breakdown
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Present</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">{selectedEmployeeForDetails.presentDays.size}</p>
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold">days</p>
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Absent</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">{selectedEmployeeForDetails.absentDays.size}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 font-bold">days</p>
                    </div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">Leave</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{selectedEmployeeForDetails.leaveDays.size}</p>
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">days</p>
                    </div>
                  </div>
                  {/* <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest mb-2">Weekly Offs</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-black text-purple-600 dark:text-purple-400">{selectedEmployeeForDetails.weeklyOffDays.size}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-bold">days</p>
                    </div>
                  </div> */}
                  <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-3">
                    <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 mb-1">Holiday</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{selectedEmployeeForDetails.holidayDays.size}</p>
                      <p className="text-xs text-cyan-600 dark:text-cyan-400 font-bold">days</p>
                    </div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-3">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Half Day</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{selectedEmployeeForDetails.halfDayDays.size}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">days</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Working Hours */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Working Hours
                </h3>
                <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Total Hours Worked</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{selectedEmployeeForDetails.workingHours.toFixed(2)} <span className="text-lg">hrs</span></p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Average per day: {(selectedEmployeeForDetails.workingHours / Math.max(selectedEmployeeForDetails.presentDays.size, 1)).toFixed(2)} hrs</p>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  ✅ Summary
                </h3>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 font-bold leading-relaxed">
                    <strong>{selectedEmployeeForDetails.name}</strong> has worked <strong>{selectedEmployeeForDetails.presentDays.size}</strong> days with an attendance rate of <strong>{selectedEmployeeForDetails.attendanceRate}%</strong>.
                    Total working hours recorded: <strong>{selectedEmployeeForDetails.workingHours.toFixed(2)} hours</strong>.
                    Absences: <strong>{selectedEmployeeForDetails.absentDays.size} days</strong>, Leave: <strong>{selectedEmployeeForDetails.leaveDays.size} days</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800">
              <div className="flex gap-2">
                <button
                  onClick={() => openEmployeeProfile(selectedEmployeeForDetails)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition"
                >
                  Open Profile
                </button>
                <button
                  onClick={closeReportModal}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Excel Modal */}
      {showUploadModal && createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Upload Attendance Records</h3>
                    <p className="text-xs text-indigo-100 mt-1 font-bold">Import attendance data from Excel file</p>
                  </div>
                </div>
                <button
                  onClick={closeUploadModal}
                  className="text-white hover:bg-white/20 p-2 rounded-xl transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* File Upload Section */}
              <div>
                {!uploadedFile ? (
                  <div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="block cursor-pointer">
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:border-slate-800 transition cursor-pointer group">
                        <div className="flex justify-center mb-4">
                          <Upload className="w-12 h-12 text-slate-400 group-hover:text-slate-800 transition" />
                        </div>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-widest">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                          Supports: Excel (.xlsx, .xls) and CSV files
                        </p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <FileText className="w-5 h-5 text-slate-800 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white text-sm">{uploadedFile.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadPreview([]);
                        setUploadErrors([]);
                      }}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition text-slate-600 dark:text-slate-400"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Error Messages */}
              {uploadErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
                  <p className="text-xs font-black text-red-700 dark:text-red-300 uppercase tracking-widest mb-2">❌ Errors</p>
                  <div className="text-sm text-red-700 dark:text-red-300 font-bold space-y-1">
                    {uploadErrors.map((error, idx) => (
                      <p key={idx}>{error}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Section */}
              {uploadPreview.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-3">
                    📋 Preview (First 5 Records)
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          {Object.keys(uploadPreview[0] || {}).map((header) => (
                            <th key={header} className="px-4 py-3 text-left font-black text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {uploadPreview.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                            {Object.values(row).map((value, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-3 text-slate-600 dark:text-slate-400 font-bold">
                                {String(value).substring(0, 30)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-800 dark:text-slate-300 font-bold leading-relaxed">
                  <span className="block font-black mb-2">📝 Required Columns:</span>
                  Your Excel file must have these columns: <strong>Employee ID</strong>, <strong>Date</strong>, <strong>Status</strong>, <strong>Check In</strong>, <strong>Check Out</strong>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-800 flex gap-3">
              <button
                onClick={closeUploadModal}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitUpload}
                disabled={!uploadedFile || uploading || uploadErrors.length > 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Records
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Analytics Dashboard Modal */}
      {showAnalyticsModal && createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-900 p-6 border-b border-indigo-500 z-10 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20">
                  <PieChart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Department Wise Analytics</h3>
                  <p className="text-xs text-indigo-100 mt-1 font-bold uppercase tracking-widest">{selectedMonth} • Comprehensive View</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-[50vh]">
              {departmentStatsAll.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
                  <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-slate-500 font-bold">No department analytics available for this period.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departmentStatsAll.map((dept, index) => (
                    <div key={index} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-lg transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-1">{dept.department}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dept.employees} Employees</p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${dept.rateNum >= 90 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          dept.rateNum >= 75 ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                            'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                          {dept.rate} ATTENDANCE
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Present</p>
                          <p className="text-lg font-black text-emerald-700">{dept.present}</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Absent</p>
                          <p className="text-lg font-black text-rose-700">{dept.absent}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Leave</p>
                          <p className="text-lg font-black text-amber-700">{dept.leave}</p>
                        </div>
                      </div>

                      {/* Progress Bar & Details */}
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance Health</p>
                          <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{dept.avgHours} Avg/Day</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mb-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${dept.rateNum >= 90 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                              dept.rateNum >= 75 ? 'bg-gradient-to-r from-indigo-400 to-indigo-500' :
                                'bg-gradient-to-r from-orange-400 to-orange-500'
                              }`}
                            style={{ width: `${dept.rateNum}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-100 dark:border-slate-800">
                          <p className="flex items-center gap-1 group-hover:text-amber-500 transition-colors">
                            <Clock size={10} /> {dept.late} Late Arrivals
                          </p>
                          <p>{dept.total} Total Days</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest transition"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
