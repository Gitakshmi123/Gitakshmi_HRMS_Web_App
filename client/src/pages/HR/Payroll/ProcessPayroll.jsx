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
    Briefcase
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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ring-1 ring-inset shadow-sm ${textColor} ${bgColor} ${borderColor} ${ringColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            {label}
        </span>
    );
}

function StatCard({ label, value, accent }) {
    const colors = {
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        slate: 'bg-slate-500'
    };
    const accentColor = colors[accent] || colors.slate;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all duration-300 group flex flex-col justify-center relative overflow-hidden min-w-[120px]">
            <div className={`absolute top-0 right-0 w-16 h-16 ${accentColor} opacity-5 blur-2xl rounded-full -mr-8 -mt-8 group-hover:opacity-10 transition-opacity duration-300`} />
            <p className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 opacity-80 relative z-10">{label}</p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none relative z-10">{value}</h3>
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

    const selectableEmployees = useMemo(() => employees.filter((employee) => employee.canProcessPayroll), [employees]);
    const readyCount = selectableEmployees.length;
    const blockedCount = employees.length - readyCount;
    const previewedCount = Object.keys(previews).length;
    const totalPages = Math.ceil(employees.length / ITEMS_PER_PAGE) || 1;
    const paginatedEmployees = employees.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
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
        <div className="space-y-3 p-3 animate-in fade-in duration-500 overflow-x-hidden w-full">
            <div className="relative rounded-2xl border border-slate-200 shadow-sm">
                <div className="overflow-hidden bg-white p-4 pr-56 rounded-2xl min-h-[68px] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100 shadow-sm shrink-0">
                        <Calculator size={18} strokeWidth={2.5} />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">Process Payroll</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Canonical salary validation before preview and payroll run
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-full bg-indigo-50/50 blur-3xl rounded-full pointer-events-none -mr-32 -mt-10" />
                </div>
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
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
                        className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-[#4F46E5] transition shadow-sm"
                        title="Refresh"
                    >
                        <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <StatCard label="Total Staff" value={employees.length} accent="slate" />
                    <StatCard label="Ready" value={readyCount} accent="emerald" />
                    <StatCard label="Blocked" value={blockedCount} accent="amber" />
                    <StatCard label="Selected" value={selectedRowKeys.length} accent="blue" />
                    <StatCard label="Previews" value={previewedCount} accent="blue" />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={calculatePreview}
                        disabled={!canCreate || calculating || selectedRowKeys.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                    >
                        {calculating ? <div className="w-3 h-3 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" /> : <Calculator size={13} strokeWidth={2.5} />}
                        Calculate Preview
                    </button>
                    <button
                        onClick={runPayroll}
                        disabled={!canCreate || payrollRunning || selectedRowKeys.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                    >
                        {payrollRunning ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <PlayCircle size={13} strokeWidth={2.5} />}
                        Run Payroll
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto w-full rounded-2xl no-scrollbar">
                <div style={{ minWidth: '920px' }} className="space-y-1.5">
                    <div className="grid grid-cols-[2rem_1.9fr_1.2fr_1fr_1.5fr_1.1fr] px-4 py-2 opacity-60">
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
                        {['Employee', 'Attendance', 'Current CTC', 'Preview', 'Status'].map((header, index) => (
                            <div key={header} className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest ${index > 0 ? 'pl-3 border-l border-slate-200' : ''} flex items-center`}>
                                {header}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center gap-3 shadow-sm">
                            <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Employees...</p>
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center gap-4 shadow-sm">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-[#4F46E5]">
                                <Users size={32} strokeWidth={1.5} />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No employees found for this month</p>
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
                                className={`grid grid-cols-[2rem_1.9fr_1.2fr_1fr_1.5fr_1.1fr] items-center px-3 py-2.5 rounded-2xl border ${canSelectEmployees && !rowBlocked ? 'cursor-pointer' : 'cursor-default'} transition-all group shadow-sm ${isSelected ? 'bg-indigo-50/60 border-[#4F46E5]/30 shadow-indigo-100' : rowBlocked ? 'bg-slate-50 border-slate-200/80 opacity-90' : 'bg-white border-transparent hover:border-[#4F46E5]/20 hover:shadow-md'}`}
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
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center text-xs font-bold border border-indigo-100 shadow-sm shrink-0">
                                        {(emp.firstName || emp.name || 'E').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-slate-700 uppercase truncate group-hover:text-[#4F46E5] transition-colors leading-none">
                                            {emp.name}
                                        </div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-0.5 truncate">
                                            {emp.department && `${emp.department} • `}{emp.employeeId || ''}
                                        </div>
                                        {summary && <div className="text-[8px] font-bold text-slate-400 mt-1 truncate">{summary}</div>}
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
                                            <div className="text-[10px] font-bold text-slate-700">Rs {Math.round(emp.effectiveSalaryVersion.totalCTC).toLocaleString()}</div>
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
                                        <span className="text-[9px] text-slate-300 italic font-bold">—</span>
                                    ) : preview.error ? (
                                        <div className="flex items-center gap-1">
                                            <AlertCircle size={12} className="text-rose-500" />
                                            <span className="text-[9px] text-rose-600 font-bold uppercase">{preview.validation ? 'Blocked' : 'Error'}</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between text-[9px]">
                                                <span className="text-slate-500 font-bold uppercase">Basic</span>
                                                <span className="font-bold text-slate-700">Rs {Math.round(basicValue || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-[9px]">
                                                <span className="text-slate-500 font-bold uppercase">Net Pay</span>
                                                <span className="font-bold text-emerald-600">Rs {Math.round(preview.net || 0).toLocaleString()}</span>
                                            </div>
                                            {canOpenPreviewDetails && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDetailData(preview.breakdown || preview);
                                                        setDetailDrawer({ visible: true, empId: emp._id });
                                                    }}
                                                    className="mt-1 flex items-center gap-1 text-[8px] font-bold uppercase text-blue-500 hover:text-blue-700 transition"
                                                >
                                                    <Eye size={10} /> Details
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

            {!loading && employees.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, employees.length)} of {employees.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronLeft size={14} strokeWidth={2.5} />
                        </button>
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-bold uppercase tracking-widest border transition shadow-sm ${currentPage === page ? 'bg-[#4F46E5] text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-[#4F46E5] hover:text-[#4F46E5]'}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            )}

            {payrollResult && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPayrollResult(null)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
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
                            <button onClick={() => setPayrollResult(null)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition text-slate-400">
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
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-slate-300 transition shadow-sm"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setPayrollResult(null);
                                        navigate('/hr/payroll/run');
                                    }}
                                    className="px-4 py-2 bg-[#4F46E5] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4338CA] transition shadow-sm"
                                >
                                    Open Run History
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

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
                            <button onClick={() => { setDetailDrawer({ visible: false, empId: null }); setDetailData(null); }} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition text-slate-400">
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
