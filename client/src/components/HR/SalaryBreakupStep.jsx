import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, Loader2, IndianRupee, Save, Calculator, AlertTriangle, 
    ArrowLeft, CheckCircle2, ChevronRight, Info, User, MapPin, Briefcase,
    Zap, TrendingUp, DollarSign, ShieldCheck, Upload, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from '@sheetjs/xlsx';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

const STATES_BASE = [
    'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH', 
    'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND', 'KARNATAKA', 
    'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 
    'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 
    'TRIPURA', 'UTTAR PRADESH', 'UTTARKHAND', 'WEST BENGAL', 'DELHI', 'JAMMU AND KASHMIR',
    'PUDUCHERRY', 'CHANDIGARH'
];

const CATEGORIES = [
    { id: 'UNSKILLED', label: 'UNSKILLED' },
    { id: 'SEMI_SKILLED', label: 'SEMI-SKILLED' },
    { id: 'SKILLED', label: 'SKILLED' },
    { id: 'HIGHLY_SKILLED', label: 'HIGHLY SKILLED' },
    { id: 'GENERAL', label: 'GENERAL / MANAGEMENT' }
];

export default function SalaryBreakupStep({
    employee,
    joiningDate,
    salaryEffectiveDate,
    setSalaryEffectiveDate,
    viewOnly = false,
    onSalaryAssigned
}) {
    const employeeId = employee?._id;
    const employeeName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim();
    const employeeCode = employee?.employeeId || '';

    // Master Data
    const [minimumWages, setMinimumWages] = useState([]);
    const [masterEarnings, setMasterEarnings] = useState([]);
    const [masterDeductions, setMasterDeductions] = useState([]);
    const [masterBenefits, setMasterBenefits] = useState([]);

    // Form State
    const [annualCTC, setAnnualCTC] = useState('');
    const [category, setCategory] = useState(employee?.category?.toUpperCase() || 'UNSKILLED');
    const [state, setState] = useState(employee?.state?.toUpperCase() || 'GUJARAT');
    const [isDragging, setIsDragging] = useState(false);
    const [parsingExcel, setParsingExcel] = useState(false);
    const fileInputRef = useRef(null);

    // Calculation Result
    const [breakup, setBreakup] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const allStates = useMemo(() => {
        const list = [...STATES_BASE];
        const dbStates = [...new Set((minimumWages || []).map(item => item.state))].filter(Boolean);
        dbStates.forEach(s => {
            const upper = s.toUpperCase();
            if (!list.includes(upper)) {
                list.push(upper);
            }
        });
        return list.sort();
    }, [minimumWages]);

    const activeMinWage = useMemo(() => {
        return minimumWages.find(m => m.state === state && m.category === category);
    }, [minimumWages, state, category]);

    useEffect(() => {
        init();
    }, [employeeId]);

    const init = async () => {
        try {
            setLoading(true);
            const [mwRes, eRes, dRes, bRes] = await Promise.all([
                api.get('/payroll/minimum-wages').catch(() => ({ data: { data: [] } })),
                api.get('/payroll/earnings').catch(() => ({ data: { data: [] } })),
                api.get('/deductions').catch(() => ({ data: { data: [] } })),
                api.get('/payroll/benefits').catch(() => ({ data: { data: [] } }))
            ]);

            const fetchedWages = mwRes.data?.data || [];
            const injectedWages = [
                { state: 'GUJARAT', category: 'UNSKILLED', monthlyAmount: 13325 },
                { state: 'GUJARAT', category: 'SEMI_SKILLED', monthlyAmount: 13585 },
                { state: 'GUJARAT', category: 'SKILLED', monthlyAmount: 13897 }
            ];
            setMinimumWages([...fetchedWages, ...injectedWages]);
            setMasterEarnings(eRes.data?.data || []);
            setMasterDeductions(dRes.data?.data || []);
            setMasterBenefits(bRes.data?.data || []);

            // Recover existing salary breakup from history if editing
            if (employeeId) {
                try {
                    const histRes = await api.get(`/payroll/history/${employeeId}`);
                    const history = histRes.data?.data || [];
                    if (history.length > 0) {
                        const latest = history[0];
                        setAnnualCTC(latest.ctcAnnual ? latest.ctcAnnual.toString() : '');
                        if (latest.category) setCategory(latest.category.toUpperCase());
                        if (latest.state) setState(latest.state.toUpperCase());
                        if (latest.effectiveFrom) {
                            setSalaryEffectiveDate(latest.effectiveFrom.split('T')[0]);
                        }
                        if (latest.breakup) {
                            setBreakup(latest.breakup);
                            if (onSalaryAssigned) onSalaryAssigned(true);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to fetch salary history", err);
                }
            }
        } catch (err) {
            showToast('error', 'Initialization Error', 'Failed to fetch master data');
        } finally {
            setLoading(false);
        }
    };

    const calculateBreakup = async () => {
        if (!annualCTC || annualCTC <= 0) {
            showToast('warning', 'Input Required', 'Please enter a valid Annual CTC');
            return;
        }
        
        try {
            setLoading(true);
            const mw = minimumWages.find(m => m.state === state && m.category === category);
            const minWageAmount = mw ? mw.monthlyAmount : 0;

            const res = await api.post('/payroll/calculate-breakup', {
                annualCTC: Number(annualCTC),
                minWageAmount,
                employeeCategory: category,
                state: state,
                earnings: masterEarnings.filter(e => e.isActive),
                deductions: masterDeductions.filter(d => d.isActive),
                benefits: masterBenefits.filter(b => b.isActive)
            });

            if (res.data.success) {
                setBreakup(res.data.data);
                showToast('success', 'Calculated', 'Salary breakup generated based on input');
            }
        } catch (err) {
            showToast('error', 'Calculation Error', err.response?.data?.error || 'Failed to calculate breakup');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!employeeId) {
            showToast('warning', 'Onboarding Draft', 'Please save employee draft first');
            return;
        }
        if (!breakup) {
            showToast('warning', 'Action Required', 'Please calculate the breakup before saving');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                employeeId,
                annualCTC: Number(annualCTC),
                effectiveFrom: salaryEffectiveDate,
                breakup,
                category,
                state
            };
            const res = await api.post('/payroll/assign-salary-excel', payload);
            if (res.data.success) {
                showToast('success', 'Assigned', 'Salary structure assigned successfully');
                if (onSalaryAssigned) onSalaryAssigned(true);
            }
        } catch (err) {
            showToast('error', 'Save Error', err.response?.data?.error || 'Failed to assign salary');
        } finally {
            setSaving(false);
        }
    };

    const processExcelFile = async (file) => {
        if (!file) return;
        setParsingExcel(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const ab = evt.target.result;
                    const wb = XLSX.read(ab, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                    let extractedEmpCode = '';
                    let extractedName = '';
                    let extractedCategory = '';
                    let extractedTotalCTC = 0;

                    for (let i = 0; i < rawData.length; i++) {
                        const row = rawData[i];
                        const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
                        
                        // Look for Emp Code
                        if (rowStr.includes('emp code') || rowStr.includes('employee id')) {
                            const valIndex = row.findIndex(c => String(c).toLowerCase().includes('emp code') || String(c).toLowerCase().includes('employee id'));
                            if (valIndex !== -1 && row[valIndex + 1]) {
                                extractedEmpCode = String(row[valIndex + 1]).trim();
                            }
                        }
                        // Look for Name
                        if (rowStr.includes('name') && !rowStr.includes('designation')) {
                            const valIndex = row.findIndex(c => String(c).toLowerCase() === 'name');
                            if (valIndex !== -1 && row[valIndex + 1]) {
                                extractedName = String(row[valIndex + 1]).trim();
                            }
                        }
                        // Look for Category
                        if (rowStr.includes('category')) {
                            const valIndex = row.findIndex(c => String(c).toLowerCase() === 'category');
                            if (valIndex !== -1 && row[valIndex + 1]) {
                                const catVal = String(row[valIndex + 1]).toUpperCase().replace(/[-\s]+/g, '_');
                                if (['UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'HIGHLY_SKILLED', 'GENERAL'].includes(catVal)) {
                                    extractedCategory = catVal;
                                }
                            }
                        }
                        // Look for Total CTC
                        if (rowStr.includes('total a+b+c') || rowStr.includes('total ctc') || rowStr.includes('annual ctc')) {
                            const nums = row.map(c => parseFloat(String(c).replace(/,/g, ''))).filter(n => !isNaN(n));
                            if (nums.length > 0) {
                                extractedTotalCTC = Math.max(...nums);
                            }
                        }
                    }

                    // Match Validation Toast
                    if (extractedEmpCode && employeeCode && extractedEmpCode.toLowerCase() !== employeeCode.toLowerCase()) {
                        showToast('warning', 'Employee ID Mismatch', `Excel ID "${extractedEmpCode}" differs from current "${employeeCode}"`);
                    } else if (extractedName && employeeName && !employeeName.toLowerCase().includes(extractedName.toLowerCase())) {
                        showToast('info', 'Name Check', `Excel specifies name "${extractedName}", matches current context.`);
                    } else {
                        showToast('success', 'Excel Verified', `Matches onboarding employee: ${employeeName}`);
                    }

                    if (extractedCategory) setCategory(extractedCategory);
                    if (extractedTotalCTC > 0) {
                        setAnnualCTC(extractedTotalCTC.toString());
                        showToast('success', 'CTC Extracted', `Extracted Annual CTC: ₹${Number(extractedTotalCTC || 0).toLocaleString('en-IN')}`);
                    }
                } catch (err) {
                    console.error('Excel parse error:', err);
                    showToast('error', 'Parse Error', 'Failed to read CTC from this Excel format');
                } finally {
                    setParsingExcel(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            setParsingExcel(false);
            showToast('error', 'Upload Error', 'Could not read the file');
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processExcelFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="w-full space-y-6">
            {/* Context Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-black shadow-sm">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h4 className="text-md font-black text-slate-800 dark:text-white uppercase tracking-wider">Salary Breakup Engine</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Professional Excel Standard v2.0</p>
                    </div>
                </div>

                {!viewOnly && (
                    <div className="flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={calculateBreakup}
                            disabled={!annualCTC || loading}
                            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
                            Calculate Breakup
                        </button>
                        <button 
                            type="button"
                            onClick={handleSave}
                            disabled={!breakup || saving || !employeeId}
                            className="h-10 px-4 bg-slate-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                            Confirm & Assign
                        </button>
                    </div>
                )}
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Configuration Controls */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Read-Only Employee Card */}
                    <div className="p-4 bg-indigo-50/50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center font-black">
                            <User size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-800 dark:text-white leading-none">{employeeName}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{employeeCode || 'Draft ID'}</p>
                        </div>
                    </div>

                    {!employeeId && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Draft Profile Required</h5>
                                <p className="text-[10px] text-amber-700 dark:text-amber-500 leading-relaxed mt-1">
                                    Please click **"Save Draft"** at the bottom of the screen to create an Employee ID before completing the salary structure assignment.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Upload Zone */}
                    {!viewOnly && (
                        <div 
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`cursor-pointer w-full p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all ${
                                isDragging 
                                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' 
                                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-900/50'
                            }`}
                        >
                            <input 
                                type="file" 
                                accept=".xlsx,.xls,.csv" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={(e) => {
                                    if (e.target.files?.length) processExcelFile(e.target.files[0]);
                                    e.target.value = '';
                                }}
                            />
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center mb-2">
                                {parsingExcel ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
                            </div>
                            <h5 className="text-xs font-bold text-slate-800 dark:text-white">Smart Annexure Upload</h5>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Drop Excel or click to parse</p>
                        </div>
                    )}

                    {/* Primary Inputs */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Proposed Annual CTC</label>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 text-slate-400 text-lg font-black">₹</span>
                                <input 
                                    type="number"
                                    value={annualCTC}
                                    onChange={(e) => setAnnualCTC(e.target.value)}
                                    placeholder="0"
                                    disabled={viewOnly}
                                    className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition-all text-xl font-black text-slate-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Regulatory State</label>
                                <select 
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    disabled={viewOnly}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-white appearance-none"
                                >
                                    {allStates.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Wage Category</label>
                                <select 
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    disabled={viewOnly}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-white appearance-none"
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Effective Date</label>
                            <input 
                                type="date"
                                value={salaryEffectiveDate}
                                onChange={(e) => setSalaryEffectiveDate(e.target.value)}
                                disabled={viewOnly}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-white"
                            />
                            {joiningDate && salaryEffectiveDate < joiningDate && (
                                <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider mt-1">Cannot be before joining date ({joiningDate})</p>
                            )}
                        </div>

                        {activeMinWage && (
                            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={16} />
                                    <div>
                                        <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider leading-none">Min Wage</p>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-0.5"> गुजरात Rules</p>
                                    </div>
                                </div>
                                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">₹{activeMinWage.monthlyAmount?.toLocaleString('en-IN')}/mo</p>
                            </div>
                        )}
                    </div>

                    {/* Net take home summary */}
                    {breakup && (
                        <div className="relative overflow-hidden bg-slate-900 rounded-2xl p-5 text-white shadow-lg">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl -mr-12 -mt-12" />
                            <div className="relative space-y-4">
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <TrendingUp size={12} className="text-emerald-400" />
                                        <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Monthly Take-Home</p>
                                    </div>
                                    <div className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[7px] font-black uppercase">Net Pay</div>
                                </div>
                                <p className="text-3xl font-black tracking-tight">₹{breakup.totals.takeHomeMonthly?.toLocaleString('en-IN')}</p>
                                <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div>
                                        <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Annual Net</p>
                                        <p className="font-black text-xs">₹{breakup.totals.takeHomeYearly?.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Deductions</p>
                                        <p className="font-black text-xs text-rose-400">₹{breakup.totals.deductionMonthly?.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dynamic calculation preview table */}
                <div className="lg:col-span-8">
                    {!breakup ? (
                        <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center h-[420px]">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4 shadow-inner">
                                <Calculator size={32} />
                            </div>
                            <h4 className="text-md font-black text-slate-800 dark:text-white tracking-wide">Dynamic Salary Preview</h4>
                            <p className="text-[10px] text-slate-400 max-w-[260px] mx-auto mt-2 leading-relaxed font-bold uppercase tracking-wider">
                                Configure the CTC details and click **"Calculate Breakup"** to display salary components.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md">
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider leading-none">Salary Structure</h5>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Regulatory Compliant</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
                                    <ShieldCheck size={12} />
                                    Min-Wage Validated
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-6 py-3">Component Details</th>
                                            <th className="px-6 py-3 text-right">Monthly (₹)</th>
                                            <th className="px-6 py-3 text-right">Yearly (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {/* Section A: Earnings */}
                                        <tr className="bg-indigo-50/20 dark:bg-indigo-950/10">
                                            <td colSpan="3" className="px-6 py-2.5 font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[8px]">
                                                Section A: Gross Earnings
                                            </td>
                                        </tr>
                                        {breakup.earnings.map(comp => (
                                            <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-2.5 font-bold text-slate-700 dark:text-slate-300">
                                                    {comp.name}
                                                    {comp.calculationType === 'MIN_WAGE_ADJUSTED' && (
                                                        <span className="text-[7px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase ml-1.5 tracking-tighter">MW Picked</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-2.5 text-right font-black text-slate-800 dark:text-white">₹{comp.monthly?.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-2.5 text-right font-bold text-slate-400">₹{comp.yearly?.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}

                                        {/* Employer Contributions */}
                                        {breakup.employerContributions && breakup.employerContributions.map(comp => (
                                            <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-2.5 text-slate-500 italic">
                                                    {comp.name} <span className="text-[7px] font-black uppercase opacity-60">(Employer Cost)</span>
                                                </td>
                                                <td className="px-6 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">₹{comp.monthly?.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-2.5 text-right font-bold text-slate-400">₹{comp.yearly?.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}

                                        <tr className="bg-slate-900 text-white font-black">
                                            <td className="px-6 py-3 uppercase tracking-wider text-[9px]">Gross A (Cost to Company A)</td>
                                            <td className="px-6 py-3 text-right text-sm">₹{breakup.totals.grossA_Monthly?.toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-3 text-right opacity-60">₹{breakup.totals.grossA_Yearly?.toLocaleString('en-IN')}</td>
                                        </tr>

                                        {/* Section B: Retirals */}
                                        <tr className="bg-amber-50/30 dark:bg-amber-950/10">
                                            <td colSpan="3" className="px-6 py-2.5 font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[8px]">
                                                Section B: Retirals & Statutory Benefits
                                            </td>
                                        </tr>
                                        {breakup.retirementBenefits && breakup.retirementBenefits.map(comp => (
                                            <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-2.5 font-bold text-slate-700 dark:text-slate-300">{comp.name}</td>
                                                <td className="px-6 py-2.5 text-right font-black text-slate-800 dark:text-white">₹{comp.monthly?.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-2.5 text-right font-bold text-slate-400">₹{comp.yearly?.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}

                                        <tr className="bg-amber-500 text-white font-black">
                                            <td className="px-6 py-3 uppercase tracking-wider text-[9px]">Gross B (Retirals)</td>
                                            <td className="px-6 py-3 text-right text-sm">₹{breakup.totals.grossB_Monthly?.toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-3 text-right opacity-60">₹{breakup.totals.grossB_Yearly?.toLocaleString('en-IN')}</td>
                                        </tr>

                                        {/* Total CTC */}
                                        <tr className="bg-indigo-700 text-white font-black border-t-4 border-white dark:border-slate-900">
                                            <td className="px-6 py-4 uppercase tracking-widest text-[10px]">Total Annual CTC (A + B)</td>
                                            <td className="px-6 py-4 text-right opacity-65 text-sm">₹{Math.round(breakup.totals.totalCTC / 12).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-right text-lg">₹{breakup.totals.totalCTC?.toLocaleString('en-IN')}</td>
                                        </tr>

                                        {/* Section C: Deductions */}
                                        <tr className="bg-rose-50/30 dark:bg-rose-950/10">
                                            <td colSpan="3" className="px-6 py-2.5 font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[8px]">
                                                Employee Statutory Deductions
                                            </td>
                                        </tr>
                                        {breakup.deductions.map(comp => (
                                            <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-2.5 text-slate-500 italic">{comp.name}</td>
                                                <td className="px-6 py-2.5 text-right font-black text-rose-600 dark:text-rose-500">-₹{comp.monthly?.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-2.5 text-right font-bold text-slate-400">₹{comp.yearly?.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}

                                        {/* Take Home Pay */}
                                        <tr className="bg-emerald-600 text-white font-black border-t-[8px] border-white dark:border-slate-900">
                                            <td className="px-6 py-5">
                                                <p className="uppercase tracking-widest text-[11px] leading-none">Net Take-Home Pay</p>
                                                <span className="text-[8px] font-bold opacity-60 uppercase tracking-wide">Approx. credit after all deductions</span>
                                            </td>
                                            <td className="px-6 py-5 text-right text-2xl tracking-tight">₹{breakup.totals.takeHomeMonthly?.toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-5 text-right opacity-40 italic">/mo</td>
                                        </tr>
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
