import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { X, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';

/**
 * Salary Change Modal
 * 
 * Smart modal for creating:
 * - Increments (CTC increase, same role)
 * - Revisions (structure change, same role)
 * - Promotions (role + grade + salary change)
 */
export default function SalaryChangeModal({ employee, currentSnapshot, type, onClose, onSuccess }) {
    const [templates, setTemplates] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    // Promotion-specific fields
    const [newDesignation, setNewDesignation] = useState(employee?.designation || '');
    const [newDepartment, setNewDepartment] = useState(employee?.department || '');
    const [newDepartmentId, setNewDepartmentId] = useState(employee?.departmentId || '');
    const [newGrade, setNewGrade] = useState(employee?.grade || '');
    const [newRole, setNewRole] = useState(employee?.role || '');

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadTemplates();
        if (type === 'PROMOTION') {
            loadDepartments();
        }

        // Set default effective date to next month
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        setEffectiveFrom(nextMonth.toISOString().split('T')[0]);
    }, [type]);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const response = await api.get('/payroll/salary-templates');
            setTemplates(response.data?.data || response.data || []);
        } catch (error) {
            console.error('Error loading templates:', error);
            setError('Failed to load salary templates');
        } finally {
            setLoading(false);
        }
    };

    const loadDepartments = async () => {
        try {
            const response = await api.get('/hr/departments');
            setDepartments(response.data || []);
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    };

    const handleTemplateChange = (templateId) => {
        setSelectedTemplateId(templateId);
        const template = templates.find(t => t._id === templateId);
        setSelectedTemplate(template);
    };

    const calculateChanges = () => {
        if (!selectedTemplate || !currentSnapshot) return null;

        const oldCTC = currentSnapshot.ctc;
        const newCTC = selectedTemplate.annualCTC;
        const absoluteChange = newCTC - oldCTC;
        const percentageChange = ((absoluteChange / oldCTC) * 100).toFixed(2);

        return {
            oldCTC,
            newCTC,
            absoluteChange,
            percentageChange,
            oldMonthly: currentSnapshot.monthlyCTC,
            newMonthly: selectedTemplate.monthlyCTC
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!selectedTemplateId) {
            setError('Please select a salary template');
            return;
        }

        if (!effectiveFrom) {
            setError('Please select effective date');
            return;
        }

        if (type === 'PROMOTION' && !newDesignation) {
            setError('Please enter new designation for promotion');
            return;
        }

        try {
            setSubmitting(true);

            const payload = {
                type,
                salaryTemplateId: selectedTemplateId,
                effectiveFrom,
                reason,
                notes
            };

            if (type === 'PROMOTION') {
                payload.promotionDetails = {
                    newDesignation,
                    newDepartment,
                    newDepartmentId,
                    newGrade,
                    newRole
                };
            }

            const response = await api.post(
                `/hr/employees/${employee._id}/salary-revision`,
                payload
            );

            if (response.data.success) {
                onSuccess();
            } else {
                setError(response.data.message || 'Failed to create salary revision');
            }
        } catch (error) {
            console.error('Error creating salary revision:', error);
            setError(error.response?.data?.message || 'Failed to create salary revision');
        } finally {
            setSubmitting(false);
        }
    };

    const changes = calculateChanges();

    const getTypeLabel = () => {
        switch (type) {
            case 'INCREMENT': return 'Increment';
            case 'REVISION': return 'Salary Revision';
            case 'PROMOTION': return 'Promotion';
            default: return 'Salary Change';
        }
    };

    const getTypeColor = () => {
        switch (type) {
            case 'INCREMENT': return 'green';
            case 'REVISION': return 'blue';
            case 'PROMOTION': return 'purple';
            default: return 'slate';
        }
    };

    const color = getTypeColor();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className={`bg-${color}-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl`}>
                    <div className="flex items-center gap-3">
                        <TrendingUp className="h-6 w-6" />
                        <h2 className="text-xl font-bold">{getTypeLabel()}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-full transition"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Employee Info */}
                    <div className="bg-slate-50 rounded-lg p-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-sm text-slate-600">Employee</div>
                                <div className="font-semibold text-slate-900">
                                    {employee.firstName} {employee.lastName}
                                </div>
                                <div className="text-sm text-slate-500">{employee.employeeId}</div>
                            </div>
                            <div>
                                <div className="text-sm text-slate-600">Current CTC</div>
                                <div className="font-semibold text-slate-900">
                                    ₹{currentSnapshot?.ctc?.toLocaleString('en-IN')}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {employee.designation || 'N/A'} • {employee.department || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Salary Template Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Select New Salary Template *
                        </label>
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        >
                            <option value="">-- Select Template --</option>
                            {templates.map(template => (
                                <option key={template._id} value={template._id}>
                                    {template.templateName} - ₹{template.annualCTC?.toLocaleString('en-IN')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Live Preview */}
                    {changes && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <ArrowRight className="h-5 w-5 text-blue-600" />
                                Change Preview
                            </h3>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <div className="text-xs text-slate-600 mb-1">Current CTC</div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        ₹{changes.oldCTC.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        ₹{changes.oldMonthly.toLocaleString('en-IN')}/month
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <div className="text-xs text-slate-600 mb-1">New CTC</div>
                                    <div className="text-2xl font-bold text-green-600">
                                        ₹{changes.newCTC.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        ₹{changes.newMonthly.toLocaleString('en-IN')}/month
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <div className="text-xs text-slate-600 mb-1">Change</div>
                                    <div className={`text-2xl font-bold ${changes.absoluteChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {changes.absoluteChange >= 0 ? '+' : ''}₹{Math.abs(changes.absoluteChange).toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {changes.percentageChange >= 0 ? '+' : ''}{changes.percentageChange}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Promotion Details */}
                    {type === 'PROMOTION' && (
                        <div className="space-y-4 border border-purple-200 rounded-lg p-4 bg-purple-50">
                            <h3 className="font-semibold text-purple-900">Promotion Details</h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        New Designation *
                                    </label>
                                    <input
                                        type="text"
                                        value={newDesignation}
                                        onChange={(e) => setNewDesignation(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g., Senior Software Engineer"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        New Department
                                    </label>
                                    <select
                                        value={newDepartmentId}
                                        onChange={(e) => {
                                            setNewDepartmentId(e.target.value);
                                            const dept = departments.find(d => d._id === e.target.value);
                                            setNewDepartment(dept?.name || '');
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">-- Keep Current --</option>
                                        {departments.map(dept => (
                                            <option key={dept._id} value={dept._id}>{dept.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        New Grade/Level
                                    </label>
                                    <input
                                        type="text"
                                        value={newGrade}
                                        onChange={(e) => setNewGrade(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g., L3, Senior"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        New Role
                                    </label>
                                    <input
                                        type="text"
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g., Team Lead"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Effective Date */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Effective From *
                        </label>
                        <input
                            type="date"
                            value={effectiveFrom}
                            onChange={(e) => setEffectiveFrom(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            The date from which this change will be effective for payroll
                        </p>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Reason
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows="3"
                            placeholder="Enter reason for this change..."
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Additional Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                            className={`flex-1 px-6 py-3 bg-${color}-600 text-white rounded-lg hover:bg-${color}-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                            disabled={submitting || loading}
                        >
                            {submitting ? 'Creating...' : `Create ${getTypeLabel()}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
