import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

export default function SalaryAssignmentModal({ employee, onClose, onSuccess }) {
    const [templates, setTemplates] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
    const [ctcAmount, setCtcAmount] = useState('');
    const [error, setError] = useState('');
    const [selectedTemplateData, setSelectedTemplateData] = useState(null);

    useEffect(() => {
        loadData();
    }, [employee]);

    useEffect(() => {
        // When template is selected, update the template data and set initial CTC
        if (selectedTemplate) {
            const template = templates.find(t => t._id === selectedTemplate);
            setSelectedTemplateData(template);
            if (template && !ctcAmount) {
                setCtcAmount(template?.annualCTC || template?.ctc || '');
            }
        }
    }, [selectedTemplate, templates]);

    async function loadData() {
        setLoading(true);
        try {
            // Fetch templates
            const resTemp = await api.get('/payroll/salary-templates');
            setTemplates(resTemp.data?.data || []);

            // Fetch history for this employee
            if (employee) {
                const resHist = await api.get(`/payroll/history/${employee._id}`);
                setHistory(resHist.data?.data || []);

                // Pre-select current if exists
                if (employee.salaryTemplateId) {
                    const currentId = typeof employee.salaryTemplateId === 'object' ? employee.salaryTemplateId._id : employee.salaryTemplateId;
                    setSelectedTemplate(currentId);
                }

                // Set current CTC if available
                if (employee.ctcAnnual) {
                    setCtcAmount(employee.ctcAnnual);
                }
            }
        } catch (err) {
            console.error("Failed to load payroll data", err);
            setError("Failed to load templates or history");
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!selectedTemplate || !effectiveFrom) {
            setError("Please select a template and effective date.");
            return;
        }

        if (!ctcAmount || ctcAmount <= 0) {
            setError("Please enter a valid CTC amount.");
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            // Use the entered/modified CTC amount
            const ctcAnnual = parseFloat(ctcAmount);

            if (!ctcAnnual) {
                setError("Invalid CTC amount. Please enter a valid number.");
                setSubmitting(false);
                return;
            }

            // Call the modern salary assignment endpoint
            await api.post('/salary/assign', {
                employeeId: employee._id,
                templateId: selectedTemplate,
                ctcAnnual: ctcAnnual,
                effectiveDate: effectiveFrom
            });

            if (onSuccess) onSuccess("Salary structure assigned as draft. Please confirm and lock to finalize.");
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to assign salary structure. Please ensure the template is valid.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleConfirm(assignmentId) {
        if (!confirm("Confirming salary will lock this structure and create an immutable snapshot. You won't be able to edit this specific assignment once locked. Proceed?")) return;

        setSubmitting(true);
        setError('');
        try {
            await api.post('/salary/confirm', {
                employeeId: employee._id,
                assignmentId: assignmentId,
                reason: 'JOINING'
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to confirm salary");
        } finally {
            setSubmitting(false);
        }
    }

    if (!employee) return null;

    const currentTemplate = history.length > 0 ? history[0].salaryTemplateId : null;
    const currentCTC = employee.ctcAnnual || (currentTemplate?.annualCTC);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h2 className="text-xl font-bold text-gray-800">Assign Salary Structure</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Employee Info Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-lg border border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold">Employee</p>
                                <p className="text-lg font-bold text-gray-900 mt-1">{employee.firstName} {employee.lastName}</p>
                                <p className="text-sm text-gray-600 mt-1">{employee.employeeId}</p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold">Department</p>
                                <p className="text-lg font-bold text-gray-900 mt-1">{employee.department || '-'}</p>
                                <p className="text-sm text-gray-600 mt-1">{employee.role || '-'}</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Status:</span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${employee.salaryLocked ? 'bg-green-100 text-green-800' : employee.salaryAssigned ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                                {employee.salaryLocked ? '✓ Locked' : employee.salaryAssigned ? '⧗ Pending Confirmation' : '○ No Salary Assigned'}
                            </span>
                        </div>
                    </div>

                    {/* Current Salary Details (if exists) */}
                    {currentTemplate && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-lg border border-green-200">
                            <h3 className="text-sm font-bold text-green-900 uppercase tracking-wider mb-3">Current Salary Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-green-700 font-medium">Template</p>
                                    <p className="text-base font-semibold text-gray-900 mt-1">{currentTemplate.templateName}</p>
                                </div>
                                {currentCTC && (
                                    <div>
                                        <p className="text-xs text-green-700 font-medium">Annual CTC</p>
                                        <p className="text-base font-semibold text-gray-900 mt-1">₹{currentCTC.toLocaleString('en-IN')}</p>
                                    </div>
                                )}
                                {history[0]?.effectiveFrom && (
                                    <div>
                                        <p className="text-xs text-green-700 font-medium">Effective From</p>
                                        <p className="text-base font-semibold text-gray-900 mt-1">{formatDateDDMMYYYY(history[0].effectiveFrom)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm flex gap-2">
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Form Section */}
                    <form onSubmit={handleSubmit} className="space-y-5 bg-gray-50 p-5 rounded-lg border border-gray-200">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="inline-flex items-center gap-2">
                                    Select Salary Template
                                    <span className="text-red-500 font-bold">*</span>
                                </span>
                            </label>
                            <select
                                value={selectedTemplate}
                                onChange={e => setSelectedTemplate(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 p-3 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
                                required
                                disabled={employee.salaryLocked || loading}
                            >
                                <option value="">Choose a template...</option>
                                {templates.map(t => (
                                    <option key={t._id} value={t._id}>
                                        {t.templateName} — ₹{(t.annualCTC || t.ctc || 0).toLocaleString('en-IN')}/year
                                    </option>
                                ))}
                            </select>
                            {templates.length === 0 && !loading && (
                                <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex gap-2">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <span>No salary templates available. Please create one first.</span>
                                </p>
                            )}
                        </div>

                        {/* Template Details Preview */}
                        {selectedTemplateData && (
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h4 className="font-semibold text-gray-700 mb-3 text-sm">Template Preview</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded border border-blue-200">
                                        <p className="text-xs text-blue-700 font-medium uppercase">Name</p>
                                        <p className="font-bold text-gray-900 mt-1">{selectedTemplateData.templateName}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-3 rounded border border-emerald-200">
                                        <p className="text-xs text-emerald-700 font-medium uppercase">Template CTC</p>
                                        <p className="font-bold text-gray-900 mt-1">₹{(selectedTemplateData.annualCTC || selectedTemplateData.ctc || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    {selectedTemplateData.structure && (
                                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded border border-purple-200">
                                            <p className="text-xs text-purple-700 font-medium uppercase">Components</p>
                                            <p className="font-bold text-gray-900 mt-1">{Object.keys(selectedTemplateData.structure || {}).length}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="inline-flex items-center gap-2">
                                    Annual CTC
                                    <span className="text-red-500 font-bold">*</span>
                                    {currentCTC && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-normal">Current: ₹{currentCTC.toLocaleString('en-IN')}</span>}
                                </span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-500 font-semibold text-lg">₹</span>
                                <input
                                    type="number"
                                    value={ctcAmount}
                                    onChange={e => setCtcAmount(e.target.value)}
                                    placeholder="Enter or modify CTC amount"
                                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 pl-8 pr-3 py-3 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
                                    required
                                    disabled={employee.salaryLocked}
                                    min="1"
                                    step="1"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">You can modify the CTC from the template's default amount if needed.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="inline-flex items-center gap-2">
                                    Effective From
                                    <span className="text-red-500 font-bold">*</span>
                                </span>
                            </label>
                            <input
                                type="date"
                                value={effectiveFrom}
                                onChange={e => setEffectiveFrom(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 p-3 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
                                required
                                disabled={employee.salaryLocked}
                            />
                            <p className="text-xs text-gray-500 mt-1">Salary assignment takes effect from this date onwards.</p>
                        </div>

                        {!employee.salaryLocked && (
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !selectedTemplate || !ctcAmount || !effectiveFrom}
                                    className="px-6 py-2.5 text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                                >
                                    {submitting && (
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {submitting ? 'Assigning...' : employee.salaryAssigned ? 'Update Assignment' : 'Assign Salary Structure'}
                                </button>
                            </div>
                        )}
                    </form>

                    {/* Assignment History Section */}
                    {history.length > 0 && (
                        <div className="border-t pt-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000-2H6a6 6 0 016 6v3h1a1 1 0 100 2h-1v3a6 6 0 01-6 6H6a1 1 0 000 2h4a2 2 0 002-2v-2.93a6 6 0 006-5.07v-3h1a1 1 0 100-2h-1V9a6 6 0 00-6-6 2 2 0 01-2-2V5z" clipRule="evenodd"></path></svg>
                                Assignment History
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Template</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">CTC</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Effective Date</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {history.map((h, idx) => (
                                            <tr key={h._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{h.salaryTemplateId?.templateName || 'Unknown'}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{(h.ctcAnnual || h.salaryTemplateId?.annualCTC || 0).toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{formatDateDDMMYYYY(h.effectiveFrom)}</td>
                                                <td className="px-4 py-3 text-sm text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${h.isConfirmed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                        {h.isConfirmed ? '✓ Locked' : '⧗ Draft'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    {!h.isConfirmed && !employee.salaryLocked && (
                                                        <button
                                                            onClick={() => handleConfirm(h._id)}
                                                            disabled={submitting}
                                                            className="text-xs bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-1.5 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 transition font-medium"
                                                        >
                                                            Confirm & Lock
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
