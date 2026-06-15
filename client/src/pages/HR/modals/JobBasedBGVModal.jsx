import React, { useState } from 'react';
import { Shield, Package, Calendar, CheckCircle, X } from 'lucide-react';
import { showToast } from '../../../utils/uiNotifications';
import api from '../../../utils/api';

const BGV_PACKAGES = {
    BASIC: {
        name: 'Basic',
        checks: ['Identity', 'Address', 'Employment'],
        description: 'Essential verification for entry-level positions',
        color: 'slate',
        recommended: 'Entry-level, Interns',
        sla: 5
    },
    STANDARD: {
        name: 'Standard',
        checks: ['Identity', 'Address', 'Employment', 'Education', 'Criminal'],
        description: 'Comprehensive verification for most positions',
        color: 'blue',
        recommended: 'Most positions, Standard hiring',
        sla: 7
    },
    PREMIUM: {
        name: 'Premium',
        checks: ['Identity', 'Address', 'Employment', 'Education', 'Criminal', 'Social Media', 'Reference'],
        description: 'Complete verification for critical roles',
        color: 'purple',
        recommended: 'Senior positions, Critical roles',
        sla: 10
    }
};

const getJobSpecificPackage = (applicant) => {
    const checks = applicant?.requirementId?.bgvConfig?.checks || [];
    if (checks.length === 0) return null;
    
    return {
        name: 'Job Specific',
        checks: checks.map(c => c.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')),
        description: 'Verification based on specific job requirements',
        color: 'emerald',
        recommended: 'This specific role',
        sla: 7
    };
};

const JobBasedBGVModal = ({ applicant, jobTitle, onClose, onSuccess }) => {
    const [selectedPackage, setSelectedPackage] = useState('STANDARD');
    const [slaDays, setSlaDays] = useState(7);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent multiple submissions
        if (loading) {
            return;
        }

        setLoading(true);
        try {
            await api.post('/bgv/initiate', {
                applicationId: applicant._id,
                package: selectedPackage,
                slaDays
            });

            showToast('success', 'BGV Initiated', `Background verification started for ${applicant.name}`);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            // Only log unexpected errors (not expected 409 or 401)
            if (err.response?.status !== 409 && err.response?.status !== 401) {
                console.error('[BGV_JOB_BASED_ERROR]', err);
            }

            // Handle 409 Conflict: BGV already exists
            if (err.response?.status === 409) {
                const message = err.response?.data?.message || 'BGV already initiated for this candidate';
                showToast('warning', 'Already Initiated', message);
                
                // Close modal after showing message
                setTimeout(() => {
                    if (onClose) onClose();
                }, 1500);
                return;
            }

            // Handle 401 Unauthorized: Token expired or invalid
            if (err.response?.status === 401) {
                showToast('error', 'Session Expired', 'Please log in again');
                // Interceptor will handle redirect
                return;
            }

            // Handle other errors
            const errorMessage = err.response?.data?.message || err.message || 'Failed to initiate BGV';
            showToast('error', 'Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const getPackageColor = (color) => {
        const colors = {
            slate: 'from-slate-500 to-slate-600 border-slate-300 hover:border-slate-400',
            blue: 'from-blue-500 to-blue-600 border-blue-300 hover:border-blue-400',
            purple: 'from-purple-500 to-purple-600 border-purple-300 hover:border-purple-400',
            emerald: 'from-emerald-500 to-emerald-600 border-emerald-300 hover:border-emerald-400'
        };
        return colors[color] || colors.blue;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Shield size={28} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">Initiate Background Verification</h2>
                            <p className="text-blue-100 text-sm mt-1">Mode-driven verification for {applicant.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-all"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Read-Only Candidate Info */}
                    <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
                        <h3 className="font-black text-slate-900 mb-4 text-sm uppercase tracking-wide">Candidate Information (Read-Only)</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-slate-500 font-bold mb-1">Name</div>
                                <div className="text-slate-900 font-black">{applicant.name}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 font-bold mb-1">Email</div>
                                <div className="text-slate-900 font-black">{applicant.email}</div>
                            </div>
                            <div className="col-span-2">
                                <div className="text-slate-500 font-bold mb-1">Position</div>
                                <div className="text-slate-900 font-black">{jobTitle || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Package Selection */}
                    <div className="mb-8">
                        <label className="block text-sm font-black text-slate-700 uppercase tracking-wide mb-4">
                            <Package size={16} className="inline mr-2" />
                            Select Verification Mode
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(() => {
                                const jobPkg = getJobSpecificPackage(applicant);
                                const packages = { ...BGV_PACKAGES };
                                if (jobPkg) {
                                    packages.CUSTOM = jobPkg;
                                }
                                
                                return Object.entries(packages).map(([key, pkg]) => (
                                    <label
                                        key={key}
                                        className={`relative border-3 rounded-2xl p-6 cursor-pointer transition-all ${selectedPackage === key
                                            ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="package"
                                            value={key}
                                            checked={selectedPackage === key}
                                            onChange={(e) => {
                                                setSelectedPackage(e.target.value);
                                                setSlaDays(pkg.sla);
                                            }}
                                            className="sr-only"
                                        />

                                        {/* Package Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase bg-gradient-to-r ${getPackageColor(pkg.color)} text-white`}>
                                                <Package size={12} />
                                                {pkg.name}
                                            </span>
                                            {selectedPackage === key && (
                                                <CheckCircle size={20} className="text-blue-600" />
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="text-sm text-slate-600 mb-4 h-10 overflow-hidden">{pkg.description}</p>

                                        {/* Checks */}
                                        <div className="space-y-2 mb-4 max-h-32 overflow-y-auto pr-1">
                                            <div className="text-xs font-black text-slate-500 uppercase">Included Checks:</div>
                                            {pkg.checks.map((check, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-sm">
                                                    <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                                                    <span className="text-slate-700 truncate">{check}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Recommended */}
                                        <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">
                                            <strong>For:</strong> {pkg.recommended}
                                        </div>
                                    </label>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* SLA */}
                    <div className="mb-8">
                        <label className="block text-sm font-black text-slate-700 uppercase tracking-wide mb-3">
                            <Calendar size={16} className="inline mr-2" />
                            SLA (Service Level Agreement)
                        </label>

                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={slaDays}
                                onChange={(e) => setSlaDays(parseInt(e.target.value))}
                                className="w-32 px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-center font-bold text-lg"
                            />
                            <div>
                                <div className="font-bold text-slate-900">Days to complete verification</div>
                                <div className="text-sm text-slate-500">
                                    Due date: {new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* SLA Presets */}
                        <div className="flex gap-2 mt-4">
                            {[3, 5, 7, 10, 14].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setSlaDays(days)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${slaDays === days
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    {days} days
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6 border-2 border-blue-200">
                        <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                            <Shield size={20} className="text-blue-600" />
                            Verification Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <div className="text-slate-500 font-bold mb-1">Mode</div>
                                <div className="text-slate-900 font-black">
                                    {selectedPackage === 'CUSTOM' ? 'Job Specific' : BGV_PACKAGES[selectedPackage].name}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 font-bold mb-1">Total Checks</div>
                                <div className="text-slate-900 font-black">
                                    {selectedPackage === 'CUSTOM' ? getJobSpecificPackage(applicant)?.checks.length : BGV_PACKAGES[selectedPackage].checks.length}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 font-bold mb-1">SLA</div>
                                <div className="text-slate-900 font-black">{slaDays} days</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-200">
                            <div className="text-xs text-blue-700 font-medium">
                                ℹ️ Verification checks are system-generated based on the selected mode. HR cannot manually select individual checks.
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                    Initiating...
                                </span>
                            ) : (
                                `Initiate BGV (${BGV_PACKAGES[selectedPackage].name})`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JobBasedBGVModal;
