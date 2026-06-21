import React, { useState, useEffect, useMemo } from 'react';
import { Play, Save, Plus, Trash2, ArrowRight, ShieldCheck, CheckCircle2, Calculator, Settings, Clock, Activity, Target, AlertCircle, ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';
import clsx from 'clsx';
import { message } from 'antd';
import api from '../../../utils/api';

const PAYABLE_DAYS_OPTIONS = [
    { id: 'PRESENT_DAYS', label: 'Present' },
    { id: 'OD_DAYS', label: 'OD' },
    { id: 'PUBLIC_HOLIDAYS', label: 'Public Holiday' },
    { id: 'WEEKLY_OFFS', label: 'Weekly Off' },
    { id: 'PAID_LEAVES', label: 'Paid Leave' }
];

const VARIABLES = [
    { cat: 'Employee', list: ['SERVICE_MONTHS', 'SERVICE_YEARS', 'DEPARTMENT', 'LOCATION', 'GENDER'] }
];

export default function FormulaBuilder({ onSave, initialData, leaveTypes = [] }) {
    // Top Level Config
    const [leaveType, setLeaveType] = useState(initialData?.leaveType || (leaveTypes[0]?.code || 'EL'));
    const [formulaType, setFormulaType] = useState(initialData?.formulaType || 'Allocation');
    
    // Smart Forms State
    const [elState, setElState] = useState({ serviceMonths: 6, payableDays: ['PRESENT_DAYS', 'OD_DAYS', 'PUBLIC_HOLIDAYS', 'WEEKLY_OFFS'], threshold: 20, credit: 1.75 });
    const [clslState, setClslState] = useState({ method: 'doj', annualLimit: 7 });
    const [mlplState, setMlplState] = useState({ gender: 'Female', credit: 182 });

    // Custom Rules State
    const [customRules, setCustomRules] = useState([]);
    
    // UI State
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Simulator State
    const [simContext, setSimContext] = useState({
        GENDER: 'Female',
        DEPARTMENT: 'Production',
        SERVICE_MONTHS: '8',
        REMAINING_MONTHS: '6',
        PRESENT_DAYS: '18',
        OD_DAYS: '2',
        PUBLIC_HOLIDAYS: '2',
        WEEKLY_OFFS: '4'
    });
    const [simResult, setSimResult] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Dynamic Effect when Leave Type Changes
    useEffect(() => {
        if (leaveType === 'ML') setMlplState({ gender: 'Female', credit: 182 });
        if (leaveType === 'PL') setMlplState({ gender: 'Male', credit: 15 });
        if (leaveType === 'CL' || leaveType === 'SL') setClslState({ method: 'doj', annualLimit: 7 });
    }, [leaveType]);

    // Auto-Compile logic to expression string
    const compiledFormula = useMemo(() => {
        let expr = '0';
        
        // Base Template Logic
        if (leaveType === 'EL') {
            const sumStr = elState.payableDays.length > 0 ? elState.payableDays.join(' + ') : '0';
            expr = `IF(SERVICE_MONTHS >= ${elState.serviceMonths} and (${sumStr}) >= ${elState.threshold}, ${elState.credit}, 0)`;
        } 
        else if (leaveType === 'CL' || leaveType === 'SL') {
            expr = `ROUND((${clslState.annualLimit} / 12) * REMAINING_MONTHS, 2)`;
        }
        else if (leaveType === 'ML' || leaveType === 'PL') {
            expr = `IF(GENDER == '${mlplState.gender}', ${mlplState.credit}, 0)`;
        }

        // Inject Custom Exception Rules on top (bottom-up nesting)
        for (let i = customRules.length - 1; i >= 0; i--) {
            const rule = customRules[i];
            if (!rule.variable || !rule.value) continue;
            let val = rule.value;
            if (isNaN(val) && !val.startsWith("'")) val = `'${val.replace(/"/g, '')}'`;
            expr = `IF(${rule.variable} ${rule.operator} ${val}, ${rule.credit || '0'}, ${expr})`;
        }

        return expr;
    }, [leaveType, elState, clslState, mlplState, customRules]);

    const handleSimulate = async () => {
        setIsSimulating(true);
        try {
            const parsedContext = {};
            for(let k in simContext) {
                const val = String(simContext[k]).replace(/['"]/g, ''); 
                if(!isNaN(val) && val !== '') parsedContext[k] = Number(val);
                else parsedContext[k] = val;
            }

            const res = await api.post('/hr/formula/simulate', {
                formula: compiledFormula,
                context: parsedContext
            });
            setSimResult(res.data.result);
        } catch (err) {
            message.error(err.response?.data?.error || 'Simulation failed');
            setSimResult('Error');
        } finally {
            setIsSimulating(false);
        }
    };

    const togglePayableDay = (id) => {
        setElState(prev => ({
            ...prev,
            payableDays: prev.payableDays.includes(id) ? prev.payableDays.filter(x => x !== id) : [...prev.payableDays, id]
        }));
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-[20px] overflow-hidden shadow-sm flex h-[850px] font-sans text-slate-800">
            
            {/* LEFT PANEL: Policy Designer */}
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-white">
                
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px]"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
                                    <ShieldCheck size={24} className="text-emerald-400"/> Context-Aware Policy Builder
                                </h1>
                                <p className="text-indigo-100 text-sm font-medium">Smart templates adapt dynamically based on Leave Type.</p>
                            </div>
                            <button onClick={() => onSave({ leaveType, formulaType, expression: compiledFormula })} className="bg-white text-indigo-600 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
                                <Save size={14} /> Publish Policy
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 relative group">
                                <div className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Select Leave Type</div>
                                <div className="relative">
                                    <select className="w-full bg-indigo-900/50 border border-indigo-400/50 text-white rounded-lg px-3 py-1.5 font-bold text-sm focus:outline-none focus:border-white shadow-sm cursor-pointer appearance-none pr-8" value={leaveType} onChange={e=>setLeaveType(e.target.value)}>
                                        {leaveTypes.map(lt => (
                                            <option key={lt.code} value={lt.code} className="text-slate-800">{lt.name} ({lt.code})</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-300">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 relative group">
                                <div className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Formula Type</div>
                                <div className="relative">
                                    <select className="w-full bg-indigo-900/50 border border-indigo-400/50 text-white rounded-lg px-3 py-1.5 font-bold text-sm focus:outline-none focus:border-white shadow-sm cursor-pointer appearance-none pr-8" value={formulaType} onChange={e=>setFormulaType(e.target.value)}>
                                        <option value="Allocation" className="text-slate-800">Allocation</option>
                                        <option value="Accrual" className="text-slate-800">Accrual</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-300">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                                <div className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Assigned</div>
                                <div className="text-white font-bold text-sm mt-1.5">Managed in Tab</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                                <div className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Status</div>
                                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1 mt-1.5"><CheckCircle2 size={14}/> Active Draft</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Smart Forms Area */}
                <div className="p-8 space-y-8 pb-20">
                    
                    {/* EL Smart Form */}
                    {leaveType === 'EL' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight"><Activity className="text-indigo-600"/> EL Attendance Policy</h2>
                            
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8">
                                {/* Eligibility */}
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">1. Eligibility</div>
                                    <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
                                        <span className="text-sm font-bold text-slate-700">Service Months</span>
                                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-sm font-black">&gt;=</span>
                                        <input value={elState.serviceMonths} onChange={e=>setElState({...elState, serviceMonths: e.target.value})} className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 text-center" />
                                    </div>
                                </div>

                                {/* Payable Days Setup */}
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">2. Payable Days Calculation</div>
                                    <div className="flex flex-wrap gap-3">
                                        {PAYABLE_DAYS_OPTIONS.map(opt => {
                                            const isActive = elState.payableDays.includes(opt.id);
                                            return (
                                                <button key={opt.id} onClick={() => togglePayableDay(opt.id)} className={clsx("px-5 py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center gap-2", isActive ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300")}>
                                                    {isActive && <CheckCircle2 size={16}/>} {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <div className="mt-4 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
                                        <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest bg-indigo-100 px-2 py-1 rounded">System Formula</div>
                                        <div className="font-mono text-sm text-indigo-900 font-bold">= {elState.payableDays.length > 0 ? elState.payableDays.join(' + ') : '0'}</div>
                                    </div>
                                </div>

                                {/* Allocation */}
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">3. Credit Allocation</div>
                                    <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                        <span className="text-sm font-bold text-slate-700">If Payable Days</span>
                                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-sm font-black">&gt;=</span>
                                        <input value={elState.threshold} onChange={e=>setElState({...elState, threshold: e.target.value})} className="w-20 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700 focus:outline-none focus:border-emerald-500 text-center" />
                                        <ArrowRight className="text-emerald-300 mx-2"/>
                                        <span className="text-sm font-bold text-slate-700">Credit</span>
                                        <input value={elState.credit} onChange={e=>setElState({...elState, credit: e.target.value})} className="w-24 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm font-black text-emerald-600 focus:outline-none focus:border-emerald-500 text-center" />
                                        <span className="text-sm font-bold text-slate-700">Days</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CL / SL Smart Form */}
                    {(leaveType === 'CL' || leaveType === 'SL') && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight"><Clock className="text-violet-600"/> {leaveType} Prorata Policy</h2>
                            
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Allocation Method</div>
                                    <div className="flex gap-4">
                                        <button className="flex-1 bg-violet-50 border-2 border-violet-500 text-violet-700 rounded-xl p-4 font-bold text-left relative overflow-hidden">
                                            <div className="absolute top-2 right-2 text-violet-500"><CheckCircle2 size={16}/></div>
                                            <div className="text-sm">DOJ Prorata</div>
                                            <div className="text-[10px] text-violet-400 uppercase tracking-widest mt-1">Calculates remaining months automatically</div>
                                        </button>
                                        <button className="flex-1 bg-white border border-slate-200 text-slate-400 rounded-xl p-4 font-bold text-left opacity-50 cursor-not-allowed">
                                            <div className="text-sm">Fixed Yearly</div>
                                            <div className="text-[10px] uppercase tracking-widest mt-1">Flat credit for all</div>
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 flex items-center gap-6">
                                    <span className="text-sm font-black text-slate-700">Annual Leave Limit</span>
                                    <input value={clslState.annualLimit} onChange={e=>setClslState({...clslState, annualLimit: e.target.value})} className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-3 text-lg font-black text-violet-600 focus:outline-none focus:border-violet-500 text-center shadow-sm" />
                                    <span className="text-sm font-black text-slate-700">Days</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ML / PL Smart Form */}
                    {(leaveType === 'ML' || leaveType === 'PL') && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight"><Target className="text-rose-500"/> {leaveType} Eligibility Policy</h2>
                            
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                                <div className="flex items-center gap-4 bg-rose-50 border border-rose-100 rounded-xl p-4">
                                    <span className="text-sm font-bold text-slate-700">Eligibility</span>
                                    <select value={mlplState.gender} onChange={e=>setMlplState({...mlplState, gender: e.target.value})} className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 outline-none">
                                        <option value="Female">Female Employees Only</option>
                                        <option value="Male">Male Employees Only</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <span className="text-sm font-bold text-slate-700">Allocation Credit</span>
                                    <input value={mlplState.credit} onChange={e=>setMlplState({...mlplState, credit: e.target.value})} className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-lg font-black text-rose-600 focus:outline-none focus:border-rose-500 text-center shadow-sm" />
                                    <span className="text-sm font-bold text-slate-700">Days</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Custom / Dynamic Leave Form */}
                    {!['EL', 'CL', 'SL', 'ML', 'PL'].includes(leaveType) && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight"><Settings className="text-slate-600"/> Custom Policy ({leaveType})</h2>
                            
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                                <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-4 items-start">
                                    <AlertCircle className="text-indigo-500 mt-0.5 shrink-0" />
                                    <div>
                                        <h3 className="text-sm font-bold text-indigo-900 mb-1">Generic Leave Configuration</h3>
                                        <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                                            Since this is a custom leave type, use the <b>Advanced Custom Rules</b> builder below to define exactly how it should be allocated. For example, you can set a flat credit by adding a rule like <i>"SERVICE_MONTHS &gt;= 0 THEN 10"</i>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <hr className="border-slate-200 my-8"/>

                    {/* Advanced Custom Rules (Exceptions) */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Settings size={16} className="text-slate-500"/> Advanced Custom Rules</h3>
                        
                        {customRules.map((rule, idx) => (
                            <div key={idx} className="bg-white border border-amber-200 rounded-xl shadow-sm p-4 flex items-center gap-3 animate-in fade-in">
                                <div className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-2 py-1 rounded">IF</div>
                                <select value={rule.variable} onChange={(e) => {
                                    const newRules = [...customRules];
                                    newRules[idx].variable = e.target.value;
                                    setCustomRules(newRules);
                                }} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none w-40">
                                    {VARIABLES[0].list.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <select value={rule.operator} onChange={(e) => {
                                    const newRules = [...customRules];
                                    newRules[idx].operator = e.target.value;
                                    setCustomRules(newRules);
                                }} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-amber-600 outline-none">
                                    <option value="==">=</option>
                                    <option value="!=">!=</option>
                                    <option value=">">&gt;</option>
                                    <option value=">=">&gt;=</option>
                                </select>
                                <input value={rule.value} onChange={(e) => {
                                    const newRules = [...customRules];
                                    newRules[idx].value = e.target.value;
                                    setCustomRules(newRules);
                                }} placeholder="Value" className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none" />
                                
                                <div className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-2 py-1 rounded ml-4">THEN</div>
                                <input value={rule.credit} onChange={(e) => {
                                    const newRules = [...customRules];
                                    newRules[idx].credit = e.target.value;
                                    setCustomRules(newRules);
                                }} placeholder="Credit" className="w-20 bg-slate-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-black text-amber-600 outline-none text-center" />
                                
                                <button onClick={() => setCustomRules(customRules.filter((_, i) => i !== idx))} className="ml-auto text-slate-400 hover:text-rose-500 bg-slate-50 p-2 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                        ))}

                        <button onClick={() => setCustomRules([...customRules, { variable: 'SERVICE_YEARS', operator: '>=', value: '', credit: '' }])} className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                            <Plus size={14}/> Add Exception Rule
                        </button>
                    </div>

                    {/* Raw Formula Drawer */}
                    <div className="mt-12 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                        <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full p-4 flex justify-between items-center bg-slate-100 hover:bg-slate-200 transition-colors">
                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><FileCode2 size={16}/> Advanced Raw Formula</span>
                            <ChevronDown size={16} className={clsx("text-slate-500 transition-transform duration-300", showAdvanced && "rotate-180")} />
                        </button>
                        {showAdvanced && (
                            <div className="p-4 bg-slate-900 border-t border-slate-800">
                                <div className="font-mono text-[10px] text-cyan-400 leading-relaxed break-all">
                                    {compiledFormula}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: Live Simulator */}
            <div className="w-[380px] border-l border-slate-200 bg-slate-50 flex flex-col shrink-0">
                <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm relative z-10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                        <Play size={16}/> Live Simulator
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="bg-indigo-50 border-b border-indigo-100 p-3 text-[10px] font-black uppercase tracking-widest text-indigo-800 text-center">Test Employee Profile</div>
                        <div className="p-4 space-y-3">
                            {Object.entries(simContext).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between gap-3 group">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-focus-within:text-indigo-600 transition-colors w-32 truncate">{k.replace('_', ' ')}</label>
                                    <input value={v} onChange={(e) => setSimContext({...simContext, [k]: e.target.value})} className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white text-right transition-all" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl border border-slate-800">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Final Allocation</div>
                        {simResult !== null ? (
                            <div className={clsx("text-5xl font-mono tracking-tight font-black mb-1 drop-shadow-md", simResult === 'Error' ? "text-rose-500" : "text-emerald-400")}>
                                {simResult}
                            </div>
                        ) : (
                            <div className="text-4xl font-mono tracking-tight font-black text-slate-700 mb-1">--</div>
                        )}
                        <div className="text-[10px] font-black text-slate-500 uppercase">Leaves Credited</div>
                    </div>
                    
                    <button onClick={handleSimulate} disabled={isSimulating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition-all transform hover:-translate-y-0.5 flex justify-center items-center gap-2 disabled:opacity-50">
                        {isSimulating ? 'Processing...' : <><Calculator size={14}/> Run Test Simulation</>}
                    </button>
                    
                    {simResult !== null && simResult !== 'Error' && (
                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 animate-in fade-in">
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5"/>
                            <div className="text-[10px] font-bold text-emerald-800 leading-relaxed uppercase tracking-widest">
                                Formula executed successfully. Final logic node evaluated.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
