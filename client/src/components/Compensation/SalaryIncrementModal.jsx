import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import { X, TrendingUp, AlertCircle, Calendar, IndianRupee, CheckCircle, Info } from 'lucide-react';

/**
 * ============================================
 * SALARY INCREMENT MODAL (ENHANCED)
 * ============================================
 * 
 * Features:
 * - Auto-calculate breakup from total CTC
 * - Manual override support
 * - Validation before submit
 * - Effective date selection (past, present, future)
 * - Status preview (ACTIVE vs SCHEDULED)
 * - Confirmation dialog
 * - Version number display
 */

export default function SalaryIncrementModal({ employee, currentVersion, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        effectiveFrom: new Date().toISOString().split('T')[0],
        totalCTC: currentVersion?.totalCTC || 0,
        grossA: currentVersion?.grossA || 0,
        grossB: currentVersion?.grossB || 0,
        grossC: currentVersion?.grossC || 0,
        components: currentVersion?.components || [],
        incrementType: 'INCREMENT',
        reason: '',
        notes: ''
    });

    const [autoCalculate, setAutoCalculate] = useState(true);
    const [validationError, setValidationError] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [previewStatus, setPreviewStatus] = useState('ACTIVE');

    // Calculate status based on effective date
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const effective = new Date(formData.effectiveFrom);
        effective.setHours(0, 0, 0, 0);

        setPreviewStatus(effective > today ? 'SCHEDULED' : 'ACTIVE');
    }, [formData.effectiveFrom]);

    // Auto-calculate breakup when total CTC changes
    useEffect(() => {
        if (autoCalculate && formData.totalCTC > 0) {
            // Production-grade Indian CTC Breakup
            const monthlyCTC = formData.totalCTC / 12;
            const basicMonthly = Math.round(monthlyCTC * 0.50);

            // Employer PF (Cap at 1800)
            let pfEmployerMonthly = Math.round(basicMonthly * 0.12);
            if (pfEmployerMonthly > 1800) pfEmployerMonthly = 1800; // PF Ceiling

            // Gratuity
            const gratuityMonthly = Math.round(basicMonthly * 0.0481);

            const grossBAnnual = (pfEmployerMonthly + gratuityMonthly) * 12;
            const grossAMonthly = Math.round((formData.totalCTC - grossBAnnual) / 12);

            // Generate standard components
            const hraMonthly = Math.round(basicMonthly * 0.40); // Standard HRA 40%
            let specialMonthly = grossAMonthly - (basicMonthly + hraMonthly);

            const generatedComponents = [
                // Earnings
                { name: 'Basic Salary', type: 'EARNING', monthlyAmount: basicMonthly, annualAmount: basicMonthly * 12, isProRata: true, isTaxable: true },
                { name: 'House Rent Allowance', type: 'EARNING', monthlyAmount: hraMonthly, annualAmount: hraMonthly * 12, isProRata: true, isTaxable: true },
                { name: 'Special Allowance', type: 'EARNING', monthlyAmount: specialMonthly, annualAmount: specialMonthly * 12, isProRata: true, isTaxable: true },
                // Employee Deductions
                { name: 'EPF Contribution', type: 'DEDUCTION', monthlyAmount: pfEmployerMonthly, annualAmount: pfEmployerMonthly * 12, isProRata: true, isTaxable: false },
                { name: 'Professional Tax', type: 'DEDUCTION', monthlyAmount: grossAMonthly > 15000 ? 200 : 0, annualAmount: (grossAMonthly > 15000 ? 200 : 0) * 12, isProRata: false, isTaxable: false },
                // Employer Benefits
                { name: 'Employer EPF', type: 'BENEFIT', monthlyAmount: pfEmployerMonthly, annualAmount: pfEmployerMonthly * 12, isProRata: false, isTaxable: false },
                { name: 'Gratuity', type: 'BENEFIT', monthlyAmount: gratuityMonthly, annualAmount: gratuityMonthly * 12, isProRata: false, isTaxable: false }
            ];

            setFormData(prev => ({
                ...prev,
                grossA: grossAMonthly,
                grossB: grossBAnnual,
                grossC: 0,
                components: generatedComponents
            }));
        }
    }, [formData.totalCTC, autoCalculate]);

    // Validate breakup
    const validateBreakup = () => {
        const sum = (formData.grossA * 12) + formData.grossB + formData.grossC;
        const diff = Math.abs(sum - formData.totalCTC);

        if (diff > 1) { // Allow ₹1 tolerance
            setValidationError(`Breakup mismatch: (Gross A × 12) + Gross B + Gross C = ₹${sum.toLocaleString('en-IN')}, but Total CTC is ₹${formData.totalCTC.toLocaleString('en-IN')}`);
            return false;
        }

        setValidationError('');
        return true;
    };

    // Calculate change from current version
    const calculateChange = () => {
        if (!currentVersion) return { absolute: 0, percentage: 0 };

        const absolute = formData.totalCTC - currentVersion.totalCTC;
        const percentage = ((absolute / currentVersion.totalCTC) * 100).toFixed(2);

        return { absolute, percentage };
    };

    const change = calculateChange();

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validateBreakup()) {
            return;
        }

        // Validate employee ID exists
        const employeeId = employee._id || employee.id;
        if (!employeeId) {
            alert('Error: Employee ID not found. Please refresh the page and try again.');
            console.error('Employee object:', employee);
            return;
        }

        setShowConfirmation(true);
    };

    const handleConfirm = async () => {
        try {
            setSubmitting(true);

            const response = await api.post('/compensation/increment', {
                employeeId: employee._id || employee.id, // Support both _id and id
                ...formData
            });

            if (response.data.success) {
                onSuccess(response.data);
            } else {
                alert('Failed to create increment: ' + response.data.message);
            }
        } catch (error) {
            console.error('Increment Error:', error);
            alert('Error: ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
            setShowConfirmation(false);
        }
    };

    const nextVersion = currentVersion ? currentVersion.version + 1 : 1;
    const hasValidEmployee = !!(employee && (employee._id || employee.id));

    if (!hasValidEmployee) {
        console.error('Invalid employee object:', employee);
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
                    <h3 className="text-lg font-bold text-red-600 mb-4">Error</h3>
                    <p className="text-slate-700 mb-4">
                        Employee data is invalid. Please refresh the page and try again.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Main Modal */}
            {createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="h-6 w-6" />
                                <div>
                                    <h2 className="text-xl font-bold">Salary Increment / Revision</h2>
                                    <p className="text-sm text-emerald-100">Version {nextVersion}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/20 rounded-full transition"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Employee Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-slate-600">Employee</div>
                                        <div className="font-semibold text-slate-900">
                                            {employee?.name || `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'N/A'}
                                        </div>
                                        <div className="text-sm text-slate-500">{employee?.employeeId || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-600">Current CTC</div>
                                        <div className="font-semibold text-slate-900">
                                            ₹{currentVersion?.totalCTC?.toLocaleString('en-IN') || '0'}
                                        </div>
                                        <div className="text-sm text-slate-500">Version {currentVersion?.version || 1}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Effective Date & Type */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Effective From Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.effectiveFrom}
                                        onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                    />
                                    <div className="mt-2 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                        <span className={`text-xs font-semibold ${previewStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {previewStatus === 'ACTIVE' ? '✓ Will activate immediately' : '⏰ Will activate on effective date'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Increment Type
                                    </label>
                                    <select
                                        value={formData.incrementType}
                                        onChange={(e) => setFormData({ ...formData, incrementType: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="INCREMENT">Annual Increment</option>
                                        <option value="REVISION">Salary Revision</option>
                                        <option value="PROMOTION">Promotion</option>
                                        <option value="ADJUSTMENT">Adjustment</option>
                                    </select>
                                </div>
                            </div>

                            {/* Total CTC */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    New Annual Total CTC (₹) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.totalCTC}
                                    onChange={(e) => setFormData({ ...formData, totalCTC: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-semibold"
                                    required
                                    min="0"
                                    step="1"
                                />

                                {/* Change Preview */}
                                {change.absolute !== 0 && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <IndianRupee className="h-4 w-4 text-slate-400" />
                                        <span className={`text-sm font-semibold ${change.absolute > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {change.absolute > 0 ? '+' : ''}₹{Math.abs(change.absolute).toLocaleString('en-IN')}
                                            ({change.percentage > 0 ? '+' : ''}{change.percentage}%)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Salary Breakup */}
                            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-900">Salary Breakup</h3>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={autoCalculate}
                                            onChange={(e) => setAutoCalculate(e.target.checked)}
                                            className="rounded"
                                        />
                                        Auto-calculate
                                    </label>
                                </div>

                                <div className="grid md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Gross A (Monthly) *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.grossA}
                                            onChange={(e) => {
                                                setAutoCalculate(false);
                                                setFormData({ ...formData, grossA: parseFloat(e.target.value) || 0 });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            required
                                            min="0"
                                        />
                                        <div className="text-xs text-slate-500 mt-1">
                                            Annual: ₹{(formData.grossA * 12).toLocaleString('en-IN')}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Gross B (Annual) *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.grossB}
                                            onChange={(e) => {
                                                setAutoCalculate(false);
                                                setFormData({ ...formData, grossB: parseFloat(e.target.value) || 0 });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            required
                                            min="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Gross C (Annual) *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.grossC}
                                            onChange={(e) => {
                                                setAutoCalculate(false);
                                                setFormData({ ...formData, grossC: parseFloat(e.target.value) || 0 });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>

                                {/* Validation */}
                                <div className="flex items-center gap-2 text-sm">
                                    {validationError ? (
                                        <>
                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                            <span className="text-red-600">{validationError}</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                            <span className="text-emerald-600">
                                                Breakup valid: (₹{formData.grossA.toLocaleString('en-IN')} × 12) + ₹{formData.grossB.toLocaleString('en-IN')} + ₹{formData.grossC.toLocaleString('en-IN')} = ₹{((formData.grossA * 12) + formData.grossB + formData.grossC).toLocaleString('en-IN')}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Reason for Increment
                                </label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    rows="3"
                                    placeholder="e.g., Annual performance increment, Market correction, etc."
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Additional Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    rows="2"
                                    placeholder="Any additional notes..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={submitting || !!validationError}
                                >
                                    Create Increment (v{nextVersion})
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Confirmation Dialog */}
            {showConfirmation && createPortal(
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300 overflow-hidden">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Info className="h-6 w-6 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Confirm Salary Increment</h3>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Employee:</span>
                                <span className="font-semibold">{employee?.name || `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Current CTC:</span>
                                <span className="font-semibold">₹{currentVersion?.totalCTC?.toLocaleString('en-IN') || '0'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">New CTC:</span>
                                <span className="font-semibold text-emerald-600">₹{formData.totalCTC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Change:</span>
                                <span className={`font-semibold ${change.absolute > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {change.absolute > 0 ? '+' : ''}₹{Math.abs(change.absolute).toLocaleString('en-IN')} ({change.percentage}%)
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Effective From:</span>
                                <span className="font-semibold">{new Date(formData.effectiveFrom).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Status:</span>
                                <span className={`font-semibold ${previewStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                    {previewStatus}
                                </span>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                            <p className="text-sm text-blue-900">
                                <strong>Important:</strong> This will create a new salary version (v{nextVersion}).
                                {previewStatus === 'ACTIVE'
                                    ? ' The new salary will be activated immediately and used for payroll.'
                                    : ' The new salary will be scheduled and activated automatically on the effective date.'}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                                disabled={submitting}
                            >
                                {submitting ? 'Creating...' : 'Confirm & Create'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
