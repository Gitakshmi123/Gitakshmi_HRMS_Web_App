import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Info, Loader2, ShieldCheck, CreditCard } from 'lucide-react';
import api from '../../../../utils/api';
import usePagePermissions from '../../../../hooks/usePagePermissions';

const PRE_TAX_TYPES = [
    { value: 'PF_EMPLOYEE', label: 'Employee PF Contribution' },
    { value: 'VPF', label: 'Voluntary PF (VPF)' },
    { value: 'NPS_EMPLOYEE', label: 'Employee NPS' },
    { value: 'INSURANCE_PREMIUM', label: 'Insurance Premium' },
    { value: 'SALARY_SACRIFICE', label: 'Salary Sacrifice' },
    { value: 'PRE_TAX_ADJUSTMENT', label: 'Pre-Tax Adjustment' },
];

const POST_TAX_TYPES = [
    { value: 'NOTICE_PAY', label: 'Notice Pay' },
    { value: 'WITHHELD_SALARY', label: 'Withheld Salary' },
    { value: 'LOP', label: 'Loss of Pay (LOP)' },
    { value: 'LATE_PENALTY', label: 'Late Penalty' },
    { value: 'LOAN_EMI', label: 'Loan EMI' },
    { value: 'ADVANCE_RECOVERY', label: 'Advance Recovery' },
    { value: 'ASSET_RECOVERY', label: 'Asset Recovery' },
    { value: 'BENEFIT_RECOVERY', label: 'Benefit Recovery' },
    { value: 'PENALTY', label: 'Penalty' },
    { value: 'CHARITY', label: 'Charity' },
    { value: 'CUSTOM', label: 'Custom Deduction' },
];

export default function NewDeduction() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const categoryFromQuery = searchParams.get('category') || 'PRE_TAX';

    const isEdit = Boolean(id);
    const { canCreate, canEdit } = usePagePermissions('payroll.salary');
    const canAccessForm = isEdit ? canEdit : canCreate;
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        name: '',
        category: categoryFromQuery,
        amountType: 'FIXED',
        amountValue: '',
        formula: '',
        formulaFrequency: 'MONTHLY',
        calculationBase: 'BASIC',
        recurring: true,
        isActive: true
    });

    useEffect(() => {
        if (isEdit) {
            const fetchDeduction = async () => {
                try {
                    setFetching(true);
                    const res = await api.get('/deductions');
                    const deduction = res.data.data.find(entry => entry._id === id);
                    if (deduction) {
                        setForm(deduction);
                    } else {
                        setError('Deduction not found');
                    }
                } catch {
                    setError('Failed to fetch deduction details');
                } finally {
                    setFetching(false);
                }
            };
            fetchDeduction();
        }
    }, [id, isEdit]);

    if (!canAccessForm) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit access disabled' : 'Create access disabled'}</h2>
                    <p className="text-sm text-slate-500 mt-2">Only enabled payroll actions should open on this page.</p>
                </div>
            </div>
        );
    }

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const validate = () => {
        if (form.amountType === 'FORMULA' && !form.formula?.trim()) return 'Formula is required';
        if (form.amountType !== 'FORMULA') {
            if (form.amountValue === '' || form.amountValue === null || form.amountValue === undefined) return 'Amount/Percentage is required';
            if (Number(form.amountValue) < 0) return 'Amount/Percentage cannot be negative';
            if (form.amountType === 'PERCENTAGE' && Number(form.amountValue) > 100) return 'Percentage cannot exceed 100%';
        }
        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) {
            setError(err);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (isEdit) {
                await api.put(`/deductions/${id}`, {
                    ...form,
                    formula: form.amountType === 'FORMULA' ? form.formula : '',
                    formulaFrequency: form.formulaFrequency
                });
            } else {
                await api.post('/deductions/create', {
                    ...form,
                    formula: form.amountType === 'FORMULA' ? form.formula : '',
                    formulaFrequency: form.formulaFrequency
                });
            }

            navigate('/hr/payroll/salary-components?tab=deductions');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save deduction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Deduction' : 'New Deduction'}</h1>
                                <p className="text-xs text-slate-500 font-medium">Configure tenant-wise payroll deduction component</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <span className="flex-1 shrink-0"><Info size={18} /></span> {error}
                    </div>
                )}

                {fetching ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">Loading record details...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* MAIN FORM */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                                        <CreditCard size={16} className="text-blue-600" />
                                        Basic Information
                                    </h2>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Deduction Name <span className="text-rose-500">*</span></label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => handleChange('name', e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="e.g. Employee State Insurance"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Category <span className="text-rose-500">*</span></label>
                                        <select
                                            value={form.category}
                                            onChange={e => handleChange('category', e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                        >
                                            <option value="PRE_TAX">Pre-Tax Deduction</option>
                                            <option value="POST_TAX">Post-Tax Deduction</option>
                                        </select>
                                    </div>

                                    {/* Calculation */}
                                    <div className="space-y-4">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Calculation Configuration</label>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Amount Type</span>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" checked={form.amountType === 'FIXED'} onChange={() => handleChange('amountType', 'FIXED')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Fixed</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" checked={form.amountType === 'PERCENTAGE'} onChange={() => handleChange('amountType', 'PERCENTAGE')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Percentage</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" checked={form.amountType === 'FORMULA'} onChange={() => handleChange('amountType', 'FORMULA')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Formula</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {form.amountType === 'PERCENTAGE' && (
                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Calculation Base</span>
                                                    <select
                                                        value={form.calculationBase}
                                                        onChange={e => handleChange('calculationBase', e.target.value)}
                                                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none border-none p-0 focus:ring-0"
                                                    >
                                                        <option value="BASIC">Basic Salary</option>
                                                        <option value="GROSS">Gross Salary</option>
                                                        <option value="CTC">Total CTC</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="relative">
                                            {form.amountType !== 'FORMULA' ? (
                                                <>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Value ({form.amountType === 'FIXED' ? '₹' : '%'})</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={form.amountValue}
                                                            onChange={e => handleChange('amountValue', e.target.value)}
                                                            className="w-full p-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                                            placeholder="0.00"
                                                        />
                                                        <span className="absolute left-3 top-3.5 text-slate-400 font-bold text-xs">{form.amountType === 'FIXED' ? '₹' : '%'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Formula Expression</label>
                                                        <textarea
                                                            value={form.formula}
                                                            onChange={e => handleChange('formula', e.target.value)}
                                                            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                            rows="2"
                                                            placeholder="e.g. (BASIC + HRA) * 0.05"
                                                        />
                                                        <p className="text-[10px] text-slate-400 mt-2">Available: BASIC, HRA, GROSS, CTC, NET</p>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <select
                                                            value={form.formulaFrequency}
                                                            onChange={e => handleChange('formulaFrequency', e.target.value)}
                                                            className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600"
                                                        >
                                                            <option value="MONTHLY">Monthly Result</option>
                                                            <option value="ANNUAL">Annual Result</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                                        Frequency & Status
                                    </h2>
                                </div>
                                <div className="p-6 grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Deduction Frequency</label>
                                        <div className="flex gap-4">
                                            {[
                                                { label: 'Recurring', value: true },
                                                { label: 'One Time', value: false }
                                            ].map(f => (
                                                <button
                                                    key={f.label}
                                                    type="button"
                                                    onClick={() => handleChange('recurring', f.value)}
                                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${form.recurring === f.value
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 flex items-center ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${form.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                            <input type="checkbox" checked={form.isActive} onChange={e => handleChange('isActive', e.target.checked)} className="hidden" />
                                            <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">Active Status</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* INFO PANEL */}
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-blue-600" />
                                    Compliance Info
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-xl">
                                        <h4 className="text-xs font-bold text-blue-900 mb-1">
                                            {form.category === 'PRE_TAX' ? 'Pre-Tax Impact' : 'Post-Tax Impact'}
                                        </h4>
                                        <p className="text-[11px] text-blue-700 leading-relaxed">
                                            {form.category === 'PRE_TAX'
                                                ? 'This deduction reduces the Taxable Income of the employee. It is applied BEFORE Income Tax calculation.'
                                                : 'This deduction does NOT affect tax calculations. It is subtracted from the Net Salary after TDS.'
                                            }
                                        </p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-900 mb-1">Calculation Logic</h4>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">
                                            {form.amountType === 'PERCENTAGE'
                                                ? `Calculated as ${form.amountValue || 'X'}% of ${form.calculationBase === 'BASIC' ? 'Basic Salary' : 'Gross Earnings'}.`
                                                : "Calculated as a flat fixed amount during payroll processing."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Deduction'}
                            </button>
                            <button
                                onClick={() => navigate(-1)}
                                className="w-full bg-white hover:bg-slate-50 text-slate-600 font-bold py-4 rounded-2xl border border-slate-200 transition-all"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
