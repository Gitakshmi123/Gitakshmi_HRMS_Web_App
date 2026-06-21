import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import api from '../../utils/api';
import {
    Plus, Trash2, Edit2, Save, X, Check,
    RefreshCw, FileText, Users, ShieldCheck, AlertCircle, ChevronDown,
    ToggleLeft, ToggleRight, Upload, Calendar, Award, Settings, Clock, DollarSign, Activity, List,
    Download
} from 'lucide-react';
import { Can } from '../../components/rbac/PermissionGate';
import LeaveAnalyticsPanel from './components/LeaveAnalyticsPanel';
import OpeningBalanceImportModal from './components/OpeningBalanceImportModal';
import * as XLSX from '@sheetjs/xlsx';

// ─── Shared Excel Export Utility ─────────────────────────────────────────────
const exportToExcel = (rows, columns, filename) => {
    // columns: [{ header: 'Display Name', key: 'rowKey' }]
    const worksheetData = [
        columns.map(c => c.header),
        ...rows.map(row => columns.map(c => {
            const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
            return val !== null && val !== undefined ? val : '';
        }))
    ];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    // Auto column widths
    const colWidths = columns.map(c => ({
        wch: Math.max(
            c.header.length,
            ...rows.map(row => {
                const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
                return val !== null && val !== undefined ? String(val).length : 0;
            })
        ) + 2
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    showToast('success', 'Download Started', `${filename}.xlsx is being downloaded.`);
};


const GRADE_COLLECTIONS = {
    'Roman + Numeric': ['I-1', 'I-2', 'II-1', 'II-2', 'III-1', 'III-2', 'IV-1', 'IV-2', 'V-1', 'V-2'],
    'Alphabet': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    'Numeric Only': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    'Roman Only': ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'],
    'Custom': []
};

const BAND_COLLECTIONS = {
    'Roman + Numeric': ['I-1', 'I-2', 'II-1', 'II-2', 'III-1', 'III-2', 'IV-1', 'IV-2', 'V-1', 'V-2'],
    'Alphabet': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    'Numeric Only': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    'Roman Only': ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'],
    'Custom': []
};

const DEFAULT_GRADES = Array.from({ length: 15 }, (_, i) => `Grade ${i + 1}`);

// Helper to filter balances based on eligibility (e.g. Maternity / Paternity rules)
const filterBalances = (balances, employee) => {
    if (!Array.isArray(balances)) return [];
    if (!employee) return balances;

    const gender = String(employee.gender || '').trim().toLowerCase();
    const maritalStatus = String(employee.maritalStatus || '').trim().toLowerCase();
    const isMarried = maritalStatus === 'married';

    return balances.filter(b => {
        const lt = String(b.leaveType || '').toUpperCase();
        if (lt === 'MATERNITY') {
            return gender === 'female' && isMarried;
        }
        if (lt === 'PATERNITY') {
            return gender === 'male' && isMarried;
        }
        return true;
    });
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, iconColor, iconBg }) {
    return (
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="flex items-center gap-3 relative z-10">
                <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center border border-current opacity-20 group-hover:opacity-100 group-hover:bg-current group-hover:text-white transition-all duration-300`}>
                    {icon && React.isValidElement(icon)
                        ? React.cloneElement(icon, { size: 18 })
                        : null}
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                    <h3 className="text-xl font-black text-slate-900 leading-none">{value}</h3>
                </div>
            </div>
        </div>
    );
}

// ─── Policy Card ────────────────────────────────────────────────────────────────
function PolicyCard({ p, onEdit, onSync, onDelete, onToggle }) {
    const activeRules = p.rules?.length || 0;
    
    return (
        <div 
            onClick={() => onEdit(p)}
            className={clsx(
                "bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-300 flex flex-col group overflow-hidden",
                !p.isActive && "opacity-80 grayscale-[0.3]"
            )}
        >
            <div className="pt-3 pb-2 px-4 flex-1">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm shrink-0 transition-all group-hover:scale-110",
                            p.isActive ? "bg-slate-100 border-slate-200 text-slate-900" : "bg-slate-50 border-slate-100 text-slate-400"
                        )}>
                            {p.applicableTo === 'All' ? <Users size={14} /> : <ShieldCheck size={14} />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[10px] font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate leading-tight">
                                {p.name}
                            </h3>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Scope:</span>
                                <span className="text-[6px] font-black text-slate-900 uppercase tracking-widest bg-slate-100/50 px-1.5 py-0.2 rounded-full border border-slate-200/50">
                                    {p.applicableTo === 'Specific' ? 'Personal' : (p.applicableTo === 'Intern' ? 'Interns' : (p.applicableTo === 'Band' ? `Bands: ${p.applicableBands?.length || 0}` : (p.applicableTo === 'JobType' ? 'Job Type' : (p.applicableTo === 'Grade' ? `Grades: ${(p.gradeCodes?.length || 0) + (p.gradeIds?.length || 0)}` : p.applicableTo))))}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={clsx(
                        "w-1 h-1 rounded-full border border-white shadow-sm",
                        p.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    )} />
                </div>

                {/* Rules List */}
                <div className="space-y-1">
                    {activeRules === 0 ? (
                        <div className="text-center py-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Baseline Only</p>
                        </div>
                    ) : (
                        (p.rules || []).map((r, i) => (
                            <div key={i} className="space-y-0.5 group/rule">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <div className="w-0.5 h-2 rounded-full" style={{ backgroundColor: r.color || '#3b82f6' }} />
                                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight">{r.leaveType}</span>
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-[10px] font-black text-slate-900">{r.totalPerYear}</span>
                                        <span className="text-[6px] text-slate-400 font-bold uppercase tracking-tighter">D</span>
                                    </div>
                                </div>
                                
                                <div className="h-0.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/30">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000" 
                                        style={{ 
                                            width: '100%',
                                            backgroundColor: r.color || '#3b82f6',
                                            opacity: 0.8
                                        }} 
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div 
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-1.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between"
            >
                <div className="flex gap-1">
                    <Can module="leave.policies" action="update">
                        <button onClick={() => onEdit(p)} className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm active:scale-90">
                            <Edit2 size={10} />
                        </button>
                        <button onClick={() => onSync(p._id || p.id)} className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm active:scale-90" title="Sync to employees">
                            <RefreshCw size={10} />
                        </button>
                    </Can>
                    <Can module="leave.policies" action="delete">
                        <button onClick={() => onDelete(p._id || p.id)} className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm active:scale-90">
                            <Trash2 size={10} />
                        </button>
                    </Can>
                </div>

                <Can module="leave.policies" action="update">
                    <button
                        onClick={() => onToggle(p, p.isActive)}
                        className={clsx(
                            "flex items-center gap-1 h-6 px-2 rounded-md text-[7px] font-black uppercase tracking-widest transition-all active:scale-95",
                            p.isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        {p.isActive ? (
                            <>
                                <Check size={8} strokeWidth={4} />
                                Active
                            </>
                        ) : (
                            <>
                                <Plus size={8} strokeWidth={4} />
                                Enable
                            </>
                        )}
                    </button>
                </Can>
            </div>
        </div>
    );
}


// ─── Custom Mappings Panel ─────────────────────────────────────────────────────
function CustomMappingsPanel({ 
    mappings, 
    setMappings,
    onAdd, 
    onDelete, 
    onEdit, 
    editingId, 
    mappingForm, 
    setMappingForm, 
    onCancelEdit,
}) {
    const [gradeType, setGradeType] = useState('Roman + Numeric');
    const [bandType, setBandType] = useState('Alphabet');
    const [selectedBandFilter, setSelectedBandFilter] = useState('All');
    
    useEffect(() => {
        if (gradeType === 'Custom') {
            setMappingForm(prev => ({ ...prev, gradeValue: '' }));
        }
    }, [gradeType, setMappingForm]);

    useEffect(() => {
        if (bandType === 'Custom') {
            setMappingForm(prev => ({ ...prev, band: '' }));
        }
    }, [bandType, setMappingForm]);

    const grades = GRADE_COLLECTIONS[gradeType] || [];
    const bands = BAND_COLLECTIONS[bandType] || [];

    const onSubmit = (e) => {
        e.preventDefault();
        onAdd();
    };

    const handleQuickSyncBand = async (mappingId) => {
        const currentMapping = mappings.find(m => m._id === mappingId);
        if (!currentMapping) return;

        if (!mappingForm.band) {
            return showToast('warning', 'Band Required', 'Please select a Band Value in the header first.');
        }

        try {
            const res = await api.put(`/hr/leave-policies/custom/mappings/${mappingId}`, {
                ...currentMapping,
                band: mappingForm.band
            });

            if (res.data.success) {
                setMappings(prev => prev.map(m => m._id === mappingId ? res.data.data : m));
                showToast('success', 'Band Synced', `Updated to Band ${mappingForm.band}`);
            }
        } catch (err) {
            console.error('Quick sync failed:', err);
            showToast('error', 'Sync Failed', 'Could not update band.');
        }
    };

    const handleToggleActive = async (mappingId) => {
        const currentMapping = mappings.find(m => m._id === mappingId);
        if (!currentMapping) return;

        const newStatus = currentMapping.isActive === false ? true : false;

        try {
            const res = await api.put(`/hr/leave-policies/custom/mappings/${mappingId}`, {
                ...currentMapping,
                isActive: newStatus
            });

            if (res.data.success) {
                setMappings(prev => prev.map(m => m._id === mappingId ? res.data.data : m));
                showToast('success', newStatus ? 'Rule Activated' : 'Rule Deactivated');
            }
        } catch (err) {
            console.error('Toggle failed:', err);
            showToast('error', 'Update Failed', err.response?.data?.error || 'Could not toggle status.');
        }
    };

    return (
        <div className="space-y-3">
            <div className="bg-white rounded-[12px] border border-slate-100 shadow-sm p-3">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        Grade Mapping
                    </h2>
                    <div className="flex items-center gap-4">
                        {/* Grade Type Selector */}
                        <div className="relative min-w-[130px] group">
                            <span className="absolute left-3 top-[4px] text-[7px] font-black text-blue-500 uppercase tracking-tighter opacity-0 group-hover:opacity-70 group-focus-within:opacity-70 transition-opacity pointer-events-none">Grade Type</span>
                            <select 
                                value={gradeType} 
                                onChange={(e) => setGradeType(e.target.value)}
                                className="w-full h-10 pl-3 pr-8 pt-1 group-hover:pt-3 group-focus-within:pt-3 bg-slate-50 border border-slate-200 rounded-[4px] text-[10px] font-black text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none"
                            >
                                {Object.keys(GRADE_COLLECTIONS).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={14} />
                            </div>
                        </div>

                        {/* Band Type Selector */}
                        <div className="relative min-w-[130px] group">
                            <span className="absolute left-3 top-[4px] text-[7px] font-black text-blue-500 uppercase tracking-tighter opacity-0 group-hover:opacity-70 group-focus-within:opacity-70 transition-opacity pointer-events-none">Band Type</span>
                            <select 
                                value={bandType} 
                                onChange={(e) => setBandType(e.target.value)}
                                className="w-full h-10 pl-3 pr-8 pt-1 group-hover:pt-3 group-focus-within:pt-3 bg-slate-50 border border-slate-200 rounded-[4px] text-[10px] font-black text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none"
                            >
                                {Object.keys(BAND_COLLECTIONS).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={14} />
                            </div>
                        </div>

                        {/* Band Value Input */}
                        <div className="relative min-w-[120px] group">
                            <span className="absolute left-3 top-[4px] text-[7px] font-black text-blue-500 uppercase tracking-tighter opacity-0 group-hover:opacity-70 group-focus-within:opacity-70 transition-opacity pointer-events-none">Band Value</span>
                            {bandType === 'Custom' || mappingForm.band === 'CUSTOM_ENTRY' ? (
                                <div className="relative group/custom">
                                    <input
                                        type="text"
                                        placeholder="Enter Band"
                                        value={mappingForm.band === 'CUSTOM_ENTRY' ? '' : mappingForm.band}
                                        onChange={e => setMappingForm({ ...mappingForm, band: e.target.value })}
                                        className="w-full h-10 pl-3 pr-8 pt-1 group-hover:pt-3 group-focus-within:pt-3 bg-slate-50 border border-slate-200 rounded-[4px] text-[10px] font-black text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        autoFocus
                                    />
                                    {bandType !== 'Custom' && (
                                        <button 
                                            type="button"
                                            onClick={() => setMappingForm({ ...mappingForm, band: '' })}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover/custom:opacity-100 transition-opacity shadow-lg"
                                        >
                                            <X size={8} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={mappingForm.band}
                                        onChange={e => setMappingForm({ ...mappingForm, band: e.target.value })}
                                        className="w-full h-10 pl-3 pr-8 pt-1 group-hover:pt-3 group-focus-within:pt-3 bg-slate-50 border border-slate-200 rounded-[4px] text-[10px] font-black text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none"
                                    >
                                        <option value="">Select/Type</option>
                                        {bands.map(b => <option key={b} value={b}>Band {b}</option>)}
                                        <option value="CUSTOM_ENTRY" className="font-black text-blue-600">+ Custom...</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
                    {/* Grade Selector */}
                    <div className="flex-[0.8] min-w-[110px] space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Grade</label>
                        {gradeType === 'Custom' || mappingForm.gradeValue === 'CUSTOM_ENTRY' ? (
                            <div className="relative group/custom">
                                <input
                                    type="text"
                                    placeholder="Enter Grade"
                                    value={mappingForm.gradeValue === 'CUSTOM_ENTRY' ? '' : mappingForm.gradeValue}
                                    onChange={e => setMappingForm({ ...mappingForm, gradeValue: e.target.value })}
                                    className="w-full h-10 px-4 bg-white border border-slate-200 rounded-[4px] text-[12px] font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                                    autoFocus
                                />
                                {gradeType !== 'Custom' && (
                                    <button 
                                        type="button"
                                        onClick={() => setMappingForm({ ...mappingForm, gradeValue: '' })}
                                        className="absolute -right-2 -top-2 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover/custom:opacity-100 transition-opacity shadow-lg"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <select
                                value={mappingForm.gradeValue}
                                onChange={e => setMappingForm({ ...mappingForm, gradeValue: e.target.value })}
                                className="w-full h-10 px-4 bg-white border border-slate-200 rounded-[4px] text-[12px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                            >
                                <option value="">Select Grade</option>
                                {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                <option value="CUSTOM_ENTRY" className="font-black text-blue-600">+ Custom...</option>
                            </select>
                        )}
                    </div>

                    {/* Grade Name */}
                    <div className="flex-[2] min-w-[200px] space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Grade Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Senior Executive"
                            value={mappingForm.gradeName}
                            onChange={e => setMappingForm({ ...mappingForm, gradeName: e.target.value })}
                            className="w-full h-10 px-4 bg-white border border-slate-200 rounded-[4px] text-[13px] font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                        />
                    </div>

                    {/* Min CTC (LPA) */}
                    <div className="flex-1 min-w-[100px] space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Min LPA</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={mappingForm.minLpa}
                            onChange={e => setMappingForm({ ...mappingForm, minLpa: e.target.value })}
                            className="w-full h-10 px-4 bg-white border border-slate-200 rounded-[4px] text-[12px] font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                        />
                    </div>

                    {/* Max CTC (LPA) */}
                    <div className="flex-1 min-w-[100px] space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Max LPA</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={mappingForm.maxLpa}
                            onChange={e => setMappingForm({ ...mappingForm, maxLpa: e.target.value })}
                            className="w-full h-10 px-4 bg-white border border-slate-200 rounded-[4px] text-[12px] font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                        />
                    </div>


                    <div className="flex items-center gap-2">
                        <Can module="leave.custom" action={editingId ? "update" : "create"}>
                            <button 
                                type="submit" 
                                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[4px] text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 transition-all transform active:scale-95"
                            >
                                {editingId ? 'Update' : 'Add'}
                            </button>
                        </Can>
                        {editingId && (
                            <button 
                                type="button" 
                                onClick={onCancelEdit}
                                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-[4px] text-[11px] font-black uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Matrix Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">Salary Range Matrix</h2>
                        
                        {/* Dynamic Band Filters */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
                            <button 
                                onClick={() => setSelectedBandFilter('All')}
                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${selectedBandFilter === 'All' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                All
                            </button>
                            {[...new Set(mappings.map(m => m.band).filter(Boolean))].sort().map(b => (
                                <button 
                                    key={b}
                                    onClick={() => setSelectedBandFilter(b)}
                                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${selectedBandFilter === b ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    Band {b}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
                
                <div className="bg-white border border-slate-100 rounded-[12px] overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-4 py-3 w-10 text-center">
                                    <input type="checkbox" disabled className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500" />
                                </th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Compensation Slab</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Grade</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Grade Name</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Band</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {mappings.filter(m => selectedBandFilter === 'All' || m.band === selectedBandFilter).map(m => (
                                <tr key={m._id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-4 py-2 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={m.band === mappingForm.band && !!mappingForm.band}
                                            onChange={() => handleQuickSyncBand(m._id)}
                                            className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer select-none" 
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className={`flex flex-col ${m.isActive === false ? 'opacity-40' : ''}`}>
                                            <span className="text-[11px] font-black text-slate-900">{m.label}</span>
                                            {m.isActive === false && <span className="text-[8px] font-bold text-rose-500 uppercase">Inactive</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${m.isActive === false ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                            Grade {m.gradeCode || m.gradeValue || m.gradeName || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`text-[11px] font-bold ${m.isActive === false ? 'text-slate-300' : 'text-slate-600'}`}>{m.gradeName || '—'}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${m.isActive === false ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {m.band || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex justify-end gap-1.5 items-center">
                                            <Can module="leave.custom" action="update">
                                                <button 
                                                    type="button" 
                                                    onClick={() => onEdit(m)} 
                                                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-md transition-all active:scale-95"
                                                    title="Edit Mapping"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                            </Can>
                                            
                                            <Can module="leave.custom" action="delete">
                                                <button 
                                                    type="button" 
                                                    onClick={() => onDelete(m._id)} 
                                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all active:scale-95"
                                                    title="Delete Mapping"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </Can>

                                            {/* Professional Toggle */}
                                            <Can module="leave.custom" action="update">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleToggleActive(m._id)} 
                                                    className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${m.isActive === false ? 'bg-slate-200' : 'bg-indigo-500'}`}
                                                    title={m.isActive === false ? 'Activate' : 'Deactivate'}
                                                >
                                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${m.isActive === false ? 'left-0.5' : 'left-[18px]'}`} />
                                                </button>
                                            </Can>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {mappings.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-10 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <p className="text-[10px] font-black uppercase tracking-widest">No Mappings Defined</p>
                                            <p className="text-[9px] font-bold mt-1">Use the form above to create salary-based policy rules</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Opening Balance Management Panel ──────────────────────────────────────────
function OpeningBalancePanel({ employees }) {
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [balances, setBalances] = useState([]);
    const [loadingBalances, setLoadingBalances] = useState(false);
    const [inputValues, setInputValues] = useState({});
    const [saving, setSaving] = useState({});
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const filteredEmployees = employees.filter(e => {
        const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
        const code = (e.employeeId || '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || code.includes(q);
    });

    useEffect(() => {
        if (selectedEmp) {
            fetchEmpBalances();
        } else {
            setBalances([]);
            setInputValues({});
        }
    }, [selectedEmp, year]);

    const fetchEmpBalances = async () => {
        setLoadingBalances(true);
        try {
            const res = await api.get('/employee/leaves/balances', {
                params: { employeeId: selectedEmp._id, year }
            });
            const bals = Array.isArray(res.data) ? res.data : (res.data?.balances || []);
            setBalances(bals);
            
            const vals = {};
            bals.forEach(b => {
                vals[b.leaveType] = b.opening ?? 0;
            });
            setInputValues(vals);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to fetch leave balances.');
        } finally {
            setLoadingBalances(false);
        }
    };

    const handleSaveOpening = async (leaveType) => {
        const val = inputValues[leaveType];
        if (val === undefined || isNaN(val) || val < 0) {
            showToast('error', 'Invalid Value', 'Please enter a valid non-negative number.');
            return;
        }

        setSaving(prev => ({ ...prev, [leaveType]: true }));
        try {
            await api.post('/employee/leaves/opening-balance', {
                employeeId: selectedEmp._id,
                leaveType,
                opening: Number(val),
                year
            });
            showToast('success', 'Saved', `${leaveType} opening balance updated.`);
            fetchEmpBalances();
        } catch (err) {
            console.error(err);
            showToast('error', 'Save Failed', err.response?.data?.error || 'Failed to save balance.');
        } finally {
            setSaving(prev => ({ ...prev, [leaveType]: false }));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-tight">Select Employee</h3>
                    </div>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all"
                    >
                        <Upload size={12} />
                        Import CSV
                    </button>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search employee name or code..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all placeholder:text-slate-300"
                    />
                </div>
                
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 pr-1.5 scrollbar-thin scrollbar-thumb-slate-200">
                    {filteredEmployees.length === 0 ? (
                        <div className="py-8 text-center text-xs font-medium text-slate-400">No employees found</div>
                    ) : (
                        filteredEmployees.map(emp => (
                            <button
                                key={emp._id}
                                onClick={() => setSelectedEmp(emp)}
                                className={clsx(
                                    "w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all mt-1",
                                    selectedEmp?._id === emp._id
                                        ? "bg-blue-50/50 border border-blue-200"
                                        : "hover:bg-slate-50 border border-transparent"
                                )}
                            >
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">
                                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-xs truncate">
                                        {emp.firstName} {emp.lastName}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        {emp.employeeId || 'ID: --'}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                {!selectedEmp ? (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 mb-3">
                            <Users size={28} />
                        </div>
                        <h4 className="font-bold text-slate-700 text-sm">No Employee Selected</h4>
                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                            Please search and select an employee from the left panel to update their opening leave balances.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 text-blue-600 font-bold text-sm flex items-center justify-center">
                                    {selectedEmp.firstName?.[0]}{selectedEmp.lastName?.[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">
                                        {selectedEmp.firstName} {selectedEmp.lastName}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {selectedEmp.employeeId || 'EMP ID'} · {selectedEmp.designation?.name || 'No Designation'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                                <select
                                    value={year}
                                    onChange={e => setYear(Number(e.target.value))}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer select-none"
                                >
                                    {[2025, 2026, 2027, 2028].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loadingBalances ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading balances...</p>
                            </div>
                        ) : balances.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                No active leave balances found for this employee in {year}.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                                    <div className="col-span-2">Leave Type</div>
                                    <div className="text-center font-black">Current Total</div>
                                    <div className="col-span-2 text-right">Opening Balance Override</div>
                                </div>
                                <div className="divide-y divide-slate-50 max-h-[350px] overflow-y-auto pr-1">
                                    {balances.map(bal => (
                                        <div key={bal._id || bal.leaveType} className="grid grid-cols-5 items-center py-3">
                                            <div className="col-span-2 flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-900" style={{ backgroundColor: bal.color || '#3b82f6' }} />
                                                <span className="font-bold text-slate-700 text-xs">{bal.leaveType}</span>
                                            </div>
                                            <div className="text-center font-bold text-slate-800 text-xs">
                                                {bal.total ?? 0}
                                            </div>
                                            <div className="col-span-2 flex items-center justify-end gap-2">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={inputValues[bal.leaveType] ?? ''}
                                                    onChange={e => setInputValues({ ...inputValues, [bal.leaveType]: e.target.value })}
                                                    className="w-20 text-center py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all shadow-none"
                                                />
                                                <button
                                                    onClick={() => handleSaveOpening(bal.leaveType)}
                                                    disabled={saving[bal.leaveType]}
                                                    className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {saving[bal.leaveType] ? 'Saving...' : (
                                                        <>
                                                            <Save size={10} /> Save
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <OpeningBalanceImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    if (selectedEmp) {
                        fetchEmpBalances();
                    }
                }}
            />
        </div>
    );
}

// ─── Leave Ledger Audit History Panel ─────────────────────────────────────────
function LeaveLedgerPanel({ employees }) {
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [leaveType, setLeaveType] = useState('All');
    const [ledger, setLedger] = useState([]);
    const [loadingLedger, setLoadingLedger] = useState(false);

    const filteredEmployees = employees.filter(e => {
        const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
        const code = (e.employeeId || '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || code.includes(q);
    });

    useEffect(() => {
        if (selectedEmp) {
            fetchLedger();
        } else {
            setLedger([]);
        }
    }, [selectedEmp, year, leaveType]);

    const fetchLedger = async () => {
        setLoadingLedger(true);
        try {
            const params = { employeeId: selectedEmp._id, year };
            if (leaveType !== 'All') {
                params.leaveType = leaveType;
            }
            const res = await api.get('/employee/leaves/ledger', { params });
            setLedger(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to fetch leave ledger.');
        } finally {
            setLoadingLedger(false);
        }
    };

    const getActionBadgeColor = (action) => {
        switch (action) {
            case 'Opening': return 'text-blue-600 bg-blue-50 border-blue-100';
            case 'Accrual': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
            case 'Applied': return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'Cancelled': return 'text-rose-600 bg-rose-50 border-rose-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-tight">Select Employee</h3>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search employee name or code..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all placeholder:text-slate-300"
                    />
                </div>
                
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 pr-1.5 scrollbar-thin scrollbar-thumb-slate-200">
                    {filteredEmployees.length === 0 ? (
                        <div className="py-8 text-center text-xs font-medium text-slate-400">No employees found</div>
                    ) : (
                        filteredEmployees.map(emp => (
                            <button
                                key={emp._id}
                                onClick={() => setSelectedEmp(emp)}
                                className={clsx(
                                    "w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all mt-1",
                                    selectedEmp?._id === emp._id
                                        ? "bg-blue-50/50 border border-blue-200"
                                        : "hover:bg-slate-50 border border-transparent"
                                )}
                            >
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">
                                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-xs truncate">
                                        {emp.firstName} {emp.lastName}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        {emp.employeeId || 'ID: --'}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
                {!selectedEmp ? (
                    <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 mb-3">
                            <FileText size={28} />
                        </div>
                        <h4 className="font-bold text-slate-700 text-sm">No Employee Selected</h4>
                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                            Select an employee from the left panel to inspect their audit trail and transaction history.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 text-blue-600 font-bold text-sm flex items-center justify-center">
                                    {selectedEmp.firstName?.[0]}{selectedEmp.lastName?.[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">
                                        {selectedEmp.firstName} {selectedEmp.lastName}
                                    </h3>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                                    <select
                                        value={year}
                                        onChange={e => setYear(Number(e.target.value))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                                    >
                                        {[2025, 2026, 2027, 2028].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                                    <select
                                        value={leaveType}
                                        onChange={e => setLeaveType(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                                    >
                                        <option value="All">All Leaves</option>
                                        {['CL', 'SL', 'EL', 'PL', 'ML'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                {ledger.length > 0 && (
                                    <button
                                        onClick={() => exportToExcel(
                                            ledger,
                                            [
                                                { header: 'Employee', key: () => `${selectedEmp?.firstName || ''} ${selectedEmp?.lastName || ''}`.trim() },
                                                { header: 'Employee ID', key: () => selectedEmp?.employeeId || '' },
                                                { header: 'Date', key: row => row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' },
                                                { header: 'Leave Type', key: 'leaveType' },
                                                { header: 'Action', key: 'actionType' },
                                                { header: 'Days', key: row => Math.abs(row.days) },
                                                { header: 'Previous Balance', key: row => row.previousBalance ?? 0 },
                                                { header: 'New Balance', key: row => row.newBalance ?? 0 },
                                                { header: 'Remarks', key: 'remarks' }
                                            ],
                                            `Leave_Ledger_${selectedEmp?.employeeId || 'Employee'}_${year}`
                                        )}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm"
                                    >
                                        <Download size={11} />
                                        Download
                                    </button>
                                )}
                            </div>
                        </div>

                        {loadingLedger ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Fetching audit logs...</p>
                            </div>
                        ) : ledger.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                No ledger transactions found for this configuration.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-xl scrollbar-thin">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Leave</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Days</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Balance Change</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                                        {ledger.map(log => {
                                            const formattedDate = log.date ? new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                            const isPositive = ['Opening', 'Accrual', 'Reversal', 'Credit'].includes(log.actionType);
                                            const daysStr = `${Math.abs(log.days)}`;
                                            
                                            return (
                                                <tr key={log._id || log.createdAt} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{formattedDate}</td>
                                                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold border border-slate-200/50">{log.leaveType}</span></td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getActionBadgeColor(log.actionType)}`}>
                                                            {log.actionType}
                                                        </span>
                                                    </td>
                                                    <td className={clsx(
                                                        "px-4 py-3 text-center font-bold text-xs whitespace-nowrap",
                                                        isPositive ? "text-emerald-600" : "text-rose-600"
                                                    )}>
                                                        {daysStr}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 whitespace-nowrap">
                                                        {log.previousBalance ?? 0} &rarr; <span className="text-slate-800">{log.newBalance ?? 0}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={log.remarks}>{log.remarks || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Holiday Master Panel ──────────────────────────────────────────────────────
function HolidayMasterPanel() {
    const [holidays, setHolidays] = useState([]);
    const [loadingHolidays, setLoadingHolidays] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [subView, setSubView] = useState('list'); // 'list' or 'calendar'
    const [form, setForm] = useState({
        name: '',
        date: '',
        endDate: '',
        type: 'Public',
        description: ''
    });
    // Excel bulk upload states
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkPreview, setBulkPreview] = useState([]);
    const [bulkErrors, setBulkErrors] = useState([]);
    const [bulkSummary, setBulkSummary] = useState(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkConfirming, setBulkConfirming] = useState(false);
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        setLoadingHolidays(true);
        try {
            const res = await api.get('/holidays');
            setHolidays(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to fetch holidays.');
        } finally {
            setLoadingHolidays(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.date) {
            showToast('error', 'Validation Error', 'Holiday Name and Date are required.');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/holidays', {
                name: form.name,
                date: form.date,
                endDate: form.endDate || null,
                type: form.type,
                description: form.description
            });
            showToast('success', 'Holiday Created', `${form.name} has been added.`);
            setForm({ name: '', date: '', endDate: '', type: 'Public', description: '' });
            setShowAddForm(false);
            fetchHolidays();
        } catch (err) {
            console.error(err);
            showToast('error', 'Creation Failed', err.response?.data?.error || 'Failed to create holiday.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        showConfirmToast({
            title: 'Delete Holiday?',
            description: 'Are you sure you want to delete this holiday?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/holidays/${id}`);
                    showToast('success', 'Holiday Deleted', 'Holiday deleted successfully.');
                    fetchHolidays();
                } catch (err) {
                    console.error(err);
                    showToast('error', 'Deletion Failed', 'Failed to delete holiday.');
                }
            }
        });
    };

    // Excel bulk upload handler
    const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be re-uploaded
        e.target.value = '';

        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
            showToast('error', 'Invalid File', 'Only .xlsx, .xls or .csv files are supported.');
            return;
        }

        setBulkUploading(true);
        setBulkPreview([]);
        setBulkErrors([]);
        setBulkSummary(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/holidays/bulk/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setBulkPreview(res.data.preview || []);
            setBulkErrors(res.data.errors || []);
            setBulkSummary(res.data.summary || null);
            setShowBulkModal(true);
        } catch (err) {
            showToast('error', 'Upload Failed', err.response?.data?.error || 'Failed to parse the file.');
        } finally {
            setBulkUploading(false);
        }
    };

    // Confirm bulk import
    const handleBulkConfirm = async () => {
        setBulkConfirming(true);
        try {
            const res = await api.post('/holidays/bulk/confirm', {
                holidays: bulkPreview,
                skipDuplicates
            });
            const s = res.data.summary;
            showToast('success', 'Import Complete', `✅ ${s.saved} saved · ${s.skipped} skipped · ${s.errors} errors`);
            setShowBulkModal(false);
            setBulkPreview([]);
            setBulkSummary(null);
            fetchHolidays();
        } catch (err) {
            showToast('error', 'Import Failed', err.response?.data?.error || 'Failed to save holidays.');
        } finally {
            setBulkConfirming(false);
        }
    };

    // Download sample Excel template
    const downloadTemplate = () => {
        const csv = `Holiday Name,Date,End Date,Type,Description
Diwali,12-Nov-2026,,Festival,Festival of Lights
Republic Day,26-Jan-2026,,National,National Holiday
Holi,14-Mar-2026,15-Mar-2026,Festival,Festival of Colors
`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'holiday_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Stats
    const totalHolidays = holidays.length;
    const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date()).length;
    const optionalHolidays = holidays.filter(h => h.type === 'Optional').length;
    const nationalHolidays = holidays.filter(h => h.type === 'National' || h.type === 'Public' || h.type === 'Regional').length;

    // Monthly calendar groupings
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const holidaysByMonth = {};
    months.forEach((m, idx) => {
        holidaysByMonth[idx] = [];
    });

    holidays.forEach(h => {
        if (h.date) {
            const start = new Date(h.date);
            const end = h.endDate ? new Date(h.endDate) : start;
            
            const uniqueMonths = new Set();
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                uniqueMonths.add(d.getMonth());
            }
            
            uniqueMonths.forEach(m => {
                if (holidaysByMonth[m]) {
                    holidaysByMonth[m].push(h);
                }
            });
        }
    });

    return (
        <>
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Holidays', value: totalHolidays, color: 'text-indigo-600 bg-indigo-50' },
                    { label: 'Upcoming Holidays', value: upcomingHolidays, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Optional Holidays', value: optionalHolidays, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Public / National', value: nationalHolidays, color: 'text-rose-600 bg-rose-50' }
                ].map((card, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                        <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">{card.label}</span>
                        <span className="text-2xl font-black text-slate-900 mt-2 font-mono">{card.value}</span>
                    </div>
                ))}
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center gap-4">
                <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">
                        {subView === 'calendar' ? 'Yearly Holiday Calendar' : 'Holiday Master List'}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* Hidden file input for Excel upload */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleExcelUpload}
                    />

                    {/* View Switcher */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSubView('list')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1",
                                subView === 'list' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <List size={13} /> List
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubView('calendar')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1",
                                subView === 'calendar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <Calendar size={13} /> Calendar
                        </button>
                    </div>

                    <button
                        onClick={downloadTemplate}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 border border-slate-200"
                        title="Download sample template"
                    >
                        <FileText size={13} /> Template
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={bulkUploading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100 flex items-center gap-1.5"
                    >
                        <Upload size={14} strokeWidth={3} />
                        {bulkUploading ? 'Parsing...' : 'Import Excel'}
                    </button>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1.5"
                    >
                        <Plus size={14} strokeWidth={3} />
                        {showAddForm ? 'Cancel' : 'Add Holiday'}
                    </button>
                </div>
            </div>

            {/* Add Holiday Form */}
            {showAddForm && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in duration-300">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Holiday Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-0 outline-none"
                                    placeholder="e.g. Diwali"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-0 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1">End Date (Optional)</label>
                                <input
                                    type="date"
                                    value={form.endDate}
                                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-0 outline-none"
                                    min={form.date}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Holiday Type</label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value })}
                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-0 outline-none"
                                >
                                    <option value="Public">Public</option>
                                    <option value="National">National</option>
                                    <option value="Festival">Festival</option>
                                    <option value="Regional">Regional</option>
                                    <option value="Optional">Optional</option>
                                    <option value="Company">Company</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-0 outline-none resize-none"
                                placeholder="Describe the holiday..."
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Adding...' : 'Save Holiday'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Holidays Container */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-x-auto">
                {/* Download button for list view */}
                {subView === 'list' && holidays.length > 0 && (
                    <div className="flex justify-end mb-3">
                        <button
                            onClick={() => exportToExcel(
                                holidays,
                                [
                                    { header: 'Holiday Name', key: 'name' },
                                    { header: 'Start Date', key: row => row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' },
                                    { header: 'End Date', key: row => row.endDate ? new Date(row.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' },
                                    { header: 'Type', key: 'type' },
                                    { header: 'Description', key: 'description' }
                                ],
                                `Holiday_Master_${new Date().getFullYear()}`
                            )}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
                        >
                            <Download size={12} />
                            Download Excel
                        </button>
                    </div>
                )}
                {loadingHolidays ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading calendar...</p>
                    </div>
                ) : subView === 'calendar' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {months.map((month, idx) => {
                            const monthHolidays = holidaysByMonth[idx] || [];
                            return (
                                <div key={idx} className="bg-white border border-slate-250 hover:border-slate-350 rounded-2xl p-4 shadow-sm space-y-3 flex flex-col justify-between min-h-[160px] transition-all">
                                    <div>
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">{month}</h4>
                                            <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-lg">{monthHolidays.length} Holidays</span>
                                        </div>
                                        {monthHolidays.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 italic">No holidays in this month</p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                                                {monthHolidays.map(h => {
                                                    const startDate = new Date(h.date);
                                                    const endDate = h.endDate ? new Date(h.endDate) : null;
                                                    const d = startDate.getDate();
                                                    
                                                    const formatHDate = (date) => {
                                                        return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                                    };
                                                    
                                                    const formattedStart = formatHDate(startDate);
                                                    const formattedEnd = endDate ? formatHDate(endDate) : null;
                                                    const isMultiDay = formattedEnd && formattedEnd !== formattedStart;
                                                    const dateRangeStr = isMultiDay 
                                                        ? `${formattedStart} to ${formattedEnd}`
                                                        : formattedStart;
                                                    return (
                                                        <div key={h._id} className="flex gap-2 items-center text-[11px] font-bold text-slate-700">
                                                            <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center shrink-0 text-[10px] font-extrabold">{d}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate text-slate-800" title={`${h.name} (${dateRangeStr})`}>{h.name}</div>
                                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                                                                    {dateRangeStr} • {h.type}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : holidays.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        No holidays configured in the calendar.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-150">
                                <th className="px-5 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Holiday Name</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-455 uppercase tracking-widest">Date</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-455 uppercase tracking-widest">Type</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-455 uppercase tracking-widest">Description</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-455 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {holidays.map(h => {
                                const formattedStartDate = h.date ? new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                const formattedEndDate = h.endDate ? new Date(h.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
                                const dateDisplay = formattedEndDate && formattedEndDate !== formattedStartDate 
                                    ? `${formattedStartDate} - ${formattedEndDate}`
                                    : formattedStartDate;
                                return (
                                    <tr key={h._id} className="hover:bg-slate-50/50">
                                        <td className="px-5 py-3 text-slate-900 font-extrabold">{h.name}</td>
                                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{dateDisplay}</td>
                                        <td className="px-4 py-3">
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded text-[9px] font-black uppercase border",
                                                h.type === 'National' && 'bg-rose-50 text-rose-600 border-rose-100',
                                                h.type === 'Festival' && 'bg-indigo-50 text-indigo-600 border-indigo-100',
                                                h.type === 'Optional' && 'bg-amber-50 text-amber-600 border-amber-100',
                                                h.type === 'Company' && 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                                h.type === 'Public' && 'bg-blue-50 text-blue-600 border-blue-100',
                                                h.type === 'Regional' && 'bg-teal-50 text-teal-600 border-teal-100'
                                            )}>
                                                {h.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 font-medium">{h.description || '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(h._id)}
                                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all active:scale-95"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

            {/* ─── Excel Bulk Upload Preview Modal ─────────────────────────────── */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                            <div>
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">📋 Excel Import Preview</h2>
                                {bulkSummary && (
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        {bulkSummary.total} holidays found · <span className="text-emerald-600">{bulkSummary.new} new</span> · <span className="text-amber-500">{bulkSummary.duplicates} duplicates</span> · <span className="text-rose-500">{bulkSummary.errors} errors</span>
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setShowBulkModal(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Options bar */}
                        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 bg-white shrink-0">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={skipDuplicates}
                                    onChange={e => setSkipDuplicates(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600"
                                />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Skip duplicate dates</span>
                            </label>
                            <span className="text-slate-200">|</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                🟡 Yellow = duplicate already in calendar
                            </span>
                        </div>

                        {/* Preview Table */}
                        <div className="flex-1 overflow-y-auto">
                            {bulkErrors.length > 0 && (
                                <div className="mx-6 mt-4 bg-rose-50 border border-rose-100 rounded-xl p-3">
                                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">⚠ Parse Errors</p>
                                    {bulkErrors.map((e, i) => (
                                        <p key={i} className="text-[10px] text-rose-500 font-medium">Row {e.row}: {e.error}</p>
                                    ))}
                                </div>
                            )}
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-150">
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">#</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Holiday Name</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bulkPreview.map((h, i) => (
                                        <tr key={h._previewId || i} className={h.isDuplicate ? 'bg-amber-50' : 'bg-white hover:bg-slate-50/50'}>
                                            <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                                            <td className="px-4 py-2.5 font-extrabold text-slate-900 text-[11px]">{h.name}</td>
                                            <td className="px-4 py-2.5 text-slate-600 font-mono text-[10px]">
                                                {h.date ? new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600 font-mono text-[10px]">
                                                {h.endDate ? new Date(h.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                                    h.type === 'National' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    h.type === 'Festival' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                    h.type === 'Regional' ? 'bg-teal-50 text-teal-600 border-teal-100' :
                                                    h.type === 'Optional' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    h.type === 'Company' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>{h.type || 'Public'}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 text-[10px]">{h.description || '—'}</td>
                                            <td className="px-4 py-2.5">
                                                {h.isDuplicate ? (
                                                    <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Duplicate</span>
                                                ) : (
                                                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">✓ New</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkConfirm}
                                disabled={bulkConfirming || bulkPreview.length === 0}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center gap-2"
                            >
                                {bulkConfirming ? (
                                    <><RefreshCw size={13} className="animate-spin" /> Importing...</>
                                ) : (
                                    <><Check size={13} strokeWidth={3} /> Import {skipDuplicates ? bulkSummary?.new : bulkSummary?.total} Holidays</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// HolidayCalendarPanel removed because it is now integrated inline within HolidayMasterPanel.

// ─── Comp Off Management Panel ──────────────────────────────────────────────────
function CompOffPanel({ employees }) {
    const [requests, setRequests] = useState([
        { _id: '1', employeeId: 'EMP-26-101', name: 'Nitesh Patel', dateWorked: '2026-05-02', type: 'Weekend Work', days: 1, validityDays: 60, status: 'Credited', remarks: 'Worked on system downtime migration' },
        { _id: '2', employeeId: 'EMP-26-103', name: 'Jayesh Patel', dateWorked: '2026-05-10', type: 'Public Holiday Work', days: 1, validityDays: 30, status: 'Pending Approval', remarks: 'Client emergency ticket resolution' }
    ]);
    const [submitting, setSubmitting] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState({
        employeeId: '',
        dateWorked: '',
        type: 'Weekend Work',
        days: 1,
        validityDays: 60,
        remarks: ''
    });

    const handleCreate = (e) => {
        e.preventDefault();
        if (!form.employeeId || !form.dateWorked) {
            showToast('error', 'Error', 'Please select Employee and Date Worked.');
            return;
        }

        setSubmitting(true);
        setTimeout(() => {
            const emp = employees.find(e => e._id === form.employeeId);
            const newRequest = {
                _id: String(Date.now()),
                employeeId: emp?.employeeId || 'EMP-TEMP',
                name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
                dateWorked: form.dateWorked,
                type: form.type,
                days: Number(form.days),
                validityDays: Number(form.validityDays),
                status: 'Credited',
                remarks: form.remarks
            };
            setRequests(prev => [newRequest, ...prev]);
            showToast('success', 'Comp Off Credited', `Credited ${form.days} days to ${newRequest.name}.`);
            setForm({ employeeId: '', dateWorked: '', type: 'Weekend Work', days: 1, validityDays: 60, remarks: '' });
            setShowAddForm(false);
            setSubmitting(false);
        }, 800);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header / Actions */}
            <div className="flex justify-between items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Comp Off Management</h3>
                </div>
                <div className="flex items-center gap-2">
                    {requests.length > 0 && (
                        <button
                            onClick={() => exportToExcel(
                                requests,
                                [
                                    { header: 'Employee Name', key: 'name' },
                                    { header: 'Employee ID', key: 'employeeId' },
                                    { header: 'Date Worked', key: row => row.dateWorked ? new Date(row.dateWorked).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' },
                                    { header: 'Work Type', key: 'type' },
                                    { header: 'Days Credited', key: 'days' },
                                    { header: 'Validity (Days)', key: 'validityDays' },
                                    { header: 'Status', key: 'status' },
                                    { header: 'Remarks', key: 'remarks' }
                                ],
                                `CompOff_Records_${new Date().getFullYear()}`
                            )}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
                        >
                            <Download size={12} />
                            Download Excel
                        </button>
                    )}
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1.5"
                    >
                        <Plus size={14} strokeWidth={3} />
                        {showAddForm ? 'Cancel' : 'Credit Comp-Off'}
                    </button>
                </div>
            </div>

            {/* Form */}
            {showAddForm && (
                <form onSubmit={handleCreate} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-end animate-in fade-in duration-300">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Employee</label>
                        <select
                            value={form.employeeId}
                            onChange={e => setForm({ ...form, employeeId: e.target.value })}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Date Worked</label>
                        <input
                            type="date"
                            value={form.dateWorked}
                            onChange={e => setForm({ ...form, dateWorked: e.target.value })}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Type</label>
                        <select
                            value={form.type}
                            onChange={e => setForm({ ...form, type: e.target.value })}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="Weekend Work">Weekend Work</option>
                            <option value="Public Holiday Work">Public Holiday Work</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Days to Credit</label>
                        <select
                            value={form.days}
                            onChange={e => setForm({ ...form, days: e.target.value })}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="0.5">0.5 Day</option>
                            <option value="1">1.0 Day</option>
                            <option value="1.5">1.5 Days</option>
                            <option value="2">2.0 Days</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Validity (Days)</label>
                        <select
                            value={form.validityDays}
                            onChange={e => setForm({ ...form, validityDays: e.target.value })}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="30">30 Days</option>
                            <option value="60">60 Days</option>
                            <option value="90">90 Days</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Remarks</label>
                        <input
                            type="text"
                            placeholder="Worked on server migrations"
                            value={form.remarks}
                            onChange={e => setForm({ ...form, remarks: e.target.value })}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-md shadow-blue-100"
                        >
                            {submitting ? 'Processing...' : 'Save & Credit'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-150">
                            <th className="px-5 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Employee</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Date Worked</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Type</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest text-center">Days</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest text-center">Validity</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Status</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {requests.map(r => (
                            <tr key={r._id} className="hover:bg-slate-50/50">
                                <td className="px-5 py-3">
                                    <div className="font-extrabold text-slate-900">{r.name}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r.employeeId}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{new Date(r.dateWorked).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td className="px-4 py-3 text-slate-505 text-slate-500 font-semibold">{r.type}</td>
                                <td className="px-4 py-3 text-center font-mono font-extrabold text-indigo-600 text-xs">+{r.days}</td>
                                <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">{r.validityDays} Days</td>
                                <td className="px-4 py-3">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded text-[9px] font-black uppercase border",
                                        r.status === 'Credited' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                    )}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-450 font-medium truncate max-w-[150px]" title={r.remarks}>{r.remarks || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Leave Encashment Panel ────────────────────────────────────────────────────
function EncashmentPanel() {
    const [config, setConfig] = useState({
        allowed: false,
        leaveType: 'EL',
        formula: 'Basic / 30',
        minBalanceRetain: 15,
        maxEncashableDays: 10,
        taxRule: 'Exempt up to 3 Lakhs'
    });
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // requestId being actioned
    const [rejectModal, setRejectModal] = useState(null); // { requestId, remark }

    const fetchData = async () => {
        try {
            setLoading(true);
            const [configRes, requestsRes] = await Promise.all([
                api.get('/hr/leaves/encashment/config'),
                api.get('/hr/leaves/encashment/requests')
            ]);
            if (configRes.data?.config) setConfig(configRes.data.config);
            if (requestsRes.data?.requests) setRequests(requestsRes.data.requests);
        } catch (err) {
            console.error('[EncashmentPanel] fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const res = await api.post('/hr/leaves/encashment/config', config);
            if (res.data?.config) setConfig(res.data.config); // reflect exact saved values from DB
            showToast('success', 'Configuration Saved', 'Leave Encashment rules updated successfully.');
        } catch (err) {
            showToast('error', 'Save Failed', err?.response?.data?.error || 'Could not save configuration.');
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (requestId) => {
        setActionLoading(requestId);
        try {
            await api.post(`/hr/leaves/encashment/requests/${requestId}/approve`);
            showToast('success', 'Approved', 'Encashment request approved and leave balance deducted.');
            await fetchData();
        } catch (err) {
            showToast('error', 'Approval Failed', err?.response?.data?.error || 'Could not approve request.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        setActionLoading(rejectModal.requestId);
        try {
            await api.post(`/hr/leaves/encashment/requests/${rejectModal.requestId}/reject`, { adminRemark: rejectModal.remark });
            showToast('success', 'Rejected', 'Encashment request rejected.');
            setRejectModal(null);
            await fetchData();
        } catch (err) {
            showToast('error', 'Rejection Failed', err?.response?.data?.error || 'Could not reject request.');
        } finally {
            setActionLoading(null);
        }
    };

    const getEmpName = (req) => {
        if (req.employeeInfo) {
            return `${req.employeeInfo.firstName || ''} ${req.employeeInfo.lastName || req.employeeInfo.name || ''}`.trim() || 'Employee';
        }
        return 'Employee';
    };
    const getEmpId = (req) => req.employeeInfo?.employeeId || '—';

    const pendingRequests = requests.filter(r => r.status === 'Pending');
    const historyRequests = requests.filter(r => r.status !== 'Pending');

    const statusColors = {
        Approved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        Rejected: 'bg-rose-50 text-rose-600 border-rose-100',
        Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
        Pending: 'bg-amber-50 text-amber-600 border-amber-100'
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Rule Config */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Encashment Policy Config</h3>
                    </div>

                    <div className="space-y-3.5">
                        {/* Allowed Toggle */}
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-150">
                            <span className="text-xs font-bold text-slate-700">Encashment Buyout Allowed</span>
                            <button
                                onClick={() => setConfig(prev => ({ ...prev, allowed: !prev.allowed }))}
                                className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${config.allowed ? 'bg-indigo-500' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${config.allowed ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Buyout Leave Type</label>
                            <select
                                value={config.leaveType}
                                onChange={e => setConfig(prev => ({ ...prev, leaveType: e.target.value }))}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                            >
                                <option value="EL">EL (Earned Leave)</option>
                                <option value="PL">PL (Privilege Leave)</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Calculation Formula</label>
                            <select
                                value={config.formula}
                                onChange={e => setConfig(prev => ({ ...prev, formula: e.target.value }))}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                            >
                                <option value="Basic / 30">Basic Salary / 30 * Buyout Days</option>
                                <option value="(Basic + DA) / 30">(Basic + DA) / 30 * Buyout Days</option>
                                <option value="Gross / 30">Gross Salary / 30 * Buyout Days</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Min Retained Balance</label>
                                <input
                                    type="number"
                                    value={config.minBalanceRetain}
                                    onChange={e => setConfig(prev => ({ ...prev, minBalanceRetain: parseInt(e.target.value) || 0 }))}
                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Max Buyout / Yr</label>
                                <input
                                    type="number"
                                    value={config.maxEncashableDays}
                                    onChange={e => setConfig(prev => ({ ...prev, maxEncashableDays: parseInt(e.target.value) || 0 }))}
                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Tax Rule / Exemption</label>
                            <select
                                value={config.taxRule}
                                onChange={e => setConfig(prev => ({ ...prev, taxRule: e.target.value }))}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                            >
                                <option value="Exempt up to 3 Lakhs">Exempt up to ₹3,00,000 (Section 10(10AA))</option>
                                <option value="Fully Taxable">Fully Taxable</option>
                            </select>
                        </div>

                        <button
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex justify-center"
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>

                {/* Requests Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">
                                    Pending Requests
                                    <span className="ml-2 text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{pendingRequests.length}</span>
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {pendingRequests.map(req => (
                                    <div key={req._id} className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-extrabold text-slate-900 text-xs">{getEmpName(req)}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{getEmpId(req)}</span>
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-black uppercase">Pending</span>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                                                <span><span className="font-black text-slate-800">{req.requestedDays}</span> Days • {req.leaveType}</span>
                                                <span>Balance at request: <span className="font-black">{req.availableBalance}</span></span>
                                                <span>Payout: <span className="font-black text-emerald-700">₹{(req.payoutAmount || 0).toLocaleString()}</span></span>
                                                <span>Formula: <span className="font-medium">{req.formulaUsed}</span></span>
                                            </div>
                                            {req.reason && (
                                                <p className="text-[11px] text-slate-500 italic">"{req.reason}"</p>
                                            )}
                                            <p className="text-[10px] text-slate-400">{req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => handleApprove(req._id)}
                                                disabled={actionLoading === req._id}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-lg transition-all disabled:opacity-60"
                                            >
                                                {actionLoading === req._id ? '...' : 'Approve'}
                                            </button>
                                            <button
                                                onClick={() => setRejectModal({ requestId: req._id, remark: '' })}
                                                disabled={actionLoading === req._id}
                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 text-[10px] font-black uppercase rounded-lg transition-all disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Buyout History */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Buyout History</h3>
                            {historyRequests.length > 0 && (
                                <button
                                    onClick={() => exportToExcel(
                                        historyRequests.map(r => ({
                                            name: getEmpName(r),
                                            employeeId: getEmpId(r),
                                            encashedDays: r.requestedDays,
                                            amount: r.payoutAmount,
                                            status: r.status,
                                            date: r.approvedAt || r.createdAt
                                        })),
                                        [
                                            { header: 'Employee Name', key: 'name' },
                                            { header: 'Employee ID', key: 'employeeId' },
                                            { header: 'Encashed Days', key: 'encashedDays' },
                                            { header: 'Payout Amount (₹)', key: 'amount' },
                                            { header: 'Status', key: 'status' },
                                            { header: 'Date', key: row => row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' }
                                        ],
                                        `Leave_Encashment_History_${new Date().getFullYear()}`
                                    )}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
                                >
                                    <Download size={12} />
                                    Download Excel
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="py-12 flex items-center justify-center text-slate-400 text-xs font-bold">Loading...</div>
                        ) : historyRequests.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <span className="text-2xl mb-2">💰</span>
                                <p className="text-xs font-bold">No encashment history yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-150">
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Employee</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest text-center">Encashed Days</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest text-right">Payout Amount</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Status</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                        {historyRequests.map(item => (
                                            <tr key={item._id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-extrabold text-slate-900">{getEmpName(item)}</div>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{getEmpId(item)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-mono">{item.requestedDays} Days</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-900">₹{(item.payoutAmount || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx('px-2 py-0.5 rounded border text-[9px] font-black uppercase', statusColors[item.status] || 'bg-slate-100 text-slate-500')}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {item.approvedAt || item.rejectedAt || item.createdAt
                                                        ? new Date(item.approvedAt || item.rejectedAt || item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
                        <h3 className="font-extrabold text-slate-800 text-sm">Reject Encashment Request</h3>
                        <p className="text-xs text-slate-500">Please provide a reason for rejecting this request (optional).</p>
                        <textarea
                            rows={3}
                            placeholder="Rejection reason..."
                            value={rejectModal.remark}
                            onChange={e => setRejectModal(prev => ({ ...prev, remark: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none resize-none"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRejectModal(null)}
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={actionLoading !== null}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase rounded-xl transition-all disabled:opacity-60"
                            >
                                {actionLoading ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Automation Center Panel ───────────────────────────────────────────────────
function AutomationPanel() {
    const [settings, setSettings] = useState({
        autoCredit: true,
        autoCarryForward: true,
        autoEncash: false,
        holidayNotif: true,
        reminderDays: 3,
        birthdayWishes: true,
        anniversaryWishes: true
    });

    const handleToggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
        showToast('success', 'Setting Updated', 'Automation rule state toggled.');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Auto credit & carry forward */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Accrual & Carry Forward Automation</h3>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                    <div className="flex justify-between items-center py-3 first:pt-0">
                        <div className="max-w-[80%]">
                            <h4 className="text-xs font-bold text-slate-800">Auto Accrual Credit</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Automatically credit monthly leave ratio (e.g. 1 EL per month) on the 1st of each month.</p>
                        </div>
                        <button
                            onClick={() => handleToggle('autoCredit')}
                            className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${settings.autoCredit ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.autoCredit ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center py-3">
                        <div className="max-w-[80%]">
                            <h4 className="text-xs font-bold text-slate-800">Auto Year-End Carry Forward</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Trigger year-end processing and carry forward eligible leave balances on 31st December automatically.</p>
                        </div>
                        <button
                            onClick={() => handleToggle('autoCarryForward')}
                            className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${settings.autoCarryForward ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.autoCarryForward ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center py-3">
                        <div className="max-w-[80%]">
                            <h4 className="text-xs font-bold text-slate-800">Auto Leave Encashment</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Automatically payout extra leave balances that exceed maximum carry-forward limit directly to payroll.</p>
                        </div>
                        <button
                            onClick={() => handleToggle('autoEncash')}
                            className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${settings.autoEncash ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.autoEncash ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Notifications & wishes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Notifications & Employee Wishes</h3>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                    <div className="flex justify-between items-center py-3 first:pt-0">
                        <div className="max-w-[80%]">
                            <h4 className="text-xs font-bold text-slate-800">Holiday Notification Broadcast</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Send company-wide notifications and calendar events 2 days prior to any corporate holiday.</p>
                        </div>
                        <button
                            onClick={() => handleToggle('holidayNotif')}
                            className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${settings.holidayNotif ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.holidayNotif ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center py-3">
                        <div className="max-w-[80%]">
                            <h4 className="text-xs font-bold text-slate-800">Birthday Wishes Emails</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Automatically trigger birthday greeting card emails to employees on their birthdays.</p>
                        </div>
                        <button
                            onClick={() => handleToggle('birthdayWishes')}
                            className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${settings.birthdayWishes ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.birthdayWishes ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center py-3">
                        <div className="max-w-[80%]">
                            <h4 className="text-xs font-bold text-slate-800">Work Anniversary Wishes</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Send congratulatory messages to employees when they complete years of service in the company.</p>
                        </div>
                        <button
                            onClick={() => handleToggle('anniversaryWishes')}
                            className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none ${settings.anniversaryWishes ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.anniversaryWishes ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel() {
    const [settings, setSettings] = useState({
        sandwichRule: true,
        maxConsecutiveLeaves: 15,
        clPriorNotice: 1,
        elPriorNotice: 15
    });
    const [rawSettings, setRawSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/attendance/settings');
            if (res.data) {
                setRawSettings(res.data);
                setSettings({
                    sandwichRule: res.data.sandwichLeave ?? false,
                    maxConsecutiveLeaves: res.data.maxConsecutiveLeaves ?? 15,
                    clPriorNotice: res.data.clPriorNotice ?? 1,
                    elPriorNotice: res.data.elPriorNotice ?? 15
                });
            }
        } catch (err) {
            console.error("Failed to load settings in SettingsPanel", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const updated = {
                ...(rawSettings || {}),
                sandwichLeave: settings.sandwichRule,
                maxConsecutiveLeaves: settings.maxConsecutiveLeaves,
                clPriorNotice: settings.clPriorNotice,
                elPriorNotice: settings.elPriorNotice,
                advancedPolicy: {
                    ...(rawSettings?.advancedPolicy || {}),
                    leaveIntegration: {
                        ...(rawSettings?.advancedPolicy?.leaveIntegration || {}),
                        sandwichRuleEnabled: settings.sandwichRule
                    }
                }
            };
            await api.put('/attendance/settings', updated);
            setRawSettings(updated);
            showToast('success', 'Settings Saved', 'General Leave Policies Settings updated.');
        } catch (err) {
            console.error("Failed to save settings", err);
            showToast('error', 'Error', 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading configuration...</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 max-w-xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">General Leave Configuration</h3>
            </div>

            <div className="space-y-4">
                {/* Sandwich Rule Toggle */}
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-150">
                    <div className="max-w-[80%]">
                        <h4 className="text-xs font-extrabold text-slate-850">Apply Sandwich Rule</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">If weekend holidays fall within leave days (e.g. Saturday & Sunday fall between leave taken on Friday and Monday), the weekend days are also deducted from the leave balance.</p>
                    </div>
                    <button
                        onClick={() => setSettings(prev => ({ ...prev, sandwichRule: !prev.sandwichRule }))}
                        className={`relative w-8 h-4 rounded-full transition-all duration-300 outline-none shrink-0 ${settings.sandwichRule ? 'bg-indigo-500' : 'bg-slate-200'}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${settings.sandwichRule ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Max Consecutive Leaves Allowed (Days)</label>
                    <input
                        type="number"
                        value={settings.maxConsecutiveLeaves}
                        onChange={e => setSettings({ ...settings, maxConsecutiveLeaves: parseInt(e.target.value) || 0 })}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">CL Prior Notice (Days)</label>
                        <input
                            type="number"
                            value={settings.clPriorNotice}
                            onChange={e => setSettings({ ...settings, clPriorNotice: parseInt(e.target.value) || 0 })}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">EL Prior Notice (Days)</label>
                        <input
                            type="number"
                            value={settings.elPriorNotice}
                            onChange={e => setSettings({ ...settings, elPriorNotice: parseInt(e.target.value) || 0 })}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex justify-center disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save General Configuration'}
                </button>
            </div>
        </div>
    );
}

// ─── Leave Requests Panel ──────────────────────────────────────────────────────
function LeaveRequestsPanel() {
    const [requests, setRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/leaves/requests?limit=1000');
            const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            setRequests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            await api.post(`/hr/leaves/requests/${id}/${action}`);
            showToast('success', `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`, `The leave application status has been updated.`);
            fetchRequests();
        } catch (err) {
            console.error(err);
            showToast('error', 'Action Failed', 'Failed to update leave application.');
        }
    };

    return (
        <>
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Employee Leave Applications</h3>
                </div>
                {requests.length > 0 && (
                    <button
                        onClick={() => exportToExcel(
                            requests,
                            [
                                { header: 'Employee Name', key: row => `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.trim() },
                                { header: 'Employee ID', key: row => row.employee?.employeeId || '' },
                                { header: 'Leave Type', key: 'leaveType' },
                                { header: 'Start Date', key: row => row.startDate ? new Date(row.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' },
                                { header: 'End Date', key: row => row.endDate ? new Date(row.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' },
                                { header: 'Days', key: 'daysCount' },
                                { header: 'Status', key: 'status' },
                                { header: 'Remarks', key: 'remarks' }
                            ],
                            `Leave_Requests_${new Date().getFullYear()}`
                        )}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
                    >
                        <Download size={12} />
                        Download Excel
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading applications...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        No leave applications found.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-150">
                                <th className="px-5 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Employee</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Leave Type</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Leave Balance</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Dates</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest text-center">Days</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-450 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {requests.map(r => (
                                <tr key={r._id} onClick={() => setSelectedRequest(r)} className="hover:bg-slate-150/40 cursor-pointer transition-all duration-150">
                                    <td className="px-5 py-3">
                                        <div className="font-extrabold text-slate-900">{r.employee?.firstName} {r.employee?.lastName}</div>
                                        <div className="text-[9px] font-black text-slate-450 uppercase tracking-widest">{r.employee?.employeeId}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black rounded">{r.leaveType}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                                            {Array.isArray(r.employeeBalances) && filterBalances(r.employeeBalances, r.employee).length > 0 ? (
                                                filterBalances(r.employeeBalances, r.employee).map(b => (
                                                    <span key={b.leaveType} className="px-1.5 py-0.5 bg-slate-50 border border-slate-150 rounded text-[9px] text-slate-500 font-bold whitespace-nowrap">
                                                        {b.leaveType}: <span className="font-extrabold text-slate-800">{b.available}</span>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 font-medium">
                                        {new Date(r.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {new Date(r.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3 text-center text-indigo-650 font-mono text-xs">
                                        <div>{r.daysCount} {r.daysCount === 1 ? 'Day' : 'Days'}</div>
                                        {r.isHalfDay && (() => {
                                             const custom = r.meta?.customHalfDays;
                                             if (custom && r.startDate !== r.endDate) {
                                                 if (custom.firstDayHalf && custom.lastDayHalf) {
                                                     return <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block mt-0.5" title={`First Day: ${custom.firstDaySession}, Last Day: ${custom.lastDaySession}`}>Half (Both Days)</span>;
                                                 }
                                                 if (custom.firstDayHalf) {
                                                     return <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block mt-0.5" title={`First Day: ${custom.firstDaySession}`}>Half (First)</span>;
                                                 }
                                                 if (custom.lastDayHalf) {
                                                     return <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block mt-0.5" title={`Last Day: ${custom.lastDaySession}`}>Half (Last)</span>;
                                                 }
                                             }
                                             return <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block mt-0.5" title={r.halfDaySession || 'Half Day'}>Half Day</span>;
                                        })()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                                            r.status === 'Pending' && 'bg-amber-50 text-amber-600 border-amber-100',
                                            r.status === 'Approved' && 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                            r.status === 'Rejected' && 'bg-rose-50 text-rose-600 border-rose-100'
                                        )}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {r.status === 'Pending' && (
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAction(r._id, 'approve'); }}
                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAction(r._id, 'reject'); }}
                                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

        {/* ─── HR Leave Request Details Modal ─────────────────────────────── */}
        {selectedRequest && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0 font-inter">
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                                <FileText size={16} className="text-indigo-650" />
                                Leave Application Details
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                REQ-{selectedRequest._id?.slice(-6).toUpperCase()}
                            </p>
                        </div>
                        <button 
                            onClick={() => setSelectedRequest(null)} 
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all active:scale-95 animate-in fade-in"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5 font-inter text-xs">
                        {/* Employee Header */}
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0 uppercase">
                                {selectedRequest.employee?.firstName?.[0]}{selectedRequest.employee?.lastName?.[0]}
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-800">{selectedRequest.employee?.firstName} {selectedRequest.employee?.lastName}</h4>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Employee ID: {selectedRequest.employee?.employeeId}</p>
                            </div>
                        </div>

                        {/* Status and Leave Type Grid */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Leave Category</span>
                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black rounded">{selectedRequest.leaveType}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Status</span>
                                <span className={clsx(
                                    "px-2 py-0.5 rounded text-[10px] font-black uppercase border inline-block",
                                    selectedRequest.status === 'Pending' && 'bg-amber-50 text-amber-600 border-amber-100',
                                    selectedRequest.status === 'Approved' && 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                    selectedRequest.status === 'Rejected' && 'bg-rose-50 text-rose-600 border-rose-100'
                                )}>
                                    {selectedRequest.status}
                                </span>
                            </div>
                        </div>

                        {/* Dates & Duration */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration Details</span>
                            <div className="bg-white border border-slate-150 rounded-xl p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50/50 flex items-center justify-center text-indigo-600">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-800">
                                            {new Date(selectedRequest.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {new Date(selectedRequest.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                            Applied on {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString('en-GB') : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-extrabold text-[#2563EB]">
                                        {selectedRequest.daysCount} {selectedRequest.daysCount === 1 ? 'Day' : 'Days'}
                                    </span>
                                    {selectedRequest.isHalfDay && (
                                        <span className="block text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded mt-1 uppercase tracking-wider">
                                            {(() => {
                                                const custom = selectedRequest.meta?.customHalfDays;
                                                if (custom && selectedRequest.startDate !== selectedRequest.endDate) {
                                                    if (custom.firstDayHalf && custom.lastDayHalf) return 'Half (Both Days)';
                                                    if (custom.firstDayHalf) return `Half (First: ${custom.firstDaySession.split(' ')[0]})`;
                                                    if (custom.lastDayHalf) return `Half (Last: ${custom.lastDaySession.split(' ')[0]})`;
                                                }
                                                return selectedRequest.halfDaySession || 'Half Day';
                                            })()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Reason / Justification */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Justification / Reason</span>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium text-slate-750 leading-relaxed min-h-[60px] whitespace-pre-line">
                                {selectedRequest.reason || <span className="text-slate-400 italic">No reason provided</span>}
                            </div>
                        </div>

                        {/* Leave Balances Grid */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employee Leave Balance</span>
                            <div className="grid grid-cols-1 gap-2">
                                {Array.isArray(selectedRequest.employeeBalances) && filterBalances(selectedRequest.employeeBalances, selectedRequest.employee)
                                    .filter(b => String(b.leaveType).toUpperCase() === String(selectedRequest.leaveType).toUpperCase())
                                    .map(b => (
                                        <div key={b.leaveType} className="p-2.5 rounded-xl border text-center transition-all bg-indigo-50/20 border-indigo-200">
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">{b.leaveType}</div>
                                            <div className="text-xs font-extrabold text-slate-800 mt-0.5">{b.available} <span className="text-[9px] font-bold text-slate-400 uppercase">Avail</span></div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Medical Certificate */}
                        {selectedRequest.medicalCertUrl && (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Medical Certificate</span>
                                <a 
                                    href={selectedRequest.medicalCertUrl.startsWith('http') ? selectedRequest.medicalCertUrl : `http://localhost:5009${selectedRequest.medicalCertUrl}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 py-2 border border-emerald-200 hover:border-emerald-400 bg-emerald-50/20 text-emerald-700 text-xs font-bold rounded-xl transition-all shadow-sm"
                                >
                                    <FileText size={14} />
                                    <span>View Medical Certificate</span>
                                </a>
                            </div>
                        )}

                        {/* History log/Workflow Details */}
                        {(selectedRequest.approvedAt || selectedRequest.rejectedAt || selectedRequest.cancelledAt) && (
                            <div className="border-t border-slate-100 pt-4 space-y-2 text-[11px] text-slate-500">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Action Trail</span>
                                <div className="space-y-1.5 bg-slate-50/30 border border-slate-100 p-3 rounded-xl">
                                    <div>
                                        <span className="font-bold text-slate-700">Action: </span>
                                        <span className={clsx(
                                            "font-bold uppercase",
                                            selectedRequest.status === 'Approved' && 'text-[#16A34A]',
                                            (selectedRequest.status === 'Rejected' || selectedRequest.status === 'Cancelled') && 'text-[#DC2626]'
                                        )}>{selectedRequest.status}</span>
                                    </div>
                                    {selectedRequest.actionBy && (
                                        <div>
                                            <span className="font-bold text-slate-700">Processed By: </span>
                                            <span className="font-medium">{selectedRequest.actionBy.firstName} {selectedRequest.actionBy.lastName}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-bold text-slate-700">Processed On: </span>
                                        <span className="font-medium">
                                            {new Date(selectedRequest.approvedAt || selectedRequest.rejectedAt || selectedRequest.cancelledAt).toLocaleString('en-GB')}
                                        </span>
                                    </div>
                                    {selectedRequest.rejectionReason && (
                                        <div className="text-rose-600 bg-rose-50/50 p-2 rounded border border-rose-100 mt-1 font-medium">
                                            <span className="font-bold text-rose-700">Rejection Reason:</span> {selectedRequest.rejectionReason}
                                        </div>
                                    )}
                                    {selectedRequest.adminRemark && (
                                        <div className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1 font-medium">
                                            <span className="font-bold text-slate-700">Admin Remarks:</span> {selectedRequest.adminRemark}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Actions Footer inside modal if Pending */}
                        {selectedRequest.status === 'Pending' && (
                            <div className="flex gap-2 pt-4 border-t border-slate-100 shrink-0 justify-end">
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await handleAction(selectedRequest._id, 'reject');
                                        setSelectedRequest(null);
                                    }}
                                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await handleAction(selectedRequest._id, 'approve');
                                        setSelectedRequest(null);
                                    }}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                                >
                                    Approve
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        , document.body)}
        </>
    );
}

// ─── Smart Defaults per Leave Type ───────────────────────────────────────────
// When the user picks a leave type in the rule configurator, these defaults
// are merged into ruleForm so the form pre-populates with sane industry values.
const LEAVE_TYPE_DEFAULTS = {
    EL: {
        totalPerYear: 21,
        color: '#3b82f6',
        carryForwardAllowed: true,
        maxCarryForward: 15,
        halfDayAllowed: true,
        requiresApproval: true,
        accrualType: 'monthly',
        monthlyAccrual: true,
        monthlyAccrualRate: 1.75,
        accrualDependsOnAttendance: true,
        minAttendanceDays: 20,
        countPresent: true,
        countOnDuty: true,
        countCompOff: true,
        countHoliday: true,
        countWeeklyOff: true,
        countPaidLeave: false,
        prorateForNewJoiners: false,
        encashmentAllowed: true,
    },
    CL: {
        totalPerYear: 7,
        color: '#10b981',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: true,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        minAttendanceDays: 20,
        prorateForNewJoiners: true,
        encashmentAllowed: false,
    },
    SL: {
        totalPerYear: 7,
        color: '#f59e0b',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: true,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        minAttendanceDays: 20,
        prorateForNewJoiners: true,
        encashmentAllowed: false,
    },
    MATERNITY: {
        totalPerYear: 84,
        color: '#ec4899',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: false,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
        applicableGender: 'Female',
        maxChildrenLimit: 2,
    },
    PATERNITY: {
        totalPerYear: 15,
        color: '#6366f1',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: false,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
        applicableGender: 'Male',
        maxChildrenLimit: 2,
    },
    COMP_OFF: {
        totalPerYear: 0,
        color: '#06b6d4',
        carryForwardAllowed: true,
        maxCarryForward: 12,
        halfDayAllowed: true,
        requiresApproval: false,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
        expiryMonths: 3,
    },
    BEREAVEMENT: {
        totalPerYear: 5,
        color: '#64748b',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: false,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
    },
    MARRIAGE: {
        totalPerYear: 3,
        color: '#f97316',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: false,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
    },
    WFH: {
        totalPerYear: 24,
        color: '#8b5cf6',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: true,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
    },
    LOP: {
        totalPerYear: 0,
        color: '#ef4444',
        carryForwardAllowed: false,
        maxCarryForward: 0,
        halfDayAllowed: true,
        requiresApproval: true,
        accrualType: 'yearly',
        monthlyAccrual: false,
        monthlyAccrualRate: 0,
        accrualDependsOnAttendance: false,
        prorateForNewJoiners: false,
        encashmentAllowed: false,
    },
};

const COMMON_POLICY_TEMPLATES = [
    {
        id: 'custom',
        label: 'Custom Policy (Manual Config)',
        name: '',
        rules: []
    },
    {
        id: 'standard',
        label: 'Standard Company Policy (21 EL, 7 CL, 7 SL)',
        name: 'Standard Company Policy',
        rules: [
            { 
                leaveType: 'EL', 
                totalPerYear: 21, 
                requiresApproval: true, 
                color: '#3b82f6', 
                carryForwardAllowed: true, 
                maxCarryForward: 15, 
                halfDayAllowed: true,
                monthlyAccrual: true,
                accrualType: 'monthly',
                monthlyAccrualRate: 1.75,
                accrualDependsOnAttendance: true,
                minAttendanceDays: 20,
                countPresent: true,
                countOnDuty: true,
                countCompOff: true,
                countHoliday: true,
                countWeeklyOff: true,
                countPaidLeave: false
            },
            { 
                leaveType: 'CL', 
                totalPerYear: 7, 
                requiresApproval: true, 
                color: '#10b981', 
                carryForwardAllowed: false, 
                maxCarryForward: 0, 
                halfDayAllowed: true,
                prorateForNewJoiners: true,
                minAttendanceDays: 20
            },
            { 
                leaveType: 'SL', 
                totalPerYear: 7, 
                requiresApproval: true, 
                color: '#f59e0b', 
                carryForwardAllowed: false, 
                maxCarryForward: 0, 
                halfDayAllowed: true,
                prorateForNewJoiners: true,
                minAttendanceDays: 20
            }
        ]
    },
    {
        id: 'corporate',
        label: 'Corporate Leave Policy (21 EL, 7 CL, 7 SL)',
        name: 'Corporate Leave Policy',
        rules: [
            { 
                leaveType: 'EL', 
                totalPerYear: 21, 
                requiresApproval: true, 
                color: '#3b82f6', 
                carryForwardAllowed: true, 
                maxCarryForward: 15, 
                halfDayAllowed: true,
                monthlyAccrual: true,
                accrualType: 'monthly',
                monthlyAccrualRate: 1.75,
                accrualDependsOnAttendance: true,
                minAttendanceDays: 20,
                countPresent: true,
                countOnDuty: true,
                countCompOff: true,
                countHoliday: true,
                countWeeklyOff: true,
                countPaidLeave: false
            },
            { 
                leaveType: 'CL', 
                totalPerYear: 7, 
                requiresApproval: true, 
                color: '#10b981', 
                carryForwardAllowed: false, 
                maxCarryForward: 0, 
                halfDayAllowed: true,
                prorateForNewJoiners: true,
                minAttendanceDays: 20
            },
            { 
                leaveType: 'SL', 
                totalPerYear: 7, 
                requiresApproval: true, 
                color: '#f59e0b', 
                carryForwardAllowed: true, 
                maxCarryForward: 5, 
                halfDayAllowed: true,
                prorateForNewJoiners: true,
                minAttendanceDays: 20
            }
        ]
    },
    {
        id: 'maternity',
        label: 'Maternity Leave Policy (84 Days)',
        name: 'Maternity Leave Policy',
        rules: [
            { leaveType: 'MATERNITY', totalPerYear: 84, requiresApproval: true, color: '#ec4899', carryForwardAllowed: false, maxCarryForward: 0, halfDayAllowed: false, applicableGender: 'Female', maxChildrenLimit: 2 }
        ]
    },
    {
        id: 'paternity',
        label: 'Paternity Leave Policy (15 Days)',
        name: 'Paternity Leave Policy',
        rules: [
            { leaveType: 'PATERNITY', totalPerYear: 15, requiresApproval: true, color: '#6366f1', carryForwardAllowed: false, maxCarryForward: 0, halfDayAllowed: false, applicableGender: 'Male', maxChildrenLimit: 2 }
        ]
    },
    {
        id: 'intern',
        label: 'Internship Leave Policy (7 Casual, 7 Sick)',
        name: 'Internship Leave Policy',
        rules: [
            { 
                leaveType: 'CL', 
                totalPerYear: 7, 
                requiresApproval: true, 
                color: '#10b981', 
                carryForwardAllowed: false, 
                maxCarryForward: 0, 
                halfDayAllowed: true,
                prorateForNewJoiners: true,
                minAttendanceDays: 20
            },
            { 
                leaveType: 'SL', 
                totalPerYear: 7, 
                requiresApproval: true, 
                color: '#f59e0b', 
                carryForwardAllowed: false, 
                maxCarryForward: 0, 
                halfDayAllowed: true,
                prorateForNewJoiners: true,
                minAttendanceDays: 20
            }
        ]
    }
];

const generatePolicyId = (name, existingPolicies = []) => {
    if (!name) return '';
    
    // Clean name: keep only alphanumeric and spaces
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = cleanName.split(/\s+/).filter(Boolean);
    
    let prefix = '';
    if (words.length === 1) {
        // If it's a single word, take first 3 characters
        prefix = words[0].slice(0, 3).toUpperCase();
    } else {
        // Take initials
        prefix = words.map(w => w[0]).join('').toUpperCase();
    }
    
    // Clean prefix (keep only letters and numbers, max 6 chars, uppercase)
    prefix = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    if (!prefix) prefix = 'PL';
    
    // Find next number
    let nextNum = 1;
    const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
    
    if (existingPolicies && existingPolicies.length > 0) {
        existingPolicies.forEach(p => {
            if (p.policyId) {
                const match = p.policyId.trim().match(regex);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num >= nextNum) {
                        nextNum = num + 1;
                    }
                }
            }
        });
    }
    
    // Format with padded zeros (e.g. SCP-001)
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${prefix}-${paddedNum}`;
};

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function LeavePolicies({ initialView = 'policies' }) {
    const [view, setView] = useState(initialView);
    const [ruleSubTab, setRuleSubTab] = useState('core');
    const [selectedTemplateId, setSelectedTemplateId] = useState('custom');
    
    useEffect(() => {
        setView(initialView);
    }, [initialView]);

    const [policies, setPolicies] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [branches, setBranches] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isPolicyIdManuallyEdited, setIsPolicyIdManuallyEdited] = useState(false);
    const [mappings, setMappings] = useState([]);
    const [editingMappingId, setEditingMappingId] = useState(null);
    const [mappingForm, setMappingForm] = useState({
        minLpa: '',
        maxLpa: '',
        band: '',
        gradeValue: '',
        gradeName: ''
    });

    const [form, setForm] = useState({
        name: '',
        policyId: '',
        status: 'ACTIVE',
        applicableTo: 'All',
        specificEmployeeId: '',
        roles: [],
        departmentIds: [],
        branchIds: [],
        gradeIds: [],
        gradeCodes: [],
        designations: [],
        applicableJobTypes: [],
        applicableBands: [],
        applicableEmployeeTypes: [],
        rules: [],
        effectiveFrom: '',
        expiryDate: ''
    });

    const [ruleForm, setRuleForm] = useState({
        leaveType: '',
        totalPerYear: 0,
        monthlyAccrual: false,
        carryForwardAllowed: false,
        maxCarryForward: 0,
        requiresApproval: true,
        color: '#0f172a',
        accrualType: 'yearly',
        monthlyAccrualRate: 0,
        maxLeaveCap: 0,
        expiryMonths: 0,
        encashmentAllowed: false,
        allowDuringProbation: false,
        minimumTenureMonths: 0,
        advanceNoticeDays: 0,
        halfDayAllowed: true,
        postFactoAllowed: false,
        maxPostFactoCount: 0,
        medicalCertRequiredAfterDays: 0,
        applicableGender: 'All',
        maxChildrenLimit: 0,
        accrualDependsOnAttendance: false,
        minAttendanceDays: 20,
        countPresent: true,
        countOnDuty: true,
        countCompOff: true,
        countHoliday: true,
        countWeeklyOff: true,
        countPaidLeave: false,
        prorateForNewJoiners: false
    });

    const [editingRuleIndex, setEditingRuleIndex] = useState(null);
    const [positions, setPositions] = useState([]);

    useEffect(() => {
        fetchPolicies();
        fetchEmployees();
        fetchMappings();
        fetchDepartments();
        fetchGrades();
        fetchPositions();
        fetchBranches();
    }, []);

    useEffect(() => {
        if (!editingId && !isPolicyIdManuallyEdited) {
            const autoId = generatePolicyId(form.name, policies);
            setForm(prev => {
                if (prev.policyId !== autoId) {
                    return { ...prev, policyId: autoId };
                }
                return prev;
            });
        }
    }, [form.name, policies, editingId, isPolicyIdManuallyEdited]);

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/leave-policies');
            const data = Array.isArray(res.data) ? res.data : (res.data?.policies || []);
            setPolicies(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMappings = async () => {
        try {
            const res = await api.get('/hr/leave-policies/custom/mappings');
            setMappings(res.data?.data || res.data || []);
        } catch (err) {
            console.error('Failed to fetch mappings:', err);
        }
    };

    const handleAddMapping = async () => {
        if (!mappingForm.minLpa || !mappingForm.maxLpa) {
            return showToast('error', 'Incomplete Range', 'Please specify both Min and Max LPA.');
        }

        if (!mappingForm.band) {
            return showToast('error', 'Band Required', 'Please select or enter a Band value.');
        }

        if (!mappingForm.gradeValue) {
            return showToast('error', 'Grade Required', 'Please select or enter a Grade.');
        }

        const payload = {
            ...mappingForm,
            gradeCode: mappingForm.gradeValue,
            gradeName: mappingForm.gradeName || mappingForm.gradeValue,
            label: `${mappingForm.minLpa}-${mappingForm.maxLpa} LPA`
        };

        try {
            if (editingMappingId) {
                await api.put(`/hr/leave-policies/custom/mappings/${editingMappingId}`, payload);
                showToast('success', 'Mapping Updated');
            } else {
                await api.post('/hr/leave-policies/custom/mappings', payload);
                showToast('success', 'Mapping Added');
            }
            setMappingForm({ minLpa: '', maxLpa: '', band: '', gradeValue: '', gradeName: '' });
            setEditingMappingId(null);
            fetchMappings();
        } catch (err) {
            showToast('error', 'Action Failed', err.response?.data?.error || err.response?.data?.message || 'Something went wrong');
        }
    };

    const handleEditMapping = (m) => {
        setEditingMappingId(m._id);
        setMappingForm({
            minLpa: m.minLpa,
            maxLpa: m.maxLpa,
            band: m.band,
            gradeValue: m.gradeValue || m.gradeCode || m.gradeName || '',
            gradeName: m.gradeName || ''
        });
    };

    const handleDeleteMapping = (id) => {
        showConfirmToast({
            title: 'Delete Mapping',
            description: 'Are you sure you want to remove this mapping rule?',
            okText: 'Delete',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/hr/leave-policies/custom/mappings/${id}`);
                    showToast('success', 'Mapping Removed');
                    fetchMappings();
                } catch {
                    showToast('error', 'Deletion Failed');
                }
            }
        });
    };

    const handleApplyMappings = async () => {
        try {
            await api.post('/hr/leave-policies/custom/apply');
            showToast('success', 'Sync Started', 'Mappings are being applied to all employee records.');
        } catch {
            showToast('error', 'Sync Failed');
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setEmployees(res.data.data);
            } else if (Array.isArray(res.data)) {
                setEmployees(res.data);
            } else {
                setEmployees([]);
            }
        } catch (err) {
            console.error('Failed to fetch employees', err);
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/hr/departments');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setDepartments(res.data.data);
            } else if (Array.isArray(res.data)) {
                setDepartments(res.data);
            } else {
                setDepartments([]);
            }
        } catch (err) {
            console.error('Failed to fetch departments', err);
            setDepartments([]);
        }
    };

    const fetchGrades = async () => {
        try {
            const res = await api.get('/grades');
            const data = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setMappingForm(prev => ({
                ...prev,
                availableGrades: data,
            }));
        } catch (err) {
            console.error('Failed to fetch grades', err);
        }
    };

    const fetchPositions = async () => {
        try {
            const res = await api.get('/positions');
            const data = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setPositions(data);
        } catch (err) {
            console.error('Failed to fetch positions', err);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await api.get('/hierarchy/branches');
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setBranches(data);
        } catch (err) {
            console.error('Failed to fetch branches', err);
        }
    };

    const normalizeObjectIdList = (items = []) => (
        Array.isArray(items)
            ? items
                .map((item) => item?._id || item?.id || item)
                .filter(Boolean)
                .map((item) => item.toString())
            : []
    );

    const buildPolicyPayload = () => {
        let rulesToSubmit = [...(form.rules || [])];
        if (editingRuleIndex !== null && editingRuleIndex >= 0 && editingRuleIndex < rulesToSubmit.length) {
            rulesToSubmit[editingRuleIndex] = { ...ruleForm };
        }
        return {
            ...form,
            status: form.status || 'ACTIVE',
            policyId: form.policyId || '',
            specificEmployeeId: form.applicableTo === 'Specific' ? form.specificEmployeeId || '' : '',
            specificEmployeeIds: form.applicableTo === 'Specific' && form.specificEmployeeId ? [form.specificEmployeeId] : [],
            roles: form.applicableTo === 'Role' ? Array.from(new Set(form.roles || [])) : [],
            // Always include scope fields - they are always visible
            departmentIds: normalizeObjectIdList(form.departmentIds || []),
            branchIds: normalizeObjectIdList(form.branchIds || []),
            gradeIds: form.gradeIds || [],
            gradeCodes: form.gradeCodes || [],
            designations: form.designations || [],
            applicableEmployeeTypes: form.applicableEmployeeTypes || [],
            applicableJobTypes: form.applicableJobTypes || [],
            applicableBands: form.applicableBands || [],
            rules: rulesToSubmit.map((rule) => ({
                ...rule,
                leaveType: String(rule.leaveType || '').trim().toUpperCase(),
                totalPerYear: Number(rule.totalPerYear) || 0
            }))
        };
    };

    const handleEdit = (policy) => {
        setEditingId(policy._id || policy.id);
        setSelectedTemplateId('custom');
        setForm({
            ...policy,
            policyId: policy.policyId || '',
            status: policy.status || (policy.isActive ? 'ACTIVE' : 'INACTIVE'),
            specificEmployeeId: policy.specificEmployeeId || policy.specificEmployeeIds?.[0]?._id || policy.specificEmployeeIds?.[0] || '',
            roles: Array.isArray(policy.roles) ? policy.roles : [],
            departmentIds: normalizeObjectIdList(policy.departmentIds),
            branchIds: Array.isArray(policy.branchIds) ? policy.branchIds.map(id => id?._id || id) : [],
            gradeIds: Array.isArray(policy.gradeIds) ? policy.gradeIds.map(id => id?._id || id) : [],
            gradeCodes: Array.isArray(policy.gradeCodes) ? policy.gradeCodes : [],
            designations: Array.isArray(policy.designations) ? policy.designations : [],
            applicableJobTypes: Array.isArray(policy.applicableJobTypes) ? policy.applicableJobTypes : [],
            applicableBands: Array.isArray(policy.applicableBands) ? policy.applicableBands : [],
            applicableEmployeeTypes: Array.isArray(policy.applicableEmployeeTypes) ? policy.applicableEmployeeTypes : [],
            rules: Array.isArray(policy.rules) ? policy.rules : [],
            effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().slice(0, 10) : '',
            expiryDate: policy.expiryDate ? new Date(policy.expiryDate).toISOString().slice(0, 10) : ''
        });
        setIsPolicyIdManuallyEdited(true);
        fetchGrades();
        fetchBranches();
        setShowModal(true);
    };

    const handleCreateNew = () => {
        setEditingId(null);
        setSelectedTemplateId('custom');
        setForm({ 
            name: '', 
            policyId: '',
            status: 'ACTIVE', 
            applicableTo: 'All', 
            specificEmployeeId: '', 
            roles: [], 
            departmentIds: [], 
            branchIds: [],
            gradeIds: [],
            gradeCodes: [],
            designations: [],
            applicableJobTypes: [],
            applicableBands: [],
            applicableEmployeeTypes: [],
            rules: [],
            effectiveFrom: '',
            expiryDate: ''
        });
        setRuleForm({ 
            leaveType: '', 
            totalPerYear: 0, 
            monthlyAccrual: false, 
            carryForwardAllowed: false, 
            maxCarryForward: 0, 
            requiresApproval: true, 
            color: '#4F46E5',
            accrualType: 'yearly',
            monthlyAccrualRate: 0,
            maxLeaveCap: 0,
            expiryMonths: 0,
            encashmentAllowed: false,
            allowDuringProbation: false,
            minimumTenureMonths: 0,
            advanceNoticeDays: 0,
            halfDayAllowed: true,
            postFactoAllowed: false,
            maxPostFactoCount: 0,
            medicalCertRequiredAfterDays: 0,
            applicableGender: 'All',
            maxChildrenLimit: 0,
            accrualDependsOnAttendance: false,
            minAttendanceDays: 20,
            countPresent: true,
            countOnDuty: true,
            countCompOff: true,
            countHoliday: true,
            countWeeklyOff: true,
            countPaidLeave: false,
            prorateForNewJoiners: false
        });
        setIsPolicyIdManuallyEdited(false);
        fetchGrades();
        fetchBranches();
        setShowModal(true);
    };

    const templatesList = [
        {
            id: 'custom',
            label: 'Custom Policy (Manual Config)',
            name: '',
            rules: []
        },
        ...COMMON_POLICY_TEMPLATES.filter(t => t.id !== 'custom').map(t => ({
            ...t,
            id: `template-${t.id}`
        })),
        ...policies.filter(p => !COMMON_POLICY_TEMPLATES.some(t => t.name && t.name.trim().toLowerCase() === p.name?.trim().toLowerCase())).map(p => {
            const rulesSummary = p.rules && p.rules.length > 0
                ? ` (${p.rules.map(r => `${r.totalPerYear} ${r.leaveType}`).join(', ')})`
                : '';
            return {
                id: p._id || p.id,
                label: `${p.name}${rulesSummary}`,
                name: p.name,
                rules: p.rules || []
            };
        })
    ];

    const handleTemplateChange = (e) => {
        const tid = e.target.value;
        setSelectedTemplateId(tid);
        const template = templatesList.find(t => t.id === tid);
        if (template) {
            setForm(prev => ({
                ...prev,
                name: template.name || prev.name,
                rules: template.id !== 'custom' ? [...template.rules] : prev.rules
            }));
        }
    };

    const addRule = () => {
        if (!ruleForm.leaveType) return showToast('error', 'Validation Error', 'Leave Type required');
        
        setSelectedTemplateId('custom');
        
        if (editingRuleIndex !== null) {
            setForm(prev => {
                const updatedRules = [...prev.rules];
                updatedRules[editingRuleIndex] = { ...ruleForm };
                return { ...prev, rules: updatedRules };
            });
            setEditingRuleIndex(null);
            showToast('success', 'Rule Updated', 'Leave rule has been updated.');
        } else {
            setForm(prev => ({ ...prev, rules: [...prev.rules, { ...ruleForm }] }));
            showToast('success', 'Rule Added', 'New leave rule added.');
        }

        setRuleForm({ 
            leaveType: '', 
            totalPerYear: 0, 
            monthlyAccrual: false, 
            carryForwardAllowed: false, 
            maxCarryForward: 0, 
            requiresApproval: true, 
            color: '#4F46E5',
            accrualType: 'yearly',
            monthlyAccrualRate: 0,
            maxLeaveCap: 0,
            expiryMonths: 0,
            encashmentAllowed: false,
            allowDuringProbation: false,
            minimumTenureMonths: 0,
            advanceNoticeDays: 0,
            halfDayAllowed: true,
            postFactoAllowed: false,
            maxPostFactoCount: 0,
            medicalCertRequiredAfterDays: 0,
            applicableGender: 'All',
            maxChildrenLimit: 0,
            accrualDependsOnAttendance: false,
            minAttendanceDays: 20,
            countPresent: true,
            countOnDuty: true,
            countCompOff: true,
            countHoliday: true,
            countWeeklyOff: true,
            countPaidLeave: false,
            prorateForNewJoiners: false
        });
    };

    const editRule = (idx) => {
        const ruleToEdit = form.rules[idx];
        setRuleForm({ ...ruleToEdit });
        setEditingRuleIndex(idx);
    };

    const cancelEditRule = () => {
        setEditingRuleIndex(null);
        setRuleForm({ 
            leaveType: '', 
            totalPerYear: 0, 
            monthlyAccrual: false, 
            carryForwardAllowed: false, 
            maxCarryForward: 0, 
            requiresApproval: true, 
            color: '#4F46E5',
            accrualType: 'yearly',
            monthlyAccrualRate: 0,
            maxLeaveCap: 0,
            expiryMonths: 0,
            encashmentAllowed: false,
            allowDuringProbation: false,
            minimumTenureMonths: 0,
            advanceNoticeDays: 0,
            halfDayAllowed: true,
            postFactoAllowed: false,
            maxPostFactoCount: 0,
            medicalCertRequiredAfterDays: 0,
            applicableGender: 'All',
            maxChildrenLimit: 0,
            accrualDependsOnAttendance: false,
            minAttendanceDays: 20,
            countPresent: true,
            countOnDuty: true,
            countCompOff: true,
            countHoliday: true,
            countWeeklyOff: true,
            countPaidLeave: false,
            prorateForNewJoiners: false
        });
    };

    const removeRule = (idx) => {
        setForm(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== idx) }));
        setSelectedTemplateId('custom');
        if (editingRuleIndex === idx) {
            cancelEditRule();
        } else if (editingRuleIndex > idx) {
            setEditingRuleIndex(prev => prev - 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.rules.length === 0) {
            return showToast('error', 'Incomplete Policy', 'You must add at least one Leave Rule (like SL, CL) to the Active Matrix before finalizing.');
        }

        if (isSaving) return;

        // Auto-apply current editing rule changes if any
        if (editingRuleIndex !== null) {
            setForm(prev => {
                const updatedRules = [...prev.rules];
                updatedRules[editingRuleIndex] = { ...ruleForm };
                return { ...prev, rules: updatedRules };
            });
            setEditingRuleIndex(null);
            setRuleForm({ 
                leaveType: '', 
                totalPerYear: 0, 
                monthlyAccrual: false, 
                carryForwardAllowed: false, 
                maxCarryForward: 0, 
                requiresApproval: true, 
                color: '#4F46E5',
                accrualType: 'yearly',
                monthlyAccrualRate: 0,
                maxLeaveCap: 0,
                expiryMonths: 0,
                encashmentAllowed: false,
                allowDuringProbation: false,
                minimumTenureMonths: 0,
                advanceNoticeDays: 0,
                halfDayAllowed: true,
                postFactoAllowed: false,
                maxPostFactoCount: 0,
                medicalCertRequiredAfterDays: 0,
                applicableGender: 'All',
                maxChildrenLimit: 0,
                accrualDependsOnAttendance: false,
                minAttendanceDays: 20,
                countPresent: true,
                countOnDuty: true,
                countCompOff: true,
                countHoliday: true,
                countWeeklyOff: true,
                countPaidLeave: false,
                prorateForNewJoiners: false
            });
        }

        const payload = buildPolicyPayload();
        try {
            if (editingId) {
                showConfirmToast({
                    title: 'Update Policy?',
                    description: 'This update requires careful review. Are you sure?',
                    okText: 'Update',
                    cancelText: 'Cancel',
                    onConfirm: async () => {
                        try {
                            setIsSaving(true);
                            await api.put(`/hr/leave-policies/${editingId}`, payload);
                            showToast('success', 'Success', 'Policy updated successfully.');
                            setShowModal(false);
                            fetchPolicies();
                        } catch (err) {
                            showToast('error', 'Error', err.response?.data?.error || 'Failed to update policy');
                        } finally {
                            setIsSaving(false);
                        }
                    }
                });
            } else {
                setIsSaving(true);
                const res = await api.post('/hr/leave-policies', payload);
                const syncCount = Number(res.data?.appliedToExistingEmployees || 0);
                const msg = syncCount > 0 ? `Policy created and assigned to ${syncCount} employees` : 'Policy created (no employees assigned yet)';
                showToast('success', 'Success', msg);
                setShowModal(false);
                fetchPolicies();
            }
        } catch (err) {
            console.error('Submit error:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to save policy');
        } finally {
            if (!editingId) {
                setIsSaving(false);
            }
        }
    };

    const handleDelete = async (id) => {
        showConfirmToast({
            title: 'Delete Policy?',
            description: 'This will remove policies from employees. This action cannot be undone.',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/hr/leave-policies/${id}`);
                    showToast('success', 'Success', 'Policy deleted successfully');
                    fetchPolicies();
                } catch (err) {
                    console.error(err);
                    showToast('error', 'Error', 'Failed to delete policy');
                }
            }
        });
    };

    const toggleStatus = async (policyObj, currentStatus) => {
        const id = policyObj?._id || policyObj?.id || policyObj?._doc?._id || policyObj?._doc?.id || (typeof policyObj === 'string' ? policyObj : null);
        if (!id) return showToast('error', 'Error', 'Cannot update status: Policy ID is missing');
        const finalId = id.toString();
        try {
            const res = await api.patch(`/hr/leave-policies/${finalId}/status`, { isActive: !currentStatus });
            const updatedDoc = res.data?.policy || res.data;
            setPolicies(prev => prev.map(p => {
                const pId = (p._id || p.id)?.toString();
                return pId === finalId ? { ...p, ...updatedDoc } : p;
            }));
            showToast('success', 'Success', `Policy ${!currentStatus ? 'Activated' : 'Deactivated'}`);
        } catch (err) {
            console.error('[TOGGLE_STATUS] Error:', err);
            showToast('error', 'Error', err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleSync = async (id) => {
        if (!id) return showToast('error', 'Error', 'Policy ID missing');
        try {
            showToast('info', 'Syncing', 'Sync in progress...');
            const res = await api.post(`/hr/leave-policies/${id}/sync`);
            const count = Number(res.data?.employeesProcessed || res.data?.results?.length || 0);
            showToast('success', 'Synced', `Policy synced to ${count} employees`);
            fetchPolicies();
        } catch (err) {
            console.error('[SYNC] Error', err);
            showToast('error', 'Failed', err.response?.data?.error || err.message || 'Failed to sync policy');
        }
    };

    const totalPolicies = policies.length;
    const activePolicies = policies.filter(p => p.isActive).length;
    const totalRules = policies.reduce((acc, p) => acc + (p.rules?.length || 0), 0);

    return (
        <div className={`${showModal ? 'h-full' : 'p-2.5 space-y-3'} animate-in fade-in duration-500`}>
            {/* ── Top Header Section (Hidden when form is shown) ─────────────────────────── */}
            {!showModal && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            Leave Master
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {view === 'policies' && (
                            <button
                                onClick={fetchPolicies}
                                className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:shadow-md"
                                title="Refresh Policies"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        )}
                        

                        {view === 'policies' && (
                            <Can module="leave.policies" action="create">
                                <button
                                    onClick={handleCreateNew}
                                    className="flex items-center gap-2 h-12 px-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    <Plus size={16} strokeWidth={3} />
                                    New Policy
                                </button>
                            </Can>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab Navigation ────────────────────────────────────────── */}
            {!showModal && (
                <div className="flex border-b border-slate-200 mb-6 bg-white p-1 rounded-xl shadow-sm gap-2 max-w-fit flex-wrap">
                    {[
                        { id: 'policies', label: 'Leave Policies', count: totalPolicies },
                        { id: 'custom', label: 'Policy Mapping', count: mappings.length },
                        { id: 'holiday', label: 'Holiday Master' },
                        { id: 'opening', label: 'Opening Balance' },
                        { id: 'requests', label: 'Leave Requests' },
                        { id: 'ledger', label: 'Leave Ledger' },
                        { id: 'compoff', label: 'Comp Off' },
                        { id: 'encashment', label: 'Encashment' },
                        { id: 'analytics', label: 'Analytics & Reports' },
                        { id: 'settings', label: 'Settings' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all select-none",
                                view === tab.id
                                    ? "bg-slate-900 text-white shadow-md"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={clsx(
                                    "px-1.5 py-0.5 text-[9px] rounded-full font-bold",
                                    view === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* ── View Content ────────────────────────────────────────── */}
            {!showModal && (
                <>
                {view === 'custom' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <CustomMappingsPanel 
                            mappings={mappings}
                            setMappings={setMappings}
                            onAdd={handleAddMapping}
                            onDelete={handleDeleteMapping}
                            onEdit={handleEditMapping}
                            editingId={editingMappingId}
                            mappingForm={mappingForm}
                            setMappingForm={setMappingForm}
                            onCancelEdit={() => {
                                setEditingMappingId(null);
                                setMappingForm({ minLpa: '', maxLpa: '', band: '', gradeValue: '', gradeName: '' });
                            }}
                            onApplyMappings={handleApplyMappings}
                        />
                    </div>
                )}

                {view === 'holiday' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <HolidayMasterPanel />
                    </div>
                )}

                {view === 'opening' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <OpeningBalancePanel employees={employees} />
                    </div>
                )}

                {view === 'requests' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <LeaveRequestsPanel />
                    </div>
                )}

                {view === 'ledger' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <LeaveLedgerPanel employees={employees} />
                    </div>
                )}

                {view === 'compoff' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <CompOffPanel employees={employees} />
                    </div>
                )}

                {view === 'encashment' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <EncashmentPanel />
                    </div>
                )}



                {view === 'analytics' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <LeaveAnalyticsPanel />
                    </div>
                )}

                {view === 'settings' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <SettingsPanel />
                    </div>
                )}

                {view === 'policies' && (
                    <>
                        {/* ── Statistics Overview ─────────────────────────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                            <StatCard 
                                label="Total Configuration" 
                                value={totalPolicies} 
                                icon={<FileText />} 
                                iconColor="text-blue-600"
                                iconBg="bg-blue-50"
                            />
                            <StatCard 
                                label="Active Policies" 
                                value={activePolicies} 
                                icon={<ShieldCheck />} 
                                iconColor="text-emerald-600"
                                iconBg="bg-emerald-50"
                            />
                            <StatCard 
                                label="Total Rules" 
                                value={totalRules} 
                                icon={<Users />} 
                                iconColor="text-amber-600"
                                iconBg="bg-amber-50"
                            />
                        </div>

                        {/* ── Policies List Section ─────────────────────────────── */}
                        {loading ? (
                            <div className="bg-white rounded-3xl border border-slate-100 p-24 flex flex-col items-center justify-center gap-4 shadow-sm">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-slate-50 border-t-slate-800 rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <RefreshCw size={14} className="text-blue-600 animate-pulse" />
                                    </div>
                                </div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Fetching enterprise policies...</p>
                            </div>
                        ) : policies.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-100 p-20 flex flex-col items-center justify-center gap-6 shadow-sm border-dashed">
                                <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 border border-slate-100">
                                    <FileText size={40} strokeWidth={1} />
                                </div>
                                <div className="text-center max-w-xs">
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">No Policies Found</h3>
                                    <p className="text-xs font-medium text-slate-400 mt-2 leading-relaxed">
                                        It looks like you haven't created any leave policies yet. Get started by clicking the "New Policy" button.
                                    </p>
                                </div>
                                <button
                                    onClick={handleCreateNew}
                                    className="flex items-center gap-2 h-11 px-6 bg-slate-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-slate-100 hover:bg-black transition-all"
                                >
                                    <Plus size={16} strokeWidth={3} /> Create First Policy
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-12 animate-in slide-in-from-bottom-4 duration-700">
                                {(policies || []).map((p, idx) => (
                                    <PolicyCard
                                        key={(p._id || p.id || p?._doc?._id)?.toString() || idx}
                                        p={p}
                                        onEdit={handleEdit}
                                        onSync={handleSync}
                                        onDelete={handleDelete}
                                        onToggle={toggleStatus}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
                </>
            )}

            {/* ── Policy Creation / Edit Form (Inline View) ──────────────────────────────────────────── */}
            {showModal && (
                <div className="flex flex-col h-screen max-h-[calc(100vh-62px)] bg-slate-50 animate-in fade-in duration-300 overflow-hidden">
                    
                    {/* Header: Integrated & High-Contrast */}
                    <div className="flex-none h-14 px-8 border-b border-slate-100 flex items-center justify-between bg-white shadow-sm relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                                <Plus size={16} strokeWidth={3} />
                            </div>
                            <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-tight">
                                {editingId ? 'Modify Policy Configuration' : 'Create New Enterprise Policy'}
                            </h2>
                        </div>

                        <button 
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all group"
                        >
                            <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        {/* Unified Full-Workspace Two-Pane Layout */}
                        <div className="flex-1 flex overflow-hidden">
                            <div className="w-full h-full flex overflow-hidden">
                                
                                {/* Left Pane: Inputs (400px width) */}
                                <div className="w-[400px] flex-none bg-white flex flex-col border-r border-slate-100 shadow-sm relative z-10">
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                                        
                                        {/* Identity & Audience: Grid Layout */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Common Policy Template</label>
                                                <select
                                                    value={selectedTemplateId}
                                                    onChange={handleTemplateChange}
                                                    className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-slate-900 transition-all shadow-inner"
                                                >
                                                    {templatesList.map(t => (
                                                        <option key={t.id} value={t.id}>{t.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Policy Name</label>
                                                <input
                                                    placeholder="Standard Policy"
                                                    value={form.name}
                                                    onChange={e => {
                                                        setForm({ ...form, name: e.target.value });
                                                        setSelectedTemplateId('custom');
                                                    }}
                                                    className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 text-xs font-bold placeholder:font-normal text-slate-700 outline-none focus:border-slate-900 transition-all shadow-inner uppercase"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Policy ID / Code</label>
                                                <input
                                                    placeholder="e.g. PL-001"
                                                    value={form.policyId || ''}
                                                    onChange={e => {
                                                        setForm({ ...form, policyId: e.target.value });
                                                        setIsPolicyIdManuallyEdited(true);
                                                        setSelectedTemplateId('custom');
                                                    }}
                                                    className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 text-xs font-bold placeholder:font-normal text-slate-700 outline-none focus:border-slate-900 transition-all shadow-inner uppercase"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Target Audience</label>
                                                <select
                                                    value={form.applicableTo}
                                                    onChange={e => setForm({ ...form, applicableTo: e.target.value })}
                                                    className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-slate-900 transition-all shadow-inner"
                                                >
                                                    <option value="All">All Employee</option>
                                                    <option value="Grade">Selective Grades</option>
                                                    <option value="Band">Job Band Wise</option>
                                                    <option value="Designation">Designation Wise</option>
                                                    <option value="Department">By Department</option>
                                                    <option value="Specific">Personal Policy</option>
                                                    <option value="Custom">Custom Criteria (Multi-Select)</option>
                                                </select>
                                            </div>
                                        </div>


                                        {/* Always-Visible Scope Selectors */}
                                        <div className="space-y-4">
                                            {/* Branch Selector - Always Visible */}
                                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Applicable Branch</label>
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Optional</span>
                                                </div>
                                                {branches.length === 0 ? (
                                                    <p className="text-[9px] text-slate-400 italic">No branches found</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {branches.map(b => {
                                            const isSelected = form.branchIds?.includes(b._id);
                                            return (
                                            <label key={b._id}
                                                style={{ color: isSelected ? '#ffffff' : '#64748b', backgroundColor: isSelected ? '#4f46e5' : '#ffffff', borderColor: isSelected ? '#4f46e5' : '#e2e8f0' }}
                                                className="px-3 py-1.5 rounded-lg cursor-pointer select-none transition-all text-[9px] font-black uppercase tracking-tight border shadow-sm hover:shadow-md">
                                                <input type="checkbox" className="hidden" checked={!!isSelected} onChange={e => {
                                                    const brs = form.branchIds || [];
                                                    if (e.target.checked) setForm({ ...form, branchIds: [...brs, b._id] });
                                                    else setForm({ ...form, branchIds: brs.filter(v => v !== b._id) });
                                                }}/>
                                                <span style={{ color: 'inherit' }}>{b.name}</span>
                                            </label>
                                            );
                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Department Selector - Always Visible */}
                                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Applicable Department</label>
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Optional</span>
                                                </div>
                                                {departments.length === 0 ? (
                                                    <p className="text-[9px] text-slate-400 italic">No departments found</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {departments.map(d => {
                                            const isSelected = form.departmentIds?.includes(d._id);
                                            return (
                                            <label key={d._id}
                                                style={{ color: isSelected ? '#ffffff' : '#64748b', backgroundColor: isSelected ? '#4f46e5' : '#ffffff', borderColor: isSelected ? '#4f46e5' : '#e2e8f0' }}
                                                className="px-3 py-1.5 rounded-lg cursor-pointer select-none transition-all text-[9px] font-black uppercase tracking-tight border shadow-sm hover:shadow-md">
                                                <input type="checkbox" className="hidden" checked={!!isSelected} onChange={e => {
                                                    const depts = form.departmentIds || [];
                                                    if (e.target.checked) setForm({ ...form, departmentIds: [...depts, d._id] });
                                                    else setForm({ ...form, departmentIds: depts.filter(v => v !== d._id) });
                                                }}/>
                                                <span style={{ color: 'inherit' }}>{d.name}</span>
                                            </label>
                                            );
                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Designation Selector - Always Visible */}
                                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Applicable Designation</label>
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Optional</span>
                                                </div>
                                                {positions.length === 0 ? (
                                                    <p className="text-[9px] text-slate-400 italic">No designations found</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {positions.map(position => {
                                            // Position model uses 'jobTitle'; Designation model uses 'name'/'title'
                                            const d = position?.jobTitle || position?.name || position?.title || position?.designation || position?.code || '';
                                            if (!d) return null;
                                            const isSelected = form.designations?.includes(d);
                                            return (
                                                <label key={position?._id || d}
                                                    style={{ color: isSelected ? '#ffffff' : '#64748b', backgroundColor: isSelected ? '#4f46e5' : '#ffffff', borderColor: isSelected ? '#4f46e5' : '#e2e8f0' }}
                                                    className="px-3 py-1.5 rounded-lg cursor-pointer select-none transition-all text-[9px] font-black uppercase tracking-tight border shadow-sm hover:shadow-md">
                                                    <input type="checkbox" className="hidden" checked={!!isSelected} onChange={e => {
                                                        const desigs = form.designations || [];
                                                        if (e.target.checked) setForm({ ...form, designations: [...desigs, d] });
                                                        else setForm({ ...form, designations: desigs.filter(v => v !== d) });
                                                    }}/>
                                                    <span style={{ color: 'inherit' }}>{d}</span>
                                                </label>
                                            );
                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Grade Selector - Always Visible */}
                                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Applicable Grade</label>
                                                    <button type="button" onClick={fetchGrades} className="text-[8px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors">Refresh</button>
                                                </div>
                                                {[...new Set(mappings.map(m => m.gradeCode || m.gradeValue).filter(Boolean))].length === 0 ? (
                                                    <p className="text-[9px] text-slate-400 italic">No grades found</p>
                                                ) : (
                                                    <div className="grid grid-cols-4 gap-1.5">
                                                        {[...new Set(mappings.map(m => m.gradeCode || m.gradeValue).filter(Boolean))].sort().map(g => {
                                            const isSelected = form.gradeCodes?.includes(g);
                                            return (
                                            <label key={g}
                                                style={{ color: isSelected ? '#ffffff' : '#94a3b8', backgroundColor: isSelected ? '#4f46e5' : '#ffffff', borderColor: isSelected ? '#4f46e5' : '#f1f5f9' }}
                                                className="flex items-center justify-center h-8 rounded-lg cursor-pointer select-none transition-all text-[9px] font-black uppercase tracking-tight border shadow-sm">
                                                <input type="checkbox" className="hidden" checked={!!isSelected} onChange={e => {
                                                    const codes = form.gradeCodes || [];
                                                    if (e.target.checked) setForm({ ...form, gradeCodes: [...codes, g] });
                                                    else setForm({ ...form, gradeCodes: codes.filter(c => c !== g) });
                                                }}/>
                                                <span style={{ color: 'inherit' }}>{g}</span>
                                            </label>
                                            );
                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Employment Type Selector - Always Visible */}
                                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Employment Type</label>
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Optional</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {['Full-time', 'Contract', 'Probation', 'Part-time', 'Intern'].map(type => {
                                                        const isSelected = form.applicableEmployeeTypes?.includes(type);
                                                        return (
                                                        <label key={type}
                                                            style={{ color: isSelected ? '#ffffff' : '#94a3b8', backgroundColor: isSelected ? '#4f46e5' : '#ffffff', borderColor: isSelected ? '#4f46e5' : '#f1f5f9' }}
                                                            className="flex items-center justify-center h-8 rounded-lg cursor-pointer select-none transition-all text-[9px] font-black uppercase tracking-tight border shadow-sm">
                                                            <input type="checkbox" className="hidden" checked={!!isSelected} onChange={e => {
                                                                const types = form.applicableEmployeeTypes || [];
                                                                if (e.target.checked) setForm({ ...form, applicableEmployeeTypes: [...types, type] });
                                                                else setForm({ ...form, applicableEmployeeTypes: types.filter(t => t !== type) });
                                                            }}/>
                                                            <span style={{ color: 'inherit' }}>{type}</span>
                                                        </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Specific Employee Selector - only when Specific is selected */}
                                            {form.applicableTo === 'Specific' && (
                                                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3 block">Select Specific Employees</label>
                                                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                                        {employees.map(e => {
                                                            const isSelected = form.specificEmployees?.includes(e._id);
                                                            return (
                                                            <label key={e._id}
                                                                style={{ backgroundColor: isSelected ? '#eef2ff' : '#ffffff', borderColor: isSelected ? '#c7d2fe' : '#f1f5f9', color: isSelected ? '#4338ca' : '#64748b' }}
                                                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer select-none transition-all border">
                                                                <input type="checkbox" className="hidden" checked={!!isSelected} onChange={v => {
                                                                    const emps = form.specificEmployees || [];
                                                                    if (v.target.checked) setForm({ ...form, specificEmployees: [...emps, e._id] });
                                                                    else setForm({ ...form, specificEmployees: emps.filter(id => id !== e._id) });
                                                                }}/>
                                                                <div className="flex flex-col">
                                                                    <span style={{ color: 'inherit', fontSize: '10px' }} className="font-black uppercase tracking-tight">{e.firstName} {e.lastName}</span>
                                                                    <span style={{ color: isSelected ? '#6366f1' : '#94a3b8', fontSize: '8px' }} className="font-bold uppercase tracking-widest">{e.employeeId}</span>
                                                                </div>
                                                            </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Leave Type Configurator */}
                                        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-5">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Policy Ruleset</h4>
                                                </div>
                                                {editingRuleIndex !== null ? (
                                                    <div className="flex gap-2">
                                                        <button type="button" onClick={cancelEditRule} className="h-8 px-3 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                                                            Cancel
                                                        </button>
                                                        <button type="button" onClick={addRule} className="h-8 px-4 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-150 hover:bg-indigo-700 transition-all flex items-center gap-1.5 animate-pulse">
                                                            <Check size={12} strokeWidth={3} /> Update Rule
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button type="button" onClick={addRule} className="h-8 px-4 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-black transition-all flex items-center gap-1.5">
                                                        <Plus size={12} strokeWidth={3} /> Add Rule
                                                    </button>
                                                )}
                                            </div>

                                            {/* Sub-tab navigation */}
                                            <div className="flex border-b border-slate-100 pb-1 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setRuleSubTab('core')}
                                                    className={clsx(
                                                        "text-[9px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all select-none",
                                                        ruleSubTab === 'core' ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    Core
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRuleSubTab('accrual')}
                                                    className={clsx(
                                                        "text-[9px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all select-none",
                                                        ruleSubTab === 'accrual' ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    Accrual
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRuleSubTab('rules')}
                                                    className={clsx(
                                                        "text-[9px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all select-none",
                                                        ruleSubTab === 'rules' ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    Advanced
                                                </button>
                                            </div>

                                            {/* Sub-tab Content: Core */}
                                            {ruleSubTab === 'core' && (
                                                <div className="space-y-4 animate-in fade-in duration-200">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Leave Type</label>
                                                            <select
                                                                value={ruleForm.leaveType && ['EL', 'CL', 'SL', 'MATERNITY', 'PATERNITY', 'COMP_OFF', 'BEREAVEMENT', 'MARRIAGE', 'WFH', 'LOP'].includes(ruleForm.leaveType) ? ruleForm.leaveType : (ruleForm.leaveType ? 'CUSTOM' : '')}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === 'CUSTOM') {
                                                                        setRuleForm({ ...ruleForm, leaveType: 'CUSTOM' });
                                                                    } else if (val && LEAVE_TYPE_DEFAULTS[val]) {
                                                                        setRuleForm(prev => ({
                                                                            ...prev,
                                                                            ...LEAVE_TYPE_DEFAULTS[val],
                                                                            leaveType: val,
                                                                        }));
                                                                    } else {
                                                                        setRuleForm({ ...ruleForm, leaveType: val });
                                                                    }
                                                                }}
                                                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                            >
                                                                <option value="">Select Leave Type</option>
                                                                <option value="EL">Earned Leave (EL)</option>
                                                                <option value="CL">Casual Leave (CL)</option>
                                                                <option value="SL">Sick Leave (SL)</option>
                                                                <option value="MATERNITY">Maternity Leave</option>
                                                                <option value="PATERNITY">Paternity Leave</option>
                                                                <option value="COMP_OFF">Compensatory Off</option>
                                                                <option value="BEREAVEMENT">Bereavement Leave</option>
                                                                <option value="MARRIAGE">Marriage Leave</option>
                                                                <option value="WFH">Work From Home</option>
                                                                <option value="LOP">LOP (Loss of Pay)</option>
                                                                <option value="CUSTOM">+ Add Custom Leave Type</option>
                                                            </select>
                                                            {ruleForm.leaveType && (ruleForm.leaveType === 'CUSTOM' || !['EL', 'CL', 'SL', 'MATERNITY', 'PATERNITY', 'COMP_OFF', 'BEREAVEMENT', 'MARRIAGE', 'WFH', 'LOP'].includes(ruleForm.leaveType)) && (
                                                                <div className="space-y-1 mt-2 animate-in slide-in-from-top-2">
                                                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Custom Leave Code</label>
                                                                    <input
                                                                        placeholder="e.g. STUDY, SABBATICAL"
                                                                        value={ruleForm.leaveType === 'CUSTOM' ? '' : ruleForm.leaveType}
                                                                        onChange={e => setRuleForm({ ...ruleForm, leaveType: e.target.value.toUpperCase() })}
                                                                        className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Annual Credit</label>
                                                            <input type="number" placeholder="0" value={ruleForm.totalPerYear} onChange={e => setRuleForm({ ...ruleForm, totalPerYear: parseInt(e.target.value) || 0 })}
                                                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Visual Color</label>
                                                            <input type="color" value={ruleForm.color} onChange={e => setRuleForm({ ...ruleForm, color: e.target.value })}
                                                                className="w-full h-10 rounded-xl border border-slate-100 overflow-hidden cursor-pointer select-none bg-white"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5 flex flex-col justify-end pb-2">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                                                <input type="checkbox" checked={ruleForm.requiresApproval} onChange={e => setRuleForm({ ...ruleForm, requiresApproval: e.target.checked })} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Needs Approval</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>

                                            )}

                                            {/* Sub-tab Content: Accrual */}
                                            {ruleSubTab === 'accrual' && (
                                                <div className="space-y-4 animate-in fade-in duration-200">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Accrual Type</label>
                                                            <select
                                                                value={ruleForm.accrualType}
                                                                onChange={e => setRuleForm({ 
                                                                    ...ruleForm, 
                                                                    accrualType: e.target.value,
                                                                    monthlyAccrual: e.target.value === 'monthly'
                                                                })}
                                                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                                                            >
                                                                <option value="yearly">Yearly Credit</option>
                                                                <option value="monthly">Monthly Accrual</option>
                                                            </select>
                                                        </div>
                                                        {ruleForm.accrualType === 'monthly' && (
                                                            <div className="space-y-1.5">
                                                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Monthly Rate</label>
                                                                <input type="number" step="0.01" placeholder="e.g. 1.75" value={ruleForm.monthlyAccrualRate} onChange={e => setRuleForm({ ...ruleForm, monthlyAccrualRate: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                                        <div className="space-y-1.5">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                                                <input type="checkbox" checked={ruleForm.carryForwardAllowed} onChange={e => setRuleForm({ ...ruleForm, carryForwardAllowed: e.target.checked })} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Carry Forward</span>
                                                            </label>
                                                            {ruleForm.carryForwardAllowed && (
                                                                <input type="number" placeholder="Max CF Cap" value={ruleForm.maxCarryForward} onChange={e => setRuleForm({ ...ruleForm, maxCarryForward: parseInt(e.target.value) || 0 })}
                                                                    className="w-full h-9 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 mt-1"
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                                                <input type="checkbox" checked={ruleForm.encashmentAllowed} onChange={e => setRuleForm({ ...ruleForm, encashmentAllowed: e.target.checked })} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Encashment</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Max Balance Cap</label>
                                                            <input type="number" placeholder="No limit" value={ruleForm.maxLeaveCap || ''} onChange={e => setRuleForm({ ...ruleForm, maxLeaveCap: parseInt(e.target.value) || 0 })}
                                                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Expiry (Months)</label>
                                                            <input type="number" placeholder="Never expires" value={ruleForm.expiryMonths || ''} onChange={e => setRuleForm({ ...ruleForm, expiryMonths: parseInt(e.target.value) || 0 })}
                                                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sub-tab Content: Advanced */}
                                            {ruleSubTab === 'rules' && (
                                                <div className="space-y-3 animate-in fade-in duration-200 max-w-full">
                                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                                                        
                                                        {/* Row 1: Allow during probation */}
                                                        <div className="flex items-center justify-between gap-4 py-1">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Allow leave during probation</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Let new employees apply for this leave during their probation period</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRuleForm({ ...ruleForm, allowDuringProbation: !ruleForm.allowDuringProbation })}
                                                                className={clsx(
                                                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer select-none rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                                                                    ruleForm.allowDuringProbation ? "bg-indigo-600" : "bg-slate-200"
                                                                )}
                                                            >
                                                                <span
                                                                    className={clsx(
                                                                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                        ruleForm.allowDuringProbation ? "translate-x-4" : "translate-x-0"
                                                                    )}
                                                                />
                                                            </button>
                                                        </div>

                                                        {/* Row 2: Minimum service required */}
                                                        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-50 pt-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Minimum service required</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Months of service completed before this leave can be requested</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={ruleForm.minimumTenureMonths || ''}
                                                                    onChange={e => setRuleForm({ ...ruleForm, minimumTenureMonths: parseInt(e.target.value) || 0 })}
                                                                    className="w-16 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                                />
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mths</span>
                                                            </div>
                                                        </div>

                                                        {/* Row 3: Apply in advance */}
                                                        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-50 pt-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Apply in advance (Notice)</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Number of days in advance the leave must be applied for</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={ruleForm.advanceNoticeDays || ''}
                                                                    onChange={e => setRuleForm({ ...ruleForm, advanceNoticeDays: parseInt(e.target.value) || 0 })}
                                                                    className="w-16 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                                />
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Days</span>
                                                            </div>
                                                        </div>

                                                        {/* Row 4: Half day applications */}
                                                        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-50 pt-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Allow half-day applications</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Allow employees to request first/second half leaves</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRuleForm({ ...ruleForm, halfDayAllowed: !ruleForm.halfDayAllowed })}
                                                                className={clsx(
                                                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer select-none rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                                                                    ruleForm.halfDayAllowed ? "bg-indigo-600" : "bg-slate-200"
                                                                )}
                                                            >
                                                                <span
                                                                    className={clsx(
                                                                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                        ruleForm.halfDayAllowed ? "translate-x-4" : "translate-x-0"
                                                                    )}
                                                                />
                                                            </button>
                                                        </div>

                                                        {/* Row 5: Allow backdated leaves */}
                                                        <div className="flex flex-col gap-2 border-t border-slate-50 pt-3">
                                                            <div className="flex items-center justify-between gap-4 py-1">
                                                                <div className="flex-1">
                                                                    <h4 className="text-xs font-bold text-slate-800">Allow backdated (past date) leaves</h4>
                                                                    <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Let employees apply for leaves in the past (post-facto)</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setRuleForm({ ...ruleForm, postFactoAllowed: !ruleForm.postFactoAllowed })}
                                                                    className={clsx(
                                                                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer select-none rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                                                                        ruleForm.postFactoAllowed ? "bg-indigo-600" : "bg-slate-200"
                                                                    )}
                                                                >
                                                                    <span
                                                                        className={clsx(
                                                                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                            ruleForm.postFactoAllowed ? "translate-x-4" : "translate-x-0"
                                                                        )}
                                                                    />
                                                                </button>
                                                            </div>
                                                            {ruleForm.postFactoAllowed && (
                                                                <div className="flex items-center justify-between gap-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50 mt-1 animate-in slide-in-from-top-2 duration-200">
                                                                    <div>
                                                                        <h5 className="text-[11px] font-bold text-slate-700">Maximum backdated days</h5>
                                                                        <p className="text-[9px] text-slate-400 leading-normal">Limit how many days in the past they can apply for</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="0"
                                                                            value={ruleForm.maxPostFactoCount || ''}
                                                                            onChange={e => setRuleForm({ ...ruleForm, maxPostFactoCount: parseInt(e.target.value) || 0 })}
                                                                            className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                                        />
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Days</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Row 6: Medical certificate required */}
                                                        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-50 pt-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Medical certificate requirement</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Mandatory certificate upload if leave duration exceeds X days</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    placeholder="e.g. 3"
                                                                    value={ruleForm.medicalCertRequiredAfterDays || ''}
                                                                    onChange={e => setRuleForm({ ...ruleForm, medicalCertRequiredAfterDays: parseInt(e.target.value) || 0 })}
                                                                    className="w-16 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                                />
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Days</span>
                                                            </div>
                                                        </div>

                                                        {/* Row 7: Allowed for genders */}
                                                        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-50 pt-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Gender eligibility</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Restrict this leave to a specific gender profile</p>
                                                            </div>
                                                            <select
                                                                value={ruleForm.applicableGender}
                                                                onChange={e => setRuleForm({ ...ruleForm, applicableGender: e.target.value })}
                                                                className="w-28 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer select-none"
                                                            >
                                                                <option value="All">All Genders</option>
                                                                <option value="Male">Male Only</option>
                                                                <option value="Female">Female Only</option>
                                                                <option value="Other">Other Only</option>
                                                            </select>
                                                        </div>

                                                        {/* Row 8: Maximum children limit */}
                                                        <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-50 pt-3">
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-bold text-slate-800">Maximum children limit</h4>
                                                                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Limit for parenting leaves (Maternity or Paternity policies)</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    placeholder="e.g. 2"
                                                                    value={ruleForm.maxChildrenLimit || ''}
                                                                    onChange={e => setRuleForm({ ...ruleForm, maxChildrenLimit: parseInt(e.target.value) || 0 })}
                                                                    className="w-16 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                                />
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kids</span>
                                                            </div>
                                                        </div>

                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Pane: Dynamic Rule Stack */}
                                <div className="flex-1 bg-slate-50/40 flex flex-col">
                                    <div className="flex-none h-14 px-8 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Active Matrix</h3>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                        <div className="space-y-3">
                                            {form.rules.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center mb-4">
                                                        <Plus size={24} strokeWidth={1.5} />
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-center max-w-[200px] leading-relaxed opacity-50">
                                                        Active Matrix is Empty
                                                    </p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center mt-2 px-4 py-1 bg-slate-100 rounded-full">
                                                        Fill Leave details & click "Add Rule" to list them here
                                                    </p>
                                                </div>
                                            ) : (
                                                (form.rules || []).map((r, i) => (
                                                    <div key={i} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex flex-col group animate-in slide-in-from-right-4 duration-300" style={{ borderLeft: `4px solid ${r.color || '#3b82f6'}` }}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-8">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[13px] font-black text-slate-900 leading-none uppercase">{r.leaveType}</span>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Leave Code</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[13px] font-black text-slate-900 leading-none">{r.totalPerYear} Days</span>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Annual Cap</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button type="button" onClick={() => editRule(i)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all" title="Edit Rule">
                                                                    <Edit2 size={15} />
                                                                </button>
                                                                <button type="button" onClick={() => removeRule(i)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all" title="Delete Rule">
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 mt-3 border-t border-slate-50 pt-2">
                                                            {r.accrualType === 'monthly' || r.monthlyAccrual ? (
                                                                <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Accrual ({r.monthlyAccrualRate || (r.totalPerYear/12).toFixed(2)}/mo)</span>
                                                            ) : (
                                                                <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Yearly</span>
                                                            )}
                                                            {r.carryForwardAllowed && (
                                                                <span className="text-[8px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">CF (Max: {r.maxCarryForward || 0})</span>
                                                            )}
                                                            {r.encashmentAllowed && (
                                                                <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Encashable</span>
                                                            )}
                                                            {r.allowDuringProbation ? (
                                                                <span className="text-[8px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Probation Ok</span>
                                                            ) : (
                                                                <span className="text-[8px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded uppercase tracking-wider">No Probation</span>
                                                            )}
                                                            {r.advanceNoticeDays > 0 && (
                                                                <span className="text-[8px] font-bold bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded uppercase tracking-wider">{r.advanceNoticeDays}d Notice</span>
                                                            )}
                                                            {r.halfDayAllowed && (
                                                                <span className="text-[8px] font-bold bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Half-day</span>
                                                            )}
                                                            {r.postFactoAllowed && (
                                                                <span className="text-[8px] font-bold bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Post-Facto ({r.maxPostFactoCount || 0})</span>
                                                            )}
                                                            {r.medicalCertRequiredAfterDays > 0 && (
                                                                <span className="text-[8px] font-bold bg-red-50 text-red-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Med Cert &gt;{r.medicalCertRequiredAfterDays}d</span>
                                                            )}
                                                            {r.applicableGender && r.applicableGender !== 'All' && (
                                                                <span className="text-[8px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">{r.applicableGender} only</span>
                                                            )}
                                                            {r.maxChildrenLimit > 0 && (
                                                                <span className="text-[8px] font-bold bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Max {r.maxChildrenLimit} Children</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Minimalist Bottom Footer */}
                        <div className="flex-none h-16 px-8 flex items-center justify-end gap-4 relative z-20 bg-white border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                            >
                                Discard Changes
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={clsx(
                                    "h-9 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-2",
                                    isSaving 
                                        ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none" 
                                        : "bg-slate-900 text-white hover:bg-black active:scale-95 shadow-slate-200"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} strokeWidth={3} />
                                        {editingId ? 'Push Update' : 'Finalize Policy'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
