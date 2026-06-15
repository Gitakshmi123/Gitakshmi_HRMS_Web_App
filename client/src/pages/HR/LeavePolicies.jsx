import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';
import api from '../../utils/api';
import {
    Plus, Trash2, Edit2, Save, X, Check,
    RefreshCw, FileText, Users, ShieldCheck, AlertCircle, ChevronDown,
    ToggleLeft, ToggleRight
} from 'lucide-react';
import { Can } from '../../components/rbac/PermissionGate';


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
        <div className={clsx(
            "bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group overflow-hidden",
            !p.isActive && "opacity-80 grayscale-[0.3]"
        )}>
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
            <div className="px-4 py-1.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
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
                                            className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer" 
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

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function LeavePolicies({ initialView = 'policies' }) {
    const [view, setView] = useState(initialView);
    
    useEffect(() => {
        setView(initialView);
    }, [initialView]);

    const [policies, setPolicies] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
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
        status: 'ACTIVE',
        applicableTo: 'All',
        specificEmployeeId: '',
        roles: [],
        departmentIds: [],
        gradeIds: [],
        gradeCodes: [],
        designations: [],
        applicableJobTypes: [],
        applicableBands: [],
        rules: []
    });

    const [ruleForm, setRuleForm] = useState({
        leaveType: '',
        totalPerYear: 0,
        monthlyAccrual: false,
        carryForwardAllowed: false,
        maxCarryForward: 0,
        requiresApproval: true,
        color: '#0f172a'
    });

    const [positions, setPositions] = useState([]);

    useEffect(() => {
        fetchPolicies();
        fetchEmployees();
        fetchMappings();
        fetchDepartments();
        fetchGrades();
        fetchPositions();
    }, []);

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

    const normalizeObjectIdList = (items = []) => (
        Array.isArray(items)
            ? items
                .map((item) => item?._id || item?.id || item)
                .filter(Boolean)
                .map((item) => item.toString())
            : []
    );

    const buildPolicyPayload = () => ({
        ...form,
        status: form.status || 'ACTIVE',
        specificEmployeeId: form.applicableTo === 'Specific' ? form.specificEmployeeId || '' : '',
        specificEmployeeIds: form.applicableTo === 'Specific' && form.specificEmployeeId ? [form.specificEmployeeId] : [],
        roles: form.applicableTo === 'Role' ? Array.from(new Set(form.roles || [])) : [],
        departmentIds: form.applicableTo === 'Department' ? normalizeObjectIdList(form.departmentIds) : [],
        gradeIds: form.applicableTo === 'Grade' ? (form.gradeIds || []) : [],
        gradeCodes: form.applicableTo === 'Grade' ? (form.gradeCodes || []) : [],
        designations: form.applicableTo === 'Designation' ? (form.designations || []) : [],
        applicableJobTypes: form.applicableTo === 'JobType' ? (form.applicableJobTypes || []) : [],
        applicableBands: ['Band', 'JobType'].includes(form.applicableTo) ? (form.applicableBands || []) : [],
        rules: (form.rules || []).map((rule) => ({
            ...rule,
            leaveType: String(rule.leaveType || '').trim().toUpperCase(),
            totalPerYear: Number(rule.totalPerYear) || 0
        }))
    });

    const handleEdit = (policy) => {
        setEditingId(policy._id || policy.id);
        setForm({
            ...policy,
            status: policy.status || (policy.isActive ? 'ACTIVE' : 'INACTIVE'),
            specificEmployeeId: policy.specificEmployeeId || policy.specificEmployeeIds?.[0]?._id || policy.specificEmployeeIds?.[0] || '',
            roles: Array.isArray(policy.roles) ? policy.roles : [],
            departmentIds: normalizeObjectIdList(policy.departmentIds),
            gradeIds: Array.isArray(policy.gradeIds) ? policy.gradeIds.map(id => id?._id || id) : [],
            gradeCodes: Array.isArray(policy.gradeCodes) ? policy.gradeCodes : [],
            designations: Array.isArray(policy.designations) ? policy.designations : [],
            applicableJobTypes: Array.isArray(policy.applicableJobTypes) ? policy.applicableJobTypes : [],
            applicableBands: Array.isArray(policy.applicableBands) ? policy.applicableBands : [],
            rules: Array.isArray(policy.rules) ? policy.rules : []
        });
        fetchGrades();
        setShowModal(true);
    };

    const handleCreateNew = () => {
        setEditingId(null);
        setForm({ 
            name: '', 
            status: 'ACTIVE', 
            applicableTo: 'All', 
            specificEmployeeId: '', 
            roles: [], 
            departmentIds: [], 
            gradeIds: [],
            gradeCodes: [],
            designations: [],
            applicableJobTypes: [],
            applicableBands: [],
            rules: [] 
        });
        setRuleForm({ leaveType: '', totalPerYear: 0, monthlyAccrual: false, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true, color: '#4F46E5' });
        fetchGrades();
        setShowModal(true);
    };

    const addRule = () => {
        if (!ruleForm.leaveType) return showToast('error', 'Validation Error', 'Leave Type required');
        setForm(prev => ({ ...prev, rules: [...prev.rules, { ...ruleForm }] }));
        setRuleForm({ leaveType: '', totalPerYear: 0, monthlyAccrual: false, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true, color: '#4F46E5' });
    };

    const removeRule = (idx) => {
        setForm(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== idx) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.rules.length === 0) {
            return showToast('error', 'Incomplete Policy', 'You must add at least one Leave Rule (like SL, CL) to the Active Matrix before finalizing.');
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
                            await api.put(`/hr/leave-policies/${editingId}`, payload);
                            showToast('success', 'Success', 'Policy updated successfully.');
                            setShowModal(false);
                            fetchPolicies();
                        } catch (err) {
                            showToast('error', 'Error', err.response?.data?.error || 'Failed to update policy');
                        }
                    }
                });
            } else {
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
                        {view !== 'custom' && (
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                Leave Policies
                            </h1>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {view !== 'custom' && (
                            <button
                                onClick={fetchPolicies}
                                className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:shadow-md"
                                title="Refresh Policies"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        )}
                        


                        {view !== 'custom' && (
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

            {/* ── View Content ────────────────────────────────────────── */}
            {!showModal && (
                <>
                {view === 'custom' ? (
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
                ) : (
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
                                        
                                        {/* Identity & Audience: One Line Layout */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Policy Identifier</label>
                                                <input
                                                    placeholder="Standard Policy"
                                                    value={form.name}
                                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                                    className="w-full h-11 bg-white border border-slate-100 rounded-xl px-4 text-xs font-bold placeholder:font-normal text-slate-700 outline-none focus:border-slate-900 transition-all shadow-inner uppercase"
                                                />
                                            </div>
                                            <div className="space-y-1">
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
                                                </select>
                                            </div>
                                        </div>

                                        {/* Dynamic Scope Selectors */}
                                        <div className="space-y-4">
                                            {form.applicableTo === 'Grade' && (
                                                <div className="bg-white p-5 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Select Applicable Grades</label>
                                                        <button type="button" onClick={fetchGrades} className="text-[8px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors">Refresh List</button>
                                                    </div>
                                                    <div className="space-y-6">
                                                        <div>
                                                            <div className="grid grid-cols-4 gap-1.5">
                                                                {[...new Set(mappings.map(m => m.gradeCode || m.gradeValue).filter(Boolean))].sort().map(g => (
                                                                    <label key={g} className={`flex items-center justify-center h-8 rounded-lg cursor-pointer transition-all text-[9px] font-black uppercase tracking-tight border ${form.gradeCodes?.includes(g) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 shadow-sm'}`}>
                                                                        <input type="checkbox" className="hidden" checked={form.gradeCodes?.includes(g)} onChange={e => {
                                                                            const codes = form.gradeCodes || [];
                                                                            if (e.target.checked) setForm({ ...form, gradeCodes: [...codes, g] });
                                                                            else setForm({ ...form, gradeCodes: codes.filter(c => c !== g) });
                                                                        }}/> Grade {g}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {form.applicableTo === 'Band' && (
                                                <div className="bg-white p-5 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4 block">Select Applicable Bands</label>
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        {[...new Set(mappings.map(m => m.band).filter(Boolean))].sort().map(b => (
                                                            <label key={b} className={`flex items-center justify-center h-8 rounded-lg cursor-pointer transition-all text-[9px] font-black uppercase tracking-tight border ${form.bands?.includes(b) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 shadow-sm'}`}>
                                                                <input type="checkbox" className="hidden" checked={form.bands?.includes(b)} onChange={e => {
                                                                    const bands = form.bands || [];
                                                                    if (e.target.checked) setForm({ ...form, bands: [...bands, b] });
                                                                    else setForm({ ...form, bands: bands.filter(v => v !== b) });
                                                                }}/> {b}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {form.applicableTo === 'Designation' && (
                                                <div className="bg-white p-5 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4 block">Select Designations</label>
                                                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                                        {positions.map(position => {
                                                            const d = position?.name || position?.title || position?.designation || position?.code || String(position);
                                                            return (
                                                            <label key={position?._id || d} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all border ${form.designations?.includes(d) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                                                                <input type="checkbox" className="hidden" checked={form.designations?.includes(d)} onChange={e => {
                                                                    const desigs = form.designations || [];
                                                                    if (e.target.checked) setForm({ ...form, designations: [...desigs, d] });
                                                                    else setForm({ ...form, designations: desigs.filter(v => v !== d) });
                                                                }}/>
                                                                <span className="text-[10px] font-black uppercase tracking-tight">{d}</span>
                                                            </label>
                                                        );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {form.applicableTo === 'Department' && (
                                                <div className="bg-white p-5 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4 block">Select Departments</label>
                                                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                                        {departments.map(d => (
                                                            <label key={d._id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all border ${form.departments?.includes(d._id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                                                                <input type="checkbox" className="hidden" checked={form.departments?.includes(d._id)} onChange={e => {
                                                                    const depts = form.departments || [];
                                                                    if (e.target.checked) setForm({ ...form, departments: [...depts, d._id] });
                                                                    else setForm({ ...form, departments: depts.filter(v => v !== d._id) });
                                                                }}/>
                                                                <span className="text-[10px] font-black uppercase tracking-tight">{d.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {form.applicableTo === 'Specific' && (
                                                <div className="bg-white p-5 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4 block">Select Specific Employees</label>
                                                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                                        {employees.map(e => (
                                                            <label key={e._id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all border ${form.specificEmployees?.includes(e._id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                                                                <input type="checkbox" className="hidden" checked={form.specificEmployees?.includes(e._id)} onChange={v => {
                                                                    const emps = form.specificEmployees || [];
                                                                    if (v.target.checked) setForm({ ...form, specificEmployees: [...emps, e._id] });
                                                                    else setForm({ ...form, specificEmployees: emps.filter(id => id !== e._id) });
                                                                }}/>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase tracking-tight">{e.firstName} {e.lastName}</span>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{e.employeeId}</span>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Leave Type Configurator */}
                                        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Policy Ruleset</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Leave Code</label>
                                                    <input placeholder="SL" value={ruleForm.leaveType} onChange={e => setRuleForm({ ...ruleForm, leaveType: e.target.value })}
                                                        className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Annual Credit</label>
                                                    <input type="number" placeholder="0" value={ruleForm.totalPerYear} onChange={e => setRuleForm({ ...ruleForm, totalPerYear: parseInt(e.target.value) || 0 })}
                                                        className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Visual Tag</label>
                                                <div className="flex items-center gap-3">
                                                    <input type="color" value={ruleForm.color} onChange={e => setRuleForm({ ...ruleForm, color: e.target.value })}
                                                        className="w-full h-10 rounded-xl border border-slate-100 overflow-hidden cursor-pointer bg-white"
                                                    />
                                                    <button type="button" onClick={addRule} className="h-10 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-black transition-all flex items-center gap-2">
                                                        <Plus size={16} strokeWidth={3} /> Add
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-2 flex items-center gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input type="checkbox" checked={ruleForm.monthlyAccrual} onChange={e => setRuleForm({ ...ruleForm, monthlyAccrual: e.target.checked })} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Accrual</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="checkbox" checked={ruleForm.carryForwardAllowed} onChange={e => setRuleForm({ ...ruleForm, carryForwardAllowed: e.target.checked })} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Carry-In</span>
                                                    </label>
                                                    {ruleForm.carryForwardAllowed && (
                                                        <input type="number" placeholder="Cap" value={ruleForm.maxCarryForward} onChange={e => setRuleForm({ ...ruleForm, maxCarryForward: parseInt(e.target.value) || 0 })}
                                                            className="w-16 h-7 bg-white border border-slate-200 rounded px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-500 animate-in zoom-in-95"
                                                        />
                                                    )}
                                                </div>
                                            </div>
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
                                                        Fill Leave details & click "Add" to list them here
                                                    </p>
                                                </div>
                                            ) : (
                                                (form.rules || []).map((r, i) => (
                                                    <div key={i} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex items-center justify-between group animate-in slide-in-from-right-4 duration-300" style={{ borderLeft: `4px solid ${r.color}` }}>
                                                        <div className="flex items-center gap-8">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-black text-slate-900 leading-none uppercase">{r.leaveType}</span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Leave Code</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-black text-slate-900 leading-none">{r.totalPerYear} Days</span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Annual Cap</span>
                                                            </div>
                                                            <div className="flex gap-1.5">
                                                                {r.monthlyAccrual && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Accrual Enabled" />}
                                                                {r.carryForwardAllowed && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Carry Forward Enabled" />}
                                                            </div>
                                                        </div>
                                                        <button type="button" onClick={() => removeRule(i)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                                            <Trash2 size={16} />
                                                        </button>
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
                                className="h-9 px-8 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all transform active:scale-95 flex items-center gap-2"
                            >
                                <Save size={14} strokeWidth={3} />
                                {editingId ? 'Push Update' : 'Finalize Policy'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
