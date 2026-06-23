import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Drawer, Empty } from 'antd';
import { message } from '../../../utils/antdGlobal';
import {
    PlayCircle,
    Calculator,
    Eye,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    Users,
    RefreshCw,
    X,
    ChevronLeft,
    ChevronRight,
    IndianRupee,
    TrendingUp,
    Building2,
    Briefcase,
    Search,
    Filter,
    ArrowRight,
    Sparkles,
    Check,
    HelpCircle
} from 'lucide-react';
import api from '../../../utils/api';
import dayjs from 'dayjs';
import usePagePermissions from '../../../hooks/usePagePermissions';

function StatusChip({ label, color }) {
    const colors = {
        indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100 ring-indigo-500/20 bg-indigo-500',
        rose: 'text-rose-700 bg-rose-50 border-rose-100 ring-rose-500/20 bg-rose-500',
        amber: 'text-amber-700 bg-amber-50 border-amber-100 ring-amber-500/20 bg-amber-500',
        emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-500/20 bg-emerald-500'
    };
    const styleStr = colors[color] || colors.indigo;
    const [textColor, bgColor, borderColor, ringColor, dotColor] = styleStr.split(' ');

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ring-1 ring-inset shadow-xs ${textColor} ${bgColor} ${borderColor} ${ringColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            {label}
        </span>
    );
}

function StatCard({ label, value, accent, icon }) {
    const colors = {
        blue: 'border-blue-100 dark:border-blue-900/40 text-blue-600 bg-blue-50/40 dark:bg-blue-950/10 shadow-blue-50/50',
        emerald: 'border-emerald-100 dark:border-emerald-900/40 text-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/10 shadow-emerald-50/50',
        amber: 'border-amber-100 dark:border-amber-900/40 text-amber-600 bg-amber-50/40 dark:bg-amber-950/10 shadow-amber-50/50',
        slate: 'border-slate-100 dark:border-slate-800/60 text-slate-600 bg-slate-50/40 dark:bg-slate-900/10 shadow-slate-50/50'
    };
    const accentStyle = colors[accent] || colors.slate;

    return (
        <div className={`bg-white dark:bg-slate-900 border rounded-2xl px-5 py-3.5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between min-w-[140px] flex-1 ${accentStyle}`}>
            <div className="space-y-1">
                <p className="text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-wider">{label}</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white leading-none tracking-tight">{value}</h3>
            </div>
            <div className="p-2 bg-white/80 dark:bg-slate-800/60 rounded-xl shadow-xs shrink-0 flex items-center justify-center text-current">
                {icon}
            </div>
        </div>
    );
}

function PayrollStepper({ selectedCount, previewedCount }) {
    const steps = [
        {
            title: "Select Month",
            description: "Choose pay period",
            status: "done"
        },
        {
            title: "Select Staff",
            description: selectedCount > 0 ? `${selectedCount} selected` : "Choose employees",
            status: selectedCount > 0 ? "done" : "active"
        },
        {
            title: "Run Preview",
            description: previewedCount > 0 ? `${previewedCount} calculated` : "Calculate & verify",
            status: previewedCount > 0 ? "done" : (selectedCount > 0 ? "active" : "pending")
        },
        {
            title: "Execute Run",
            description: "Generate payslips",
            status: (selectedCount > 0 && previewedCount > 0) ? "active" : "pending"
        }
    ];

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" />
                <h4 className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-wider">Payroll Processing Guide:</h4>
            </div>
            <div className="flex items-center gap-2 sm:gap-6 flex-wrap flex-1 justify-end">
                {steps.map((step, idx) => {
                    const isDone = step.status === "done";
                    const isActive = step.status === "active";
                    
                    return (
                        <div key={step.title} className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isDone ? 'bg-emerald-500 text-white shadow-sm' : 
                                    isActive ? 'bg-indigo-600 text-white shadow-indigo-100 scale-115 font-extrabold ring-4 ring-indigo-50' : 
                                    'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                    {isDone ? <Check size={10} strokeWidth={3} /> : idx + 1}
                                </div>
                                <div className="text-left">
                                    <p className={`text-[10px] font-bold leading-none ${isDone ? 'text-slate-700 dark:text-slate-300' : isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
                                        {step.title}
                                    </p>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{step.description}</p>
                                </div>
                            </div>
                            {idx < steps.length - 1 && (
                                <ArrowRight size={12} className="text-slate-300 dark:text-slate-700 hidden md:block" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DrawerSection({ title, accentColor, rows, emptyText }) {
    const borders = {
        blue: 'border-blue-100',
        amber: 'border-amber-100',
        rose: 'border-rose-100',
        indigo: 'border-indigo-100'
    };
    const headers = {
        blue: 'text-blue-700',
        amber: 'text-amber-700',
        rose: 'text-rose-600',
        indigo: 'text-indigo-600'
    };

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 ${borders[accentColor] || 'border-slate-100'}`}>
            <h4 className={`text-[9px] font-bold uppercase tracking-widest mb-3 ${headers[accentColor] || 'text-slate-400'}`}>
                {title}
            </h4>
            {rows && rows.length > 0 ? (
                <div className="space-y-1.5">
                    {rows.map((row, index) => (
                        <div key={`${row.name}-${index}`} className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 hover:border-[#4F46E5]/20 transition">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{row.name}</span>
                            <span className="text-[11px] font-bold text-slate-800">Rs {(row.amount || 0).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest py-4">{emptyText}</p>
            )}
        </div>
    );
}

const ITEMS_PER_PAGE = 12;

const ProcessPayroll = () => {
    const navigate = useNavigate();
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('payroll.process');
    const canSeeProcessData = canView || canCreate || canEdit || canDelete;
    const canSelectEmployees = canCreate;
    const canOpenPreviewDetails = canSeeProcessData;

    const [month, setMonth] = useState(dayjs());
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [calculating, setCalculating] = useState(false);
    const [previews, setPreviews] = useState({});
    const [detailDrawer, setDetailDrawer] = useState({ visible: false, empId: null });
    const [detailData, setDetailData] = useState(null);
    const [payrollRunning, setPayrollRunning] = useState(false);
    const [payrollResult, setPayrollResult] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Redesign search & filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDept, setSelectedDept] = useState('ALL');
    const [selectedReadiness, setSelectedReadiness] = useState('ALL');

    useEffect(() => {
        if (!month) return;
        if (!canSeeProcessData) {
            setEmployees([]);
            setPreviews({});
            setSelectedRowKeys([]);
            return;
        }
        fetchEmployees();
        setPreviews({});
        setSelectedRowKeys([]);
        setCurrentPage(1);
        // `fetchEmployees` is intentionally recreated with the current month and permission state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, canSeeProcessData]);

    const fetchEmployees = async () => {
        if (!canSeeProcessData) return;
        setLoading(true);
        try {
            const response = await api.get(`/payroll/process/employees?month=${month.format('YYYY-MM')}`);
            setEmployees((response.data?.data || []).map((employee) => ({ ...employee, key: employee._id })));
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to fetch employees');
        } finally {
            setLoading(false);
        }
    };

    // Extract unique departments dynamically
    const departments = useMemo(() => {
        const set = new Set();
        employees.forEach((emp) => {
            if (emp.department) set.add(emp.department);
        });
        return Array.from(set).sort();
    }, [employees]);

    // Multi-criteria filtering logic
    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            const matchesSearch = !searchQuery || 
                emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;

            let matchesReadiness = true;
            if (selectedReadiness !== 'ALL') {
                if (selectedReadiness === 'READY') {
                    matchesReadiness = emp.canProcessPayroll;
                } else if (selectedReadiness === 'BLOCKED') {
                    matchesReadiness = !emp.canProcessPayroll;
                } else if (selectedReadiness === 'SALARY_MISSING') {
                    matchesReadiness = emp.payrollReadiness === 'MISSING_SALARY';
                } else if (selectedReadiness === 'PROFILE_MISSING') {
                    matchesReadiness = emp.payrollReadiness === 'MISSING_PROFILE';
                }
            }

            return matchesSearch && matchesDept && matchesReadiness;
        });
    }, [employees, searchQuery, selectedDept, selectedReadiness]);

    const selectableEmployees = useMemo(() => filteredEmployees.filter((employee) => employee.canProcessPayroll), [filteredEmployees]);
    const readyCount = useMemo(() => employees.filter((employee) => employee.canProcessPayroll).length, [employees]);
    const blockedCount = employees.length - readyCount;
    const previewedCount = Object.keys(previews).length;
    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE) || 1;
    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const allSelected = selectableEmployees.length > 0 && selectedRowKeys.length === selectableEmployees.length;
    const someSelected = selectedRowKeys.length > 0 && selectedRowKeys.length < selectableEmployees.length;

    const toggleRow = (id) => {
        if (!canSelectEmployees) return;
        const employee = employees.find((entry) => entry._id === id);
        if (!employee?.canProcessPayroll) return;
        setSelectedRowKeys((prev) => prev.includes(id) ? prev.filter((key) => key !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (!canSelectEmployees) return;
        setSelectedRowKeys((prev) => prev.length === selectableEmployees.length ? [] : selectableEmployees.map((employee) => employee._id));
    };

    const calculatePreview = async () => {
        if (!canCreate) return;
        const itemsToPreview = employees
            .filter((employee) => selectedRowKeys.includes(employee._id))
            .map((employee) => ({ employeeId: employee._id, useCompensation: true }));

        if (itemsToPreview.length === 0) {
            message.warning('Select at least one payroll-ready employee to preview');
            return;
        }

        setCalculating(true);
        try {
            const response = await api.post('/payroll/process/preview', {
                month: month.format('YYYY-MM'),
                items: itemsToPreview,
                useCompensation: true
            });
            const nextPreviews = {};
            (response.data?.data || []).forEach((preview) => {
                nextPreviews[preview.employeeId] = preview;
            });
            setPreviews(nextPreviews);
            message.success(`Calculated successfully for ${itemsToPreview.length} employee(s)`);
        } catch (err) {
            console.error('Calculation Error:', err);
            message.error(err.response?.data?.message || 'Calculation failed');
        } finally {
            setCalculating(false);
        }
    };

    const runPayroll = async () => {
        if (!canCreate) return;
        const selectedEmployeeIds = employees
            .filter((employee) => selectedRowKeys.includes(employee._id))
            .map((employee) => employee._id);

        if (selectedEmployeeIds.length === 0) {
            message.error('No payroll-ready employees selected');
            return;
        }

        if (!window.confirm(`Process payroll for ${selectedEmployeeIds.length} employees for ${month.format('MMMM YYYY')}?`)) {
            return;
        }

        setPayrollRunning(true);
        try {
            const initiateResponse = await api.post('/payroll/runs', {
                month: month.month() + 1,
                year: month.year(),
                runType: 'SELECTED',
                roleScope: 'ALL',
                executionMode: 'MONTHLY',
                selectedEmployeeIds,
                attendancePolicy: 'STRICT',
                isFiltered: true,
                filters: {
                    source: 'PROCESS_PAYROLL_SCREEN',
                    employeeIds: selectedEmployeeIds
                }
            });
            const runId = initiateResponse.data?.data?._id;
            if (!runId) {
                throw new Error('Payroll run could not be initiated');
            }

            const preflightResponse = await api.post(`/payroll/runs/${runId}/preflight`);
            const preflight = preflightResponse.data?.data || null;

            if (preflight && !preflight.canCalculate) {
                const blockerCount = preflight.blockers?.length || 0;
                const warningCount = preflight.warnings?.length || 0;
                throw new Error(`Preflight found ${blockerCount} blocker(s) and ${warningCount} warning(s).`);
            }

            const calculateResponse = await api.post(`/payroll/runs/${runId}/calculate`);
            const payrollRun = calculateResponse.data?.data || {};

            setPayrollResult({
                payrollRunId: payrollRun._id || runId,
                runCode: payrollRun.runCode || '',
                runType: payrollRun.runType || 'SELECTED',
                sequenceNo: payrollRun.sequenceNo || null,
                status: payrollRun.status || '',
                lifecycleState: payrollRun.lifecycleState || '',
                totalEmployees: payrollRun.totalEmployees || 0,
                processedEmployees: payrollRun.processedEmployees || 0,
                failedEmployees: payrollRun.failedEmployees || 0,
                totalGross: payrollRun.totalGross || 0,
                totalNetPay: payrollRun.totalNetPay || 0,
                totalDeductions: payrollRun.totalDeductions || 0,
                errors: payrollRun.executionErrors || [],
                preflightSummary: preflight
                    ? {
                        blockers: preflight.blockers?.length || 0,
                        warnings: preflight.warnings?.length || 0
                    }
                    : null
            });
            setSelectedRowKeys([]);
            setPreviews({});
            message.success(`Selected payroll run ${payrollRun.runCode || ''} processed successfully for ${payrollRun.processedEmployees || 0} employees.`);
            await fetchEmployees();
        } catch (err) {
            console.error('Payroll error:', err);
            message.error(err.response?.data?.message || err.message || 'Payroll run failed');
        } finally {
            setPayrollRunning(false);
        }
    };

    return (
        <div className="space-y-4 p-4 animate-in fade-in duration-500 overflow-x-hidden w-full bg-slate-50/50 min-h-screen">
            {/* Header section */}
            <div className="relative rounded-3xl border border-slate-200/80 bg-white shadow-xs">
                <div className="overflow-hidden p-6 pr-56 rounded-3xl min-h-[80px] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100 shadow-xs shrink-0">
                        <Calculator size={22} strokeWidth={2.5} />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">Process Payroll</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                            Validate, preview, and process employee pay records
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-full bg-indigo-50/50 blur-3xl rounded-full pointer-events-none -mr-32 -mt-10" />
                </div>
                <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
                    <DatePicker
                        picker="month"
                        value={month}
                        onChange={setMonth}
                        format="MMMM YYYY"
                        allowClear={false}
                        size="small"
                        className="rounded-xl border-slate-200 text-[11px] font-bold"
                        style={{ width: 140 }}
                    />
                    <button
                        onClick={fetchEmployees}
                        disabled={loading}
                        className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-[#4F46E5] transition shadow-xs cursor-pointer"
                        title="Refresh list"
                    >
                        <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stepper Guide */}
            <PayrollStepper selectedCount={selectedRowKeys.length} previewedCount={previewedCount} />

            {/* Filters Toolbar */}
            <div className="bg-white border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search size={14} />
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search staff by name or employee ID..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] focus:bg-white transition"
                        />
                    </div>
                    {(searchQuery || selectedDept !== 'ALL' || selectedReadiness !== 'ALL') && (
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedDept('ALL'); setSelectedReadiness('ALL'); setCurrentPage(1); }}
                            className="px-3 py-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Filter size={11} /> Dept:
                        </span>
                        <select
                            value={selectedDept}
                            onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
                            className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700"
                        >
                            <option value="ALL">All Departments</option>
                            {departments.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <AlertCircle size={11} /> Status:
                        </span>
                        <select
                            value={selectedReadiness}
                            onChange={(e) => { setSelectedReadiness(e.target.value); setCurrentPage(1); }}
                            className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="READY">Ready Only</option>
                            <option value="BLOCKED">Blocked Only</option>
                            <option value="SALARY_MISSING">Salary Missing</option>
                            <option value="PROFILE_MISSING">Profile Missing</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Dashboard Stats */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                    <StatCard label="Total Staff" value={employees.length} accent="slate" icon={<Users size={16} />} />
                    <StatCard label="Ready to Run" value={readyCount} accent="emerald" icon={<CheckCircle2 size={16} />} />
                    <StatCard label="Needs Attention" value={blockedCount} accent="amber" icon={<AlertTriangle size={16} />} />
                    <StatCard label="Selected" value={selectedRowKeys.length} accent="blue" icon={<Building2 size={16} />} />
                    <StatCard label="Previews Ready" value={previewedCount} accent="blue" icon={<Calculator size={16} />} />
                </div>

                {/* Main Action Trigger Area */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={calculatePreview}
                        disabled={!canCreate || calculating || selectedRowKeys.length === 0}
                        className={`flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all shadow-sm ${
                            selectedRowKeys.length > 0 && !calculating 
                                ? 'hover:border-indigo-600 hover:text-indigo-600 border-indigo-200 ring-2 ring-indigo-500/10 cursor-pointer animate-pulse' 
                                : 'disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                        {calculating ? (
                            <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Calculator size={13} strokeWidth={2.5} />
                        )}
                        Calculate Preview {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
                    </button>
                    <button
                        onClick={runPayroll}
                        disabled={!canCreate || payrollRunning || selectedRowKeys.length === 0}
                        className={`flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all shadow-sm ${
                            selectedRowKeys.length > 0 && !payrollRunning 
                                ? 'hover:bg-indigo-700 ring-2 ring-indigo-500/20 cursor-pointer' 
                                : 'disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                        {payrollRunning ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <PlayCircle size={13} strokeWidth={2.5} />
                        )}
                        Run Payroll {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
                    </button>
                </div>
            </div>

            {/* Data Grid Section */}
            <div className="overflow-x-auto w-full rounded-2xl no-scrollbar">
                <div style={{ minWidth: '920px' }} className="space-y-1.5">
                    {/* Header Columns */}
                    <div className="grid grid-cols-[2rem_1.9fr_1.2fr_1fr_1.5fr_1.1fr] px-4 py-3 bg-slate-100 rounded-xl border border-slate-200/50">
                        {canSelectEmployees && (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(element) => { if (element) element.indeterminate = someSelected; }}
                                    onChange={toggleAll}
                                    className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                                />
                            </div>
                        )}
                        {['Employee', 'Attendance', 'Current CTC', 'Preview Output', 'Status'].map((header, index) => (
                            <div key={header} className={`text-[9px] font-black text-slate-500 uppercase tracking-widest ${index > 0 ? 'pl-3 border-l border-slate-200' : ''} flex items-center`}>
                                {header}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center gap-3 shadow-sm">
                            <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Employee Records...</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center gap-4 shadow-sm text-center">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-[#4F46E5] border border-indigo-100">
                                <Users size={28} strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">No matching employees found</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">Try adjusting your filters or search keywords.</p>
                            </div>
                        </div>
                    ) : paginatedEmployees.map((emp) => {
                        const isSelected = selectedRowKeys.includes(emp._id);
                        const preview = previews[emp._id];
                        const earnings = preview?.breakdown?.earningsSnapshot || [];
                        const basicItem = earnings.find((item) => item.name?.toLowerCase().includes('basic'));
                        const basicValue = basicItem ? basicItem.amount : preview?.gross;
                        const rowBlocked = !emp.canProcessPayroll;
                        const readinessLabel =
                            emp.payrollReadiness === 'READY'
                                ? 'PAYROLL READY'
                                : emp.payrollReadiness === 'MISSING_PROFILE'
                                    ? 'PROFILE MISSING'
                                    : emp.payrollReadiness === 'MISSING_SALARY'
                                        ? 'SALARY MISSING'
                                        : 'BLOCKED';
                        const summary = [...(emp.validation?.issues || []), ...(emp.validation?.warnings || [])]
                            .map((item) => item.message)[0];

                        return (
                            <div
                                key={emp._id}
                                onClick={() => canSelectEmployees && !rowBlocked && toggleRow(emp._id)}
                                className={`grid grid-cols-[2rem_1.9fr_1.2fr_1fr_1.5fr_1.1fr] items-center px-3 py-3 rounded-2xl border ${canSelectEmployees && !rowBlocked ? 'cursor-pointer' : 'cursor-default'} transition-all duration-200 group shadow-sm ${isSelected ? 'bg-indigo-50/50 border-[#4F46E5]/40 shadow-indigo-100/50' : rowBlocked ? 'bg-slate-50 border-slate-200/80 opacity-90' : 'bg-white border-transparent hover:border-[#4F46E5]/20 hover:shadow-xs'}`}
                            >
                                {canSelectEmployees && (
                                    <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleRow(emp._id)}
                                            disabled={rowBlocked}
                                            className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center text-xs font-bold border border-indigo-100 shadow-xs shrink-0">
                                        {(emp.firstName || emp.name || 'E').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-extrabold text-slate-700 uppercase truncate group-hover:text-[#4F46E5] transition-colors leading-none">
                                            {emp.name}
                                        </div>
                                        <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-tight mt-1 truncate">
                                            {emp.department && `${emp.department} • `}{emp.employeeId || ''}
                                        </div>
                                        {summary && <div className="text-[8px] font-bold text-rose-500 mt-1 truncate flex items-center gap-1"><AlertCircle size={9}/> {summary}</div>}
                                    </div>
                                </div>

                                <div className="pl-3 border-l border-slate-200">
                                    <div className="text-[10px] font-bold text-slate-700">
                                        Present: <span className="text-emerald-600">{emp.attendanceParams?.presentDays}</span> / {emp.attendanceParams?.totalDays}
                                    </div>
                                    {emp.attendanceParams?.presentDays === 0 && (
                                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-bold uppercase border border-rose-100">
                                            <AlertTriangle size={8} /> High Absenteeism
                                        </span>
                                    )}
                                </div>

                                <div className="pl-3 border-l border-slate-200">
                                    {emp.effectiveSalaryVersion?.totalCTC ? (
                                        <div className="space-y-0.5">
                                            <div className="text-[10px] font-extrabold text-slate-700">Rs {Math.round(emp.effectiveSalaryVersion.totalCTC).toLocaleString()}</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                {emp.effectiveSalaryVersion?.version ? `v${emp.effectiveSalaryVersion.version}` : 'canonical'}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] text-slate-300 italic font-bold">—</span>
                                    )}
                                </div>

                                <div className="pl-3 border-l border-slate-200">
                                    {!preview ? (
                                        rowBlocked ? (
                                            <span className="text-[9px] text-slate-400 font-bold uppercase italic">Calculation Blocked</span>
                                        ) : (
                                            <div className="px-3 py-1 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/20 text-[9px] text-[#4F46E5] font-extrabold uppercase tracking-wide text-center max-w-[210px] transition-all hover:bg-indigo-50">
                                                👉 Check box & run preview
                                            </div>
                                        )
                                    ) : preview.error ? (
                                        <div className="flex items-center gap-1">
                                            <AlertCircle size={12} className="text-rose-500" />
                                            <span className="text-[9px] text-rose-600 font-extrabold uppercase">{preview.validation ? 'Blocked' : 'Error'}</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px] gap-4 max-w-[210px]">
                                                <span className="text-slate-500 font-bold uppercase text-[8px]">Basic</span>
                                                <span className="font-extrabold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-lg">Rs {Math.round(basicValue || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] gap-4 max-w-[210px]">
                                                <span className="text-slate-500 font-bold uppercase text-[8px]">Net Pay</span>
                                                <span className="font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-100">Rs {Math.round(preview.net || 0).toLocaleString()}</span>
                                            </div>
                                            {canOpenPreviewDetails && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDetailData(preview.breakdown || preview);
                                                        setDetailDrawer({ visible: true, empId: emp._id });
                                                    }}
                                                    className="mt-1 flex items-center gap-1 text-[8px] font-extrabold uppercase text-blue-500 hover:text-blue-700 transition cursor-pointer"
                                                >
                                                    <Eye size={10} /> View Details Breakdown
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="pl-3 border-l border-slate-200 flex items-center">
                                    <div className="space-y-1">
                                        <StatusChip label={readinessLabel} color={emp.canProcessPayroll ? 'emerald' : emp.payrollReadiness === 'MISSING_PROFILE' ? 'amber' : 'rose'} />
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                            {emp.hasPayrollProfile ? 'profile set' : 'profile missing'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pagination Controls */}
            {!loading && filteredEmployees.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)} of {filteredEmployees.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
                        >
                            <ChevronLeft size={14} strokeWidth={2.5} />
                        </button>
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-bold uppercase tracking-widest border transition shadow-xs ${currentPage === page ? 'bg-[#4F46E5] text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-[#4F46E5] hover:text-[#4F46E5] cursor-pointer'}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
                        >
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            )}

            {/* Run Result Portal Modal */}
            {payrollResult && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setPayrollResult(null)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100">
                                    <CheckCircle2 size={18} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight leading-none">Payroll Run Results</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{month.format('MMMM YYYY')}</p>
                                </div>
                            </div>
                            <button onClick={() => setPayrollResult(null)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition text-slate-400 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {(payrollResult.runCode || payrollResult.status || payrollResult.sequenceNo) && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Run Code</p>
                                        <p className="text-sm font-bold text-slate-700 mt-1">{payrollResult.runCode || 'Pending'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                                        <p className="text-sm font-bold text-emerald-600 mt-1">{payrollResult.status || 'INITIATED'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sequence</p>
                                        <p className="text-sm font-bold text-slate-700 mt-1">{payrollResult.sequenceNo || 'Auto'}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Total', value: payrollResult.totalEmployees || 0, color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <Users size={16} /> },
                                    { label: 'Processed', value: payrollResult.processedEmployees || 0, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 size={16} /> },
                                    { label: 'Failed', value: payrollResult.failedEmployees || 0, color: 'bg-rose-50 text-rose-600 border-rose-100', icon: <AlertTriangle size={16} /> }
                                ].map((item) => (
                                    <div key={item.label} className={`p-4 rounded-2xl border flex flex-col items-center gap-1 ${item.color}`}>
                                        {item.icon}
                                        <div className="text-2xl font-bold leading-none">{item.value}</div>
                                        <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">{item.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Gross</p>
                                    <p className="text-xl font-bold text-blue-600 mt-1">Rs {Math.round(payrollResult.totalGross || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Net Pay</p>
                                    <p className="text-xl font-bold text-emerald-600 mt-1">Rs {Math.round(payrollResult.totalNetPay || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            {payrollResult.preflightSummary && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">Preflight Blockers</p>
                                        <p className="text-xl font-bold text-amber-700 mt-1">{payrollResult.preflightSummary.blockers || 0}</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest">Preflight Warnings</p>
                                        <p className="text-xl font-bold text-blue-700 mt-1">{payrollResult.preflightSummary.warnings || 0}</p>
                                    </div>
                                </div>
                            )}

                            {payrollResult.errors && payrollResult.errors.length > 0 && (
                                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                    <h4 className="text-[9px] font-bold text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <AlertTriangle size={12} /> Processing Errors
                                    </h4>
                                    <div className="space-y-1.5">
                                        {payrollResult.errors.map((error, index) => (
                                            <div key={index} className="text-[10px] text-rose-700 bg-rose-100 px-3 py-2 rounded-xl font-bold">
                                                <strong>Employee:</strong> {error.employeeId} - {error.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button
                                    onClick={() => setPayrollResult(null)}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-slate-300 transition shadow-sm cursor-pointer"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setPayrollResult(null);
                                        navigate('/hr/payroll/run');
                                    }}
                                    className="px-4 py-2 bg-[#4F46E5] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4338CA] transition shadow-sm cursor-pointer"
                                >
                                    Open Run History
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Details Drawer */}
            <Drawer
                width={680}
                title={null}
                placement="right"
                onClose={() => { setDetailDrawer({ visible: false, empId: null }); setDetailData(null); }}
                open={detailDrawer.visible}
                closable={false}
                styles={{ body: { padding: 0, background: '#f8fafc' } }}
            >
                {detailData ? (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100">
                                    <IndianRupee size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight leading-none">Payslip Preview</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        {detailData.employeeInfo?.employeeId || '—'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setDetailDrawer({ visible: false, empId: null }); setDetailData(null); }} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition text-slate-400 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Employee Details</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Employee ID', icon: <Briefcase size={11} />, value: detailData.employeeInfo?.employeeId || '—' },
                                        { label: 'Name', icon: <Users size={11} />, value: detailData.employeeInfo?.name || '—' },
                                        { label: 'Department', icon: <Building2 size={11} />, value: detailData.employeeInfo?.department || '—' },
                                        { label: 'Designation', icon: <TrendingUp size={11} />, value: detailData.employeeInfo?.designation || '—' }
                                    ].map((field) => (
                                        <div key={field.label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                                            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                                                {field.icon}{field.label}
                                            </div>
                                            <div className="text-[11px] font-bold text-slate-700 truncate">{field.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white rounded-2xl border border-blue-100 p-4 text-center shadow-sm">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Earnings</p>
                                    <p className="text-xl font-bold text-blue-600">Rs {Math.round(detailData.grossEarnings || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-emerald-100 p-4 text-center shadow-sm">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Pay</p>
                                    <p className="text-xl font-bold text-emerald-600">Rs {Math.round(detailData.netPay || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <DrawerSection title="Earnings" accentColor="blue" rows={detailData.earningsSnapshot} emptyText="No earnings data" />
                            <DrawerSection title="Pre-Tax Deductions" accentColor="amber" rows={detailData.preTaxDeductionsSnapshot} emptyText="No pre-tax deductions" />
                            <DrawerSection title="Post-Tax Deductions" accentColor="rose" rows={detailData.postTaxDeductionsSnapshot} emptyText="No post-tax deductions" />
                            {detailData.employerContributionsSnapshot && detailData.employerContributionsSnapshot.length > 0 && (
                                <DrawerSection title="Employer Contributions" accentColor="indigo" rows={detailData.employerContributionsSnapshot} emptyText="" />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        <Empty description="No preview available" />
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default ProcessPayroll;
