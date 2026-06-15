import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { TrendingUp, RefreshCw, ArrowUpCircle, IndianRupee, Calendar, FileText } from 'lucide-react';
import SalaryChangeModal from './SalaryChangeModal';
import SalaryHistory from './SalaryHistory';

/**
 * Compensation Tab Component
 * 
 * Displays employee's current salary and provides options for:
 * - Increment
 * - Revision
 * - Promotion
 * - View Salary History
 */
export default function CompensationTab({ employee }) {
    const [currentSnapshot, setCurrentSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChangeModal, setShowChangeModal] = useState(false);
    const [changeType, setChangeType] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (employee?._id) {
            loadCurrentSalary();
        }
    }, [employee]);

    const loadCurrentSalary = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/hr/employees/${employee._id}/salary-history`);
            if (response.data.success) {
                const snapshots = response.data.data.snapshots || [];
                const current = snapshots.find(s =>
                    s._id.toString() === employee.currentSalarySnapshotId?.toString()
                );
                setCurrentSnapshot(current || snapshots[0]);
            }
        } catch (error) {
            console.error('Error loading current salary:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeClick = (type) => {
        setChangeType(type);
        setShowChangeModal(true);
    };

    const handleChangeSuccess = () => {
        setShowChangeModal(false);
        loadCurrentSalary();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!currentSnapshot) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <p className="text-amber-800">No salary information available for this employee.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => handleChangeClick('INCREMENT')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md"
                >
                    <TrendingUp className="h-5 w-5" />
                    <span>Increment</span>
                </button>
                <button
                    onClick={() => handleChangeClick('REVISION')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
                >
                    <RefreshCw className="h-5 w-5" />
                    <span>Revision</span>
                </button>
                <button
                    onClick={() => handleChangeClick('PROMOTION')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-md"
                >
                    <ArrowUpCircle className="h-5 w-5" />
                    <span>Promotion</span>
                </button>
                <button
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition shadow-md ml-auto"
                >
                    <FileText className="h-5 w-5" />
                    <span>View History</span>
                </button>
            </div>

            {/* Current Salary Overview */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-blue-600" />
                    Current Salary Structure
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* CTC Summary */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-sm text-slate-600 mb-1">Annual CTC</div>
                        <div className="text-3xl font-bold text-slate-900">
                            ₹{currentSnapshot.ctc?.toLocaleString('en-IN') || 0}
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                            Monthly: ₹{currentSnapshot.monthlyCTC?.toLocaleString('en-IN') || 0}
                        </div>
                        <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Effective from: {new Date(currentSnapshot.effectiveFrom).toLocaleDateString('en-IN')}
                        </div>
                    </div>

                    {/* Breakdown Summary */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Gross Salary</span>
                                <span className="font-semibold text-slate-900">
                                    ₹{currentSnapshot.breakdown?.grossA?.toLocaleString('en-IN') || 0}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Total Deductions</span>
                                <span className="font-semibold text-red-600">
                                    -₹{currentSnapshot.breakdown?.totalDeductions?.toLocaleString('en-IN') || 0}
                                </span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 mt-2"></div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-700">Take Home</span>
                                <span className="font-bold text-green-600 text-lg">
                                    ₹{currentSnapshot.breakdown?.takeHome?.toLocaleString('en-IN') || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                    <h4 className="font-semibold text-slate-900">Earnings</h4>
                </div>
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        {currentSnapshot.earnings?.map((earning, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                                <div>
                                    <div className="font-medium text-slate-900">{earning.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {earning.calculationType === 'PERCENT_CTC' && `${earning.percentage}% of CTC`}
                                        {earning.calculationType === 'PERCENT_BASIC' && `${earning.percentage}% of Basic`}
                                        {earning.calculationType === 'FIXED' && 'Fixed Amount'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-green-700">
                                        ₹{earning.monthlyAmount?.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-xs text-slate-500">per month</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Deductions Breakdown */}
            {currentSnapshot.employeeDeductions && currentSnapshot.employeeDeductions.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-900">Deductions</h4>
                    </div>
                    <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            {currentSnapshot.employeeDeductions.map((deduction, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                                    <div>
                                        <div className="font-medium text-slate-900">{deduction.name}</div>
                                        <div className="text-xs text-slate-500">{deduction.category || 'Deduction'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-red-700">
                                            ₹{deduction.monthlyAmount?.toLocaleString('en-IN')}
                                        </div>
                                        <div className="text-xs text-slate-500">per month</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showChangeModal && (
                <SalaryChangeModal
                    employee={employee}
                    currentSnapshot={currentSnapshot}
                    type={changeType}
                    onClose={() => setShowChangeModal(false)}
                    onSuccess={handleChangeSuccess}
                />
            )}

            {showHistory && (
                <SalaryHistory
                    employee={employee}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}
