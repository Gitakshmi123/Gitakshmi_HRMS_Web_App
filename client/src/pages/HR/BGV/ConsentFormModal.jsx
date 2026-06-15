import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, FileText, MapPin, Smartphone, ShieldCheck, Signature, Edit2, Eraser, Globe } from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

const ConsentFormModal = ({ isOpen, onClose, caseData, onConsentCaptured }) => {
    const [loading, setLoading] = useState(false);
    const [consentGiven, setConsentGiven] = useState(false);
    const [signatureType, setSignatureType] = useState('TYPED_NAME');
    const [typedName, setTypedName] = useState('');
    const [scopeAgreed, setScopeAgreed] = useState([]);
    const [location, setLocation] = useState({ city: '', country: 'India' });
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
        // Pre-select all checks by default
        if (caseData?.checks?.length > 0 && scopeAgreed.length === 0) {
            setScopeAgreed(caseData.checks.map(c => ({
                checkType: c.type,
                agreedAt: new Date().toISOString()
            })));
        }
    }, [caseData]);

    if (!isMounted || !isOpen || typeof document === 'undefined') return null;

    const handleCheckChange = (checkType) => {
        if (scopeAgreed.find(s => s.checkType === checkType)) {
            setScopeAgreed(scopeAgreed.filter(s => s.checkType !== checkType));
        } else {
            setScopeAgreed([...scopeAgreed, {
                checkType,
                agreedAt: new Date().toISOString()
            }]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!consentGiven) {
            showToast('error', 'Error', 'Please confirm your consent to proceed');
            return;
        }

        if (scopeAgreed.length === 0) {
            showToast('error', 'Error', 'Please select at least one verification module');
            return;
        }

        if (signatureType === 'TYPED_NAME' && !typedName.trim()) {
            showToast('error', 'Error', 'Legal signature name is required');
            return;
        }

        setLoading(true);

        let signatureData = '';
        if (signatureType === 'TYPED_NAME') {
            signatureData = typedName;
        } else {
            // Check if canvas is blank (this is a simple heuristic)
            const canvas = canvasRef.current;
            if (canvas) {
                const blank = document.createElement('canvas');
                blank.width = canvas.width;
                blank.height = canvas.height;
                if (canvas.toDataURL() === blank.toDataURL()) {
                    showToast('error', 'Error', 'Please draw your signature on the canvas');
                    return;
                }
                signatureData = canvas.toDataURL();
            }
        }

        try {
            const payload = {
                consentGiven: true,
                signatureType,
                signatureData,
                scopeAgreed,
                location
            };

            const res = await api.post(`/bgv/case/${caseData._id}/consent`, payload);

            showToast('success', 'Success', 'Digital consent captured in audit trail');
            onConsentCaptured(res.data.data);
            onClose();
        } catch (err) {
            console.error('Failed to capture consent:', err);
            showToast('error', 'Error', err.response?.data?.message || 'Failed to capture consent');
        } finally {
            setLoading(false);
        }
    };

    const startDrawing = (e) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#4F46E5';
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9990] p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-[#4F46E5] px-10 py-8 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center border border-white/30">
                            <ShieldCheck size={32} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Consent Form</h2>
                            <p className="text-indigo-50 font-semibold tracking-widest uppercase text-[10px] opacity-90 mt-1">Background Check Authorization</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all border border-transparent hover:border-white/30 text-white relative z-10"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                <form id="consent-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-8">

                        {/* Summary Card */}
                        <div className="bg-[#4F46E5] rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                            <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
                            <h3 className="text-[10px] font-bold text-indigo-100 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <FileText size={14} className="text-indigo-100" />
                                DETAILS
                            </h3>
                            <div className="grid grid-cols-2 gap-8 relative z-10">
                                <div>
                                    <div className="text-[9px] font-bold text-indigo-100/60 uppercase tracking-widest mb-1">Case ID</div>
                                    <div className="text-base font-bold tracking-tight">{caseData.caseId}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-bold text-indigo-100/60 uppercase tracking-widest mb-1">Package</div>
                                    <div className="text-base font-bold tracking-tight uppercase">{caseData.package}</div>
                                </div>
                            </div>
                        </div>

                        {/* Legal Declaration */}
                        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm transition-all hover:border-indigo-200">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Signature size={14} className="text-[#4F46E5]" />
                                AUTHORIZATION
                            </h3>
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner">
                                <div className="text-xs text-slate-600 font-semibold leading-relaxed space-y-4 max-h-48 overflow-y-auto pr-4 custom-scrollbar uppercase tracking-tight">
                                    <p>I HEREBY AUTHORIZE THE COMPANY AND ITS DESIGNATED THIRD-PARTY AGENTS TO CONDUCT A COMPREHENSIVE BACKGROUND VERIFICATION AS OUTLINED BELOW.</p>
                                    <ul className="space-y-3 list-none">
                                        <li className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1 shrink-0"></div>
                                            <span>I WARRANT THAT ALL INFORMATION PROVIDED IS LEGALLY ACCURATE AND COMPLETE TO THE BEST OF MY KNOWLEDGE.</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1 shrink-0"></div>
                                            <span>I ACKNOWLEDGE THAT THE COMPANY MAY INTERFACE WITH PREVIOUS EMPLOYERS, ACADEMIC INSTITUTIONS, AND REGULATORY BODIES.</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1 shrink-0"></div>
                                            <span>SYSTEM MISREPRESENTATION MAY RESULT IN IMMEDIATE DISQUALIFICATION OR TERMINATION OF THE ENGAGEMENT.</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1 shrink-0"></div>
                                            <span>DATA PROCESSING WILL COMPLY WITH GLOBAL ENCRYPTION AND PRIVACY STANDARDS (GDPR/APP/IT ACT).</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Scope Checklist */}
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm transition-all hover:border-indigo-200">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] mb-6">SELECT CHECKS</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {caseData.checks?.map((check) => {
                                    const isAgreed = scopeAgreed.find(s => s.checkType === check.type);
                                    return (
                                        <label
                                            key={check._id}
                                            className={`flex items-center gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all ${isAgreed
                                                ? 'border-[#4F46E5] bg-indigo-50 shadow-lg shadow-indigo-500/5'
                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isAgreed ? 'bg-[#4F46E5] border-[#4F46E5]' : 'border-slate-200 bg-white'}`}>
                                                {isAgreed && <CheckCircle size={14} className="text-white" strokeWidth={3} />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!isAgreed}
                                                onChange={() => handleCheckChange(check.type)}
                                                className="hidden"
                                            />
                                            <span className="text-sm font-bold text-slate-900 tracking-tight uppercase">
                                                {check.type.replace(/_/g, ' ')}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Signature Section */}
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em] mb-6">SIGNATURE TYPE</h3>
                            <div className="flex p-1.5 bg-slate-100 rounded-[1.5rem] mb-8">
                                <button
                                    type="button"
                                    onClick={() => setSignatureType('TYPED_NAME')}
                                    className={`flex-1 py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 ${signatureType === 'TYPED_NAME' ? 'bg-white text-[#4F46E5] shadow-xl shadow-indigo-500/5' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Globe size={14} /> TYPED NAME
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSignatureType('DIGITAL_SIGNATURE')}
                                    className={`flex-1 py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 ${signatureType === 'DIGITAL_SIGNATURE' ? 'bg-white text-[#4F46E5] shadow-xl shadow-indigo-500/5' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Edit2 size={14} /> DRAW SIGNATURE
                                </button>
                            </div>

                            {signatureType === 'TYPED_NAME' ? (
                                <div className="space-y-6">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={typedName}
                                            onChange={(e) => setTypedName(e.target.value)}
                                            placeholder="Enter Full Name..."
                                            className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:border-[#4F46E5] focus:bg-white transition-all outline-none text-base font-bold text-slate-900 shadow-inner"
                                            required
                                        />
                                    </div>
                                    {typedName && (
                                        <div className="p-10 bg-slate-50 border border-slate-100 rounded-[2rem] text-center shadow-inner group">
                                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-6">SIGNATURE PREVIEW</div>
                                            <p className="text-4xl font-signature text-[#4F46E5] italic tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity">{typedName}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="border-2 border-slate-100 rounded-[2rem] p-4 bg-slate-100/50 shadow-inner overflow-hidden">
                                        <canvas
                                            ref={canvasRef}
                                            width={700}
                                            height={200}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            className="w-full h-40 bg-white border border-slate-200/60 rounded-[1.5rem] cursor-crosshair shadow-sm"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearCanvas}
                                        className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors px-4"
                                    >
                                        <Eraser size={14} /> RESET CANVAS
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Location Metadata */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <MapPin size={14} className="text-[#4F46E5]" />
                                    JURISDICTION CITY
                                </h3>
                                <input
                                    type="text"
                                    value={location.city}
                                    onChange={(e) => setLocation({ ...location, city: e.target.value })}
                                    placeholder="Enter Location..."
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-[#4F46E5] focus:bg-white transition-all outline-none font-semibold text-sm text-slate-900 shadow-inner"
                                />
                            </div>
                            <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Globe size={14} className="text-[#4F46E5]" />
                                    REGION/COUNTRY
                                </h3>
                                <input
                                    type="text"
                                    value={location.country}
                                    onChange={(e) => setLocation({ ...location, country: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-[#4F46E5] focus:bg-white transition-all outline-none font-semibold text-sm text-slate-900 shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Final Attestation */}
                        <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-300 ${consentGiven ? 'bg-indigo-50 border-[#4F46E5] shadow-xl shadow-indigo-500/10' : 'bg-slate-50 border-slate-200'}`}>
                            <label className="flex items-start gap-5 cursor-pointer">
                                <div className={`w-8 h-8 rounded-xl border-2 shrink-0 flex items-center justify-center transition-all ${consentGiven ? 'bg-[#4F46E5] border-[#4F46E5]' : 'bg-white border-slate-300'}`}>
                                    {consentGiven && <CheckCircle size={18} className="text-white" strokeWidth={3} />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={consentGiven}
                                    onChange={(e) => setConsentGiven(e.target.checked)}
                                    className="hidden"
                                    required
                                />
                                <div>
                                    <strong className="text-sm font-bold text-slate-900 uppercase tracking-tight block mb-1">CONSENT</strong>
                                    <p className="text-xs font-semibold text-slate-500 leading-relaxed uppercase tracking-tighter">
                                        I confirm my consent for the background check.
                                    </p>
                                </div>
                            </label>
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
                        type="submit"
                        form="consent-form"
                        disabled={loading || !consentGiven}
                        className="h-14 px-10 bg-slate-900 text-white rounded-[1.25rem] font-bold text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-[#4F46E5] hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-slate-400 transition-all flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                                <span>SAVING...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} strokeWidth={2.5} />
                                <span>SUBMIT CONSENT</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConsentFormModal;
