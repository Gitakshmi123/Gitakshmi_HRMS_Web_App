import React, { useState, useEffect } from 'react';
import { PackageCheck, Plus, Trash2, Check, X, Save, ArrowRight } from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

/**
 * HR asset clearance panel — shown when stage === 'Asset Clearance'.
 * HR can check off returned assets, add custom items, and advance stage.
 */
export default function AssetClearancePanel({ request, onUpdate }) {
    const [checklist, setChecklist] = useState([]);
    const [assetRemarks, setAssetRemarks] = useState(request.assetRemarks || '');
    const [newItem, setNewItem]     = useState('');
    const [saving, setSaving]       = useState(false);
    const [advancing, setAdvancing] = useState(false);

    useEffect(() => {
        if (request.assetChecklist?.length) {
            setChecklist(request.assetChecklist.map(a => ({ ...a })));
        }
    }, [request._id]); // eslint-disable-line

    const allReturned = checklist.length > 0 && checklist.every(c => c.returned);
    const returnedCount = checklist.filter(c => c.returned).length;

    const toggle = (idx) => {
        setChecklist(prev => prev.map((item, i) =>
            i === idx ? { ...item, returned: !item.returned } : item
        ));
    };

    const addItem = () => {
        const trimmed = newItem.trim();
        if (!trimmed) return;
        setChecklist(prev => [...prev, { item: trimmed, returned: false }]);
        setNewItem('');
    };

    const removeItem = (idx) => {
        setChecklist(prev => prev.filter((_, i) => i !== idx));
    };

    const saveChecklist = async (advance = false) => {
        const setter = advance ? setAdvancing : setSaving;
        try {
            setter(true);
            await exitAPI.updateAssets(request._id, { checklist, assetRemarks });
            toast.success('Asset checklist saved.');
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to save checklist.');
        } finally {
            setter(false);
        }
    };

    if (request.stage !== 'Clearance') return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                        <PackageCheck size={17} className="text-orange-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Asset Clearance</h3>
                        <p className="text-xs text-slate-500">{returnedCount} / {checklist.length} items returned</p>
                    </div>
                </div>
                {/* Progress ring indicator */}
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 relative">
                        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                                className="text-slate-100 dark:text-slate-800" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                                className="text-orange-500 transition-all duration-500"
                                strokeWidth="3"
                                strokeDasharray={`${checklist.length > 0 ? (returnedCount / checklist.length) * 100 : 0} 100`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {checklist.length > 0 ? Math.round((returnedCount / checklist.length) * 100) : 0}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* Checklist items */}
                <div className="space-y-2">
                    {checklist.map((asset, idx) => (
                        <div
                            key={idx}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
                                ${asset.returned
                                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            <button
                                onClick={() => toggle(idx)}
                                className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center border-2 transition-all
                                    ${asset.returned
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-300 dark:border-slate-600 hover:border-orange-400'
                                    }`}
                            >
                                {asset.returned && <Check size={13} strokeWidth={3} />}
                            </button>

                            <span className={`flex-1 text-sm font-medium
                                ${asset.returned
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                {asset.item}
                            </span>

                            {asset.returned ? (
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Check size={11} strokeWidth={3} /> Returned
                                </span>
                            ) : (
                                <span className="text-xs text-slate-400">Pending</span>
                            )}

                            <button
                                onClick={() => removeItem(idx)}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add custom item */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addItem()}
                        placeholder="Add custom asset..."
                        className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                    <button
                        onClick={addItem}
                        disabled={!newItem.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-40"
                    >
                        <Plus size={14} /> Add
                    </button>
                </div>

                {/* Remarks */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Asset Remarks (optional)
                    </label>
                    <textarea
                        rows={2}
                        value={assetRemarks}
                        onChange={e => setAssetRemarks(e.target.value)}
                        placeholder="Notes about asset condition, damages, etc."
                        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                    />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap pt-1">
                    <button
                        onClick={() => saveChecklist(false)}
                        disabled={saving || advancing}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                        <Save size={14} /> Save Progress
                    </button>

                    <button
                        onClick={() => saveChecklist(true)}
                        disabled={!allReturned || saving || advancing}
                        title={!allReturned ? 'Mark all assets as returned first' : ''}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm shadow-orange-500/30 disabled:opacity-50 transition-colors"
                    >
                        <ArrowRight size={14} />
                        {advancing ? 'Saving...' : 'Save — All Assets Cleared'}
                    </button>
                </div>

                {!allReturned && checklist.length > 0 && (
                    <p className="text-[11px] text-slate-400">
                        Mark all {checklist.length} items as returned to advance to Exit Interview.
                    </p>
                )}
            </div>
        </div>
    );
}
