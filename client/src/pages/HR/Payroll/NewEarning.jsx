import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import api from '../../../utils/api';
import usePagePermissions from '../../../hooks/usePagePermissions';

const EARNING_TYPES = [
    'Basic',
    'House Rent Allowance',
    'Conveyance Allowance',
    'Fixed Allowance',
    'Medical Allowance',
    'Bonus',
    'Commission',
    'Custom Allowance'
];

export default function NewEarning() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const { canCreate, canEdit } = usePagePermissions('payroll.salary');
    const canAccessForm = isEdit ? canEdit : canCreate;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [existingEarnings, setExistingEarnings] = useState([]);
    const [customDraft, setCustomDraft] = useState({ name: '', payslipName: '' });

    const [form, setForm] = useState({
        earningType: 'Basic',
        name: 'Basic',
        payslipName: 'Basic',
        payType: 'FIXED',
        calculationType: 'FLAT_AMOUNT',
        formula: '',
        formulaFrequency: 'MONTHLY',
        amount: '',
        percentage: '',
        isActive: true,
        isTaxable: true,
        isProRataBasis: true,
        includeInSalaryStructure: true,
        epf: {
            enabled: false,
            rule: 'ALWAYS'
        },
        esi: {
            enabled: false
        },
        showInPayslip: true,
        isUsedInPayroll: false
    });

    // Fetch data if in edit mode
    useEffect(() => {
        // Always fetch earnings list for duplicate validation; fetch details when editing
        const fetchEarningsList = async () => {
            try {
                const res = await api.get('/payroll/earnings');
                setExistingEarnings(res.data.data || []);
            } catch {
                // non-fatal
            }
        };
        fetchEarningsList();

        if (isEdit) {
            const fetchData = async () => {
                try {
                    setFetching(true);
                    const res = await api.get(`/payroll/earnings`);
                    const earnings = res.data.data;
                    const item = earnings.find(entry => entry._id === id);

                    if (item) {
                        setForm({
                            ...item,
                            earningType: item.isCustom ? 'Custom Allowance' : (item.name || 'Basic'),
                            amount: item.calculationType === 'FLAT_AMOUNT' ? item.amount : '',
                            // support both percentage variants used across UI/backends
                            percentage: (item.calculationType === 'PERCENTAGE_OF_BASIC' || item.calculationType === 'PERCENTAGE_OF_CTC') ? item.percentage : ''
                        });
                    } else {
                        setError('Earning component not found');
                    }
                } catch {
                    setError('Failed to fetch component details');
                } finally {
                    setFetching(false);
                }
            };
            fetchData();
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

    // Handle Type Change (Auto-fill names)
    const handleTypeChange = (e) => {
        const type = e.target.value;
        const updates = { earningType: type };

        if (type === 'Custom Allowance') {
            // Restore any draft custom values (usually blank unless user typed earlier)
            updates.name = customDraft.name || '';
            updates.payslipName = customDraft.payslipName || '';
        } else {
            updates.name = type;
            updates.payslipName = type === 'House Rent Allowance' ? 'HRA' : type;
            // Clear any previously typed custom draft when switching back to predefined
            setCustomDraft({ name: '', payslipName: '' });
        }
        setForm(prev => ({ ...prev, ...updates }));
        setFieldErrors({});
    };

    // Handle Input Changes
    const handleChange = (field, value) => {
        // Allow typing, but keep a draft when this is a custom component
        if (form.earningType === 'Custom Allowance') {
            const nextDraft = { ...customDraft, [field]: value };
            setCustomDraft(nextDraft);
            setForm(prev => ({ ...prev, [field]: value }));
            setFieldErrors(prev => ({ ...prev, [field]: undefined }));
        } else {
            // If changing calculationType, clear the opposite input to avoid stale values
            if (field === 'calculationType') {
                const calc = value;
                setForm(prev => ({
                    ...prev,
                    calculationType: calc,
                    // when switching to FLAT_AMOUNT keep amount (user may have filled it)
                    // when switching to percentage types, clear amount to avoid accidental mapping
                    amount: calc === 'FLAT_AMOUNT' ? prev.amount : '',
                    // when switching to percentage types keep percentage (user may have filled it)
                    // when switching to FLAT_AMOUNT, clear percentage
                    percentage: calc === 'FLAT_AMOUNT' ? '' : prev.percentage
                }));
                setFieldErrors(prev => ({ ...prev, calculationType: undefined }));
            } else {
                setForm(prev => ({ ...prev, [field]: value }));
                setFieldErrors(prev => ({ ...prev, [field]: undefined }));
            }
        }

        if (field === 'name' && !form.payslipName) {
            setForm(prev => ({ ...prev, payslipName: value }));
        }
    };

    const handleCheckbox = (field, checked) => {
        setForm(prev => ({ ...prev, [field]: checked }));
    };

    const handleEPFChange = (enabled) => {
        setForm(prev => ({
            ...prev,
            epf: { ...prev.epf, enabled }
        }));
    };

    const handleEPFRuleChange = (rule) => {
        setForm(prev => ({
            ...prev,
            epf: { ...prev.epf, rule }
        }));
    };

    const handleESIChange = (enabled) => {
        setForm(prev => ({
            ...prev,
            esi: { ...prev.esi, enabled }
        }));
    };

    const validate = () => {
        const errs = {};
        const name = (form.name || '').toString();

        if (!name.trim()) errs.name = 'Earning Name is required';
        else if (name !== name.trim()) errs.name = 'No leading or trailing spaces allowed';

        if (form.calculationType === 'FORMULA' && !form.formula.trim()) errs.formula = 'Formula is required';
        if (form.calculationType === 'FLAT_AMOUNT' && (form.amount === '' || Number(form.amount) < 0)) errs.amount = 'Valid amount is required';
        else if ((form.calculationType === 'PERCENTAGE_OF_BASIC' || form.calculationType === 'PERCENTAGE_OF_CTC') && (form.percentage === '' || Number(form.percentage) < 0 || Number(form.percentage) > 100)) errs.percentage = 'Valid Percentage (0-100) is required';

        const normalized = name.trim().toLowerCase();
        if (normalized) {
            const dup = existingEarnings.find(e => e.name && e.name.toString().toLowerCase() === normalized && e._id !== id);
            if (dup) errs.name = 'An earning with this name already exists';
        }

        setFieldErrors(errs);
        return Object.keys(errs).length ? errs : null;
    };

    const handleSubmit = async () => {
        const errs = validate();
        if (errs) {
            setError('Please fix the highlighted errors');
            return;
        }

        try {
            setError(null);
            setLoading(true);

            const payload = {
                earningType: form.earningType,
                name: form.name.trim(),
                payslipName: (form.payslipName && form.payslipName.trim()) || form.name.trim(),
                isCustom: form.earningType === 'Custom Allowance',
                taxable: !!form.isTaxable,
                partOfCTC: !!form.includeInSalaryStructure,
                proRata: !!form.isProRataBasis,
                showInPayslip: !!form.showInPayslip,
                payType: form.payType,
                calculationType: form.calculationType,
                formula: form.formula,
                formulaFrequency: form.formulaFrequency,
                isActive: !!form.isActive,
                isUsedInPayroll: !!form.isUsedInPayroll,
                epf: form.epf || {},
                esi: form.esi || {}
            };
            if (form.calculationType === 'FLAT_AMOUNT') {
                payload.amount = Number(form.amount);
                payload.percentage = 0;
            } else if (form.calculationType !== 'FORMULA') {
                payload.amount = 0;
                payload.percentage = Number(form.percentage);
            } else {
                payload.amount = 0;
                payload.percentage = 0;
            }

            if (isEdit) {
                await api.put(`/payroll/earnings/${id}`, payload);
            } else {
                await api.post('/payroll/earnings', payload);
            }
            navigate('/hr/payroll/salary-components');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save earning');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-xl font-bold text-slate-900">{isEdit ? `Edit ${form.name || 'Earning'}` : 'New Earning'}</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm flex items-center gap-2">
                        <Info size={16} /> {error}
                    </div>
                )}

                {fetching ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                        <p className="text-slate-500 font-medium">Fetching earning details...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Earning Type <span className="text-rose-500">*</span></label>
                                    <select
                                        value={form.earningType}
                                        disabled={form.isUsedInPayroll}
                                        onChange={handleTypeChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {EARNING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                {form.earningType === 'Custom Allowance' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Earning Name <span className="text-rose-500">*</span></label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => handleChange('name', e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g. Special Allowance"
                                        />
                                        {fieldErrors.name && <p className="text-rose-600 text-xs mt-1">{fieldErrors.name}</p>}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Calculation Type <span className="text-rose-500">*</span></label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="calcType" checked={form.calculationType === 'FLAT_AMOUNT'} onChange={() => handleChange('calculationType', 'FLAT_AMOUNT')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Flat Amount</span>
                                        </label>
                                        {form.earningType !== 'Basic' && (
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input type="radio" name="calcType" checked={form.calculationType === 'PERCENTAGE_OF_BASIC'} onChange={() => handleChange('calculationType', 'PERCENTAGE_OF_BASIC')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Percent of Basic</span>
                                            </label>
                                        )}
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="calcType" checked={form.calculationType === 'PERCENTAGE_OF_CTC'} onChange={() => handleChange('calculationType', 'PERCENTAGE_OF_CTC')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Percent of CTC</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="calcType" checked={form.calculationType === 'FORMULA'} onChange={() => handleChange('calculationType', 'FORMULA')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Custom Formula</span>
                                        </label>
                                    </div>

                                    <div>
                                        {form.calculationType === 'FLAT_AMOUNT' && (
                                            <div className="relative max-w-xs">
                                                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={form.amount}
                                                    onChange={e => handleChange('amount', e.target.value)}
                                                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                    placeholder="0.00"
                                                />
                                                {fieldErrors.amount && <p className="text-rose-600 text-xs mt-1">{fieldErrors.amount}</p>}
                                            </div>
                                        )}

                                        {(form.calculationType === 'PERCENTAGE_OF_BASIC' || form.calculationType === 'PERCENTAGE_OF_CTC') && (
                                            <div className="relative max-w-xs">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={form.percentage}
                                                    onChange={e => handleChange('percentage', e.target.value)}
                                                    className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                    placeholder="0.00"
                                                />
                                                <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                                                {fieldErrors.percentage && <p className="text-rose-600 text-xs mt-1">{fieldErrors.percentage}</p>}
                                            </div>
                                        )}

                                        {form.calculationType === 'FORMULA' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Formula Expression</label>
                                                    <textarea
                                                        value={form.formula}
                                                        onChange={e => handleChange('formula', e.target.value)}
                                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                        rows="2"
                                                        placeholder="e.g. (BASIC + HRA) * 0.1"
                                                    />
                                                    {fieldErrors.formula && <p className="text-rose-600 text-xs mt-1">{fieldErrors.formula}</p>}
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

                                <div className="pt-4 border-t border-slate-100">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.isActive}
                                            onChange={(e) => handleCheckbox('isActive', e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Mark this earning as Active</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="md:col-span-1 space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Configuration</h3>
                                <div className="space-y-4">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={form.includeInSalaryStructure}
                                            onChange={(e) => handleCheckbox('includeInSalaryStructure', e.target.checked)}
                                            className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="text-sm">
                                            <span className="font-medium text-slate-700 block group-hover:text-blue-600 transition-colors">part of salary structure</span>
                                            <span className="text-xs text-slate-400">Component appears in CTC</span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={form.isTaxable}
                                            onChange={(e) => handleCheckbox('isTaxable', e.target.checked)}
                                            className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="text-sm">
                                            <span className="font-medium text-slate-700 block group-hover:text-blue-600 transition-colors">Is Taxable</span>
                                            <span className="text-xs text-slate-400">Subject to TDS</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-start gap-3 group ${form.isUsedInPayroll ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                        <input
                                            type="checkbox"
                                            disabled={form.isUsedInPayroll}
                                            checked={form.isProRataBasis}
                                            onChange={(e) => handleCheckbox('isProRataBasis', e.target.checked)}
                                            className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="text-sm">
                                            <span className="font-medium text-slate-700 block group-hover:text-blue-600 transition-colors">Pro-rata Basis</span>
                                            <span className="text-xs text-slate-400">Calculated based on attendance</span>
                                        </div>
                                    </label>

                                    <div className="my-4 border-t border-slate-100"></div>

                                    {/* EPF */}
                                    <div className="space-y-3">
                                        <label className={`flex items-center gap-3 ${form.isUsedInPayroll ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                disabled={form.isUsedInPayroll}
                                                checked={form.epf.enabled}
                                                onChange={(e) => handleEPFChange(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Consider for EPF</span>
                                        </label>

                                        {form.epf.enabled && (
                                            <div className="pl-7 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="epfRule"
                                                        checked={form.epf.rule === 'ALWAYS'}
                                                        onChange={() => handleEPFRuleChange('ALWAYS')}
                                                        className="w-3 h-3 text-blue-600 border-slate-300 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs text-slate-600">Always</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="epfRule"
                                                        checked={form.epf.rule === 'PF_WAGE_LT_15000'}
                                                        onChange={() => handleEPFRuleChange('PF_WAGE_LT_15000')}
                                                        className="w-3 h-3 text-blue-600 border-slate-300 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs text-slate-600">Only when PF Wage &lt; ₹15k</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>

                                    {/* ESI */}
                                    <div className="pt-2">
                                        <label className={`flex items-center gap-3 ${form.isUsedInPayroll ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                disabled={form.isUsedInPayroll}
                                                checked={form.esi.enabled}
                                                onChange={(e) => handleESIChange(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Consider for ESI</span>
                                        </label>
                                    </div>

                                    <div className="my-4 border-t border-slate-100"></div>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.showInPayslip}
                                            onChange={(e) => handleCheckbox('showInPayslip', e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Show in Payslip</span>
                                    </label>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    <span className="font-bold">Note:</span> Once this component is associated with an employee, only Name and Amount can be edited to maintain payroll integrity.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || fetching}
                        className="px-8 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEdit ? 'Update Earning' : 'Save Earning'}
                    </button>
                </div>
            </div>
        </div>
    );
}
