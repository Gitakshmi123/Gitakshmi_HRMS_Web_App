import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, Loader2, IndianRupee, Save, Calculator, AlertTriangle, 
    ArrowLeft, CheckCircle2, ChevronRight, Info, User, MapPin, Briefcase,
    Zap, TrendingUp, DollarSign, ShieldCheck, Upload, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from '@sheetjs/xlsx';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';

const SalaryAssignmentExcel = () => {
    // Selection State
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [minimumWages, setMinimumWages] = useState([]);
    const [masterEarnings, setMasterEarnings] = useState([]);
    const [masterDeductions, setMasterDeductions] = useState([]);
    const [masterBenefits, setMasterBenefits] = useState([]);

    // Form State
    const [annualCTC, setAnnualCTC] = useState('');
    const [category, setCategory] = useState('UNSKILLED');
    const [state, setState] = useState('GUJARAT');
    const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [parsingExcel, setParsingExcel] = useState(false);
    const fileInputRef = useRef(null);

    // Calculation Result
    const [breakup, setBreakup] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        try {
            setLoading(true);
            const [empRes, mwRes, eRes, dRes, bRes] = await Promise.all([
                api.get('/hr/employees'),
                api.get('/payroll/minimum-wages'),
                api.get('/payroll/earnings'),
                api.get('/deductions'),
                api.get('/payroll/benefits')
            ]);
            setEmployees(empRes.data.data || []);
            setMinimumWages(mwRes.data.data || []);
            setMasterEarnings(eRes.data.data || []);
            setMasterDeductions(dRes.data.data || []);
            setMasterBenefits(bRes.data.data || []);
        } catch (err) {
            showToast('error', 'Initialization Error', 'Failed to fetch master data');
        } finally {
            setLoading(false);
        }
    };

    const filteredEmployees = useMemo(() => {
        if (!searchQuery) return [];
        return employees.filter(emp => 
            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);
    }, [searchQuery, employees]);

    const handleEmployeeSelect = (emp) => {
        setSelectedEmployee(emp);
        setSearchQuery(`${emp.firstName} ${emp.lastName}`);
        setShowResults(false);
        // Try to auto-pick state/category from emp if available
        if (emp.state) setState(emp.state.toUpperCase());
        if (emp.category) setCategory(emp.category.toUpperCase());
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
        if (!selectedEmployee) {
            showToast('warning', 'Employee Selection', 'Please select an employee first');
            return;
        }
        if (!breakup) {
            showToast('warning', 'Action Required', 'Please calculate the breakup before saving');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                employeeId: selectedEmployee._id,
                annualCTC: Number(annualCTC),
                effectiveFrom,
                breakup,
                category,
                state
            };
            const res = await api.post('/payroll/assign-salary-excel', payload);
            if (res.data.success) {
                showToast('success', 'Assigned', 'Salary structure assigned successfully');
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
                                const catVal = String(row[valIndex + 1]).toUpperCase().replace('-', '_');
                                if (['UNSKILLED', 'SEMI_SKILLED', 'SKILLED'].includes(catVal)) {
                                    extractedCategory = catVal;
                                }
                            }
                        }
                        // Look for Total CTC
                        if (rowStr.includes('total a+b+c') || rowStr.includes('total ctc') || rowStr.includes('annual ctc')) {
                            const nums = row.map(c => parseFloat(String(c).replace(/,/g, ''))).filter(n => !isNaN(n));
                            if (nums.length > 0) {
                                extractedTotalCTC = Math.max(...nums); // Usually the largest number in that row is the yearly CTC
                            }
                        }
                    }

                    // Attempt to auto-select employee
                    let foundEmp = null;
                    if (extractedEmpCode) {
                        foundEmp = employees.find(e => e.employeeId && e.employeeId.toLowerCase() === extractedEmpCode.toLowerCase());
                    }
                    if (!foundEmp && extractedName) {
                        foundEmp = employees.find(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(extractedName.toLowerCase()));
                    }

                    if (foundEmp) {
                        handleEmployeeSelect(foundEmp);
                        showToast('success', 'Excel Parsed', `Found Employee: ${foundEmp.firstName} ${foundEmp.lastName}`);
                    } else {
                        showToast('warning', 'Employee Not Found', `Could not find employee matching ID "${extractedEmpCode}" or Name "${extractedName}"`);
                    }

                    if (extractedCategory) setCategory(extractedCategory);
                    if (extractedTotalCTC > 0) {
                        setAnnualCTC(extractedTotalCTC.toString());
                        showToast('success', 'CTC Extracted', `Extracted Annual CTC: ₹${extractedTotalCTC.toLocaleString('en-IN')}`);
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
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-4 md:p-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="max-w-[1600px] mx-auto space-y-8">
                
                {/* 🌟 Header Section */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none"
                >
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 dark:shadow-none rotate-3">
                            <Zap size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Salary Breakup Engine</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Professional Excel Standard v2.0</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={calculateBreakup}
                            disabled={!annualCTC || loading}
                            className="h-14 px-8 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-xl shadow-indigo-200 dark:shadow-none"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Calculator size={20} strokeWidth={2.5} />}
                            Calculate Breakup
                        </motion.button>
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSave}
                            disabled={!breakup || saving}
                            className="h-14 px-8 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black flex items-center gap-3 hover:bg-black dark:hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-xl shadow-slate-200 dark:shadow-none"
                        >
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} strokeWidth={2.5} />}
                            Confirm & Assign
                        </motion.button>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* 🔧 Left Controls: Configuration */}
                    <div className="lg:col-span-4 space-y-8">
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 border border-slate-200 dark:border-slate-800 shadow-xl space-y-10"
                        >
                            {/* Smart Excel Upload Zone */}
                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Smart Annexure Upload</label>
                                <div 
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative cursor-pointer w-full p-6 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
                                        isDragging 
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
                                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-3">
                                        {parsingExcel ? <Loader2 className="animate-spin" size={24} /> : <FileSpreadsheet size={24} />}
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Upload CTC Formula Excel</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Drop file or click to browse</p>
                                </div>
                            </div>

                            {/* Employee Search */}
                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Employee Context</label>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                    <div className="relative">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} strokeWidth={2.5} />
                                        <input 
                                            type="text"
                                            value={searchQuery}
                                            onFocus={() => setShowResults(true)}
                                            placeholder="Search by Name or ID..."
                                            className="w-full pl-14 pr-5 py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setShowResults(true);
                                            }}
                                        />
                                    </div>
                                    
                                    <AnimatePresence>
                                        {showResults && filteredEmployees.length > 0 && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl z-50 overflow-hidden"
                                            >
                                                {filteredEmployees.map(emp => (
                                                    <button 
                                                        key={emp._id}
                                                        onClick={() => handleEmployeeSelect(emp)}
                                                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700 last:border-0"
                                                    >
                                                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                                                            {emp.firstName[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white">{emp.firstName} {emp.lastName}</p>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{emp.employeeId}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {selectedEmployee && (
                                    <motion.div 
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="p-5 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800/50"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                                                <User className="text-indigo-600" size={24} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white text-lg leading-tight">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <MapPin size={12} className="text-slate-400" />
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{state} • {category}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Main Inputs */}
                            <div className="space-y-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Proposed Annual CTC</label>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/20 rounded-[1.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                        <div className="relative flex items-center">
                                            <span className="absolute left-6 text-slate-300 dark:text-slate-600 text-3xl font-black">₹</span>
                                            <input 
                                                type="number"
                                                value={annualCTC}
                                                onChange={(e) => setAnnualCTC(e.target.value)}
                                                placeholder="0"
                                                className="w-full pl-12 pr-6 py-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 focus:border-emerald-500 transition-all text-4xl font-black text-slate-900 dark:text-white tracking-tighter"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regulatory State</label>
                                        <select 
                                            value={state}
                                            onChange={(e) => setState(e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 font-black text-sm text-slate-900 dark:text-white appearance-none"
                                        >
                                            <option value="GUJARAT">GUJARAT</option>
                                            <option value="MAHARASHTRA">MAHARASHTRA</option>
                                            <option value="DELHI">DELHI</option>
                                            <option value="KARNATAKA">KARNATAKA</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wage Category</label>
                                        <select 
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 font-black text-sm text-slate-900 dark:text-white appearance-none"
                                        >
                                            <option value="UNSKILLED">UNSKILLED</option>
                                            <option value="SEMI_SKILLED">SEMI-SKILLED</option>
                                            <option value="SKILLED">SKILLED</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Effective Execution Date</label>
                                    <div className="relative">
                                        <input 
                                            type="date"
                                            value={effectiveFrom}
                                            onChange={(e) => setEffectiveFrom(e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 font-black text-sm text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Summary */}
                            {breakup && (
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="relative group overflow-hidden bg-slate-950 rounded-[2rem] p-8 text-white shadow-2xl"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16" />
                                    <div className="relative space-y-6">
                                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp size={14} className="text-emerald-400" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Monthly Take-Home</p>
                                            </div>
                                            <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-[8px] font-black uppercase">Net Pay</div>
                                        </div>
                                        <p className="text-5xl font-black tracking-tighter">₹{breakup.totals.takeHomeMonthly.toLocaleString('en-IN')}</p>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Annual Net</p>
                                                <p className="font-black text-sm">₹{breakup.totals.takeHomeYearly.toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Deductions</p>
                                                <p className="font-black text-sm text-rose-400">₹{breakup.totals.deductionMonthly.toLocaleString('en-IN')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    </div>

                    {/* 📊 Right Panel: Professional Breakup Table */}
                    <div className="lg:col-span-8">
                        <AnimatePresence mode="wait">
                            {!breakup ? (
                                <motion.div 
                                    key="empty"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="h-full min-h-[700px] flex flex-col items-center justify-center bg-white dark:bg-slate-900/50 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800 p-20 text-center"
                                >
                                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-200 dark:text-slate-700 mb-8 border border-slate-100 dark:border-slate-700 shadow-inner">
                                        <Calculator size={48} strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ready to Calculate</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-lg mt-4 max-w-md font-medium leading-relaxed">
                                        Configure the CTC details on the left to generate a professional, compliant salary breakup structure.
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="results"
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden"
                                >
                                    {/* Table Header Wrapper */}
                                    <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/30 dark:bg-slate-800/30">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                                                <DollarSign size={28} strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Salary Breakup Structure</h3>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black tracking-[0.2em] uppercase mt-1">Regulatory Compliant • Excel Aligned</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                                            <ShieldCheck size={14} strokeWidth={2.5} />
                                            Min-Wage Validated
                                        </div>
                                    </div>

                                    {/* Professional Table Design */}
                                    <div className="overflow-x-auto pb-10">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                                                    <th className="px-10 py-6 border-b border-slate-50 dark:border-slate-800">Salary Component Details</th>
                                                    <th className="px-10 py-6 border-b border-slate-50 dark:border-slate-800 text-right">Monthly (₹)</th>
                                                    <th className="px-10 py-6 border-b border-slate-50 dark:border-slate-800 text-right">Yearly (₹)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                
                                                {/* 🏷 SECTION A: EARNINGS */}
                                                <tr className="bg-indigo-50/20 dark:bg-indigo-900/10">
                                                    <td colSpan="3" className="px-10 py-5 font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] text-[10px]">
                                                        Section A: Gross Earnings & Employer Contributions
                                                    </td>
                                                </tr>
                                                
                                                {/* Regular Earnings */}
                                                {breakup.earnings.map(comp => (
                                                    <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                                        <td className="px-10 py-5">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{comp.name}</span>
                                                                {comp.calculationType === 'MIN_WAGE_ADJUSTED' && (
                                                                    <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">MW Picked</span>
                                                                )}
                                                                {comp.isSystemGenerated && (
                                                                    <span className="text-[8px] border border-slate-200 dark:border-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Auto-Balancing</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-5 text-right font-black text-slate-900 dark:text-white text-base">₹{comp.monthly.toLocaleString('en-IN')}</td>
                                                        <td className="px-10 py-5 text-right font-bold text-slate-400 dark:text-slate-500">₹{comp.yearly.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}

                                                {/* Employer Contribs */}
                                                {breakup.employerContributions.map(comp => (
                                                    <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-10 py-5">
                                                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 italic">
                                                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                                                                {comp.name}
                                                                <span className="text-[8px] font-black uppercase opacity-60 ml-2">(Employer Cost)</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-5 text-right font-bold text-slate-900 dark:text-white">₹{comp.monthly.toLocaleString('en-IN')}</td>
                                                        <td className="px-10 py-5 text-right font-bold text-slate-400 dark:text-slate-500">₹{comp.yearly.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}

                                                <tr className="bg-slate-950 text-white relative">
                                                    <td className="px-10 py-7 font-black uppercase tracking-[0.2em] text-[11px]">Gross A Total (Monthly Cost to Company A)</td>
                                                    <td className="px-10 py-7 text-right font-black text-2xl">₹{breakup.totals.grossA_Monthly.toLocaleString('en-IN')}</td>
                                                    <td className="px-10 py-7 text-right font-black opacity-40">₹{breakup.totals.grossA_Yearly.toLocaleString('en-IN')}</td>
                                                </tr>

                                                {/* 🏷 SECTION B: RETIRALS */}
                                                <tr className="bg-amber-50/30 dark:bg-amber-900/10">
                                                    <td colSpan="3" className="px-10 py-5 font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] text-[10px]">
                                                        Section B: Retirals & Statutory Benefits
                                                    </td>
                                                </tr>
                                                {breakup.retirementBenefits.map(comp => (
                                                    <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-10 py-5 font-bold text-slate-700 dark:text-slate-300">{comp.name}</td>
                                                        <td className="px-10 py-5 text-right font-black text-slate-900 dark:text-white">₹{comp.monthly.toLocaleString('en-IN')}</td>
                                                        <td className="px-10 py-5 text-right font-bold text-slate-400 dark:text-slate-500">₹{comp.yearly.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-amber-500 text-white shadow-xl">
                                                    <td className="px-10 py-7 font-black uppercase tracking-[0.2em] text-[11px]">Gross B Total (Retirals)</td>
                                                    <td className="px-10 py-7 text-right font-black text-2xl">₹{breakup.totals.grossB_Monthly.toLocaleString('en-IN')}</td>
                                                    <td className="px-10 py-7 text-right font-black opacity-40">₹{breakup.totals.grossB_Yearly.toLocaleString('en-IN')}</td>
                                                </tr>

                                                {/* 🏁 FINAL CTC */}
                                                <tr className="bg-indigo-700 text-white border-t-8 border-white dark:border-slate-900">
                                                    <td className="px-10 py-8">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                                                <Briefcase size={20} />
                                                            </div>
                                                            <div className="font-black uppercase tracking-[0.3em] text-[14px]">Total Annual CTC (Section A + B)</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-8 text-right font-black opacity-40 text-lg">₹{Math.round(breakup.totals.totalCTC / 12).toLocaleString('en-IN')}</td>
                                                    <td className="px-10 py-8 text-right font-black text-4xl tracking-tighter">₹{breakup.totals.totalCTC.toLocaleString('en-IN')}</td>
                                                </tr>

                                                {/* 💸 EMPLOYEE DEDUCTIONS */}
                                                <tr className="bg-rose-50/30 dark:bg-rose-900/10">
                                                    <td colSpan="3" className="px-10 py-5 font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] text-[10px]">
                                                        Employee Statutory Deductions
                                                    </td>
                                                </tr>
                                                {breakup.deductions.map(comp => (
                                                    <tr key={comp.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-10 py-5 text-slate-600 dark:text-slate-400 font-medium italic">{comp.name}</td>
                                                        <td className="px-10 py-5 text-right font-black text-rose-600 dark:text-rose-500">-(₹{comp.monthly.toLocaleString('en-IN')})</td>
                                                        <td className="px-10 py-5 text-right font-bold text-slate-400 dark:text-slate-500 italic">₹{comp.yearly.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}

                                                {/* 🏆 NET TAKE HOME */}
                                                <tr className="bg-emerald-600 text-white border-t-[12px] border-white dark:border-slate-900 shadow-2xl relative z-10">
                                                    <td className="px-10 py-10">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-14 h-14 bg-white text-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                                                                <TrendingUp size={28} strokeWidth={2.5} />
                                                            </div>
                                                            <div>
                                                                <div className="font-black uppercase tracking-[0.4em] text-[16px]">Monthly Take-Home Pay</div>
                                                                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">Approx. credit after all deductions</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-10 text-right font-black text-5xl tracking-tighter">₹{breakup.totals.takeHomeMonthly.toLocaleString('en-IN')}</td>
                                                    <td className="px-10 py-10 text-right font-black opacity-40 text-xl italic pt-12">/mo</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalaryAssignmentExcel;
