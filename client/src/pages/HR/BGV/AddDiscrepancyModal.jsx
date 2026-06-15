import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Save, Target, ShieldAlert, ChevronDown, CheckCircle } from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

const AddDiscrepancyModal = ({ isOpen, onClose, checkData, caseId, onDiscrepancyAdded }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: '',
        description: '',
        severity: 'MINOR'
    });

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || !isOpen || typeof document === 'undefined') return null;

    // All 30+ discrepancy types from backend
    const discrepancyTypes = [
        { value: 'MINOR_DATE_MISMATCH', label: 'Minor Date Mismatch', points: 5 },
        { value: 'MAJOR_DATE_MISMATCH', label: 'Major Date Mismatch (>6 months)', points: 15 },
        { value: 'NAME_SPELLING_VARIATION', label: 'Name Spelling Variation', points: 3 },
        { value: 'ADDRESS_MISMATCH_MINOR', label: 'Address Mismatch - Minor', points: 5 },
        { value: 'ADDRESS_MISMATCH_MAJOR', label: 'Address Mismatch - Major', points: 20 },
        { value: 'SALARY_MISMATCH_MINOR', label: 'Salary Mismatch - Minor (<10%)', points: 10 },
        { value: 'SALARY_MISMATCH_MAJOR', label: 'Salary Mismatch - Major (>10%)', points: 25 },
        { value: 'DESIGNATION_MISMATCH', label: 'Designation Mismatch', points: 15 },
        { value: 'EMPLOYMENT_GAP_UNEXPLAINED', label: 'Employment Gap - Unexplained', points: 20 },
        { value: 'EMPLOYMENT_GAP_EXPLAINED', label: 'Employment Gap - Explained', points: 5 },
        { value: 'EMPLOYER_NOT_REACHABLE', label: 'Employer Not Reachable', points: 15 },
        { value: 'EMPLOYER_REFUSED_INFO', label: 'Employer Refused Information', points: 25 },
        { value: 'NEGATIVE_FEEDBACK', label: 'Negative Feedback from Employer', points: 30 },
        { value: 'FAKE_EMPLOYER', label: 'Fake Employer', points: 50 },
        { value: 'DEGREE_NOT_VERIFIED', label: 'Degree Not Verified', points: 30 },
        { value: 'UNIVERSITY_NOT_RECOGNIZED', label: 'University Not Recognized', points: 40 },
        { value: 'FAKE_DEGREE', label: 'Fake Degree Certificate', points: 60 },
        { value: 'MARKS_MISMATCH', label: 'Marks/Grade Mismatch', points: 20 },
        { value: 'YEAR_OF_PASSING_MISMATCH', label: 'Year of Passing Mismatch', points: 15 },
        { value: 'CRIMINAL_RECORD_MINOR', label: 'Criminal Record - Minor Offense', points: 40 },
        { value: 'CRIMINAL_RECORD_MAJOR', label: 'Criminal Record - Major Offense', points: 60 },
        { value: 'PENDING_COURT_CASE', label: 'Pending Court Case', points: 35 },
        { value: 'IDENTITY_DOCUMENT_MISMATCH', label: 'Identity Document Mismatch', points: 25 },
        { value: 'FAKE_IDENTITY_DOCUMENT', label: 'Fake Identity Document', points: 60 },
        { value: 'REFERENCE_NOT_REACHABLE', label: 'Reference Not Reachable', points: 10 },
        { value: 'REFERENCE_REFUSED', label: 'Reference Refused to Provide Info', points: 20 },
        { value: 'NEGATIVE_REFERENCE', label: 'Negative Reference Feedback', points: 30 },
        { value: 'SOCIAL_MEDIA_RED_FLAG', label: 'Social Media Red Flag', points: 15 },
        { value: 'CREDIT_SCORE_ISSUE', label: 'Credit Score Issue', points: 20 },
        { value: 'DRUG_TEST_FAILED', label: 'Drug Test Failed', points: 50 },
        { value: 'OTHER', label: 'Other Discrepancy', points: 10 }
    ];

    if (!isOpen) return null;

    const selectedType = discrepancyTypes.find(d => d.value === formData.type);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.type) {
            showToast('error', 'Error', 'Please select a discrepancy type');
            return;
        }

        if (!formData.description.trim()) {
            showToast('error', 'Error', 'Please provide a description');
            return;
        }

        setLoading(true);

        try {
            const res = await api.post(`/bgv/check/${checkData._id}/add-discrepancy`, {
                type: formData.type,
                description: formData.description,
                severity: formData.severity
            });

            showToast('success', 'Success', `Discrepancy Added. Score: ${res.data.data.totalRiskScore}`);
            onDiscrepancyAdded(res.data.data);
            onClose();
        } catch (err) {
            console.error('Failed to add discrepancy:', err);
            showToast('error', 'Error', err.response?.data?.message || 'Failed to add discrepancy');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-10 py-8 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center border border-white/30">
                            <ShieldAlert size={32} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Report Issue</h2>
                            <p className="text-orange-50 font-semibold tracking-widest uppercase text-[10px] opacity-90 mt-1">Add an issue found during verification</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all border border-transparent hover:border-white/30 text-white relative z-10"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    <div className="space-y-8">
                        {/* Target Context */}
                        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm flex items-center justify-between group">
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Target size={14} className="text-orange-500" />
                                    CHECK TYPE
                                </h3>
                                <div className="text-xl font-bold text-slate-900 tracking-tight uppercase">
                                    {checkData.type?.replace(/_/g, ' ')}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID</div>
                                <div className="text-xs font-semibold text-slate-600">#{String(checkData._id || '').slice(-8).toUpperCase()}</div>
                            </div>
                        </div>

                        {/* Anomaly Selection */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2">DISCREPANCY TYPE</h3>
                            <div className="relative group">
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none font-bold text-xs uppercase tracking-widest text-slate-700 shadow-sm appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">-- Choose Type --</option>
                                    {discrepancyTypes.map((type) => (
                                        <option key={type.value} value={type.value}>
                                            {type.label} (+{type.points} PTS)
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-orange-500 transition-colors" />
                            </div>

                            {selectedType && (
                                <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                                    <div>
                                        <div className="text-[9px] font-bold text-orange-900 uppercase tracking-widest mb-0.5">IMPACT SCORE</div>
                                        <div className="text-xs font-semibold text-orange-700 opacity-70 italic">Points added to the risk score</div>
                                    </div>
                                    <div className="text-4xl font-bold text-orange-600 tracking-tighter">
                                        +{selectedType.points}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Severity Matrix */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2">SEVERITY</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'MINOR', color: 'amber' },
                                    { id: 'MODERATE', color: 'orange' },
                                    { id: 'MAJOR', color: 'rose' }
                                ].map((sev) => (
                                    <button
                                        key={sev.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, severity: sev.id })}
                                        className={`py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all border-2 ${formData.severity === sev.id
                                            ? `border-${sev.color}-500 bg-${sev.color}-50 text-${sev.color}-700 shadow-lg shadow-${sev.color}-500/10`
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {sev.id}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Forensic Narrative */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] px-2">DESCRIPTION</h3>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the issue found..."
                                className="w-full px-8 py-6 bg-white border border-slate-200 rounded-[2rem] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-sm font-medium h-48 resize-none shadow-sm shadow-inner"
                                required
                            />
                            <div className="flex justify-end px-2">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${formData.description.length > 50 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                    {formData.description.length} CHARACTERS
                                </span>
                            </div>
                        </div>

                        {/* Protocol Warning */}
                        <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 flex items-start gap-5">
                            <AlertTriangle className="text-rose-500 shrink-0 mt-1" size={24} />
                            <div>
                                <p className="text-[10px] font-bold text-rose-900 uppercase tracking-widest mb-1">WARNING</p>
                                <p className="text-xs font-semibold text-rose-700/80 leading-relaxed uppercase tracking-tighter">
                                    Adding a discrepancy will increase the overall risk score for this candidate.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer Footer */}
                <div className="bg-white px-10 py-8 border-t border-slate-100 flex items-center justify-end gap-4 flex-shrink-0 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 text-slate-400 hover:text-slate-600 font-bold text-[11px] uppercase tracking-widest transition-colors"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="h-14 px-10 bg-slate-900 text-white rounded-[1.25rem] font-bold text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-orange-600 hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-slate-300 transition-all flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                                <span>SAVING...</span>
                            </>
                        ) : (
                            <>
                                <Save size={18} strokeWidth={2.5} />
                                <span>SAVE DISCREPANCY</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddDiscrepancyModal;
