import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import {
    X, Shield, Package, Calendar, CheckCircle, AlertCircle, User, Briefcase, Search, ArrowRight, ShieldCheck, Clock, Settings
} from 'lucide-react';
import dayjs from 'dayjs';

const BGV_PACKAGES = {
    BASIC: {
        name: 'Basic',
        checks: ['Identity', 'Address', 'Employment'],
        description: 'Essential verification for entry-level positions',
        color: 'slate',
        recommended: 'Entry-level, Interns'
    },
    STANDARD: {
        name: 'Standard',
        checks: ['Identity', 'Address', 'Employment', 'Education', 'Criminal'],
        description: 'Comprehensive verification for most positions',
        color: 'indigo',
        recommended: 'Most positions, Standard hiring'
    },
    PREMIUM: {
        name: 'Premium',
        checks: ['Identity', 'Address', 'Employment', 'Education', 'Criminal', 'Social Media', 'Reference'],
        description: 'Complete verification for critical roles',
        color: 'indigo',
        recommended: 'Senior positions, Critical roles'
    }
};

const InitiateBGVModal = ({ onClose, onSuccess, preselectedApplicant = null, preselectedEmployee = null }) => {
    const [applicants, setApplicants] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [mode, setMode] = useState(preselectedEmployee ? 'EMPLOYEE' : 'APPLICANT');
    const [selectedId, setSelectedId] = useState(preselectedEmployee?._id || preselectedApplicant?.id || '');
    const [selectedPackage, setSelectedPackage] = useState('STANDARD');
    const [slaDays, setSlaDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchApplicants();
        fetchEmployees();
    }, []);

    const fetchApplicants = async () => {
        try {
            const res = await api.get('/requirements/applicants');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setApplicants(data);
        } catch (err) {
            console.error('Failed to fetch applicants:', err);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setEmployees(data);
        } catch (err) {
            console.error('Failed to fetch employees:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedId) {
            showToast('error', 'Error', `Please select an ${mode.toLowerCase()}`);
            return;
        }

        // Prevent multiple submissions
        if (loading) {
            return;
        }

        setLoading(true);
        try {
            const payload = {
                package: selectedPackage,
                slaDays
            };

            if (mode === 'APPLICANT') {
                payload.applicationId = selectedId;
            } else {
                payload.employeeId = selectedId;
            }

            const response = await api.post('/bgv/initiate', payload);

            showToast('success', 'Success', 'BGV initiated successfully');
            
            // Call onSuccess after successful creation (201)
            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            // Only log unexpected errors (not expected 409 or 401)
            if (err.response?.status !== 409 && err.response?.status !== 401) {
                console.error('[BGV_INITIATE_ERROR]', err);
            }

            // Handle 409 Conflict: BGV already exists
            if (err.response?.status === 409) {
                const caseId = err.response?.data?.caseId;
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
                // The interceptor will handle redirect to login
                return;
            }

            // Handle other errors
            const errorMessage = err.response?.data?.message || err.message || 'Failed to initiate BGV';
            showToast('error', 'Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const filteredList = (mode === 'APPLICANT' ? applicants : employees)
        .filter(item => {
            const name = mode === 'APPLICANT' ? item.name : `${item.firstName} ${item.lastName}`;
            const email = item.email;
            return name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                email?.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .filter(item => item.bgvStatus === 'NOT_INITIATED' || !item.bgvStatus);

    const alreadyInitiated = (mode === 'APPLICANT' ? applicants : employees)
        .filter(item => {
            const name = mode === 'APPLICANT' ? item.name : `${item.firstName} ${item.lastName}`;
            const email = item.email;
            return name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                email?.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .filter(item => item.bgvStatus && item.bgvStatus !== 'NOT_INITIATED');

    const getPackageColor = (color) => {
        const colors = {
            slate: 'from-slate-500 to-slate-600 shadow-slate-200',
            indigo: 'from-indigo-500 to-[#4F46E5] shadow-indigo-200'
        };
        return colors[color] || colors.indigo;
    };

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-[#4F46E5] px-10 py-8 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center border border-white/30">
                            <Shield size={32} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">INITIATE BGV</h2>
                            <p className="text-indigo-50 font-semibold tracking-widest uppercase text-[10px] opacity-90 mt-1">Start a new background check</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all border border-transparent hover:border-white/30 text-white relative z-10"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-10">

                        {/* Mode Selection */}
                        <div className="flex p-2 bg-white rounded-[1.5rem] border border-slate-200/60 shadow-sm transition-all">
                            <button
                                type="button"
                                onClick={() => { setMode('APPLICANT'); setSelectedId(''); setSearchQuery(''); }}
                                className={`flex-1 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${mode === 'APPLICANT' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <User size={16} /> Applicants
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMode('EMPLOYEE'); setSelectedId(''); setSearchQuery(''); }}
                                className={`flex-1 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${mode === 'EMPLOYEE' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <Briefcase size={16} /> Existing Staff
                            </button>
                        </div>

                        {/* Step 1: Identity Selection */}
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center font-bold text-xs border border-indigo-100 italic">01</div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Select Person</h3>
                            </div>

                            <div className="relative mb-6">
                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={`Search ${mode.toLowerCase()} database...`}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (selectedId) setSelectedId('');
                                    }}
                                    className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:border-[#4F46E5] focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-base font-semibold text-slate-900 placeholder:text-slate-300 shadow-inner"
                                />

                                {selectedId && (
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl shadow-lg animate-in zoom-in duration-300">
                                        <CheckCircle size={16} strokeWidth={2.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Selected</span>
                                    </div>
                                )}
                            </div>

                            {/* List Registry */}
                            <div className="border border-slate-100 rounded-[2rem] max-h-80 overflow-y-auto bg-slate-50/50 p-2 custom-scrollbar">
                                {filteredList.length === 0 && alreadyInitiated.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-100 shadow-sm">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">No matching records found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredList.map((item) => {
                                            const name = mode === 'APPLICANT' ? item.name : `${item.firstName} ${item.lastName}`;
                                            const isSelected = selectedId === item._id;
                                            return (
                                                <div
                                                    key={item._id}
                                                    onClick={() => {
                                                        setSelectedId(item._id);
                                                        setSearchQuery(name);
                                                    }}
                                                    className={`group flex items-center gap-5 p-5 rounded-2xl cursor-pointer transition-all border-2 ${isSelected
                                                        ? 'bg-white border-[#4F46E5] shadow-xl shadow-indigo-500/10'
                                                        : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200 hover:shadow-md'
                                                        }`}
                                                >
                                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl transition-all ${isSelected ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-300 border border-slate-100 shadow-sm group-hover:bg-slate-50'}`}>
                                                        {name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-lg text-slate-900 tracking-tight leading-none mb-1.5 uppercase">{name}</div>
                                                        <div className="text-xs font-semibold text-slate-400">{item.email}</div>
                                                        {mode === 'EMPLOYEE' && item.employeeId && (
                                                            <div className="text-[9px] font-bold uppercase tracking-widest mt-2 text-[#4F46E5] opacity-80">ID: {item.employeeId}</div>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <div className="w-10 h-10 bg-indigo-50 text-[#4F46E5] rounded-full flex items-center justify-center animate-in zoom-in">
                                                            <ArrowRight size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {alreadyInitiated.map((item) => {
                                            const name = mode === 'APPLICANT' ? item.name : `${item.firstName} ${item.lastName}`;
                                            return (
                                                <div
                                                    key={item._id}
                                                    className="flex items-center gap-5 p-5 rounded-2xl opacity-40 grayscale pointer-events-none"
                                                >
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl bg-slate-200 text-slate-400">
                                                        {name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-lg text-slate-900 leading-none mb-1.5 uppercase">{name}</div>
                                                        <div className="text-xs font-semibold text-slate-400">{item.email}</div>
                                                    </div>
                                                    <div className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                        ACTIVE CASE
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Verification Logistics */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm flex flex-col">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center font-bold text-xs border border-indigo-100 italic">02</div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Select Package</h3>
                                </div>

                                <div className="space-y-4 flex-1">
                                    {Object.entries(BGV_PACKAGES).map(([key, pkg]) => (
                                        <label
                                            key={key}
                                            className={`group relative flex flex-col p-6 rounded-[2rem] border-2 cursor-pointer transition-all duration-300 ${selectedPackage === key
                                                ? 'border-[#4F46E5] bg-indigo-50 shadow-xl shadow-indigo-500/10'
                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="package"
                                                value={key}
                                                checked={selectedPackage === key}
                                                onChange={(e) => setSelectedPackage(e.target.value)}
                                                className="sr-only"
                                            />
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${getPackageColor(pkg.color)} text-white shadow-lg`}>
                                                        <Package size={20} strokeWidth={2.5} />
                                                    </div>
                                                    <span className="text-lg font-bold text-slate-900 tracking-tight uppercase">{pkg.name}</span>
                                                </div>
                                                {selectedPackage === key && (
                                                    <ShieldCheck size={24} className="text-[#4F46E5]" strokeWidth={2.5} />
                                                )}
                                            </div>
                                            <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mb-4">{pkg.description}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {pkg.checks.slice(0, 4).map((check, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 bg-white/60 border border-slate-200/60 rounded-md text-[8px] font-bold text-slate-600 uppercase tracking-tighter">
                                                        {check}
                                                    </span>
                                                ))}
                                                {pkg.checks.length > 4 && (
                                                    <span className="px-2 py-0.5 text-[8px] font-bold text-slate-400">+ {pkg.checks.length - 4} more</span>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center font-bold text-xs border border-indigo-100 italic">03</div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Set Due Date</h3>
                                </div>

                                <div className="space-y-10">
                                    <div className="flex items-center gap-8">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={slaDays}
                                                onChange={(e) => setSlaDays(parseInt(e.target.value))}
                                                className="w-32 px-4 py-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-[#4F46E5] focus:bg-white transition-all outline-none text-center font-bold text-3xl text-slate-900 shadow-inner"
                                            />
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">Days</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 tracking-tight uppercase leading-none mb-2 font-bold italic">Timeline</div>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                                                <Calendar size={14} className="text-[#4F46E5]" />
                                                Due: {dayjs().add(slaDays, 'day').format('DD MMM, YYYY')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">QUICK SELECT</div>
                                        <div className="grid grid-cols-5 gap-2">
                                            {[3, 5, 7, 10, 14].map((days) => (
                                                <button
                                                    key={days}
                                                    type="button"
                                                    onClick={() => setSlaDays(days)}
                                                    className={`py-3 rounded-xl font-bold text-xs transition-all border-2 ${slaDays === days
                                                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:border-[#4F46E5] hover:text-[#4F46E5]'
                                                        }`}
                                                >
                                                    {days}d
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-amber-200">
                                                <Clock size={24} className="text-amber-500" />
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest mb-1.5">SLA Warning</h4>
                                                <p className="text-[11px] font-semibold text-amber-700/80 leading-relaxed">The system will trigger escalation workflows if the case is not closed within the designated {slaDays}-day window.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary & Submission */}
                        <div className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                                <Shield size={160} className="text-white" />
                            </div>
                            <div className="relative z-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                                    <div className="space-y-6">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#4F46E5]/20 text-[#4F46E5] rounded-lg text-[9px] font-bold uppercase tracking-widest border border-[#4F46E5]/20">
                                            SUMMARY
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-12 gap-y-6">
                                            <SummaryItem label="PACKAGE" value={BGV_PACKAGES[selectedPackage].name} />
                                            <SummaryItem label="CHECKS" value={BGV_PACKAGES[selectedPackage].checks.length} />
                                            <SummaryItem label="TOTAL DAYS" value={`${slaDays} DAYS`} />
                                            <SummaryItem label="DUE DATE" value={dayjs().add(slaDays, 'day').format('DD MMM')} />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 shrink-0">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-8 py-5 bg-white/5 border border-white/10 text-white rounded-[1.5rem] font-bold text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !selectedId}
                                            className="px-10 py-5 bg-[#4F46E5] text-white rounded-[1.5rem] font-bold text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/20 hover:bg-[#0ea5e9] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center gap-3"
                                        >
                                            {loading ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                    <span>Initializing...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <span>Initiate BGV</span>
                                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const SummaryItem = ({ label, value }) => (
    <div className="flex flex-col gap-1.5">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</div>
        <div className="text-sm font-bold text-white tracking-tight uppercase italic">{value}</div>
    </div>
);

export default InitiateBGVModal;
