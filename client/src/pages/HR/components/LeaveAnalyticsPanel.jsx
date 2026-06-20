import React, { useState, useEffect } from 'react';
import { 
    Download, 
    FileText, 
    Users, 
    Calendar, 
    TrendingUp, 
    AlertCircle, 
    Briefcase,
    Settings,
    ShieldAlert,
    RefreshCw,
    Search,
    ChevronRight,
    MapPin,
    GraduationCap,
    Award,
    Upload
} from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import clsx from 'clsx';
import * as XLSX from '@sheetjs/xlsx';
import OpeningBalanceImportModal from './OpeningBalanceImportModal';
import { 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    CartesianGrid, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend 
} from 'recharts';

export default function LeaveAnalyticsPanel() {
    const [subView, setSubView] = useState('master'); // master, policy, allRequests, employeeSummary, balances, utilization, pending, ledger, trends, leaderboard, sick, liability
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    
    // Master Report States
    const [masterReport, setMasterReport] = useState({ stats: {}, sheets: {} });
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [empBalPage, setEmpBalPage] = useState(1);
    const EMP_BAL_PER_PAGE = 10;
    const [masterFilters, setMasterFilters] = useState({
        policyId: '',
        departmentId: '',
        branchId: '',
        designationId: '',
        employeeStatus: 'Active',
        employeeId: '',
        leaveType: 'All'
    });
    const [policiesList, setPoliciesList] = useState([]);

    // Lookups
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [grades, setGrades] = useState([]);
    const [designations, setDesignations] = useState([]);

    // Data States
    const [policyAnalytics, setPolicyAnalytics] = useState([]);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [policyEmployees, setPolicyEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    const [balancesAnalytics, setBalancesAnalytics] = useState([]);
    const [balanceFilters, setBalanceFilters] = useState({
        branchId: '',
        departmentId: '',
        gradeId: '',
        designationId: ''
    });

    const [utilizationReport, setUtilizationReport] = useState([]);
    const [pendingReport, setPendingReport] = useState([]);
    const [ledgerReport, setLedgerReport] = useState([]);
    const [ledgerFilters, setLedgerFilters] = useState({
        leaveType: 'All',
        actionType: 'All',
        employeeId: ''
    });
    
    const [monthlyTrends, setMonthlyTrends] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    
    const [sickLeaveReport, setSickLeaveReport] = useState([]);
    const [sickMinDays, setSickMinDays] = useState(5);
    
    const [liability, setLiability] = useState({ totalELDays: 0, activeEmployeesCount: 0 });

    // New detailed report states
    const [allRequestsReport, setAllRequestsReport] = useState([]);
    const [employeeSummaryReport, setEmployeeSummaryReport] = useState([]);
    const [employees, setEmployees] = useState([]);

    // New filter/search states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedLeaveType, setSelectedLeaveType] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');

    // Reset filters on subview switch
    useEffect(() => {
        setSearchTerm('');
        setSelectedBranch('');
        setSelectedDept('');
        setSelectedLeaveType('All');
        setSelectedStatus('All');
        setLedgerFilters({
            leaveType: 'All',
            actionType: 'All',
            employeeId: ''
        });
    }, [subView]);

    // Load filter lookups
    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const [branchRes, deptRes, gradeRes, posRes, empRes, policyRes] = await Promise.all([
                    api.get('/organization/branches').catch(() => ({ data: [] })),
                    api.get('/hr/departments').catch(() => ({ data: [] })),
                    api.get('/grades').catch(() => ({ data: [] })),
                    api.get('/positions').catch(() => ({ data: [] })),
                    api.get('/hr/employees?limit=1000').catch(() => ({ data: { data: [] } })),
                    api.get('/hr/leave-policies').catch(() => ({ data: [] }))
                ]);
                
                const rawBranches = Array.isArray(branchRes.data?.data) ? branchRes.data.data : (Array.isArray(branchRes.data) ? branchRes.data : []);
                const rawDepts = Array.isArray(deptRes.data?.data) ? deptRes.data.data : (Array.isArray(deptRes.data) ? deptRes.data : []);
                const rawGrades = Array.isArray(gradeRes.data?.data) ? gradeRes.data.data : (Array.isArray(gradeRes.data) ? gradeRes.data : []);
                const rawPos = Array.isArray(posRes.data?.data) ? posRes.data.data : (Array.isArray(posRes.data) ? posRes.data : []);
                const rawEmps = Array.isArray(empRes.data?.data) ? empRes.data.data : (Array.isArray(empRes.data) ? empRes.data.data : (Array.isArray(empRes.data) ? empRes.data : []));

                setBranches(rawBranches);
                setDepartments(rawDepts);
                setGrades(rawGrades);
                setDesignations(rawPos);
                setPoliciesList(Array.isArray(policyRes.data) ? policyRes.data : []);
                setEmployees(rawEmps.map(emp => ({
                    _id: emp._id,
                    name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                    employeeId: emp.employeeId
                })));
            } catch (err) {
                console.error('Failed to load filter lookups:', err);
            }
        };
        fetchLookups();
    }, []);

    // Main fetch controller
    useEffect(() => {
        fetchAnalyticsData();
    }, [subView, year, balanceFilters, ledgerFilters, sickMinDays, masterFilters]);

    const fetchAnalyticsData = async () => {
        setLoading(true);
        try {
            if (subView === 'master') {
                const params = { 
                    year, 
                    policyId: masterFilters.policyId,
                    departmentId: masterFilters.departmentId,
                    branchId: masterFilters.branchId,
                    designationId: masterFilters.designationId,
                    employeeStatus: masterFilters.employeeStatus,
                    employeeId: masterFilters.employeeId,
                    leaveType: masterFilters.leaveType
                };
                const res = await api.get('/hr/leaves/analytics/master-report', { params });
                setMasterReport(res.data);
                setEmpBalPage(1);
            } else if (subView === 'policy') {
                const res = await api.get('/hr/leaves/analytics/policy-assignments');
                setPolicyAnalytics(res.data);
            } else if (subView === 'allRequests') {
                const res = await api.get('/hr/leaves/analytics/all-requests', { params: { year } });
                setAllRequestsReport(res.data);
            } else if (subView === 'employeeSummary') {
                const res = await api.get('/hr/leaves/analytics/employee-summary', { params: { year } });
                setEmployeeSummaryReport(res.data);
            } else if (subView === 'balances') {
                const params = { year, ...balanceFilters };
                const res = await api.get('/hr/leaves/analytics/balances', { params });
                setBalancesAnalytics(res.data);
            } else if (subView === 'utilization') {
                const res = await api.get('/hr/leaves/analytics/utilization', { params: { year } });
                setUtilizationReport(res.data);
            } else if (subView === 'pending') {
                const res = await api.get('/hr/leaves/analytics/pending');
                setPendingReport(res.data);
            } else if (subView === 'ledger') {
                const params = { year, ...ledgerFilters };
                const res = await api.get('/hr/leaves/analytics/ledger-audit', { params });
                setLedgerReport(res.data);
            } else if (subView === 'trends') {
                const res = await api.get('/hr/leaves/analytics/monthly-trends', { params: { year } });
                setMonthlyTrends(res.data);
            } else if (subView === 'leaderboard') {
                const res = await api.get('/hr/leaves/analytics/high-users', { params: { year } });
                setLeaderboard(res.data);
            } else if (subView === 'sick') {
                const res = await api.get('/hr/leaves/analytics/sick-leave', { params: { year, minDays: sickMinDays } });
                setSickLeaveReport(res.data);
            } else if (subView === 'liability') {
                const res = await api.get('/hr/leaves/analytics/liability', { params: { year } });
                setLiability(res.data);
            }
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to load report data.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportMasterExcel = () => {
        if (!masterReport || !masterReport.sheets) {
            showToast('error', 'Export Failed', 'No report data available to export.');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            const policySummaryData = masterReport.sheets.policySummary || [];
            const ws1 = XLSX.utils.json_to_sheet(policySummaryData);
            XLSX.utils.book_append_sheet(wb, ws1, "Policy Summary");

            const departmentAnalyticsData = masterReport.sheets.departmentAnalytics || [];
            const ws2 = XLSX.utils.json_to_sheet(departmentAnalyticsData);
            XLSX.utils.book_append_sheet(wb, ws2, "Department Analytics");

            const employeeBalanceData = masterReport.sheets.employeeBalance || [];
            const ws3 = XLSX.utils.json_to_sheet(employeeBalanceData);
            XLSX.utils.book_append_sheet(wb, ws3, "Employee Leave Balance");

            const leaveLedgerData = masterReport.sheets.leaveLedger || [];
            const ws4 = XLSX.utils.json_to_sheet(leaveLedgerData);
            XLSX.utils.book_append_sheet(wb, ws4, "Leave Ledger");

            const utilizationAnalyticsData = masterReport.sheets.utilizationAnalytics || [];
            const ws5 = XLSX.utils.json_to_sheet(utilizationAnalyticsData);
            XLSX.utils.book_append_sheet(wb, ws5, "Utilization Analytics");

            XLSX.writeFile(wb, `Master_Leave_Report_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showToast('success', 'Export Successful', 'Master Leave Report downloaded.');
        } catch (err) {
            console.error('Master Excel Export Error:', err);
            showToast('error', 'Export Failed', 'Failed to generate Excel file.');
        }
    };

    const handleSelectPolicy = async (policy) => {
        setSelectedPolicy(policy);
        setLoadingEmployees(true);
        try {
            const res = await api.get(`/hr/leaves/analytics/policy-assignments/${policy.policyId}/employees`);
            setPolicyEmployees(res.data);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to fetch policy employees.');
        } finally {
            setLoadingEmployees(false);
        }
    };

    // Shared Excel exporter (uses XLSX)
    const handleExportXLSX = (data, columns, filename) => {
        if (!data || data.length === 0) {
            showToast('error', 'Export Failed', 'No data available to export.');
            return;
        }
        // columns: [{ header: 'Display Name', key: 'fieldKey' | fn }]
        const worksheetData = [
            columns.map(c => c.header),
            ...data.map(row => columns.map(c => {
                const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
                return val !== null && val !== undefined ? val : '';
            }))
        ];
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        ws['!cols'] = columns.map((c, i) => ({
            wch: Math.max(
                c.header.length,
                ...data.map(row => {
                    const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
                    return val !== null && val !== undefined ? String(val).length : 0;
                })
            ) + 2
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('success', 'Download Started', `${filename}.xlsx is being downloaded.`);
    };

    // Per-subview download dispatcher (for top bar button)
    const handleTopBarDownload = () => {
        if (subView === 'policy') {
            handleExportXLSX(policyAnalytics, [
                { header: 'Policy Name', key: 'policyName' },
                { header: 'Employee Count', key: 'employeeCount' }
            ], 'Policy_Assignments');
        } else if (subView === 'allRequests') {
            handleExportXLSX(filteredRequests, [
                { header: 'Applied Date', key: 'appliedDate' },
                { header: 'Employee Name', key: 'employeeName' },
                { header: 'Employee ID', key: 'employeeId' },
                { header: 'Department', key: 'department' },
                { header: 'Branch', key: 'branch' },
                { header: 'Leave Type', key: 'leaveType' },
                { header: 'Start Date', key: 'startDate' },
                { header: 'End Date', key: 'endDate' },
                { header: 'Days', key: 'days' },
                { header: 'Status', key: 'status' }
            ], 'All_Leave_Requests');
        } else if (subView === 'employeeSummary') {
            handleExportXLSX(filteredEmployeeSummary, [
                { header: 'Employee Name', key: 'employeeName' },
                { header: 'Employee ID', key: 'employeeId' },
                { header: 'Department', key: 'department' },
                { header: 'Branch', key: 'branch' },
                { header: 'CL Allocated', key: 'clAllocated' },
                { header: 'CL Used', key: 'clUsed' },
                { header: 'CL Available', key: 'clAvailable' },
                { header: 'SL Allocated', key: 'slAllocated' },
                { header: 'SL Used', key: 'slUsed' },
                { header: 'SL Available', key: 'slAvailable' },
                { header: 'EL Allocated', key: 'elAllocated' },
                { header: 'EL Used', key: 'elUsed' },
                { header: 'EL Available', key: 'elAvailable' },
                { header: 'Others Allocated', key: 'othersAllocated' },
                { header: 'Others Used', key: 'othersUsed' },
                { header: 'Others Available', key: 'othersAvailable' }
            ], 'Employee_Leave_Summary');
        } else if (subView === 'balances') {
            handleExportXLSX(balancesAnalytics, [
                { header: 'Department', key: 'department' },
                { header: 'CL Balance', key: 'CL' },
                { header: 'SL Balance', key: 'SL' },
                { header: 'EL Balance', key: 'EL' },
                { header: 'Others', key: 'Others' }
            ], 'Leave_Balances');
        } else if (subView === 'utilization') {
            handleExportXLSX(utilizationReport, [
                { header: 'Leave Type', key: 'leaveType' },
                { header: 'Allocated Days', key: 'allocated' },
                { header: 'Used Days', key: 'used' },
                { header: 'Remaining Balance', key: 'balance' }
            ], 'Leave_Utilization');
        } else if (subView === 'pending') {
            handleExportXLSX(pendingReport, [
                { header: 'Employee Name', key: 'employeeName' },
                { header: 'Employee ID', key: 'employeeId' },
                { header: 'Department', key: 'department' },
                { header: 'Leave Type', key: 'leaveType' },
                { header: 'Days', key: 'days' },
                { header: 'Pending Since (Days)', key: 'pendingSinceDays' }
            ], 'Pending_Leave_Report');
        } else if (subView === 'ledger') {
            handleExportXLSX(ledgerReport, [
                { header: 'Date', key: row => new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { header: 'Employee Name', key: 'employeeName' },
                { header: 'Employee ID', key: 'employeeId' },
                { header: 'Leave Type', key: 'leaveType' },
                { header: 'Transaction Type', key: 'action' },
                { header: 'Credit', key: 'credit' },
                { header: 'Debit', key: 'debit' },
                { header: 'Running Balance', key: 'newBalance' },
                { header: 'Remarks', key: 'remarks' },
                { header: 'Created By', key: 'createdBy' }
            ], 'Ledger_Audit_Report');
        } else if (subView === 'trends') {
            handleExportXLSX(monthlyTrends, [
                { header: 'Month', key: 'month' },
                { header: 'Leave Requests', key: 'requests' }
            ], 'Monthly_Leave_Trends');
        } else if (subView === 'leaderboard') {
            handleExportXLSX(leaderboard, [
                { header: 'Rank', key: (row, i) => i + 1 },
                { header: 'Employee Name', key: 'employeeName' },
                { header: 'Employee ID', key: 'employeeId' },
                { header: 'Department', key: 'department' },
                { header: 'Total Leaves Taken (Days)', key: 'totalLeaves' }
            ], 'High_Leave_Users');
        } else if (subView === 'sick') {
            handleExportXLSX(sickLeaveReport, [
                { header: 'Employee Name', key: 'employeeName' },
                { header: 'Employee ID', key: 'employeeId' },
                { header: 'Department', key: 'department' },
                { header: 'Total Sick Leaves Taken', key: 'totalSL' }
            ], 'Sick_Leave_Analysis');
        } else if (subView === 'liability') {
            handleExportXLSX(
                [{ metric: 'Total EL Days Liability', value: liability.totalELDays }, { metric: 'Active Employees', value: liability.activeEmployeesCount }, { metric: 'Avg EL Per Employee', value: liability.activeEmployeesCount > 0 ? (liability.totalELDays / liability.activeEmployeesCount).toFixed(2) : 0 }],
                [{ header: 'Metric', key: 'metric' }, { header: 'Value', key: 'value' }],
                'Leave_Liability'
            );
        }
    };

    // Filtered data for All Leave Requests
    const filteredRequests = allRequestsReport.filter(req => {
        const matchesSearch = searchTerm === '' || 
            String(req.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(req.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === '' || req.department === selectedDept;
        const matchesLeaveType = selectedLeaveType === 'All' || req.leaveType === selectedLeaveType;
        const matchesStatus = selectedStatus === 'All' || req.status === selectedStatus;
        return matchesSearch && matchesDept && matchesLeaveType && matchesStatus;
    });

    // Filtered data for Employee Summary
    const filteredEmployeeSummary = employeeSummaryReport.filter(emp => {
        const matchesSearch = searchTerm === '' || 
            String(emp.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = selectedBranch === '' || emp.branch === selectedBranch;
        const matchesDept = selectedDept === '' || emp.department === selectedDept;
        return matchesSearch && matchesBranch && matchesDept;
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Sidebar Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
                <div>
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider px-3 py-1">Leave Analytics</h3>
                </div>
                {[
                    { id: 'master', label: 'Master Leave Report', icon: <FileText size={14} /> },
                    { id: 'policy', label: 'Policy Assignments', icon: <Users size={14} /> },
                    { id: 'allRequests', label: 'All Leave Requests', icon: <FileText size={14} /> },
                    { id: 'employeeSummary', label: 'Employee Leave Summary', icon: <Users size={14} /> },
                    { id: 'balances', label: 'Leave Balances', icon: <Briefcase size={14} /> },
                    { id: 'utilization', label: 'Leave Utilization', icon: <FileText size={14} /> },
                    { id: 'pending', label: 'Pending Leave Report', icon: <ShieldAlert size={14} /> },
                    { id: 'ledger', label: 'Audit Ledger Logs', icon: <Calendar size={14} /> },
                    { id: 'trends', label: 'Monthly Leave Trends', icon: <TrendingUp size={14} /> },
                    { id: 'leaderboard', label: 'High Leave Users', icon: <Award size={14} /> },
                    { id: 'sick', label: 'Sick Leave Analysis', icon: <AlertCircle size={14} /> },
                    { id: 'liability', label: 'Leave Liability', icon: <Settings size={14} /> }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setSubView(item.id);
                            setSelectedPolicy(null);
                        }}
                        className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left",
                            subView === item.id 
                                ? "bg-slate-900 text-white shadow-md"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        )}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Reports Display Panel */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px] flex flex-col">
                
                {/* Year Selection (Visible on most panels) */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 flex-wrap gap-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">
                            {subView === 'master' && 'Master Leave Report'}
                            {subView === 'policy' && 'Policy Assignment Analytics'}
                            {subView === 'allRequests' && 'All Leave Requests'}
                            {subView === 'employeeSummary' && 'Employee Leave Balance Summary'}
                            {subView === 'balances' && 'Leave Balance Analytics'}
                            {subView === 'utilization' && 'Leave Utilization Report'}
                            {subView === 'pending' && 'Pending Leave Report'}
                            {subView === 'ledger' && 'Leave Ledger Audit Trail'}
                            {subView === 'trends' && 'Monthly Leave Trends'}
                            {subView === 'leaderboard' && 'High Leave Users'}
                            {subView === 'sick' && 'Sick Leave Analysis'}
                            {subView === 'liability' && 'Leave Liability'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {subView === 'master' && (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                                    <select
                                        value={year}
                                        onChange={e => setYear(Number(e.target.value))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                    >
                                        {[2025, 2026, 2027, 2028].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={handleExportMasterExcel}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                                >
                                    <Download size={14} />
                                    Export Excel
                                </button>
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all"
                                >
                                    <Upload size={14} />
                                    Import Balances
                                </button>
                            </>
                        )}

                        {['balances', 'utilization', 'ledger', 'trends', 'leaderboard', 'sick', 'liability', 'allRequests', 'employeeSummary'].includes(subView) && (
                            <div className="flex items-center gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                                <select
                                    value={year}
                                    onChange={e => setYear(Number(e.target.value))}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                >
                                    {[2025, 2026, 2027, 2028].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        {subView !== 'master' && (
                            <button
                                onClick={handleTopBarDownload}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-md transition-all"
                            >
                                <Download size={14} />
                                Download Excel
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-9 h-9 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Generating report...</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col">
                        
                        {/* 1. MASTER LEAVE REPORT */}
                        {subView === 'master' && (
                            <div className="space-y-6">
                                {/* Filters Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-5 rounded-3xl border border-slate-150">
                                    {/* Leave Policy Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Policy</label>
                                        <select
                                            value={masterFilters.policyId}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, policyId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Policies</option>
                                            {policiesList.map(p => (
                                                <option key={p._id} value={p._id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Department Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Department</label>
                                        <select
                                            value={masterFilters.departmentId}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, departmentId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map(d => (
                                                <option key={d._id} value={d._id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Branch Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch</label>
                                        <select
                                            value={masterFilters.branchId}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, branchId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Branches</option>
                                            {branches.map(b => (
                                                <option key={b._id} value={b._id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Designation Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Designation</label>
                                        <select
                                            value={masterFilters.designationId}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, designationId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Designations</option>
                                            {designations.map(d => (
                                                <option key={d._id} value={d._id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Employee Status Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee Status</label>
                                        <select
                                            value={masterFilters.employeeStatus}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, employeeStatus: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>

                                    {/* Employee Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</label>
                                        <select
                                            value={masterFilters.employeeId}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Employees</option>
                                            {employees.map(emp => (
                                                <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeId})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Leave Type Filter */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Type</label>
                                        <select
                                            value={masterFilters.leaveType}
                                            onChange={e => setMasterFilters(prev => ({ ...prev, leaveType: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="All">All Types</option>
                                            <option value="EL">EL</option>
                                            <option value="CL">CL</option>
                                            <option value="SL">SL</option>
                                            <option value="PL">PL</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Stats Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {[
                                        { label: 'Total Policies', value: masterReport.stats?.totalPolicies ?? 0, color: 'text-blue-600 bg-blue-50' },
                                        { label: 'Covered Employees', value: masterReport.stats?.totalEmployeesCovered ?? 0, color: 'text-indigo-600 bg-indigo-50' },
                                        { label: 'Allocated Days', value: masterReport.stats?.totalLeaveAllocated ?? 0, color: 'text-emerald-600 bg-emerald-50' },
                                        { label: 'Used Days', value: masterReport.stats?.totalLeaveUsed ?? 0, color: 'text-amber-600 bg-amber-50' },
                                        { label: 'Pending Days', value: masterReport.stats?.totalPendingLeaves ?? 0, color: 'text-rose-600 bg-rose-50' },
                                        { label: 'Balance Days', value: masterReport.stats?.totalBalanceAvailable ?? 0, color: 'text-teal-600 bg-teal-50' }
                                    ].map((card, idx) => (
                                        <div key={idx} className="border border-slate-150 rounded-2xl p-4 flex flex-col justify-between bg-white shadow-sm hover:shadow-md transition-shadow">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{card.label}</span>
                                            <div className="flex items-baseline justify-between mt-3">
                                                <span className="text-xl font-extrabold text-slate-900 font-mono">{card.value}</span>
                                                <span className={clsx("w-2 h-2 rounded-full", card.color.split(' ')[0])} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Department Analytics Table */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest">Department-wise Summary</h3>
                                        {(masterReport.sheets?.departmentAnalytics?.length > 0) && (
                                            <button onClick={() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masterReport.sheets.departmentAnalytics), 'Dept Summary'); XLSX.writeFile(wb, `Dept_Summary_${year}.xlsx`); showToast('success','Downloaded','Department Summary Excel downloaded.'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                                                <Download size={12} /> Download
                                            </button>
                                        )}
                                    </div>
                                    <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                                <tr>
                                                    <th className="px-5 py-3">Department</th>
                                                    <th className="px-4 py-3 text-center">Employees</th>
                                                    <th className="px-4 py-3">Assigned Policies</th>
                                                    <th className="px-4 py-3 text-right">Allocated</th>
                                                    <th className="px-4 py-3 text-right">Used</th>
                                                    <th className="px-4 py-3 text-right">Pending</th>
                                                    <th className="px-4 py-3 text-right">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                                {(!masterReport.sheets?.departmentAnalytics || masterReport.sheets.departmentAnalytics.length === 0) ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">No department data found.</td>
                                                    </tr>
                                                ) : (
                                                    masterReport.sheets.departmentAnalytics.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                            <td className="px-5 py-3 text-slate-900">{item["Department"]}</td>
                                                            <td className="px-4 py-3 text-center text-slate-600">{item["Total Employees"]}</td>
                                                            <td className="px-4 py-3 text-slate-500 font-medium text-[11px] truncate max-w-[150px]">{item["Policy Assigned"]}</td>
                                                            <td className="px-4 py-3 text-right font-mono text-slate-650">{item["Total Allocated"]}</td>
                                                            <td className="px-4 py-3 text-right font-mono text-amber-600">{item["Used"]}</td>
                                                            <td className="px-4 py-3 text-right font-mono text-rose-600">{item["Pending"]}</td>
                                                            <td className="px-4 py-3 text-right font-mono text-emerald-600">{item["Balance"]}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Employee Balance Table */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest">Employee Leave Balances</h3>
                                        {(masterReport.sheets?.employeeBalance?.length > 0) && (
                                            <button onClick={() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masterReport.sheets.employeeBalance), 'Emp Balances'); XLSX.writeFile(wb, `Employee_Leave_Balances_${year}.xlsx`); showToast('success','Downloaded','Employee Balance Excel downloaded.'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                                                <Download size={12} /> Download
                                            </button>
                                        )}
                                    </div>
                                    <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm bg-white">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                                                <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                                    <tr>
                                                        <th className="px-5 py-3">Emp Code</th>
                                                        <th className="px-4 py-3">Name</th>
                                                        <th className="px-4 py-3">Department</th>
                                                        <th className="px-4 py-3">Policy</th>
                                                        <th className="px-4 py-3 text-center bg-blue-50/30">CL (Alloc/Used/Bal)</th>
                                                        <th className="px-4 py-3 text-center bg-amber-50/20">SL (Alloc/Used/Bal)</th>
                                                        <th className="px-4 py-3 text-center bg-emerald-50/20">EL (Alloc/Used/Bal)</th>
                                                        <th className="px-4 py-3 text-center bg-slate-100/50">Others (Alloc/Used/Bal)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                                    {(!masterReport.sheets?.employeeBalance || masterReport.sheets.employeeBalance.length === 0) ? (
                                                        <tr>
                                                            <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">No employee leave balance records found.</td>
                                                        </tr>
                                                    ) : (
                                                        masterReport.sheets.employeeBalance.slice((empBalPage - 1) * EMP_BAL_PER_PAGE, empBalPage * EMP_BAL_PER_PAGE).map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">{item["Emp Code"]}</td>
                                                                <td className="px-4 py-3 text-slate-900">{item["Employee Name"]}</td>
                                                                <td className="px-4 py-3 text-slate-600">{item["Department"]}</td>
                                                                <td className="px-4 py-3 text-slate-500 font-medium text-[11px]">{item["Policy"]}</td>
                                                                <td className="px-4 py-3 text-center font-mono text-[11px] bg-blue-50/10">
                                                                    <span className="text-slate-500">{item["CL Allocated"]}</span> / <span className="text-amber-600">{item["CL Used"]}</span> / <span className="text-blue-700 font-black">{item["CL Balance"]}</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-mono text-[11px] bg-amber-50/10">
                                                                    <span className="text-slate-500">{item["SL Allocated"]}</span> / <span className="text-amber-600">{item["SL Used"]}</span> / <span className="text-amber-700 font-black">{item["SL Balance"]}</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-mono text-[11px] bg-emerald-50/10">
                                                                    <span className="text-slate-500">{item["EL Allocated"]}</span> / <span className="text-amber-600">{item["EL Used"]}</span> / <span className="text-emerald-700 font-black">{item["EL Balance"]}</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-mono text-[11px] bg-slate-100/20">
                                                                    <span className="text-slate-400">{item["Others Allocated"]}</span> / <span className="text-slate-500">{item["Others Used"]}</span> / <span className="text-slate-700 font-black">{item["Others Balance"]}</span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Pagination Controls */}
                                        {masterReport.sheets?.employeeBalance?.length > EMP_BAL_PER_PAGE && (() => {
                                            const totalPages = Math.ceil(masterReport.sheets.employeeBalance.length / EMP_BAL_PER_PAGE);
                                            const pages = [];
                                            if (totalPages <= 5) {
                                                for (let i = 1; i <= totalPages; i++) pages.push(i);
                                            } else {
                                                pages.push(1);
                                                if (empBalPage > 3) pages.push('ellipsis-start');
                                                
                                                const start = Math.max(2, empBalPage - 1);
                                                const end = Math.min(totalPages - 1, empBalPage + 1);
                                                for (let i = start; i <= end; i++) {
                                                    if (!pages.includes(i)) pages.push(i);
                                                }
                                                
                                                if (empBalPage < totalPages - 2) pages.push('ellipsis-end');
                                                if (!pages.includes(totalPages)) pages.push(totalPages);
                                            }

                                            return (
                                                <div className="flex justify-between items-center px-5 py-3.5 bg-slate-50/50 border-t border-slate-150">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Showing {Math.min(masterReport.sheets.employeeBalance.length, (empBalPage - 1) * EMP_BAL_PER_PAGE + 1)} - {Math.min(masterReport.sheets.employeeBalance.length, empBalPage * EMP_BAL_PER_PAGE)} of {masterReport.sheets.employeeBalance.length}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button 
                                                            disabled={empBalPage === 1}
                                                            onClick={() => setEmpBalPage(prev => Math.max(1, prev - 1))}
                                                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                                        >
                                                            Prev
                                                        </button>
                                                        {pages.map((p, pIdx) => {
                                                            if (p === 'ellipsis-start' || p === 'ellipsis-end') {
                                                                return <span key={pIdx} className="px-1 text-xs text-slate-400 font-bold">...</span>;
                                                            }
                                                            return (
                                                                <button
                                                                    key={pIdx}
                                                                    onClick={() => setEmpBalPage(p)}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-xl text-[10px] font-black transition-all ${
                                                                        empBalPage === p 
                                                                            ? 'bg-slate-800 text-white shadow-sm' 
                                                                            : 'border border-slate-200 text-slate-655 bg-white hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    {p}
                                                                </button>
                                                            );
                                                        })}
                                                        <button 
                                                            disabled={empBalPage === totalPages}
                                                            onClick={() => setEmpBalPage(prev => Math.min(totalPages, prev + 1))}
                                                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. POLICY ASSIGNMENTS */}
                        {subView === 'policy' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Policy Groups</div>
                                    <div className="space-y-2">
                                        {policyAnalytics.map(policy => (
                                            <button
                                                key={policy.policyId}
                                                onClick={() => handleSelectPolicy(policy)}
                                                className={clsx(
                                                    "w-full flex justify-between items-center p-3 rounded-2xl border transition-all text-left",
                                                    selectedPolicy?.policyId === policy.policyId
                                                        ? "bg-slate-50 border-slate-300 font-bold"
                                                        : "bg-white border-slate-100 hover:bg-slate-50/50"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                                                    <span className="text-xs font-bold text-slate-800">{policy.policyName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-xs font-black text-slate-600">{policy.employeeCount}</span>
                                                    <ChevronRight size={14} className="text-slate-400" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/20 space-y-4 min-h-[350px]">
                                    {!selectedPolicy ? (
                                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-350 border border-slate-100 mb-3 shadow-sm">
                                                <Users size={20} />
                                            </div>
                                            <h4 className="font-bold text-slate-700 text-xs">No Policy Selected</h4>
                                            <p className="text-[10px] text-slate-400 max-w-[200px] mt-1 leading-relaxed">
                                                Click a policy group from the left to view assigned employees.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-xs">{selectedPolicy.policyName}</h4>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{selectedPolicy.employeeCount} Employees Assigned</p>
                                                </div>
                                                <button
                                                    onClick={() => handleExportCSV(policyEmployees, ['name', 'employeeId', 'department', 'designation', 'grade', 'branch'], ['Name', 'Employee ID', 'Department', 'Designation', 'Grade', 'Branch'], `policy_employees_${selectedPolicy.policyName}`)}
                                                    className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                                >
                                                    Export List
                                                </button>
                                            </div>

                                            {loadingEmployees ? (
                                                <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading employee list...</div>
                                            ) : policyEmployees.length === 0 ? (
                                                <div className="py-12 text-center text-xs font-bold text-slate-400">No employees found in this policy</div>
                                            ) : (
                                                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 pr-1">
                                                    {policyEmployees.map(emp => (
                                                        <div key={emp._id} className="py-2.5 first:pt-0 last:pb-0">
                                                            <div className="font-bold text-slate-850 text-xs">{emp.name}</div>
                                                            <div className="grid grid-cols-2 text-[9px] font-medium text-slate-400 mt-1 gap-1">
                                                                <div>Code: <span className="font-semibold text-slate-650">{emp.employeeId}</span></div>
                                                                <div>Grade: <span className="font-semibold text-slate-650">{emp.grade}</span></div>
                                                                <div>Dept: <span className="font-semibold text-slate-650">{emp.department}</span></div>
                                                                <div>Desig: <span className="font-semibold text-slate-650 truncate block">{emp.designation}</span></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ALL LEAVE REQUESTS */}
                        {subView === 'allRequests' && (
                            <div className="space-y-6">
                                {/* Search and Filters */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Search size={10} />Search Employee</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search by name or code..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-slate-700 outline-none placeholder:text-slate-400"
                                            />
                                            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Briefcase size={10} />Department</label>
                                        <select
                                            value={selectedDept}
                                            onChange={e => setSelectedDept(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map(d => (
                                                <option key={d._id} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={10} />Leave Type</label>
                                        <select
                                            value={selectedLeaveType}
                                            onChange={e => setSelectedLeaveType(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="All">All Types</option>
                                            <option value="CL">CL</option>
                                            <option value="SL">SL</option>
                                            <option value="EL">EL</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><ShieldAlert size={10} />Status</label>
                                        <select
                                            value={selectedStatus}
                                            onChange={e => setSelectedStatus(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Approved">Approved</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="max-h-[420px] overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-5 py-3 w-[15%]">Applied Date</th>
                                                    <th className="px-4 py-3 w-[25%]">Employee</th>
                                                    <th className="px-4 py-3 w-[20%]">Department</th>
                                                    <th className="px-4 py-3 text-center w-[10%]">Type</th>
                                                    <th className="px-4 py-3 text-center w-[15%]">Dates</th>
                                                    <th className="px-4 py-3 text-center w-[8%]">Days</th>
                                                    <th className="px-4 py-3 text-center w-[12%]">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                                {filteredRequests.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">No leave requests match filters.</td>
                                                    </tr>
                                                ) : (
                                                    filteredRequests.map((req, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                            <td className="px-5 py-3 font-mono text-slate-500">{req.appliedDate}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-extrabold text-slate-900">{req.employeeName}</div>
                                                                <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{req.employeeId}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-650">{req.department}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-150 rounded-md font-mono text-[10px] uppercase">
                                                                    {req.leaveType}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-[10px] text-slate-600 font-semibold leading-tight">
                                                                <div>{req.startDate}</div>
                                                                <div className="text-[8px] text-slate-400">to</div>
                                                                <div>{req.endDate}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-slate-800">{req.days}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={clsx(
                                                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                                                    req.status === 'Approved' && "text-emerald-600 bg-emerald-50 border-emerald-100",
                                                                    req.status === 'Pending' && "text-amber-600 bg-amber-50 border-amber-100",
                                                                    req.status === 'Rejected' && "text-rose-600 bg-rose-50 border-rose-100"
                                                                )}>
                                                                    {req.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EMPLOYEE LEAVE BALANCE SUMMARY */}
                        {subView === 'employeeSummary' && (
                            <div className="space-y-6">
                                {/* Search and Filters */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Search size={10} />Search Employee</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search by name or code..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-slate-700 outline-none placeholder:text-slate-400"
                                            />
                                            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} />Branch</label>
                                        <select
                                            value={selectedBranch}
                                            onChange={e => setSelectedBranch(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Branches</option>
                                            {branches.map(b => (
                                                <option key={b._id} value={b.name}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Briefcase size={10} />Department</label>
                                        <select
                                            value={selectedDept}
                                            onChange={e => setSelectedDept(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map(d => (
                                                <option key={d._id} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="max-h-[420px] overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-5 py-3 w-[20%]">Employee</th>
                                                    <th className="px-4 py-3 w-[15%]">Department</th>
                                                    <th className="px-4 py-3 text-center bg-blue-50/30">CL (Alloc/Used/Bal)</th>
                                                    <th className="px-4 py-3 text-center bg-amber-50/20">SL (Alloc/Used/Bal)</th>
                                                    <th className="px-4 py-3 text-center bg-emerald-50/20">EL (Alloc/Used/Bal)</th>
                                                    <th className="px-4 py-3 text-center bg-slate-100/50">Others (Alloc/Used/Bal)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                                {filteredEmployeeSummary.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No employee leave summaries match filters.</td>
                                                    </tr>
                                                ) : (
                                                    filteredEmployeeSummary.map((emp, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                            <td className="px-5 py-3">
                                                                <div className="font-extrabold text-slate-900">{emp.employeeName}</div>
                                                                <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{emp.employeeId}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-650">
                                                                <div>{emp.department}</div>
                                                                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{emp.branch}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-[11px] bg-blue-50/10">
                                                                <span className="text-slate-500">{emp.clAllocated}</span> / <span className="text-amber-600">{emp.clUsed}</span> / <span className="text-blue-700 font-black">{emp.clAvailable}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-[11px] bg-amber-50/10">
                                                                <span className="text-slate-500">{emp.slAllocated}</span> / <span className="text-amber-600">{emp.slUsed}</span> / <span className="text-amber-700 font-black">{emp.slAvailable}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-[11px] bg-emerald-50/10">
                                                                <span className="text-slate-500">{emp.elAllocated}</span> / <span className="text-amber-600">{emp.elUsed}</span> / <span className="text-emerald-700 font-black">{emp.elAvailable}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-[11px] bg-slate-100/20">
                                                                <span className="text-slate-400">{emp.othersAllocated}</span> / <span className="text-slate-500">{emp.othersUsed}</span> / <span className="text-slate-700 font-black">{emp.othersAvailable}</span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. LEAVE BALANCES (DEPARTMENT WISE WITH DYNAMIC FILTERS) */}
                        {subView === 'balances' && (
                            <div className="space-y-6">
                                {/* Dynamic Filter Selectors */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} />Branch</label>
                                        <select
                                            value={balanceFilters.branchId}
                                            onChange={e => setBalanceFilters(prev => ({ ...prev, branchId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Branches</option>
                                            {branches.map(b => (
                                                <option key={b._id} value={b._id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Briefcase size={10} />Department</label>
                                        <select
                                            value={balanceFilters.departmentId}
                                            onChange={e => setBalanceFilters(prev => ({ ...prev, departmentId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map(d => (
                                                <option key={d._id} value={d._id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><GraduationCap size={10} />Grade</label>
                                        <select
                                            value={balanceFilters.gradeId}
                                            onChange={e => setBalanceFilters(prev => ({ ...prev, gradeId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Grades</option>
                                            {grades.map(g => (
                                                <option key={g._id} value={g._id}>{g.code || g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Award size={10} />Designation</label>
                                        <select
                                            value={balanceFilters.designationId}
                                            onChange={e => setBalanceFilters(prev => ({ ...prev, designationId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Designations</option>
                                            {designations.map(d => (
                                                <option key={d._id} value={d._id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                            <tr>
                                                <th className="px-5 py-3 w-[40%]">Department</th>
                                                <th className="px-4 py-3 text-center">CL Balance</th>
                                                <th className="px-4 py-3 text-center">SL Balance</th>
                                                <th className="px-4 py-3 text-center">EL Balance</th>
                                                <th className="px-4 py-3 text-center">Others</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                            {balancesAnalytics.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No department balances found matching criteria.</td>
                                                </tr>
                                            ) : (
                                                balancesAnalytics.map((deptRow, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-5 py-3 font-extrabold text-slate-800">{deptRow.department}</td>
                                                        <td className="px-4 py-3 text-center text-slate-800 font-mono">{deptRow.CL}</td>
                                                        <td className="px-4 py-3 text-center text-slate-800 font-mono">{deptRow.SL}</td>
                                                        <td className="px-4 py-3 text-center text-slate-800 font-mono">{deptRow.EL}</td>
                                                        <td className="px-4 py-3 text-center text-slate-850 font-mono">{deptRow.Others}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 4. LEAVE UTILIZATION REPORT */}
                        {subView === 'utilization' && (
                            <div className="space-y-4">
                                {utilizationReport.length > 0 && (
                                    <div className="flex justify-end">
                                        <button onClick={() => handleExportXLSX(utilizationReport, [{header:'Leave Type',key:'leaveType'},{header:'Allocated Days',key:'allocated'},{header:'Used Days',key:'used'},{header:'Remaining Balance',key:'balance'}], 'Leave_Utilization')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm">
                                            <Download size={12} /> Download Excel
                                        </button>
                                    </div>
                                )}
                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                            <tr>
                                                <th className="px-5 py-3">Leave Type</th>
                                                <th className="px-4 py-3 text-center">Allocated Days</th>
                                                <th className="px-4 py-3 text-center">Used Days</th>
                                                <th className="px-4 py-3 text-center">Remaining Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                            {utilizationReport.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No utilization data found for {year}.</td>
                                                </tr>
                                            ) : (
                                                utilizationReport.map((util, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-5 py-3 text-slate-900 font-extrabold">{util.leaveType}</td>
                                                        <td className="px-4 py-3 text-center text-slate-650 font-mono">{util.allocated}</td>
                                                        <td className="px-4 py-3 text-center text-amber-600 font-mono">{util.used}</td>
                                                        <td className="px-4 py-3 text-center text-emerald-600 font-mono">{util.balance}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 5. PENDING LEAVE REPORT (HIGHLIGHT IF PENDING SINCE >= 12 DAYS) */}
                        {subView === 'pending' && (
                            <div className="space-y-4">
                                {pendingReport.length > 0 && (
                                    <div className="flex justify-end">
                                        <button onClick={() => handleExportXLSX(pendingReport, [{header:'Employee Name',key:'employeeName'},{header:'Employee ID',key:'employeeId'},{header:'Department',key:'department'},{header:'Leave Type',key:'leaveType'},{header:'Days',key:'days'},{header:'Pending Since (Days)',key:'pendingSinceDays'}], 'Pending_Leave_Report')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm">
                                            <Download size={12} /> Download Excel
                                        </button>
                                    </div>
                                )}
                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                            <tr>
                                                <th className="px-5 py-3">Employee</th>
                                                <th className="px-4 py-3">Department</th>
                                                <th className="px-4 py-3 text-center">Leave Type</th>
                                                <th className="px-4 py-3 text-center">Days</th>
                                                <th className="px-4 py-3 text-center">Pending Since</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                            {pendingReport.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No pending leave requests found.</td>
                                                </tr>
                                            ) : (
                                                pendingReport.map((req, idx) => {
                                                    const isLongPending = req.pendingSinceDays >= 12;
                                                    return (
                                                        <tr 
                                                            key={idx} 
                                                            className={clsx(
                                                                "hover:bg-slate-50/50 transition-colors",
                                                                isLongPending && "bg-rose-50/40 hover:bg-rose-50/70 text-rose-900 border-l-4 border-l-rose-500"
                                                            )}
                                                        >
                                                            <td className="px-5 py-3">
                                                                <div className="font-extrabold text-slate-900">{req.employeeName}</div>
                                                                <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{req.employeeId}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-650">{req.department}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-150 rounded-md font-mono text-[10px] uppercase">
                                                                    {req.leaveType}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono">{req.days}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={clsx(
                                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                                    isLongPending 
                                                                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                                                                        : "bg-amber-50 text-amber-700 border border-amber-150"
                                                                )}>
                                                                    {req.pendingSinceDays} Days
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 6. LEAVE LEDGER (AUDIT REPORT) */}
                        {subView === 'ledger' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</label>
                                        <select
                                            value={ledgerFilters.employeeId || ''}
                                            onChange={e => setLedgerFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">All Employees</option>
                                            {employees.map(emp => (
                                                <option key={emp._id} value={emp._id}>
                                                    {emp.name} ({emp.employeeId})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Type</label>
                                        <select
                                            value={ledgerFilters.leaveType}
                                            onChange={e => setLedgerFilters(prev => ({ ...prev, leaveType: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="All">All Types</option>
                                            <option value="CL">CL</option>
                                            <option value="SL">SL</option>
                                            <option value="EL">EL</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transaction Type</label>
                                        <select
                                            value={ledgerFilters.actionType}
                                            onChange={e => setLedgerFilters(prev => ({ ...prev, actionType: e.target.value }))}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="All">All Actions</option>
                                            <option value="Opening">Opening</option>
                                            <option value="Accrual">Accrual</option>
                                            <option value="Applied">Applied</option>
                                            <option value="Cancelled">Cancelled</option>
                                            <option value="Override">Override</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="max-h-[380px] overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 w-[10%]">Date</th>
                                                    <th className="px-4 py-3 w-[18%]">Employee</th>
                                                    <th className="px-4 py-3 text-center w-[8%]">Leave Type</th>
                                                    <th className="px-4 py-3 text-center w-[12%]">Transaction Type</th>
                                                    <th className="px-4 py-3 text-center w-[8%]">Credit</th>
                                                    <th className="px-4 py-3 text-center w-[8%]">Debit</th>
                                                    <th className="px-4 py-3 text-center w-[10%]">Running Balance</th>
                                                    <th className="px-4 py-3 w-[16%]">Remarks</th>
                                                    <th className="px-4 py-3 w-[10%]">Created By</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                                {ledgerReport.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">No ledger audit entries match filters.</td>
                                                    </tr>
                                                ) : (
                                                    ledgerReport.map((log, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-mono text-slate-500">
                                                                {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-extrabold text-slate-805">{log.employeeName}</div>
                                                                <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{log.employeeId}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono font-black">{log.leaveType}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={clsx(
                                                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                                                    log.action === 'Opening' && "text-blue-600 bg-blue-50 border-blue-100",
                                                                    log.action === 'Accrual' && "text-emerald-600 bg-emerald-50 border-emerald-100",
                                                                    log.action === 'Applied' && "text-amber-600 bg-amber-50 border-amber-100",
                                                                    log.action === 'Cancelled' && "text-rose-600 bg-rose-50 border-rose-100",
                                                                    log.action === 'Override' && "text-purple-600 bg-purple-50 border-purple-100"
                                                                )}>
                                                                    {log.action}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono font-black text-emerald-600">
                                                                {log.credit > 0 ? `+${log.credit}` : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono font-black text-rose-600">
                                                                {log.debit > 0 ? `-${log.debit}` : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                                                                {log.newBalance}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 font-medium truncate max-w-[120px]" title={log.remarks}>{log.remarks}</td>
                                                            <td className="px-4 py-3 text-slate-650 font-bold">{log.createdBy || 'System'}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. MONTHLY LEAVE TRENDS */}
                        {subView === 'trends' && (
                            <div className="space-y-6">
                                {monthlyTrends.length > 0 && (
                                    <div className="flex justify-end">
                                        <button onClick={() => handleExportXLSX(monthlyTrends, [{header:'Month',key:'month'},{header:'Leave Requests',key:'requests'}], 'Monthly_Leave_Trends')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm">
                                            <Download size={12} /> Download Excel
                                        </button>
                                    </div>
                                )}
                                <div className="h-[300px] w-full bg-slate-50/50 p-4 rounded-3xl border border-slate-150 flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyTrends} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                                            <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                                            <Bar dataKey="requests" fill="#0f172a" radius={[6, 6, 0, 0]} name="Requests Submitted" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* 8. HIGH LEAVE USERS */}
                        {subView === 'leaderboard' && (
                            <div className="space-y-4">
                                {leaderboard.length > 0 && (
                                    <div className="flex justify-end">
                                        <button onClick={() => handleExportXLSX(leaderboard.map((r,i)=>({...r,rank:i+1})), [{header:'Rank',key:'rank'},{header:'Employee Name',key:'employeeName'},{header:'Employee ID',key:'employeeId'},{header:'Department',key:'department'},{header:'Total Leaves Taken (Days)',key:'totalLeaves'}], 'High_Leave_Users')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm">
                                            <Download size={12} /> Download Excel
                                        </button>
                                    </div>
                                )}
                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                            <tr>
                                                <th className="px-5 py-3 w-[15%]">Rank</th>
                                                <th className="px-4 py-3">Employee</th>
                                                <th className="px-4 py-3">Department</th>
                                                <th className="px-4 py-3 text-center">Approved Leaves Taken (Days)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                            {leaderboard.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No leave records found for {year}.</td>
                                                </tr>
                                            ) : (
                                                leaderboard.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-5 py-3 font-black text-slate-500">#{idx + 1}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-extrabold text-slate-900">{item.employeeName}</div>
                                                            <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{item.employeeId}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">{item.department}</td>
                                                        <td className="px-4 py-3 text-center font-mono font-black text-rose-600 text-xs">{item.totalLeaves}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 9. SICK LEAVE ANALYSIS */}
                        {subView === 'sick' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150 mb-4 justify-between">
                                    <div className="text-xs font-bold text-slate-700">Filter: Employees taking Sick Leave more than:</div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={sickMinDays}
                                            onChange={e => setSickMinDays(Number(e.target.value))}
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            {[2, 3, 5, 8, 10, 15].map(days => (
                                                <option key={days} value={days}>{days} Days</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {sickLeaveReport.length > 0 && (
                                    <div className="flex justify-end">
                                        <button onClick={() => handleExportXLSX(sickLeaveReport, [{header:'Employee Name',key:'employeeName'},{header:'Employee ID',key:'employeeId'},{header:'Department',key:'department'},{header:'Total Sick Leaves Taken',key:'totalSL'}], 'Sick_Leave_Analysis')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm">
                                            <Download size={12} /> Download Excel
                                        </button>
                                    </div>
                                )}
                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 font-black text-slate-450 uppercase tracking-widest border-b border-slate-150">
                                            <tr>
                                                <th className="px-5 py-3">Employee</th>
                                                <th className="px-4 py-3">Department</th>
                                                <th className="px-4 py-3 text-center">Total Sick Leaves Taken</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                            {sickLeaveReport.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="p-8 text-center text-slate-400 font-medium">No employees matching criteria.</td>
                                                </tr>
                                            ) : (
                                                sickLeaveReport.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-5 py-3">
                                                            <div className="font-extrabold text-slate-900">{item.employeeName}</div>
                                                            <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{item.employeeId}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">{item.department}</td>
                                                        <td className="px-4 py-3 text-center font-mono font-black text-rose-600 text-xs">{item.totalSL}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 10. LEAVE LIABILITY */}
                        {subView === 'liability' && (
                            <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={() => handleExportXLSX([{metric:'Total EL Days Liability',value:liability.totalELDays},{metric:'Active Employees',value:liability.activeEmployeesCount},{metric:'Avg EL Per Employee',value:liability.activeEmployeesCount>0?(liability.totalELDays/liability.activeEmployeesCount).toFixed(2):0}],[{header:'Metric',key:'metric'},{header:'Value',key:'value'}],'Leave_Liability')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm">
                                    <Download size={12} /> Download Excel
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start py-4">
                                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg space-y-4">
                                    <div>
                                        <h3 className="text-white/70 font-bold text-xs uppercase tracking-widest">Leave Liability (EL/PL)</h3>
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Calculated based on active employees</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-4xl font-extrabold font-mono text-emerald-400">
                                            {liability.totalELDays} <span className="text-xs font-black uppercase text-white/50 tracking-widest font-sans ml-1">Days</span>
                                        </div>
                                        <p className="text-[10px] text-white/60 font-semibold leading-relaxed">
                                            This represents the total unused Privilege/Earned leave balance currently accrued by your employees which might carry financial liability.
                                        </p>
                                    </div>
                                </div>

                                <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/30 space-y-3">
                                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Report Details</h4>
                                    <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                        <div className="flex justify-between py-2.5">
                                            <span className="text-slate-450">Active Employees</span>
                                            <span className="font-bold text-slate-800">{liability.activeEmployeesCount}</span>
                                        </div>
                                        <div className="flex justify-between py-2.5">
                                            <span className="text-slate-450">Average EL Accrual Per Emp</span>
                                            <span className="font-bold text-slate-800 font-mono">
                                                {liability.activeEmployeesCount > 0 ? (liability.totalELDays / liability.activeEmployeesCount).toFixed(2) : 0} Days
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
            <OpeningBalanceImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onSuccess={fetchAnalyticsData}
            />
        </div>
    );
}
