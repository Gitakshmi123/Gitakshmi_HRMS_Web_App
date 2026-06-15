import React, { useEffect, useMemo, useState } from 'react';
import {
    Search,
    Eye,
    PlusCircle,
    TrendingUp,
    History,
    AlertCircle,
    X,
    Calendar,
    Users,
    CheckCircle2,
    RefreshCw,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import api from '../../utils/api';
import SalaryIncrementModal from '../../components/Compensation/SalaryIncrementModal';
import InitialCompensationModal from '../../components/Compensation/InitialCompensationModal';
import PayrollSetupPanel from '../../components/Compensation/PayrollSetupPanel';
import CustomSelect from '../../components/shared/CustomSelect';
import usePagePermissions from '../../hooks/usePagePermissions';

const ITEMS_PER_PAGE = 10;

const formatINR = (value) => Number(value || 0).toLocaleString('en-IN');
const formatDate = (value, options = { dateStyle: 'medium' }) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN', options);
};

function StatCard({ label, value, icon, accent, tag }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all duration-500 group flex flex-col justify-between h-full relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 ${accent} opacity-5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity duration-500`} />
            
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform duration-500`}>
                    {icon ? React.cloneElement(icon, { size: 20, className: `text-slate-600 dark:text-slate-300`, strokeWidth: 2.5 }) : null}
                </div>
                {tag && (
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                        {tag}
                    </span>
                )}
            </div>

            <div>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">{label}</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{value}</h3>
                </div>
            </div>
        </div>
    );
}

function StatusChip({ status }) {
    const tones = {
        Active: 'text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-500/30',
        Ready: 'text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-500/30',
        Scheduled: 'text-indigo-700 bg-indigo-50 border-indigo-100 ring-indigo-500/30',
        'Not Set': 'text-amber-700 bg-amber-50 border-amber-100 ring-amber-500/30',
        'Missing Profile': 'text-amber-700 bg-amber-50 border-amber-100 ring-amber-500/30',
        'Missing Salary': 'text-rose-700 bg-rose-50 border-rose-100 ring-rose-500/30',
        Blocked: 'text-rose-700 bg-rose-50 border-rose-100 ring-rose-500/30'
    };
    const dots = {
        Active: 'bg-emerald-500',
        Ready: 'bg-emerald-500',
        Scheduled: 'bg-indigo-500',
        'Not Set': 'bg-amber-500',
        'Missing Profile': 'bg-amber-500',
        'Missing Salary': 'bg-rose-500',
        Blocked: 'bg-rose-500'
    };
    const tone = tones[status] || 'text-slate-600 bg-slate-50 border-slate-100 ring-slate-500/10';
    const dot = dots[status] || 'bg-slate-400';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ring-1 ring-inset shadow-sm ${tone}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {status}
        </span>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-right">{value || '-'}</span>
        </div>
    );
}

function Row({ emp, canView, canManage, onView, onSetupSalary, onIncrement, onHistory }) {
    const active = emp.activeVersion;
    const fullName = emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A';
    const initials = fullName.split(' ').map((item) => item[0]).join('').slice(0, 2).toUpperCase() || 'E';
    const statusNote = `${emp.blockersCount || 0} blocker(s) / ${emp.warningsCount || 0} warning(s)`;
    const showSetupSalary = canManage && (emp.availableActions?.canSetupSalary ?? !active);
    const showIncrement = canManage && (emp.availableActions?.canCreateIncrement ?? Boolean(active));
    const showHistory = canView && (emp.availableActions?.canViewHistory ?? Boolean(emp.versionCount));
    const showView = canView;

    return (
        <div className="bg-white dark:bg-slate-900 grid grid-cols-[1.6fr_0.9fr_0.85fr_1fr_0.9fr_0.95fr_1fr_1.1fr] items-center px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800/40 hover:border-[#4F46E5]/20 hover:bg-slate-50/50 transition-all group min-w-[1040px]">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] flex items-center justify-center text-[11px] font-semibold border border-indigo-100 dark:border-indigo-800/40 shrink-0">
                    {initials}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-[#4F46E5] transition-colors">
                        {fullName}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400 truncate mt-0.5">
                        {emp.employeeId || emp.email || 'N/A'}
                    </span>
                </div>
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300 text-center">
                {emp.role || emp.department || 'N/A'}
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 text-center">
                {active ? (
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Rs {formatINR(active.totalCTC)}</span>
                ) : emp.scheduledVersion ? (
                    <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Scheduled</span>
                ) : (
                    <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Not Set</span>
                )}
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 text-center">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {active ? formatDate(active.effectiveFrom, { day: '2-digit', month: '2-digit', year: '2-digit' }) : emp.scheduledVersion ? formatDate(emp.scheduledVersion.effectiveFrom, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                </span>
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1">
                <StatusChip status={emp.compensationStatus} />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{emp.versionCount || 0} version(s)</span>
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1">
                <StatusChip status={emp.payrollReadiness} />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">{statusNote}</span>
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 text-center">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {emp.payrollProfile?.payrollRegion || emp.payrollProfile?.workState || '-'}
                </span>
            </div>

            <div className="pl-3 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 flex-wrap">
                {showSetupSalary && (
                    <button
                        onClick={() => onSetupSalary(emp)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white border border-indigo-100 transition-all shadow-sm text-[10px] font-black uppercase tracking-wide"
                        title="Setup Salary"
                    >
                        <PlusCircle size={12} strokeWidth={2.5} />
                        Setup
                    </button>
                )}
                {showView && (
                    <button onClick={() => onView(emp)} className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white border border-blue-100 transition-all shadow-sm" title="View">
                        <Eye size={12} strokeWidth={2.5} />
                    </button>
                )}
                {showIncrement && (
                    <button onClick={() => onIncrement(emp)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-100 transition-all shadow-sm" title="Increment">
                        <TrendingUp size={12} strokeWidth={2.5} />
                    </button>
                )}
                {showHistory && (
                    <button onClick={() => onHistory(emp)} className="p-1.5 rounded-lg bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white border border-orange-100 transition-all shadow-sm" title="History">
                        <History size={12} strokeWidth={2.5} />
                    </button>
                )}
                {!showSetupSalary && !showView && !showIncrement && !showHistory && (
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">-</span>
                )}
            </div>
        </div>
    );
}

export default function Compensation() {
    const { canView, canCreate, canEdit } = usePagePermissions('payroll.compensation');
    const canManageCanonical = canCreate || canEdit;
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showIncrementModal, setShowIncrementModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyMeta, setHistoryMeta] = useState(null);
    const [migrationBusy, setMigrationBusy] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/compensation/list');
            setEmployees((response.data?.data || []).map((emp) => ({
                ...emp,
                name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A'
            })));
        } catch (error) {
            console.error('Fetch Data Error:', error);
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredEmployees = useMemo(() => {
        let result = [...employees];
        if (search) {
            const query = search.toLowerCase();
            result = result.filter((emp) => {
                const fullName = (emp.name || '').toLowerCase();
                const identifier = `${emp.employeeId || ''} ${emp.email || ''}`.toLowerCase();
                return fullName.includes(query) || identifier.includes(query);
            });
        }
        if (statusFilter) {
            result = result.filter((emp) => emp.compensationStatus === statusFilter || emp.payrollReadiness === statusFilter);
        }
        return result;
    }, [employees, search, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE));
    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const totals = {
        employees: employees.length,
        ready: employees.filter((emp) => emp.payrollReadiness === 'Ready').length,
        attention: employees.filter((emp) => !emp.validation?.canCalculate).length,
        scheduled: employees.filter((emp) => emp.compensationStatus === 'Scheduled').length
    };

    const runCanonicalMigration = async (dryRun) => {
        if (!canManageCanonical) return;
        if (!dryRun && !window.confirm('Run canonical payroll migration for this tenant now?')) return;
        try {
            setMigrationBusy(true);
            const response = await api.post('/payroll/canonical/migrate', { dryRun });
            const result = response.data?.data;
            alert([
                dryRun ? 'Canonical payroll dry run complete.' : 'Canonical payroll migration complete.',
                `Employees checked: ${result?.totalEmployees || 0}`,
                `Salary versions ${dryRun ? 'to create' : 'created'}: ${result?.salaryVersionsCreated || 0}`,
                `Payroll profiles ${dryRun ? 'to create' : 'created'}: ${result?.payrollProfilesCreated || 0}`,
                `Missing salary sources: ${result?.missingSalarySources || 0}`
            ].join('\n'));
            if (!dryRun) await fetchData();
        } catch (error) {
            console.error('Canonical migration error:', error);
            alert(error.response?.data?.message || error.message || 'Canonical migration failed');
        } finally {
            setMigrationBusy(false);
        }
    };

    const openView = (emp) => {
        setSelectedEmployee(emp);
        setShowViewModal(true);
    };

    const openSetupSalary = (emp) => {
        setSelectedEmployee(emp);
        setShowSetupModal(true);
    };

    const openIncrement = (emp) => {
        if (!emp.activeVersion) {
            alert('Active salary version is required before creating an increment.');
            return;
        }
        setSelectedEmployee(emp);
        setShowIncrementModal(true);
    };

    const openHistory = async (emp) => {
        setSelectedEmployee(emp);
        try {
            const response = await api.get(`/compensation/history/${emp._id}`);
            setHistory(response.data?.data || []);
            setHistoryMeta(response.data?.meta || null);
            setShowHistoryModal(true);
        } catch (error) {
            console.error('History Fetch Error:', error);
            setHistory([]);
            setHistoryMeta(null);
        }
    };

    return (
        <div className="space-y-4 p-4 animate-in fade-in duration-500 overflow-x-hidden w-full">
            <div className="relative rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="overflow-hidden bg-white dark:bg-slate-900 p-5 pr-56 rounded-2xl min-h-[72px] flex items-center">
                    <div className="relative z-10">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Employee Compensation
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Canonical salary versions, payroll profiles, and readiness
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-full bg-indigo-50/50 dark:bg-indigo-900/10 blur-3xl rounded-full pointer-events-none -mr-32 -mt-10" />
                </div>

                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    {canManageCanonical && (
                        <>
                            <button
                                onClick={() => runCanonicalMigration(true)}
                                disabled={migrationBusy}
                                className="px-3 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm text-[10px] font-black uppercase tracking-widest"
                            >
                                Dry Run
                            </button>
                            <button
                                onClick={() => runCanonicalMigration(false)}
                                disabled={migrationBusy}
                                className="px-3 h-9 flex items-center justify-center bg-[#4F46E5] text-white rounded-xl hover:bg-[#4338CA] transition shadow-sm text-[10px] font-black uppercase tracking-widest"
                            >
                                {migrationBusy ? 'Working...' : 'Migrate'}
                            </button>
                        </>
                    )}
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#4F46E5] transition shadow-sm"
                        title="Refresh"
                    >
                        <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Employees" value={totals.employees} icon={<Users />} accent="bg-indigo-500" tag="ALL" />
                <StatCard label="Payroll Ready" value={totals.ready} icon={<CheckCircle2 />} accent="bg-emerald-500" tag="READY" />
                <StatCard label="Needs Attention" value={totals.attention} icon={<AlertCircle />} accent="bg-orange-500" tag="BLOCKED" />
                <StatCard label="Scheduled Revisions" value={totals.scheduled} icon={<Calendar />} accent="bg-violet-500" tag="NEXT" />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative group flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4F46E5] transition-colors" size={14} strokeWidth={2.5} />
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 outline-none transition shadow-sm"
                    />
                </div>
                <CustomSelect
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value)}
                    options={[
                        { value: '', label: 'All Status' },
                        { value: 'Active', label: 'Salary Active' },
                        { value: 'Scheduled', label: 'Salary Scheduled' },
                        { value: 'Not Set', label: 'Salary Missing' },
                        { value: 'Ready', label: 'Payroll Ready' },
                        { value: 'Missing Profile', label: 'Profile Missing' },
                        { value: 'Blocked', label: 'Blocked' }
                    ]}
                    className="w-44"
                />
            </div>

            <div className="overflow-x-auto w-full rounded-2xl no-scrollbar">
                <div className="space-y-2" style={{ minWidth: '1040px' }}>
                    <div className="grid grid-cols-[1.6fr_0.9fr_0.85fr_1fr_0.9fr_0.95fr_1fr_1.1fr] px-4 py-2 opacity-60 min-w-[1040px]">
                        {['Employee', 'Role', 'Annual CTC', 'Effective', 'Salary', 'Payroll', 'Region', 'Actions'].map((header, index) => (
                            <div
                                key={header}
                                className={`text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center ${index > 0 ? 'border-l border-slate-200 dark:border-slate-800 pl-3 justify-center' : ''}`}
                            >
                                {header}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 flex flex-col items-center justify-center gap-3 shadow-sm">
                            <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Records...</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 flex flex-col items-center justify-center gap-4 shadow-sm">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-[#4F46E5]">
                                <Users size={32} strokeWidth={1.5} />
                            </div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No matching records found</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {paginatedEmployees.map((emp) => (
                                <Row
                                    key={emp._id}
                                    emp={emp}
                                    canView={canView}
                                    canManage={canManageCanonical}
                                    onView={openView}
                                    onSetupSalary={openSetupSalary}
                                    onIncrement={openIncrement}
                                    onHistory={openHistory}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {!loading && filteredEmployees.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)} of {filteredEmployees.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronLeft size={14} strokeWidth={2.5} />
                        </button>
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest border transition shadow-sm ${currentPage === page ? 'bg-[#4F46E5] text-white border-transparent' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4F46E5] hover:text-[#4F46E5]'}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            )}

            {showViewModal && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex-none flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Compensation Details</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {selectedEmployee.name} - {selectedEmployee.employeeId || 'N/A'}
                                </p>
                            </div>
                            <button onClick={() => setShowViewModal(false)} className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 rounded-xl transition">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Validation</h4>
                                    <div className="flex items-center gap-2 mb-3">
                                        <StatusChip status={selectedEmployee.payrollReadiness} />
                                        <StatusChip status={selectedEmployee.compensationStatus} />
                                    </div>
                                    {[...(selectedEmployee.validation?.issues || []), ...(selectedEmployee.validation?.warnings || [])].length === 0 ? (
                                        <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-[11px] font-bold">
                                            Payroll can calculate cleanly for the current period.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(selectedEmployee.validation?.issues || []).map((issue) => (
                                                <div key={`issue-${issue.code}`} className="px-3 py-2 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 text-[11px] font-bold">
                                                    {issue.message}
                                                </div>
                                            ))}
                                            {(selectedEmployee.validation?.warnings || []).map((warning) => (
                                                <div key={`warning-${warning.code}`} className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-[11px] font-bold">
                                                    {warning.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Salary Components</h4>
                                    {selectedEmployee.activeVersion?.components?.length ? (
                                        <div className="space-y-2">
                                            {selectedEmployee.activeVersion.components.map((component, index) => (
                                                <div key={`${component.name}-${index}`} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    <div>
                                                        <div className="text-[11px] font-black text-slate-800 dark:text-white uppercase">{component.name}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{component.type}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-slate-900 dark:text-white">Rs {formatINR(component.monthlyAmount)}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">Rs {formatINR(component.annualAmount)} /yr</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-3 py-8 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                            No active salary version for today
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-5 bg-slate-900 dark:bg-slate-800 rounded-2xl text-white">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Annual CTC</p>
                                    <h2 className="text-2xl font-black mb-4">Rs {formatINR(selectedEmployee.activeVersion?.totalCTC || 0)}<span className="text-sm text-slate-500 font-normal">/yr</span></h2>
                                    <div className="space-y-2 pt-4 border-t border-slate-800/60">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                            <span>Version</span>
                                            <span className="text-white">{selectedEmployee.activeVersion ? `v${selectedEmployee.activeVersion.version}` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                            <span>Effective</span>
                                            <span className="text-white">{formatDate(selectedEmployee.activeVersion?.effectiveFrom)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payroll Profile</h4>
                                    {selectedEmployee.payrollProfile ? (
                                        <div className="space-y-2">
                                            <InfoRow label="Branch" value={selectedEmployee.payrollProfile.branchName || '-'} />
                                            <InfoRow label="Work City" value={selectedEmployee.payrollProfile.workCity || '-'} />
                                            <InfoRow label="Work State" value={selectedEmployee.payrollProfile.workState || '-'} />
                                            <InfoRow label="Region" value={selectedEmployee.payrollProfile.payrollRegion || '-'} />
                                            <InfoRow label="Effective From" value={formatDate(selectedEmployee.payrollProfile.effectiveFrom)} />
                                        </div>
                                    ) : (
                                        <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-[11px] font-bold">
                                            No effective payroll profile found for the current period.
                                        </div>
                                    )}
                                </div>

                                {selectedEmployee.scheduledVersion && (
                                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Next Scheduled Revision</h4>
                                        <div className="space-y-2">
                                            <InfoRow label="Version" value={`v${selectedEmployee.scheduledVersion.version}`} />
                                            <InfoRow label="Effective From" value={formatDate(selectedEmployee.scheduledVersion.effectiveFrom)} />
                                            <InfoRow label="Annual CTC" value={`Rs ${formatINR(selectedEmployee.scheduledVersion.totalCTC)}`} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-2">
                                <PayrollSetupPanel
                                    employee={selectedEmployee}
                                    canManage={canManageCanonical}
                                    onDataChanged={fetchData}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSetupModal && selectedEmployee && !selectedEmployee.activeVersion && (
                <InitialCompensationModal
                    employee={selectedEmployee}
                    onClose={() => setShowSetupModal(false)}
                    onSuccess={(result) => {
                        setShowSetupModal(false);
                        fetchData();
                        alert([
                            'Initial salary setup created.',
                            `Version: v${result.data.salaryVersion.version}`,
                            `Annual CTC: Rs ${result.data.salaryVersion.totalCTC.toLocaleString('en-IN')}`,
                            result.data.payrollProfileAutoBackfilled
                                ? 'Payroll profile was auto-created from employee location.'
                                : 'Payroll profile was left unchanged.',
                            result.data.preservedScheduledVersion
                                ? `Existing scheduled version preserved for ${formatDate(result.data.preservedScheduledVersion.effectiveFrom)}.`
                                : 'No scheduled revision was affected.'
                        ].join('\n'));
                    }}
                />
            )}

            {showIncrementModal && selectedEmployee && selectedEmployee.activeVersion && (
                <SalaryIncrementModal
                    employee={selectedEmployee}
                    currentVersion={selectedEmployee.activeVersion}
                    onClose={() => setShowIncrementModal(false)}
                    onSuccess={(result) => {
                        setShowIncrementModal(false);
                        fetchData();
                        alert(`Salary version created.\n\nVersion: v${result.data.newVersion.version}\nNew CTC: Rs ${result.data.newVersion.totalCTC.toLocaleString('en-IN')}\nStatus: ${result.data.status}`);
                    }}
                />
            )}

            {showHistoryModal && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="flex-none flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Version History</h3>
                                <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mt-0.5">Salary versions and payroll profiles</p>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 rounded-xl transition">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salary Versions</h4>
                                {history.length === 0 ? (
                                    <div className="py-10 text-center font-black text-slate-400 uppercase tracking-widest text-xs">No salary history found</div>
                                ) : (
                                    history.map((version) => (
                                        <div key={version._id} className="flex justify-between items-center p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950">
                                            <div>
                                                <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase">v{version.version} - Rs {formatINR(version.totalCTC)} /yr</div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                    {formatDate(version.effectiveFrom)}{version.effectiveTo ? ` - ${formatDate(version.effectiveTo)}` : ''}
                                                </div>
                                            </div>
                                            <StatusChip status={version.status === 'ACTIVE' ? 'Active' : version.status === 'SCHEDULED' ? 'Scheduled' : 'Blocked'} />
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payroll Profiles</h4>
                                {(historyMeta?.payrollProfiles || []).length === 0 ? (
                                    <div className="py-10 text-center font-black text-slate-400 uppercase tracking-widest text-xs">No payroll profile history found</div>
                                ) : (
                                    historyMeta.payrollProfiles.map((profile) => (
                                        <div key={profile._id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase">
                                                    {profile.payrollRegion || profile.workState || profile.workCity || 'Payroll Profile'}
                                                </div>
                                                <StatusChip status={profile.status === 'ACTIVE' ? 'Active' : profile.status === 'SCHEDULED' ? 'Scheduled' : 'Blocked'} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                <InfoRow label="Branch" value={profile.branchName || '-'} />
                                                <InfoRow label="State" value={profile.workState || '-'} />
                                                <InfoRow label="City" value={profile.workCity || '-'} />
                                                <InfoRow label="Effective" value={formatDate(profile.effectiveFrom)} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
