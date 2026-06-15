import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ChevronDown, Plus, IndianRupee, TrendingDown, Gift, Layers, RefreshCw, FileSpreadsheet, Shield, Calculator
} from 'lucide-react';
import { showToast, showConfirmToast } from '../../../utils/uiNotifications';
import SalaryComponentTable from '../../../components/Payroll/SalaryComponentTable';
import BulkUploadComponentsModal from '../../../components/Payroll/BulkUploadComponentsModal';
import api from '../../../utils/api';
import { formatCalculationLabel } from '../../../utils/payrollFormat';
import usePagePermissions from '../../../hooks/usePagePermissions';
import MinimumWageMaster from './MinimumWageMaster';

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, bgColor, tag }) {
    return (
        <div className={`relative overflow-hidden ${bgColor} p-5 rounded-2xl shadow-lg group hover:scale-[1.02] hover:shadow-xl transition-all duration-300`}>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-sm transition-transform group-hover:rotate-6">
                        {icon && React.isValidElement(icon)
                            ? React.cloneElement(icon, { size: 18, strokeWidth: 2.5, className: 'text-white' })
                            : null}
                    </div>
                    {tag && (
                        <span className="text-[9px] font-bold text-white/90 bg-black/10 px-2.5 py-1 rounded-full uppercase tracking-[0.1em] border border-white/10 backdrop-blur-sm">
                            {tag}
                        </span>
                    )}
                </div>
                <div className="mt-auto">
                    <h4 className="text-3xl font-bold text-white tracking-tighter leading-none mb-1.5">{value}</h4>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.15em]">{label}</p>
                </div>
            </div>
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
        </div>
    );
}

export default function SalaryComponents() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('payroll.salary');
    const canAccessListData = canView || canEdit || canDelete;
    const initialTab = searchParams.get('tab') || 'earnings';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [earnings, setEarnings] = useState([]);
    const [deductions, setDeductions] = useState([]);
    const [benefits, setBenefits] = useState([]);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

    const TABS = [
        { key: 'earnings', label: 'Earnings', icon: <IndianRupee size={14} /> },
        { key: 'deductions', label: 'Deductions', icon: <TrendingDown size={14} /> },
        { key: 'benefits', label: 'Benefits', icon: <Gift size={14} /> },
        { key: 'minWage', label: 'Min Wage Master', icon: <Shield size={14} /> },
        { key: 'corrections', label: 'Corrections', icon: <Layers size={14} /> },
    ];

    useEffect(() => {
        if (!canAccessListData) {
            setEarnings([]);
            setDeductions([]);
            setBenefits([]);
            return;
        }
        if (activeTab === 'earnings') fetchEarnings();
        else if (activeTab === 'deductions') fetchDeductions();
        else if (activeTab === 'benefits') fetchBenefits();
    }, [activeTab, canAccessListData]);

    const fetchBenefits = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/benefits');
            if (res.data.success) {
                setBenefits(res.data.data.map(item => ({
                    id: item._id,
                    name: item.name,
                    type: item.payType === 'FIXED' ? 'Fixed' : 'Variable',
                    calculationType: formatCalculationLabel(item),
                    considerForPF: item.epf?.enabled,
                    considerForESI: item.esi?.enabled,
                    status: item.isActive ? 'Active' : 'Inactive',
                    isUsed: false,
                    category: 'Benefit'
                })));
            }
        } catch (err) {
            console.error('Failed to fetch benefits', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEarnings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/earnings');
            if (res.data.success) {
                setEarnings(res.data.data.map(item => ({
                    id: item._id,
                    name: item.name,
                    type: item.payType === 'FIXED' ? 'Fixed' : 'Variable',
                    calculationType: formatCalculationLabel(item),
                    considerForPF: item.epf?.enabled,
                    considerForESI: item.esi?.enabled,
                    status: item.isActive ? 'Active' : 'Inactive',
                    isUsed: item.isUsedInPayroll,
                    category: 'Earning'
                })));
            }
        } catch (err) {
            console.error('Failed to fetch earnings', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeductions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/deductions');
            if (res.data.success) {
                setDeductions(res.data.data.map(item => ({
                    id: item._id,
                    name: item.name,
                    type: item.category === 'PRE_TAX' ? 'Pre-Tax' : 'Post-Tax',
                    calculationType: item.amountType === 'FIXED'
                        ? `₹${item.amountValue}`
                        : `${item.amountValue}% of ${item.calculationBase}`,
                    frequency: item.recurring ? 'Monthly' : 'One-time',
                    status: item.isActive ? 'Active' : 'Inactive',
                    category: 'Deduction'
                })));
            }
        } catch (err) {
            console.error('Failed to fetch deductions', err);
        } finally {
            setLoading(false);
        }
    };

    const getData = () => {
        switch (activeTab) {
            case 'earnings': return earnings;
            case 'deductions': return deductions;
            case 'corrections': return [];
            case 'benefits': return benefits;
            case 'minWage': return [];
            default: return [];
        }
    };

    const activeData = getData();

    const handleEdit = (item) => {
        if (!canEdit) return;
        if (item.category === 'Earning') navigate(`/hr/payroll/earnings/edit/${item.id}`);
        else if (item.category === 'Deduction') navigate(`/hr/payroll/deductions/edit/${item.id}`);
        else if (item.category === 'Benefit') navigate(`/hr/payroll/benefits/edit/${item.id}`);
    };

    const handleToggleStatus = async (item) => {
        if (!canEdit) return;
        try {
            if (item.category === 'Earning') {
                await api.put(`/payroll/earnings/${item.id}`, { isActive: item.status !== 'Active' });
                fetchEarnings();
            } else if (item.category === 'Deduction') {
                await api.patch(`/deductions/${item.id}/status`, { isActive: item.status !== 'Active' });
                fetchDeductions();
            } else if (item.category === 'Benefit') {
                await api.patch(`/payroll/benefits/${item.id}/status`, { isActive: item.status !== 'Active' });
                fetchBenefits();
            }
            showToast('success', 'Success', 'Status updated successfully');
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleDelete = async (item) => {
        if (!canDelete) return;
        showConfirmToast({
            title: 'Delete Component',
            description: `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    if (item.category === 'Earning') await api.delete(`/payroll/earnings/${item.id}`);
                    else if (item.category === 'Deduction') await api.delete(`/deductions/${item.id}`);
                    else if (item.category === 'Benefit') await api.delete(`/payroll/benefits/${item.id}`);

                    if (item.category === 'Earning') fetchEarnings();
                    else if (item.category === 'Deduction') fetchDeductions();
                    else if (item.category === 'Benefit') fetchBenefits();

                    showToast('success', 'Success', 'Component deleted successfully');
                } catch (err) {
                    showToast('error', 'Error', err.response?.data?.error || 'Failed to delete component. It might be in use.');
                }
            }
        });
    };

    const handleAdd = (type) => {
        if (!canCreate) return;
        setDropdownOpen(false);
        if (type === 'Earning') navigate('/hr/payroll/earnings/new');
        else if (type === 'Deduction') navigate('/hr/payroll/deductions/new');
        else if (type === 'Benefit') navigate('/hr/payroll/benefits/new');
        else showToast('info', 'Info', `Coming soon: ${type}`);
    };

    const currentRefresh = () => {
        if (!canAccessListData) return;
        if (activeTab === 'earnings') fetchEarnings();
        else if (activeTab === 'deductions') fetchDeductions();
        else if (activeTab === 'benefits') fetchBenefits();
    };

    return (
        <div className="space-y-4 p-4 animate-in fade-in duration-500">

            {/* ── Header ─────────────────────────────────────────── */}
            {/* Outer wrapper: relative but NOT overflow-hidden so dropdown can escape */}
            <div className="relative rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                {/* Inner: overflow-hidden for background glow clipping only */}
                <div className="overflow-hidden bg-white dark:bg-slate-900 p-5 pr-56 rounded-2xl min-h-[72px] flex items-center">
                    <div className="relative z-10">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Salary Components
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Manage all salary structure elements, deductions, and benefits
                        </p>
                    </div>
                    {/* Background glow ornament (stays inside overflow-hidden) */}
                    <div className="absolute top-0 right-0 w-64 h-full bg-indigo-50/50 dark:bg-indigo-900/10 blur-3xl rounded-full pointer-events-none -mr-32 -mt-10" />
                </div>

                {/* Buttons: sit OUTSIDE overflow-hidden so dropdown is never clipped */}
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    {/* Refresh */}
                    <button
                        onClick={currentRefresh}
                        disabled={loading || !canAccessListData}
                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#4F46E5] transition shadow-sm"
                        title="Refresh"
                    >
                        <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {/* Bulk Upload */}
                    <button
                        onClick={() => setIsBulkUploadOpen(true)}
                        disabled={loading || !canCreate}
                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-600 transition shadow-sm"
                        title="Bulk Upload Excel"
                    >
                        <FileSpreadsheet size={16} strokeWidth={2.5} />
                    </button>

                    {/* Excel Salary Assignment */}
                    <button
                        onClick={() => navigate('/hr/payroll/salary-assignment-excel')}
                        disabled={loading || !canCreate}
                        className="h-9 px-4 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 transition shadow-sm font-bold text-[10px] uppercase tracking-wider"
                        title="Professional Excel Assignment"
                    >
                        <Calculator size={15} strokeWidth={2.5} />
                        Excel Assignment
                    </button>

                    {/* Add Component dropdown */}
                    {canCreate && <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-[#4F46E5] to-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-95 shadow-md"
                        >
                            <Plus size={14} strokeWidth={3} />
                            Add Component
                            <ChevronDown size={13} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden">
                                    {[
                                        { label: 'Add Earning', type: 'Earning', color: 'hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' },
                                        { label: 'Add Deduction', type: 'Deduction', color: 'hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20' },
                                        { label: 'Add Correction', type: 'Correction', color: 'hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' },
                                        { label: 'Add Benefit', type: 'Benefit', color: 'hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20' },
                                    ].map(({ label, type, color }) => (
                                        <button
                                            key={type}
                                            onClick={() => handleAdd(type)}
                                            className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 ${color} transition-colors`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>}
                </div>
            </div>

            {/* ── Stats ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Earnings" value={earnings.length} icon={<IndianRupee />} bgColor="bg-[#00c6a7]" tag="COMP" />
                <StatCard label="Deductions" value={deductions.length} icon={<TrendingDown />} bgColor="bg-[#f95d3a]" tag="DEDUCT" />
                <StatCard label="Benefits" value={benefits.length} icon={<Gift />} bgColor="bg-[#4d69ff]" tag="PERKS" />
                <StatCard label="Active Now" value={[...earnings, ...deductions, ...benefits].filter(x => x.status === 'Active').length} icon={<Layers />} bgColor="bg-[#ff8f00]" tag="LIVE" />
            </div>

            {/* ── Tabs ───────────────────────────────────────────── */}
            <div className="flex bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl w-fit border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm shadow-sm">
                {TABS.map(({ key, label, icon }) => {
                    const isActive = activeTab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                setActiveTab(key);
                                setSearchParams({ tab: key });
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${isActive
                                ? 'bg-white dark:bg-slate-900 text-[#4F46E5] shadow-sm ring-1 ring-slate-100 dark:ring-slate-700'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <span className={isActive ? 'text-[#4F46E5]' : 'text-slate-400 dark:text-slate-500'}>{icon}</span>
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── Table ──────────────────────────────────────────── */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'minWage' ? (
                    <MinimumWageMaster />
                ) : loading ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 flex flex-col items-center justify-center gap-3 shadow-sm">
                        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching components...</p>
                    </div>
                ) : (
                    <SalaryComponentTable
                        data={activeData}
                        onEdit={handleEdit}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        canEdit={canEdit}
                        canToggleStatus={canEdit}
                        canDelete={canDelete}
                    />
                )}
            </div>

            {/* ── Modals ────────────────────────────────────────── */}
            <BulkUploadComponentsModal
                isOpen={isBulkUploadOpen}
                onClose={() => setIsBulkUploadOpen(false)}
                onRefresh={currentRefresh}
                activeTab={activeTab}
            />
        </div>
    );
}
