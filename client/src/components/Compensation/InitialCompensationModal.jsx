import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Calendar, CheckCircle2, Info, PlusCircle, X, Calculator, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../../utils/api';
import debounce from 'lodash/debounce';

function formatDateInput(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
        return formatDateInput(new Date());
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatINR(value) {
    return Number(value || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
}

const CATEGORIES = [
    { id: 'UNSKILLED', label: 'Unskilled' },
    { id: 'SEMI_SKILLED', label: 'Semi-Skilled' },
    { id: 'SKILLED', label: 'Skilled' },
    { id: 'HIGHLY_SKILLED', label: 'Highly Skilled' },
    { id: 'GENERAL', label: 'General / Management' }
];

const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 
    'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir',
    'Puducherry', 'Chandigarh'
];

export default function InitialCompensationModal({ employee, applicant, onClose, onSuccess }) {
    const targetEntity = employee || applicant;
    const isApplicant = !!applicant;

    const [formData, setFormData] = useState({
        effectiveFrom: formatDateInput(targetEntity?.legacySource?.effectiveFrom || targetEntity?.joiningDate || new Date()),
        monthlyCTC: targetEntity?.legacySource?.totalCTC ? Math.round(targetEntity.legacySource.totalCTC / 12) : '',
        annualCTC: targetEntity?.legacySource?.totalCTC || '',
        employeeCategory: 'GENERAL',
        state: targetEntity?.workState || targetEntity?.state || 'Gujarat',
        templateId: '',
        reason: '',
        notes: '',
        autoCreatePayrollProfile: true
    });

    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [dbStates, setDbStates] = useState([]);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Fetch templates & minimum wage states on mount
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await api.get('/payroll/salary-templates');
                if (res.data?.success) setTemplates(res.data.data || []);
            } catch (err) {
                console.error('Failed to fetch templates:', err);
            }
        };
        const fetchMinWages = async () => {
            try {
                const res = await api.get('/payroll/minimum-wages');
                if (res.data?.success) {
                    const uniqueStates = [...new Set((res.data.data || []).map(item => item.state))].filter(Boolean);
                    setDbStates(uniqueStates);
                }
            } catch (err) {
                console.error('Failed to fetch minimum wages for states:', err);
            }
        };
        fetchTemplates();
        fetchMinWages();
    }, []);

    const allStates = useMemo(() => {
        const list = [...STATES];
        dbStates.forEach(s => {
            const exists = list.some(x => x.toLowerCase() === s.toLowerCase());
            if (!exists) {
                const formatted = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                list.push(formatted);
            }
        });
        return list.sort();
    }, [dbStates]);

    const fetchPreview = useCallback(
        debounce(async (data) => {
            if (!data.annualCTC || data.annualCTC <= 0) {
                setPreview(null);
                return;
            }
            setLoadingPreview(true);
            try {
                const res = await api.post('/payroll/calculate-breakup', {
                    annualCTC: data.annualCTC,
                    employeeCategory: data.employeeCategory,
                    state: data.state
                });
                if (res.data?.success) {
                    setPreview(res.data.data);
                }
            } catch (err) {
                console.error('Preview fetch failed:', err);
            } finally {
                setLoadingPreview(false);
            }
        }, 500),
        []
    );

    useEffect(() => {
        fetchPreview(formData);
    }, [formData.annualCTC, formData.employeeCategory, formData.state, fetchPreview]);

    const handleChange = (field, value) => {
        setFormData((current) => {
            const next = { ...current, [field]: value };
            
            // Sync monthly and annual CTC
            if (field === 'monthlyCTC') {
                next.annualCTC = value ? Number(value) * 12 : '';
            } else if (field === 'annualCTC') {
                next.monthlyCTC = value ? Math.round(Number(value) / 12) : '';
            }
            
            return next;
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        const totalCTC = Number(formData.annualCTC || 0);
        if (totalCTC <= 0) {
            setError('Please enter a valid Annual CTC.');
            return;
        }

        try {
            setSubmitting(true);
            
            let endpoint = `/compensation/setup/${targetEntity._id}`;
            let payload = {
                effectiveFrom: formData.effectiveFrom,
                totalCTC,
                employeeCategory: formData.employeeCategory,
                state: formData.state,
                reason: formData.reason,
                notes: formData.notes,
                autoCreatePayrollProfile: formData.autoCreatePayrollProfile
            };
            if (isApplicant) {
                endpoint = '/salary/candidate-setup';
                payload.applicantId = targetEntity._id;
            }

            const response = await api.post(endpoint, payload);

            if (response.data?.success) {
                onSuccess(response.data);
                return;
            }

            setError(response.data?.message || 'Failed to create initial salary setup.');
        } catch (requestError) {
            console.error('Initial compensation setup failed:', requestError);
            setError(requestError.response?.data?.message || requestError.message || 'Failed to create initial salary setup.');
        } finally {
            setSubmitting(false);
        }
    };

    const previewStatus = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const effectiveDate = new Date(formData.effectiveFrom);
        effectiveDate.setHours(0, 0, 0, 0);
        return effectiveDate > today ? 'SCHEDULED' : 'ACTIVE';
    }, [formData.effectiveFrom]);

    if (!targetEntity) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-hidden bg-white rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-slate-900 text-white px-8 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Automated Salary Setup</h2>
                            <p className="text-slate-400 text-sm">Configure minimum wage & structure logic</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition" disabled={submitting}>
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="grid lg:grid-cols-12 gap-0">
                        {/* Configuration Form */}
                        <div className="lg:col-span-7 p-8 border-r border-slate-100">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Employee Context Card */}
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                                            {targetEntity.firstName?.[0] || targetEntity.name?.[0] || '?'}{targetEntity.lastName?.[0] || ''}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 text-lg">{targetEntity.name || `${targetEntity.firstName} ${targetEntity.lastName}`}</div>
                                            <div className="text-slate-500 text-sm flex items-center gap-2">
                                                <span>{isApplicant ? 'Candidate' : targetEntity.employeeId}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{targetEntity.department || targetEntity.requirementId?.jobTitle || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</div>
                                        <div className="text-indigo-600 font-bold">{isApplicant ? (targetEntity.salaryAssigned ? 'Assigned' : 'Not Set') : (targetEntity.compensationStatus || 'Not Set')}</div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                                        <p className="text-sm text-rose-700 font-medium">{error}</p>
                                    </div>
                                )}

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Effective From *</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                                            <input
                                                type="date"
                                                value={formData.effectiveFrom}
                                                onChange={(e) => handleChange('effectiveFrom', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition font-medium"
                                                required
                                            />
                                        </div>
                                        <p className={`text-xs font-bold ${previewStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            ● {previewStatus === 'ACTIVE' ? 'Activates immediately' : `Scheduled for ${formData.effectiveFrom}`}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Employee Category *</label>
                                        <select
                                            value={formData.employeeCategory}
                                            onChange={(e) => handleChange('employeeCategory', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition font-medium"
                                        >
                                            {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Monthly CTC (Rs) *</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-3 font-bold text-slate-400 pointer-events-none">₹</div>
                                            <input
                                                type="number"
                                                value={formData.monthlyCTC}
                                                onChange={(e) => handleChange('monthlyCTC', e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition font-bold text-lg"
                                                placeholder="0.00"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Annual CTC (Rs) *</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-3 font-bold text-slate-400 pointer-events-none">₹</div>
                                            <input
                                                type="number"
                                                value={formData.annualCTC}
                                                onChange={(e) => handleChange('annualCTC', e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition font-bold text-lg"
                                                placeholder="0.00"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Work State (For Min Wage/PT)</label>
                                        <select
                                            value={formData.state}
                                            onChange={(e) => handleChange('state', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition font-medium"
                                        >
                                            {allStates.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Salary Template (Optional)</label>
                                        <select
                                            value={formData.templateId}
                                            onChange={(e) => handleChange('templateId', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition font-medium"
                                        >
                                            <option value="">No Template (Auto-Generate)</option>
                                            {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex-1 px-8 py-4 bg-slate-100 text-slate-700 rounded-2xl hover:bg-slate-200 transition font-bold"
                                            disabled={submitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-[2] px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                            disabled={submitting || !formData.annualCTC}
                                        >
                                            {submitting ? 'Setting up...' : (
                                                <>
                                                    <ShieldCheck className="h-5 w-5" />
                                                    Finalize & Create Setup
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Live Preview Panel */}
                        <div className="lg:col-span-5 bg-slate-50/50 p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Calculator className="h-5 w-5 text-indigo-600" />
                                    Live Salary Preview
                                </h3>
                                {preview?.minWageAmount > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg tracking-tighter">
                                        Min Wage Compliant
                                    </span>
                                )}
                            </div>

                            {!formData.annualCTC ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 border-2 border-dashed border-slate-200 rounded-3xl">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-300">
                                        <Calculator className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-400">No Preview Available</p>
                                        <p className="text-xs text-slate-400 mt-1">Enter CTC to see the automated structure</p>
                                    </div>
                                </div>
                            ) : loadingPreview ? (
                                <div className="space-y-4 animate-pulse">
                                    {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-200 rounded-xl w-full"></div>)}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Component Breakdown */}
                                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="text-left px-5 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Component</th>
                                                    <th className="text-right px-5 py-3 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Monthly (₹)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {preview?.earnings?.map(c => (
                                                    <tr key={c.code} className="group hover:bg-slate-50/50 transition">
                                                        <td className="px-5 py-4">
                                                            <div className="font-bold text-slate-700">{c.name}</div>
                                                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                                                                {c.basedOn === 'MW_OR_50PCT' ? (c.monthly === preview.minWageAmount ? 'Minimum Wage' : '50% of CTC') : c.basedOn}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                                                            {formatINR(c.monthly)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Deductions Heading */}
                                                <tr className="bg-slate-50/30">
                                                    <td colSpan="2" className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Statutory Deductions</td>
                                                </tr>
                                                {preview?.deductions?.map(c => (
                                                    <tr key={c.code} className="group hover:bg-slate-50/50 transition">
                                                        <td className="px-5 py-4 text-slate-600 font-medium">{c.name}</td>
                                                        <td className="px-5 py-4 text-right font-bold text-rose-500">
                                                            - {formatINR(c.monthly)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-emerald-600 p-5 rounded-3xl text-white shadow-lg shadow-emerald-600/20">
                                            <div className="text-[10px] font-black uppercase opacity-80 mb-1">Net In-Hand</div>
                                            <div className="text-xl font-black">₹{formatINR(preview?.totals?.takeHomeMonthly)}</div>
                                            <div className="text-[10px] mt-1 opacity-70">Per Month</div>
                                        </div>
                                        <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-lg shadow-slate-900/20">
                                            <div className="text-[10px] font-black uppercase opacity-60 mb-1">Total CTC</div>
                                            <div className="text-xl font-black">₹{formatINR(formData.annualCTC / 12)}</div>
                                            <div className="text-[10px] mt-1 opacity-50">Per Month</div>
                                        </div>
                                    </div>

                                    {/* Compliance Badge */}
                                    {preview?.minWageAmount > 0 && (
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-indigo-900 uppercase">Compliance Check</div>
                                                <p className="text-[11px] text-indigo-700 font-medium">
                                                    Basic salary is pinned to {formData.state} {formData.employeeCategory.toLowerCase()} min wage: ₹{formatINR(preview.minWageAmount)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
