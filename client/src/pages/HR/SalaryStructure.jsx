import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Calculator, ShieldCheck, AlertCircle, Check, X, Database, Lock, Unlock, IndianRupee, TrendingUp, TrendingDown, Plus, MapPin, SlidersHorizontal, FileCode2
} from 'lucide-react';
import { Can } from "../../components/rbac/PermissionGate";
import api from '../../utils/api';

/**
 * ============================================
 * SALARY STRUCTURE (v9.0) - ARCHITECT EDITION
 * ============================================
 */

const STATE_CITY_PRESETS = {
    Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
    Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
    Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru'],
    Delhi: ['New Delhi', 'Delhi'],
    Telangana: ['Hyderabad'],
    'Tamil Nadu': ['Chennai', 'Coimbatore'],
    Haryana: ['Gurugram', 'Faridabad'],
    'West Bengal': ['Kolkata'],
    Rajasthan: ['Jaipur', 'Udaipur'],
    'Uttar Pradesh': ['Noida', 'Lucknow', 'Ghaziabad']
};

const DEFAULT_LOCATION_CONTEXT = {
    country: 'IN',
    workState: 'Gujarat',
    workCity: 'Ahmedabad',
    payrollRegion: 'Gujarat',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    applyStatutory: true
};

const CUSTOM_COMPONENT_DEFAULT = {
    section: 'Earnings',
    name: '',
    mode: 'FIXED',
    monthlyAmount: '',
    percentage: '',
    formula: '',
    formulaFrequency: 'MONTHLY'
};

export default function SalaryStructure() {
    const { candidateId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [targetType, setTargetType] = useState(searchParams.get('type') === 'employee' ? 'employee' : 'applicant');

    // --- CORE STATE ---
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [ctcInput, setCtcInput] = useState('');
    const [selectedEarnings, setSelectedEarnings] = useState([]);
    const [selectedDeductions, setSelectedDeductions] = useState([]);
    const [selectedBenefits, setSelectedBenefits] = useState([]);
    const [locationContext, setLocationContext] = useState(DEFAULT_LOCATION_CONTEXT);
    const [rulePreview, setRulePreview] = useState(null);
    const [ruleLoading, setRuleLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    // --- CALCULATION RESULT STATE ---
    const [salaryData, setSalaryData] = useState({
        annualCTC: 0,
        locked: false,
        breakdown: { earnings: [], deductions: [], benefits: [] },
        totals: { netMonthly: 0, grossMonthly: 0, deductionMonthly: 0 }
    });

    // --- MODAL STATE ---
    const [showModal, setShowModal] = useState(false);
    const [activeSection, setActiveSection] = useState(null);
    const [availableComponents, setAvailableComponents] = useState({ earnings: [], deductions: [], benefits: [] });
    const [tempSelectedIds, setTempSelectedIds] = useState([]);
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customDraft, setCustomDraft] = useState(CUSTOM_COMPONENT_DEFAULT);

    // --- HELPERS ---
    const safe = (v) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
    };
    const formatINR = (v) => {
        try {
            return safe(v).toLocaleString('en-IN');
        } catch {
            return "0";
        }
    };

    const cityOptions = useMemo(() => {
        return STATE_CITY_PRESETS[locationContext.workState] || [];
    }, [locationContext.workState]);

    const updateLocationContext = (field, value) => {
        setLocationContext(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'workState') {
                next.payrollRegion = value || prev.payrollRegion;
                next.workCity = '';
            }
            if (field === 'workCity' && !next.payrollRegion) {
                next.payrollRegion = next.workState || value;
            }
            return next;
        });
    };

    const handleTemplateSelect = async (templateId) => {
        if (!templateId) {
            setSelectedTemplateId('');
            return;
        }
        setSelectedTemplateId(templateId);
        try {
            setLoading(true);
            const res = await api.get(`/payroll/salary-templates/${templateId}`);
            if (res.data?.success) {
                const template = res.data.data;
                
                const mappedEarnings = (template.earnings || []).map(e => {
                    const master = availableComponents.earnings.find(m => m.name.toLowerCase() === e.name.toLowerCase() || (e.componentCode && m._id === e.componentCode));
                    return master ? {
                        ...master,
                        calculationType: e.calculationType,
                        percentage: e.percentage,
                        formula: e.formula,
                        value: e.percentage || e.monthlyAmount || 0,
                        isManual: e.calculationType === 'FIXED'
                    } : {
                        _id: e.componentCode || e._id,
                        name: e.name,
                        calculationType: e.calculationType,
                        percentage: e.percentage,
                        formula: e.formula,
                        value: e.percentage || e.monthlyAmount || 0,
                        isManual: e.calculationType === 'FIXED'
                    };
                });

                const mappedDeductions = (template.employeeDeductions || []).map(d => {
                    const master = availableComponents.deductions.find(m => m.name.toLowerCase() === d.name.toLowerCase() || (d.componentCode && m._id === d.componentCode));
                    const calcType = d.amountType === 'PERCENTAGE' ? 'PERCENTAGE_OF_BASIC' : d.amountType;
                    return master ? {
                        ...master,
                        calculationType: calcType,
                        percentage: d.amountValue,
                        formula: d.formula,
                        value: d.amountValue || 0,
                        isManual: d.amountType === 'FIXED'
                    } : {
                        _id: d.componentCode || d._id,
                        name: d.name,
                        calculationType: calcType,
                        percentage: d.amountValue,
                        formula: d.formula,
                        value: d.amountValue || 0,
                        isManual: d.amountType === 'FIXED'
                    };
                });

                const mappedBenefits = (template.employerDeductions || []).map(b => {
                    const master = availableComponents.benefits.find(m => m.name.toLowerCase() === b.name.toLowerCase() || (b.componentCode && m._id === b.componentCode));
                    return master ? {
                        ...master,
                        calculationType: b.calculationType,
                        percentage: b.percentage,
                        formula: b.formula,
                        value: b.percentage || b.monthlyAmount || 0,
                        isManual: b.calculationType === 'FIXED'
                    } : {
                        _id: b.componentCode || b._id,
                        name: b.name,
                        calculationType: b.calculationType,
                        percentage: b.percentage,
                        formula: b.formula,
                        value: b.percentage || b.monthlyAmount || 0,
                        isManual: b.calculationType === 'FIXED'
                    };
                });

                setSelectedEarnings(mappedEarnings);
                setSelectedDeductions(mappedDeductions);
                setSelectedBenefits(mappedBenefits);
                
                if (template.annualCTC) {
                    setCtcInput(template.annualCTC.toString());
                }
            }
        } catch (err) {
            console.error("Failed to load template details:", err);
            alert("Failed to load template details: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const deriveCode = (c) => {
        if (!c) return '';
        // Prioritize code
        if (c.code) return c.code.toUpperCase().trim();

        const raw = (c.name || '').toUpperCase().trim();
        // Exact matches
        if (raw === 'BASIC' || raw === 'BASIC SALARY' || raw === 'BASIC PAY') return 'BASIC';
        if (raw === 'SPECIAL ALLOWANCE') return 'SPECIAL_ALLOWANCE';

        return raw.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        try {
            const initialize = async () => {
                try {
                    setLoading(true);

                    // Fetch Master Components & Salary Templates
                    const [eMaster, dMaster, bMaster, templatesRes] = await Promise.all([
                        api.get('/payroll/earnings').catch(() => ({ data: { data: [] } })),
                        api.get('/deductions').catch(() => ({ data: { data: [] } })),
                        api.get('/payroll/benefits').catch(() => ({ data: { data: [] } })),
                        api.get('/payroll/salary-templates').catch(() => ({ data: { data: [] } }))
                    ]);
                    setAvailableComponents({
                        earnings: eMaster.data?.data || [],
                        deductions: dMaster.data?.data || [],
                        benefits: bMaster.data?.data || []
                    });
                    setTemplates(templatesRes.data?.data || []);

                    // Fetch Current Salary Snapshot
                    try {
                        const type = searchParams.get('type');
                        console.log(`[DEBUG] Fetching salary for ${type || 'unknown'} id: ${candidateId}`);

                        // Strategy: Try the explicitly provided type first, then fallback to other if empty
                        let currentRes;
                        if (type === 'employee') {
                            currentRes = await api.get(`/salary/current?employeeId=${candidateId}`);
                        } else if (type === 'applicant') {
                            currentRes = await api.get(`/salary/current?applicantId=${candidateId}`);
                        } else {
                            // No type provided - try both
                            currentRes = await api.get(`/salary/current?employeeId=${candidateId}`);
                            if (!currentRes.data?.data) {
                                currentRes = await api.get(`/salary/current?applicantId=${candidateId}`);
                            }
                        }

                        const sData = currentRes.data?.data;
                        console.log(`[DEBUG] Received salary data:`, sData);

                        if (sData) {
                            // Update targetType state if it was found under a different context
                            if (sData.employee && sData.employee === candidateId) setTargetType('employee');
                            else if (sData.applicant && sData.applicant === candidateId) setTargetType('applicant');

                            setSalaryData({
                                annualCTC: safe(sData.annualCTC),
                                locked: !!sData.locked,
                                breakdown: {
                                    earnings: sData.earnings || [],
                                    deductions: sData.deductions || [],
                                    benefits: sData.benefits || []
                                },
                                totals: sData.totals || { netMonthly: 0, grossMonthly: 0, deductionMonthly: 0 }
                            });
                            setCtcInput(sData.annualCTC ? sData.annualCTC.toString() : '');
                            if (sData.payrollContext?.locationContext) {
                                setLocationContext(prev => ({
                                    ...prev,
                                    ...sData.payrollContext.locationContext,
                                    effectiveFrom: sData.payrollContext.locationContext.effectiveFrom
                                        ? String(sData.payrollContext.locationContext.effectiveFrom).slice(0, 10)
                                        : (sData.effectiveFrom ? String(sData.effectiveFrom).slice(0, 10) : prev.effectiveFrom)
                                }));
                            } else if (sData.effectiveFrom) {
                                setLocationContext(prev => ({ ...prev, effectiveFrom: String(sData.effectiveFrom).slice(0, 10) }));
                            }
                            setSelectedEarnings(sData.earnings || []);
                            setSelectedDeductions(sData.deductions || []);
                            setSelectedBenefits(sData.benefits || []);
                        }
                    } catch (err) {
                        console.log("[DEBUG] No existing salary data found - starting fresh", err.message);
                    }
                } catch (err) {
                    console.error("[DEBUG] Initialization Error:", err);
                    setError("Failed to load components: " + err.message);
                } finally {
                    setLoading(false);
                }
            };

            initialize();
        } catch (outerErr) {
            console.error("[SALARY_STRUCTURE] Outer error:", outerErr);
            setError("Critical initialization error");
            setLoading(false);
        }
    }, [candidateId]);

    useEffect(() => {
        if (loading) return;

        const timer = setTimeout(async () => {
            try {
                setRuleLoading(true);
                const res = await api.get('/payroll-rules/rules/preview', {
                    params: {
                        country: locationContext.country || 'IN',
                        workState: locationContext.workState || '',
                        workCity: locationContext.workCity || '',
                        payrollRegion: locationContext.payrollRegion || ''
                    }
                });
                setRulePreview(res.data?.data || null);
            } catch (err) {
                console.warn('[SALARY_STRUCTURE] Rule preview failed:', err.message);
                setRulePreview(null);
            } finally {
                setRuleLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [loading, locationContext.country, locationContext.workState, locationContext.workCity, locationContext.payrollRegion]);

    // --- AUTO-CALCULATION LOGIC ---
    useEffect(() => {
        const ctc = safe(ctcInput);
        if (loading || ctc <= 0 || salaryData.locked) return;

        const timer = setTimeout(() => {
            handleCalculate();
        }, 800);

        return () => clearTimeout(timer);
    }, [ctcInput, selectedEarnings, selectedDeductions, selectedBenefits, locationContext, loading]);

    const handleCalculate = async () => {
        try {
            const payload = {
                annualCTC: safe(ctcInput),
                selectedEarnings,
                selectedDeductions,
                selectedBenefits,
                locationContext,
                payrollContext: { applyStatutory: locationContext.applyStatutory !== false }
            };
            console.log("🚀 [SALARY_STRUCTURE] handleCalculate payload:", JSON.stringify(payload, null, 2));

            const res = await api.post('/salary/preview', payload);
            if (res.data?.success) {
                const result = res.data.data;
                console.log("✅ [SALARY_STRUCTURE] Received calculation result:", result);
                setSalaryData({
                    annualCTC: result.annualCTC || 0,
                    locked: false,
                    breakdown: {
                        earnings: result.earnings || [],
                        deductions: result.deductions || [],
                        benefits: result.benefits || []
                    },
                    totals: result.totals || { netMonthly: 0, grossMonthly: 0, deductionMonthly: 0 }
                });
                if (result.payrollContext?.locationPolicySnapshot || result.payrollContext?.locationPolicy) {
                    setRulePreview(prev => ({
                        ...(prev || {}),
                        resolvedPolicy: result.payrollContext.locationPolicy,
                        snapshot: result.payrollContext.locationPolicySnapshot
                    }));
                }

                // DANGER PREVENTER: Do NOT update selectedLists here unless necessary, 
                // but we should ensure they are in sync if the engine added something mandatory.
                // However, for manual persistence, it's safer to keep what the user selected.
            }
        } catch (err) {
            console.error("Calculation Error:", err);
            setError("Calculation failed: " + (err.response?.data?.message || err.message));
        }
    };

    // --- ACTIONS ---
    const handleSaveDraft = async () => {
        if (safe(ctcInput) <= 0) {
            alert("Please enter a valid CTC before saving.");
            return;
        }
        try {
            setSaving(true);
            const payload = {
                [targetType === 'applicant' ? 'applicantId' : 'employeeId']: candidateId,
                annualCTC: safe(ctcInput),
                earnings: selectedEarnings,
                deductions: selectedDeductions,
                benefits: selectedBenefits,
                locationContext,
                effectiveFrom: locationContext.effectiveFrom,
                payrollContext: { applyStatutory: locationContext.applyStatutory !== false }
            };
            const res = await api.post('/salary/assign', payload);
            if (res.data?.success) {
                const sData = res.data.data;
                // Sync state from server to be 100% sure we have what's saved
                setSalaryData({
                    annualCTC: safe(sData.annualCTC),
                    locked: !!sData.locked,
                    breakdown: {
                        earnings: sData.earnings || [],
                        deductions: sData.deductions || [],
                        benefits: sData.benefits || []
                    },
                    totals: sData.totals || { netMonthly: 0, grossMonthly: 0, deductionMonthly: 0 }
                });
                setSelectedEarnings(sData.earnings || []);
                setSelectedDeductions(sData.deductions || []);
                setSelectedBenefits(sData.benefits || []);

                alert("Salary Draft Saved Successfully");
            }
        } catch (err) {
            console.error("Save Draft Error:", err);
            alert("Save Failed: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleFinalize = async () => {
        try {
            setSaving(true);
            const payload = {
                [targetType === 'applicant' ? 'applicantId' : 'employeeId']: candidateId // Dynamic Key
            };
            const res = await api.post('/salary/confirm', payload);
            if (res.data?.success) {
                setSalaryData(p => ({ ...p, locked: true }));
                alert("Salary Finalized & Locked!");
            }
        } catch (err) {
            alert("Lock Failed: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleUnlock = async () => {
        if (!window.confirm("Unlock this salary? All locked data will become editable.")) return;
        try {
            setSaving(true);
            const payload = {
                [targetType === 'applicant' ? 'applicantId' : 'employeeId']: candidateId // Dynamic Key
            };
            await api.post('/salary/unlock', payload);
            setSalaryData(p => ({ ...p, locked: false }));
        } catch {
            alert("Unlock Failed");
        } finally {
            setSaving(false);
        }
    };

    // --- MODAL WRANGLING ---
    const openModal = (section) => {
        if (salaryData.locked) return;
        setActiveSection(section);
        const current = section === 'Earnings' ? selectedEarnings : section === 'Deductions' ? selectedDeductions : selectedBenefits;
        const masterList = availableComponents[section.toLowerCase()] || [];

        // Match existing selected items to Master IDs (Handle Legacy Data without _id)
        let currentIds = current.map(sel => {
            // 1. If it already has a valid Master ID
            if (sel._id && masterList.some(m => m._id === sel._id)) return sel._id;

            // 2. Fallback: Match by Derived Code
            const selCode = deriveCode(sel);
            const match = masterList.find(m => deriveCode(m) === selCode);
            return match ? match._id : null;
        }).filter(Boolean).map(id => id.toString()); // Ensure strings

        // FORCE MANDATORY: If section is Earnings, make sure BASIC and SPECIAL_ALLOWANCE are in currentIds if they exist in masterList
        if (section === 'Earnings') {
            masterList.forEach(m => {
                const code = deriveCode(m);
                if (code === 'BASIC' || code === 'SPECIAL_ALLOWANCE') {
                    const idStr = m._id?.toString();
                    if (idStr && !currentIds.includes(idStr)) {
                        currentIds.push(idStr);
                    }
                }
            });
        }

        console.log(`🔍 [SALARY_STRUCTURE] openModal(${section}): initializing tempSelectedIds with`, currentIds);
        setTempSelectedIds(currentIds);
        setShowModal(true);
    };

    const confirmSelection = () => {
        const sectionKey = activeSection.toLowerCase();
        const masterList = availableComponents[sectionKey] || [];

        // Use string comparison for safety
        const newSelectedMaster = masterList.filter(c => tempSelectedIds.includes(c._id?.toString()));

        // PRESERVE ALL NON-MASTER COMPONENTS: 
        const current = sectionKey === 'earnings' ? selectedEarnings : sectionKey === 'deductions' ? selectedDeductions : selectedBenefits;
        const remainingComponents = current.filter(c => !masterList.some(m => m._id?.toString() === c._id?.toString()));

        const newSelected = [...newSelectedMaster, ...remainingComponents];

        console.log(`✅ [SALARY_STRUCTURE] confirmSelection(${activeSection}): updating state to`, newSelected);

        if (activeSection === 'Earnings') setSelectedEarnings(newSelected);
        if (activeSection === 'Deductions') setSelectedDeductions(newSelected);
        if (activeSection === 'Benefits') setSelectedBenefits(newSelected);

        setShowModal(false);
    };

    const openCustomComponentModal = (section) => {
        if (salaryData.locked) return;
        setCustomDraft({
            ...CUSTOM_COMPONENT_DEFAULT,
            section
        });
        setShowCustomModal(true);
    };

    const saveCustomComponent = () => {
        const name = customDraft.name.trim();
        if (!name) {
            alert('Component name is required.');
            return;
        }

        const code = deriveCode({ name });
        const sectionKey = customDraft.section.toLowerCase();
        let newComponent = {
            code,
            name,
            basedOn: 'NA',
            isCustom: true,
            isManual: false,
            isSystemGenerated: false
        };

        if (customDraft.mode === 'FORMULA') {
            if (!customDraft.formula.trim()) {
                alert('Formula is required.');
                return;
            }
            newComponent = {
                ...newComponent,
                calculationType: 'FORMULA',
                formula: customDraft.formula.trim().toUpperCase(),
                formulaFrequency: customDraft.formulaFrequency,
                value: 0
            };
        } else if (customDraft.mode === 'PERCENTAGE_OF_CTC' || customDraft.mode === 'PERCENTAGE_OF_BASIC') {
            const percentage = safe(customDraft.percentage);
            if (percentage <= 0) {
                alert('Percentage must be greater than 0.');
                return;
            }
            newComponent = {
                ...newComponent,
                calculationType: customDraft.mode,
                basedOn: customDraft.mode === 'PERCENTAGE_OF_BASIC' ? 'BASIC' : 'CTC',
                value: percentage,
                percentage
            };
        } else {
            const monthly = safe(customDraft.monthlyAmount);
            if (monthly <= 0) {
                alert('Monthly amount must be greater than 0.');
                return;
            }
            newComponent = {
                ...newComponent,
                calculationType: 'FIXED',
                value: monthly,
                amount: monthly,
                monthly,
                yearly: monthly * 12,
                isManual: true
            };
        }

        const append = (items) => [...items.filter(item => deriveCode(item) !== code), newComponent];
        if (sectionKey === 'earnings') setSelectedEarnings(append);
        if (sectionKey === 'deductions') setSelectedDeductions(append);
        if (sectionKey === 'benefits') setSelectedBenefits(append);
        setShowCustomModal(false);
    };

    // --- AUTO-BALANCE LOGIC (NEW) ---
    // --- AUTO-BALANCE LOGIC (SMART FIT) ---
    // --- AUTO-BALANCE LOGIC (SECURE API MIGRATION) ---
    const handleAutoBalance = async () => {
        const ctc = safe(ctcInput);
        if (ctc <= 0) return;

        try {
            setLoading(true);
            const payload = {
                annualCTC: ctc,
                selectedEarnings,
                selectedDeductions,
                selectedBenefits,
                locationContext,
                payrollContext: { applyStatutory: locationContext.applyStatutory !== false }
            };

            // Call the secure backend API for balancing logic
            const res = await api.post('/salary/auto-balance', payload);

            if (res.data?.success) {
                const result = res.data.data;
                setSalaryData({
                    annualCTC: result.annualCTC || 0,
                    locked: false,
                    breakdown: {
                        earnings: result.earnings || [],
                        deductions: result.deductions || [],
                        benefits: result.benefits || []
                    },
                    totals: result.totals || { netMonthly: 0, grossMonthly: 0, deductionMonthly: 0 }
                });

                // Sync the selected lists with what the server returned
                setSelectedEarnings(result.earnings || []);
                setSelectedDeductions(result.deductions || []);
                setSelectedBenefits(result.benefits || []);
                setError(null);
            }
        } catch (err) {
            console.error("Auto-Balance API Error:", err);
            setError("Auto-Balance failed: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // --- VALIDATION FOR SHIELD ---
    const isSumCorrect = Math.abs(safe(salaryData.annualCTC) - safe(ctcInput)) < 2 && safe(ctcInput) > 0;
    const canLock = isSumCorrect && !salaryData.locked && salaryData.breakdown.earnings.length > 0;
    const resolvedPolicy = rulePreview?.resolvedPolicy || null;
    const ruleSnapshot = rulePreview?.snapshot || null;

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Database className="animate-spin text-blue-600" size={48} />
                <p className="font-black text-slate-400 animate-pulse">LOADING ARCHITECTURE...</p>
            </div>
        </div>
    );

    return (
        <div className="p-2.5 min-h-screen bg-[#F8FAFC]">
            {error && (
                <div className="bg-rose-600 text-white px-8 py-3 flex items-center justify-between animate-in slide-in-from-top-full duration-300">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={20} />
                        <span className="font-bold text-sm tracking-wide">{error}</span>
                        {(error.includes('CTC') || error.includes('exceeds')) && (
                            <button
                                onClick={handleAutoBalance}
                                className="ml-4 px-3 py-1 bg-white text-rose-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-rose-50 transition-colors shadow-sm"
                            >
                                AUTO BALANCE
                            </button>
                        )}
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg"><X size={18} /></button>
                </div>
            )}
            {/* Header */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 sm:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-6 w-full md:w-auto overflow-hidden">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors flex-shrink-0">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight truncate">Salary Structure</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase whitespace-nowrap">
                                {targetType === 'applicant' ? 'APPLICANT' : 'EMPLOYEE'}
                            </span>
                            {salaryData.locked && <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase flex items-center gap-1"><ShieldCheck size={10} /> LOCKED</span>}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {!salaryData.locked && (
                        <div className="relative flex-1 md:flex-initial">
                            <select
                                value={selectedTemplateId}
                                disabled={salaryData.locked}
                                onChange={(e) => handleTemplateSelect(e.target.value)}
                                className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-black text-slate-700 text-sm w-full md:w-56 focus:border-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                            >
                                <option value="">SELECT TEMPLATE</option>
                                {templates.map(t => (
                                    <option key={t._id} value={t._id}>{String(t.templateName || 'UNNAMED TEMPLATE').toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Can module="payroll.salary" action="edit">
                        <div className="relative group flex-1 md:flex-initial">
                            <input
                                type="number"
                                value={ctcInput}
                                disabled={salaryData.locked}
                                onChange={(e) => setCtcInput(e.target.value)}
                                placeholder="ANNUAL CTC"
                                className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 sm:px-6 py-3 font-black text-blue-900 sm:text-lg w-full md:w-48 focus:border-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                            />
                            <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1.5 rounded-lg shadow-lg">
                                <IndianRupee size={12} strokeWidth={4} />
                            </div>
                        </div>
                    </Can>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Can module="payroll.salary" action="view">
                            <button
                                onClick={handleCalculate}
                                disabled={salaryData.locked || safe(ctcInput) <= 0}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black hover:bg-blue-100 transition-all disabled:opacity-30 whitespace-nowrap"
                            >
                                <Calculator size={18} />
                                <span className="hidden sm:inline">CALCULATE</span>
                                <span className="sm:hidden">CALC</span>
                            </button>
                        </Can>

                        <Can module="payroll.salary" action="create">
                            <button
                                onClick={handleSaveDraft}
                                disabled={salaryData.locked || saving || safe(ctcInput) <= 0}
                                className="p-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl hover:border-blue-200 hover:text-blue-600 transition-all disabled:opacity-30"
                            >
                                <Database size={20} />
                            </button>
                        </Can>
                    </div>

                    <Can module="payroll.salary" action="create">
                        <button
                            onClick={() => openCustomComponentModal('Earnings')}
                            disabled={salaryData.locked}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-black hover:bg-emerald-100 transition-all disabled:opacity-30 whitespace-nowrap"
                            title="Manual Fill Up"
                        >
                            <FileCode2 size={18} />
                            <span className="text-xs">MANUAL FILL UP</span>
                        </button>
                    </Can>

                    <Can module="payroll.salary" action="edit">
                        <button
                            onClick={handleFinalize}
                            disabled={!canLock || saving}
                            className={`flex-1 md:flex-initial flex items-center justify-center gap-3 px-6 sm:px-8 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 disabled:opacity-30 whitespace-nowrap ${salaryData.locked ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white shadow-slate-200'}`}
                        >
                            {saving ? <Database size={20} className="animate-spin" /> : (salaryData.locked ? <ShieldCheck size={20} /> : <Lock size={20} />)}
                            <span className="text-xs sm:text-sm">{salaryData.locked ? 'FINALIZED' : 'FINALIZE & LOCK'}</span>
                        </button>
                    </Can>

                    {salaryData.locked && (
                        <Can module="payroll.salary" action="edit">
                            <button onClick={handleUnlock} className="p-3 bg-orange-50 text-orange-600 rounded-2xl border-2 border-orange-100 hover:bg-orange-100 transition-all">
                                <Unlock size={20} />
                            </button>
                        </Can>
                    )}
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Breakup Section */}
                <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
                    {['Earnings', 'Deductions', 'Benefits'].map(section => (
                        <section key={section} className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <div className={`w-2 h-6 rounded-full ${section === 'Earnings' ? 'bg-emerald-500' : section === 'Deductions' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                                    {section}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openCustomComponentModal(section)}
                                        disabled={salaryData.locked}
                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-30"
                                        title="Add Custom Component"
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <button
                                        onClick={() => openModal(section)}
                                        disabled={salaryData.locked}
                                        className="text-[10px] font-black text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all disabled:opacity-30"
                                    >
                                        MODIFY ({salaryData.breakdown[section.toLowerCase()]?.length || 0})
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {salaryData.breakdown[section.toLowerCase()]?.map((comp, idx) => (
                                    <div key={comp.code} className="p-6 bg-slate-50/50 rounded-3xl group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100 relative">
                                        {!salaryData.locked && !comp.isSystemGenerated && comp.code !== 'BASIC' && comp.code !== 'SPECIAL_ALLOWANCE' && (
                                            <button
                                                onClick={() => {
                                                    if (!window.confirm(`Remove ${comp.name}?`)) return;
                                                    const sectionKey = section.toLowerCase();
                                                    const updatedBreakdown = salaryData.breakdown[sectionKey].filter((_, i) => i !== idx);

                                                    if (sectionKey === 'earnings') setSelectedEarnings(updatedBreakdown);
                                                    if (sectionKey === 'deductions') setSelectedDeductions(updatedBreakdown);
                                                    if (sectionKey === 'benefits') setSelectedBenefits(updatedBreakdown);

                                                    // Recalculate totals
                                                    const allEarnings = sectionKey === 'earnings' ? updatedBreakdown : salaryData.breakdown.earnings;
                                                    const allDeductions = sectionKey === 'deductions' ? updatedBreakdown : salaryData.breakdown.deductions;
                                                    const allBenefits = sectionKey === 'benefits' ? updatedBreakdown : salaryData.breakdown.benefits;
                                                    const grossMonthly = allEarnings.reduce((sum, e) => sum + safe(e.monthly), 0);
                                                    const deductionMonthly = allDeductions.reduce((sum, d) => sum + safe(d.monthly), 0);
                                                    const netMonthly = grossMonthly - deductionMonthly;
                                                    const annualCTC = (grossMonthly + allBenefits.reduce((sum, b) => sum + safe(b.monthly), 0)) * 12;

                                                    setSalaryData({
                                                        ...salaryData,
                                                        breakdown: { ...salaryData.breakdown, [sectionKey]: updatedBreakdown },
                                                        totals: { grossMonthly, deductionMonthly, netMonthly },
                                                        annualCTC
                                                    });
                                                    setCtcInput(Math.round(annualCTC).toString());
                                                }}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 shadow-lg z-10"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}

                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{comp.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-1">
                                                    {(comp.calculationType || '').replace(/_/g, ' ')} {comp.basedOn !== 'NA' ? `OF ${comp.basedOn}` : ''}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-end gap-1.5 min-w-[100px]">
                                                    <span className="text-[10px] font-bold text-slate-400">₹</span>
                                                    {salaryData.locked ? (
                                                        <span className="font-black text-slate-900 text-sm">{Math.round(comp.monthly)}</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={Math.round(comp.monthly) || '0'}
                                                            onChange={(e) => {
                                                                const newMonthly = safe(e.target.value);
                                                                const sectionKey = section.toLowerCase();
                                                                const updatedBreakdown = [...salaryData.breakdown[sectionKey]];
                                                                updatedBreakdown[idx] = {
                                                                    ...comp,
                                                                    calculationType: 'FIXED',
                                                                    value: newMonthly,
                                                                    amount: newMonthly,
                                                                    monthly: newMonthly,
                                                                    yearly: newMonthly * 12,
                                                                    isManual: true
                                                                };

                                                                if (sectionKey === 'earnings') setSelectedEarnings(updatedBreakdown);
                                                                if (sectionKey === 'deductions') setSelectedDeductions(updatedBreakdown);
                                                                if (sectionKey === 'benefits') setSelectedBenefits(updatedBreakdown);

                                                                const allEarnings = sectionKey === 'earnings' ? updatedBreakdown : salaryData.breakdown.earnings;
                                                                const allDeductions = sectionKey === 'deductions' ? updatedBreakdown : salaryData.breakdown.deductions;
                                                                const allBenefits = sectionKey === 'benefits' ? updatedBreakdown : salaryData.breakdown.benefits;

                                                                const grossMonthly = allEarnings.reduce((sum, e) => sum + safe(e.monthly), 0);
                                                                const deductionMonthly = allDeductions.reduce((sum, d) => sum + safe(d.monthly), 0);
                                                                const netMonthly = grossMonthly - deductionMonthly;
                                                                const annualCTC = (grossMonthly + allBenefits.reduce((sum, b) => sum + safe(b.monthly), 0)) * 12;

                                                                setSalaryData({
                                                                    ...salaryData,
                                                                    breakdown: { ...salaryData.breakdown, [sectionKey]: updatedBreakdown },
                                                                    totals: { grossMonthly, deductionMonthly, netMonthly },
                                                                    annualCTC
                                                                });
                                                                setCtcInput(Math.round(annualCTC).toString());
                                                            }}
                                                            className="w-16 bg-transparent border-none text-right font-black text-slate-900 text-sm p-0 focus:ring-0 outline-none"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            {comp.code === 'SPECIAL_ALLOWANCE' ? (
                                                <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded">
                                                    <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">FIXED</span>
                                                    <span className="text-[8px] font-black text-white bg-blue-500 px-1 rounded-sm tracking-tighter">BALANCER</span>
                                                </div>
                                            ) : comp.isManual ? (
                                                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">MANUAL OVERRIDE</span>
                                                </div>
                                            ) : comp.calculationType === 'FORMULA' ? (
                                                <div className="flex items-center gap-1 bg-violet-50 px-1.5 py-0.5 rounded">
                                                    <span className="text-[8px] font-black text-violet-600 uppercase tracking-tighter">FORMULA</span>
                                                </div>
                                            ) : comp.isSystemGenerated ? (
                                                <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">AUTO RULE</span>
                                                </div>
                                            ) : (
                                                <div />
                                            )}
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">₹{formatINR(comp.monthly * 12)} /yr</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="lg:col-span-4 space-y-6 order-1 lg:order-2 lg:sticky lg:top-28 h-fit">
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Payroll Location</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto rules for Indian payroll</p>
                                </div>
                            </div>
                            {ruleLoading && <Database size={16} className="animate-spin text-blue-500" />}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Country</span>
                                <select
                                    value={locationContext.country}
                                    disabled={salaryData.locked}
                                    onChange={(e) => updateLocationContext('country', e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
                                >
                                    <option value="IN">India</option>
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Effective From</span>
                                <input
                                    type="date"
                                    value={locationContext.effectiveFrom || ''}
                                    disabled={salaryData.locked}
                                    onChange={(e) => updateLocationContext('effectiveFrom', e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase">State</span>
                                <input
                                    list="payroll-state-options"
                                    value={locationContext.workState || ''}
                                    disabled={salaryData.locked}
                                    onChange={(e) => updateLocationContext('workState', e.target.value)}
                                    placeholder="State"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
                                />
                                <datalist id="payroll-state-options">
                                    {Object.keys(STATE_CITY_PRESETS).map(state => <option key={state} value={state} />)}
                                </datalist>
                            </label>
                            <label className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase">City</span>
                                <input
                                    list="payroll-city-options"
                                    value={locationContext.workCity || ''}
                                    disabled={salaryData.locked}
                                    onChange={(e) => updateLocationContext('workCity', e.target.value)}
                                    placeholder="City"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
                                />
                                <datalist id="payroll-city-options">
                                    {cityOptions.map(city => <option key={city} value={city} />)}
                                </datalist>
                            </label>
                            <label className="space-y-1 col-span-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Payroll Region</span>
                                <input
                                    value={locationContext.payrollRegion || ''}
                                    disabled={salaryData.locked}
                                    onChange={(e) => updateLocationContext('payrollRegion', e.target.value)}
                                    placeholder="Region"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
                                />
                            </label>
                            <label className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Apply statutory auto-fill</span>
                                <input
                                    type="checkbox"
                                    checked={locationContext.applyStatutory !== false}
                                    disabled={salaryData.locked}
                                    onChange={(e) => updateLocationContext('applyStatutory', e.target.checked)}
                                    className="h-4 w-4 accent-blue-600"
                                />
                            </label>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
                            <div className="rounded-xl bg-blue-50 px-3 py-2 text-blue-700">HRA {safe(resolvedPolicy?.hra?.percentageOfBasic || ruleSnapshot?.hraPercentageOfBasic)}%</div>
                            <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">PT Rs.{formatINR(resolvedPolicy?.professionalTax?.amount ?? ruleSnapshot?.professionalTaxAmount)}</div>
                            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">ESI {ruleSnapshot?.esiApplicable === false ? 'Off' : 'Auto'}</div>
                            <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">LWF {ruleSnapshot?.lwfEnabled ? 'On' : 'Off'}</div>
                        </div>
                        <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {resolvedPolicy?.ruleName || ruleSnapshot?.ruleName || 'Company Default'}
                        </p>
                    </div>

                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Monthly Take-Home</p>
                        <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 sm:mb-10 flex items-center gap-3">
                            ₹{formatINR(salaryData?.totals?.netMonthly || 0)}<span className="text-base sm:text-lg text-slate-500">/mo</span>
                        </h2>

                        <div className="space-y-4 pt-8 border-t border-slate-800">
                            {[
                                { label: 'Gross Income', val: salaryData?.totals?.grossMonthly || 0, color: 'text-emerald-400', icon: TrendingUp },
                                { label: 'Total Deductions', val: salaryData?.totals?.deductionMonthly || 0, color: 'text-rose-400', icon: TrendingDown },
                                { label: 'Annual CTC', val: salaryData?.annualCTC || 0, color: 'text-blue-400', icon: IndianRupee }
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg"><item.icon size={14} className={item.color} /></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                                    </div>
                                    <span className={`font-black ${item.color}`}>₹{formatINR(item.val)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-600 rounded-[32px] p-6 sm:p-8 text-white shadow-lg relative cursor-help group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-2 sm:p-3 bg-white/20 rounded-2xl"><Calculator size={22} /></div>
                            <h4 className="font-black uppercase tracking-tight text-sm">System Status</h4>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed opacity-80">
                            Calculation Engine v11.0 Active. Every component is derived from CTC. Special Allowance adjusts automatically to ensure 100% precision.
                        </p>
                        <div className="mt-6 pt-6 border-t border-white/20 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest">Integrity Check</span>
                            {isSumCorrect ? <Check size={16} className="text-emerald-300" /> : <AlertCircle size={16} className="text-warning-300" />}
                        </div>
                    </div>
                </div>
            </main>

            {showCustomModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowCustomModal(false)} />
                    <div className="relative bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden border border-slate-100">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <FileCode2 size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Custom {customDraft.section.slice(0, -1)}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fixed, percent, or formula</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCustomModal(false)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Manual Component Category</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Earnings', 'Deductions', 'Benefits'].map(section => (
                                        <button
                                            key={section}
                                            onClick={() => setCustomDraft(prev => ({ ...prev, section }))}
                                            className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase transition-all ${customDraft.section === section ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            {section}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="space-y-2 block">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Component Name</span>
                                <input
                                    value={customDraft.name}
                                    onChange={(e) => setCustomDraft(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Custom Allowance"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                                />
                            </label>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { key: 'FIXED', label: 'Fixed' },
                                    { key: 'PERCENTAGE_OF_CTC', label: '% CTC' },
                                    { key: 'PERCENTAGE_OF_BASIC', label: '% Basic' },
                                    { key: 'FORMULA', label: 'Formula' }
                                ].map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => setCustomDraft(prev => ({ ...prev, mode: option.key }))}
                                        className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase transition-all ${customDraft.mode === option.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {customDraft.mode === 'FIXED' && (
                                <label className="space-y-2 block">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Monthly Amount</span>
                                    <input
                                        type="number"
                                        value={customDraft.monthlyAmount}
                                        onChange={(e) => setCustomDraft(prev => ({ ...prev, monthlyAmount: e.target.value }))}
                                        placeholder="0"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                                    />
                                </label>
                            )}

                            {(customDraft.mode === 'PERCENTAGE_OF_CTC' || customDraft.mode === 'PERCENTAGE_OF_BASIC') && (
                                <label className="space-y-2 block">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Percentage</span>
                                    <input
                                        type="number"
                                        value={customDraft.percentage}
                                        onChange={(e) => setCustomDraft(prev => ({ ...prev, percentage: e.target.value }))}
                                        placeholder="10"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                                    />
                                </label>
                            )}

                            {customDraft.mode === 'FORMULA' && (
                                <div className="space-y-3">
                                    <label className="space-y-2 block">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Formula</span>
                                        <input
                                            value={customDraft.formula}
                                            onChange={(e) => setCustomDraft(prev => ({ ...prev, formula: e.target.value }))}
                                            placeholder="BASIC * 0.10"
                                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                                        />
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['MONTHLY', 'ANNUAL'].map(freq => (
                                            <button
                                                key={freq}
                                                onClick={() => setCustomDraft(prev => ({ ...prev, formulaFrequency: freq }))}
                                                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase transition-all ${customDraft.formulaFrequency === freq ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                            >
                                                {freq}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                                <SlidersHorizontal size={14} />
                                {customDraft.mode.replace(/_/g, ' ')}
                            </div>
                            <button onClick={saveCustomComponent} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">
                                ADD COMPONENT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Modify {activeSection}</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Select components to include in structure</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 max-h-[500px] overflow-y-auto grid grid-cols-2 gap-4">
                            {(availableComponents[activeSection.toLowerCase()] || []).map(comp => {
                                const isSelected = tempSelectedIds.includes(comp._id?.toString());
                                const isMandatory = (comp.code === 'BASIC' || comp.name === 'Basic Salary' || comp.code === 'SPECIAL_ALLOWANCE') && activeSection === 'Earnings';

                                return (
                                    <button
                                        key={comp._id}
                                        disabled={isMandatory}
                                        onClick={() => {
                                            if (isMandatory) return;
                                            const idStr = comp._id?.toString();
                                            setTempSelectedIds(p => isSelected ? p.filter(id => id !== idStr) : [...p, idStr])
                                        }}
                                        className={`p-5 rounded-[24px] border-2 text-left transition-all relative overflow-hidden group ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'} ${isMandatory ? 'opacity-50 grayscale' : ''}`}
                                    >
                                        <p className={`font-black uppercase text-xs transition-colors ${isSelected ? 'text-blue-900' : 'text-slate-600'}`}>{comp.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                            {comp.calculationType} {comp.calculationBase ? `OF ${comp.calculationBase}` : ''}
                                        </p>
                                        {isSelected && <div className="absolute top-4 right-4 text-blue-600"><Check size={16} strokeWidth={3} /></div>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{tempSelectedIds.length} COMPONENTS SELECTED</span>
                            <button onClick={confirmSelection} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">
                                APPLY CONFIGURATION
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
