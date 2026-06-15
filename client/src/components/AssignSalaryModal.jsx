import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';

/**
 * ============================================
 * ASSIGN SALARY MODAL (v9.0) - STABILIZED
 * ============================================
 * 
 * CORE PRINCIPLES:
 * 1. HR enters ONLY CTC
 * 2. Backend is the SINGLE SOURCE OF TRUTH (v8.1 Engine)
 * 3. Supports Snapshot Loading and Live Calculation
 * 4. Strict Contract: { monthly, yearly }
 */

export default function AssignSalaryModal({
    isOpen,
    onClose,
    applicant,
    employee, // Added employee support
    onSuccess
}) {
    const [ctcAnnual, setCtcAnnual] = useState('');
    const [salaryData, setSalaryData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState(null);

    const targetId = applicant?._id || employee?._id;
    const targetType = applicant ? 'applicantId' : 'employeeId';

    // Calculate total calculated CTC and mismatch flag
    const earningsYearly = salaryData?.earnings?.reduce((sum, e) => sum + (e.yearly || 0), 0) || 0;
    const benefitsYearly = salaryData?.benefits?.reduce((sum, b) => sum + (b.yearly || 0), 0) || 0;
    const calculatedCTC = earningsYearly + benefitsYearly;
    const targetCTC = Number(ctcAnnual) || salaryData?.annualCTC || 0;
    const ctcDifference = calculatedCTC - targetCTC;
    const isMismatched = targetCTC > 0 && Math.abs(ctcDifference) > 1.01;

    // Load existing salary snapshot or default preview
    const loadSalary = useCallback(async () => {
        if (!isOpen || !targetId) return;

        try {
            setLoading(true);
            setError(null);

            // Fetch current state from backend
            const res = await api.get(`/salary/current?${targetType}=${targetId}&annualCTC=${ctcAnnual || 0}`);

            if (res.data.success) {
                setSalaryData(res.data.data);
                // Sync CTC input if from snapshot
                if (res.data.source === 'SNAPSHOT') {
                    setCtcAnnual(res.data.data.annualCTC || '');
                }
            }
        } catch (err) {
            console.error('Failed to load salary:', err);
            setError('Failed to fetch salary information');
        } finally {
            setLoading(false);
        }
    }, [isOpen, targetId, targetType, ctcAnnual]);

    useEffect(() => {
        if (isOpen) {
            loadSalary();
        } else {
            setSalaryData(null);
            setCtcAnnual('');
            setError(null);
        }
    }, [isOpen, targetId]);

    // Calculate salary breakdown from CTC
    const handleCalculate = async () => {
        if (!ctcAnnual || isNaN(ctcAnnual) || Number(ctcAnnual) <= 0) {
            setError('Please enter a valid Annual CTC');
            return;
        }

        try {
            setCalculating(true);
            setError(null);

            const res = await api.post('/salary/preview', {
                annualCTC: Number(ctcAnnual)
            });

            if (res.data.success) {
                setSalaryData(res.data.data);
            } else {
                setError(res.data.message || 'Failed to calculate salary');
            }
        } catch (err) {
            console.error('Failed to calculate salary:', err);
            setError(err.response?.data?.message || 'Failed to calculate salary breakdown');
        } finally {
            setCalculating(false);
        }
    };

    // Assign salary (Draft state)
    const handleAssign = async () => {
        if (!ctcAnnual || !salaryData) {
            setError('Please calculate salary first');
            return;
        }

        try {
            setAssigning(true);
            setError(null);

            const payload = {
                [targetType]: targetId,
                annualCTC: Number(ctcAnnual),
                earnings: salaryData.earnings,
                deductions: salaryData.deductions,
                benefits: salaryData.benefits
            };

            const res = await api.post('/salary/assign', payload);

            if (res.data.success) {
                // Now trigger Lock
                const confirmRes = await api.post('/salary/confirm', {
                    [targetType]: targetId
                });

                if (confirmRes.data.success) {
                    alert('Salary finalized and locked successfully!');
                    onSuccess && onSuccess(confirmRes.data.data);
                    onClose();
                }
            }
        } catch (err) {
            console.error('Failed to assign salary:', err);
            setError(err.response?.data?.message || 'Failed to assign salary');
        } finally {
            setAssigning(false);
        }
    };

    const formatCurrency = (amount) => {
        const val = Math.round(parseFloat(amount || 0));
        const prefix = val < 0 ? '-' : '';
        return `${prefix}₹${Math.abs(val).toLocaleString('en-IN')}`;
    };

    const isLocked = !!salaryData?.locked;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                            {isLocked ? "Salary Snapshot" : "Salary Configuration"}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {applicant?.name || employee?.name} | {applicant?.requirementId?.jobTitle || employee?.designation || 'N/A'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <div className="flex">
                                <span className="text-red-500 mr-3">⚠️</span>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* CTC Input */}
                    {!isLocked && (
                        <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Annual Cost to Company (CTC)
                            </label>
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                                    <input
                                        type="number"
                                        value={ctcAnnual}
                                        onChange={(e) => setCtcAnnual(e.target.value)}
                                        placeholder="Enter Amount (e.g. 800000)"
                                        disabled={calculating || assigning}
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <button
                                    onClick={handleCalculate}
                                    disabled={!ctcAnnual || calculating || assigning}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none font-bold shadow-lg shadow-blue-500/20"
                                >
                                    {calculating ? 'Analyzing...' : 'Calculate'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Salary Grid */}
                    {salaryData && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Master Totals */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 rounded-2xl p-6 text-white">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Annual CTC</p>
                                    <h3 className="text-3xl font-black">{formatCurrency(salaryData.totals?.ctcYearly || salaryData.totals?.totalCTC || salaryData.annualCTC)}</h3>
                                </div>
                                <div className="bg-emerald-600 rounded-2xl p-6 text-white">
                                    <p className="text-emerald-100/70 text-xs font-bold uppercase tracking-wider mb-1">Monthly Take Home</p>
                                    <h3 className="text-3xl font-black">{formatCurrency(salaryData.earnings?.reduce((s, e) => s + (e.monthly || 0), 0) - salaryData.deductions?.reduce((s, e) => s + (e.monthly || 0), 0))}</h3>
                                </div>
                            </div>

                            {isMismatched && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 flex items-start gap-3">
                                    <span className="text-xl">⚠️</span>
                                    <div>
                                        <h5 className="font-bold text-sm">CTC Mismatch Detected</h5>
                                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                            The sum of all configured Earnings & Benefits (₹{calculatedCTC.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) does not match the entered Annual CTC (₹{targetCTC.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).
                                        </p>
                                        <p className="text-xs text-amber-800 font-bold mt-2">
                                            Difference: {ctcDifference > 0 ? '+' : ''}{formatCurrency(ctcDifference)}
                                        </p>
                                        <p className="text-[10px] text-amber-500 mt-1 italic">
                                            Note: Please balance the salary components first. If the component totals exceed the target CTC, the Special Allowance will balance at 0.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Components Tables */}
                            <div className="space-y-6">
                                {/* Earnings Group */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                                        Earnings Breakdown
                                    </h4>
                                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-bold">
                                                <tr>
                                                    <th className="px-6 py-3 text-left">Component</th>
                                                    <th className="px-6 py-3 text-right">Monthly</th>
                                                    <th className="px-6 py-3 text-right">Yearly</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {salaryData.earnings?.map((e) => (
                                                    <tr key={e.code} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-700">{e.name}</td>
                                                        <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(e.monthly)}</td>
                                                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(e.yearly)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50/80 font-bold text-slate-900 border-t-2 border-slate-100">
                                                    <td className="px-6 py-4">Gross Earnings</td>
                                                    <td className="px-6 py-4 text-right">{formatCurrency(salaryData.totals?.grossMonthly || salaryData.earnings?.reduce((s, e) => s + (e.monthly || 0), 0))}</td>
                                                    <td className="px-6 py-4 text-right">{formatCurrency(salaryData.totals?.grossYearly || salaryData.earnings?.reduce((s, e) => s + (e.yearly || 0), 0))}</td>
                                                </tr>

                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Benefits & Deductions Grid */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Benefits */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                                            Employer Benefits
                                        </h4>
                                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm h-full">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-slate-50">
                                                    {(salaryData.benefits || []).map((b) => (
                                                        <tr key={b.code} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 text-slate-600">{b.name}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(b.monthly)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-red-500 rounded-full"></div>
                                            Employee Deductions
                                        </h4>
                                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm h-full">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-slate-50">
                                                    {(salaryData.deductions || []).map((d) => (
                                                        <tr key={d.code} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 text-slate-600">{d.name}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-red-600">-{formatCurrency(d.monthly)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-6 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
                    <div className="flex items-center text-slate-400 gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                        {isLocked ? 'Immutable Snapshot' : 'Configuration Mode'}
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all font-bold"
                        >
                            {isLocked ? 'Close' : 'Cancel'}
                        </button>
                        {!isLocked && salaryData && (
                            <button
                                onClick={handleAssign}
                                disabled={assigning || isMismatched}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl hover:bg-black active:scale-95 transition-all disabled:opacity-50 font-bold shadow-xl shadow-slate-900/10"
                            >
                                {assigning ? 'Finalizing...' : 'Finalize & Lock Salary'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
