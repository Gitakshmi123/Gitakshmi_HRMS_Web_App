import React, { useState, useEffect } from 'react';
import { IndianRupee, Plus, Trash2, Calculator, Check, AlertTriangle } from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

function SectionLabel({ children }) {
    return <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{children}</p>;
}

function NumField({ label, value, onChange, required, placeholder }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-400 outline-none" />
        </div>
    );
}

function ReadOnlyField({ label, value }) {
    const display = value !== '' && value !== undefined && value !== null ? Number(value).toLocaleString('en-IN') : '—';
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>
            <div className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                {display}
            </div>
        </div>
    );
}

function CalcRow({ label, amount, deduction }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className={deduction ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}>
                {deduction ? '-' : '+'}₹{fmt(Math.abs(amount))}
            </span>
        </div>
    );
}

function applyFNFDataToForm(prev, d) {
    return {
        ...prev,
        monthlyCTC: d.monthlyCTC ?? prev.monthlyCTC,
        basicSalary: d.basicSalary ?? prev.basicSalary,
        allowances: d.allowances ?? prev.allowances,
        annualCTC: d.annualCTC ?? prev.annualCTC,
        workedDays: d.workedDays ?? prev.workedDays,
        totalWorkingDays: d.totalWorkingDays ?? prev.totalWorkingDays,
        leaveEncashmentDays: d.leaveEncashmentDays ?? prev.leaveEncashmentDays,
        gratuityAmount: d.gratuityAmount ?? prev.gratuityAmount,
        deductions: (d.deductions && d.deductions.length) ? d.deductions.map(x => ({ label: x.label || '', amount: x.amount ?? '' })) : prev.deductions,
    };
}

export default function FNFSettlementPanel({ request, onUpdate }) {
    const existing = request.fnfSettlement || {};
    const [form, setForm] = useState({
        monthlyCTC:          existing.monthlyCTC          || '',
        basicSalary:         existing.basicSalary         ?? '',
        allowances:         existing.allowances          ?? '',
        annualCTC:          existing.annualCTC           ?? '',
        workedDays:          existing.workedDays         || '',
        totalWorkingDays:    existing.totalWorkingDays    || 26,
        leaveEncashmentDays: existing.leaveEncashmentDays || 0,
        gratuityAmount:      existing.gratuityAmount      || 0,
        remarks:             existing.remarks             || '',
        deductions:          existing.deductions?.length
            ? existing.deductions.map(d => ({ ...d }))
            : [{ label: 'Notice Pay Shortage', amount: '' }],
    });
    const [saving, setSaving] = useState(false);
    const [loadingSuggested, setLoadingSuggested] = useState(false);
    const [salaryStructureLoaded, setSalaryStructureLoaded] = useState(false);
    const [noSalaryStructure, setNoSalaryStructure] = useState(false);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const loadSuggestedFNF = async () => {
        try {
            setLoadingSuggested(true);
            setNoSalaryStructure(false);
            const res = await exitAPI.getCalculateFNF(request._id);
            const d = res?.data;
            if (d) {
                setForm(prev => applyFNFDataToForm(prev, d));
                setSalaryStructureLoaded(true);
                setNoSalaryStructure(d.salaryStructureFound === false);
                if (d.salaryStructureFound === false) {
                    toast.error('No salary structure found for this employee. Please add compensation or salary structure in HR.');
                } else {
                    toast.success('Suggested FNF breakdown loaded. Review and save.');
                }
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not load suggested FNF.');
        } finally {
            setLoadingSuggested(false);
        }
    };

    // Auto-fetch salary structure and pre-fill when FNF panel loads (stage FNF, not yet processed)
    useEffect(() => {
        if (request.stage !== 'FNF' || request.fnfProcessed || !request._id || salaryStructureLoaded) return;
        let cancelled = false;
        (async () => {
            try {
                setLoadingSuggested(true);
                setNoSalaryStructure(false);
                const res = await exitAPI.getCalculateFNF(request._id);
                const d = res?.data;
                if (!cancelled && d) {
                    setForm(prev => applyFNFDataToForm(prev, d));
                    setSalaryStructureLoaded(true);
                    setNoSalaryStructure(d.salaryStructureFound === false);
                }
            } catch (_) {
                if (!cancelled) setSalaryStructureLoaded(true);
            } finally {
                if (!cancelled) setLoadingSuggested(false);
            }
        })();
        return () => { cancelled = true; };
    }, [request._id, request.stage, request.fnfProcessed, salaryStructureLoaded]);

    // Live calculations
    const dailyRate             = form.monthlyCTC && form.totalWorkingDays ? form.monthlyCTC / form.totalWorkingDays : 0;
    const basicSalaryPayable    = Math.round(dailyRate * (form.workedDays || 0));
    const leaveEncashmentAmount = Math.round(dailyRate * (form.leaveEncashmentDays || 0));
    const grossPayable          = basicSalaryPayable + leaveEncashmentAmount + Number(form.gratuityAmount || 0);
    const totalDeductions       = form.deductions.reduce((s, d) => s + Number(d.amount || 0), 0);
    const netPayable            = grossPayable - totalDeductions;

    const addDeduction    = () => setForm(p => ({ ...p, deductions: [...p.deductions, { label: '', amount: '' }] }));
    const removeDeduction = (i) => setForm(p => ({ ...p, deductions: p.deductions.filter((_, j) => j !== i) }));
    const setDeduction    = (i, k, v) => setForm(p => ({
        ...p,
        deductions: p.deductions.map((d, j) => j === i ? { ...d, [k]: v } : d)
    }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.monthlyCTC || !form.workedDays)
            return toast.error('Monthly CTC and Worked Days are required.');
        try {
            setSaving(true);
            await exitAPI.processFNF(request._id, {
                monthlyCTC:          Number(form.monthlyCTC),
                workedDays:          Number(form.workedDays),
                totalWorkingDays:    Number(form.totalWorkingDays),
                leaveEncashmentDays: Number(form.leaveEncashmentDays),
                gratuityAmount:      Number(form.gratuityAmount),
                deductions:          form.deductions.filter(d => d.label && d.amount).map(d => ({ label: d.label, amount: Number(d.amount) })),
                remarks:             form.remarks
            });
            toast.success('FNF settlement processed!');
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to process FNF.');
        } finally {
            setSaving(false);
        }
    };

    if (request.stage !== 'FNF') return null;

    if (request.fnfProcessed) {
        const s = request.fnfSettlement;
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-cyan-200 dark:border-cyan-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                        <Check size={17} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">FNF Settlement Processed</h3>
                        <p className="text-cyan-100 text-xs">Processed on {s?.processedAt ? new Date(s.processedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <FNFSummary s={s} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-cyan-200 dark:border-cyan-800 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <IndianRupee size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">Full & Final Settlement</h3>
                        <p className="text-cyan-100 text-xs mt-0.5">Calculate and process employee's final dues.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={loadSuggestedFNF}
                    disabled={loadingSuggested || saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium disabled:opacity-50"
                >
                    <Calculator size={16} />
                    {loadingSuggested ? 'Loading…' : 'Reload from salary structure'}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {loadingSuggested && !salaryStructureLoaded && (
                    <div className="flex items-center gap-2 py-2 text-sm text-cyan-600 dark:text-cyan-400">
                        <Calculator size={16} className="animate-pulse" />
                        <span>Loading salary structure and calculating FNF…</span>
                    </div>
                )}
                {salaryStructureLoaded && noSalaryStructure && (
                    <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-800 dark:text-amber-200">Salary structure not configured</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">No salary structure found for this employee. Please add Compensation or Salary Structure for this employee in HR before processing FNF.</p>
                        </div>
                    </div>
                )}
                {/* Salary structure (from employee – auto-filled) */}
                <div>
                    <SectionLabel>Salary Structure (from employee record)</SectionLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                        <ReadOnlyField label="Annual CTC (₹)" value={form.annualCTC} />
                        <NumField label="Monthly CTC (₹)" value={form.monthlyCTC} onChange={v => set('monthlyCTC', v)} required placeholder="Auto from Annual CTC / 12" />
                        <ReadOnlyField label="Basic Salary (₹/mo)" value={form.basicSalary} />
                        <ReadOnlyField label="Allowances (₹/mo)" value={form.allowances} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Monthly CTC is derived from Annual CTC. You can adjust if needed. Proration: (Worked Days / Working Days) × Monthly CTC.</p>
                </div>

                {/* Editable salary inputs for FNF */}
                <div>
                    <SectionLabel>FNF Parameters</SectionLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <NumField label="Worked Days" value={form.workedDays} onChange={v => set('workedDays', v)} required placeholder="e.g. 23" />
                        <NumField label="Working Days/Month" value={form.totalWorkingDays} onChange={v => set('totalWorkingDays', v)} placeholder="Default: 26" />
                        <NumField label="Leave Encashment Days" value={form.leaveEncashmentDays} onChange={v => set('leaveEncashmentDays', v)} placeholder="Auto from balance" />
                    </div>
                </div>

                <div>
                    <NumField label="Gratuity Amount (₹)" value={form.gratuityAmount} onChange={v => set('gratuityAmount', v)} placeholder="0 if not applicable" />
                </div>

                {/* Deductions */}
                <div>
                    <SectionLabel>Deductions</SectionLabel>
                    <div className="space-y-2">
                        {form.deductions.map((d, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    value={d.label}
                                    onChange={e => setDeduction(i, 'label', e.target.value)}
                                    placeholder="Deduction label (e.g. Notice Pay Shortage)"
                                    className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-400 outline-none"
                                />
                                <input
                                    type="number"
                                    value={d.amount}
                                    onChange={e => setDeduction(i, 'amount', e.target.value)}
                                    placeholder="Amount"
                                    className="w-28 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-400 outline-none"
                                />
                                <button type="button" onClick={() => removeDeduction(i)}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={addDeduction}
                            className="flex items-center gap-1.5 text-sm text-cyan-600 font-semibold hover:text-cyan-700 mt-1"
                        >
                            <Plus size={14} /> Add Deduction
                        </button>
                    </div>
                </div>

                {/* Remarks */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">FNF Remarks</label>
                    <textarea rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)}
                        placeholder="Additional notes about the settlement..."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-400 outline-none resize-none"
                    />
                </div>

                {/* Live calculation preview */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <Calculator size={14} className="text-cyan-500" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Settlement Preview</span>
                    </div>
                    <div className="p-5 space-y-2">
                        <CalcRow label={`Basic Salary (${form.workedDays || '?'}/${form.totalWorkingDays} days)`} amount={basicSalaryPayable} />
                        {Number(form.leaveEncashmentDays) > 0 && (
                            <CalcRow label={`Leave Encashment (${form.leaveEncashmentDays} days)`} amount={leaveEncashmentAmount} />
                        )}
                        {Number(form.gratuityAmount) > 0 && (
                            <CalcRow label="Gratuity" amount={Number(form.gratuityAmount)} />
                        )}
                        <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-slate-600 dark:text-slate-400">Gross Payable</span>
                            <span className="text-slate-800 dark:text-white">₹{fmt(grossPayable)}</span>
                        </div>
                        {form.deductions.filter(d => d.label && d.amount).map((d, i) => (
                            <CalcRow key={i} label={d.label} amount={-Number(d.amount)} deduction />
                        ))}
                        {totalDeductions > 0 && (
                            <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-rose-600">Total Deductions</span>
                                <span className="text-rose-600">-₹{fmt(totalDeductions)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-3 border-t-2 border-slate-300 dark:border-slate-600 mt-2">
                            <span className="font-black text-slate-800 dark:text-white">NET PAYABLE</span>
                            <span className={`text-2xl font-black ${netPayable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                ₹{fmt(netPayable)}
                            </span>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={saving || noSalaryStructure}
                    className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-cyan-500/25 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                >
                    <IndianRupee size={15} /> {saving ? 'Processing...' : 'Process FNF Settlement'}
                </button>
            </form>
        </div>
    );
}

/* ── Sub-component (used after FNF processed) ───────────────────────────────── */
function FNFSummary({ s }) {
    if (!s) return null;
    return (
        <div className="space-y-2 text-sm">
            <CalcRow label={`Basic Salary (${s.workedDays}/${s.totalWorkingDays} days)`} amount={s.basicSalaryPayable} />
            {s.leaveEncashmentDays > 0 && <CalcRow label={`Leave Encashment (${s.leaveEncashmentDays} days)`} amount={s.leaveEncashmentAmount} />}
            {s.gratuityAmount > 0 && <CalcRow label="Gratuity" amount={s.gratuityAmount} />}
            <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Gross Payable</span>
                <span>₹{fmt(s.grossPayable)}</span>
            </div>
            {s.deductions?.map((d, i) => <CalcRow key={i} label={d.label} amount={d.amount} deduction />)}
            {s.totalDeductions > 0 && (
                <div className="flex justify-between font-semibold text-rose-600 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>Total Deductions</span><span>-₹{fmt(s.totalDeductions)}</span>
                </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t-2 border-slate-300 dark:border-slate-600">
                <span className="font-black text-slate-800 dark:text-white">NET PAYABLE</span>
                <span className={`text-2xl font-black ${s.netPayable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{fmt(s.netPayable)}
                </span>
            </div>
            {s.remarks && <p className="text-xs text-slate-400 pt-1">Note: {s.remarks}</p>}
        </div>
    );
}
