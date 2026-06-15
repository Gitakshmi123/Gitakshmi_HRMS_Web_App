import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

const COMMON_CRITERIA = [
    "Technical Skills", "Communication", "Problem Solving", "Cultural Fit", "Leadership", "Teamwork"
];

export default function FeedbackConfigModal({ isOpen, onClose, onSave, initialCriteria = [] }) {
    const [criteria, setCriteria] = useState([]);
    const [newItem, setNewItem] = useState("");

    useEffect(() => {
        if (isOpen) {
            setCriteria(initialCriteria || []);
        }
    }, [isOpen]);

    const handleAdd = () => {
        if (newItem.trim() && !criteria.includes(newItem.trim())) {
            setCriteria([...criteria, newItem.trim()]);
            setNewItem("");
        }
    };

    const handleRemove = (item) => {
        setCriteria(criteria.filter(c => c !== item));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Feedback Criteria</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="mb-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Quick Add</label>
                    <div className="flex flex-wrap gap-2">
                        {COMMON_CRITERIA.map(c => (
                            <button key={c} onClick={() => !criteria.includes(c) && setCriteria([...criteria, c])}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${criteria.includes(c) ? 'bg-indigo-50 border-indigo-200 text-indigo-600 opacity-50 cursor-default' : 'bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                    {criteria.map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                            <span className="text-sm font-medium text-slate-700">{c}</span>
                            <button onClick={() => handleRemove(c)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    {criteria.length === 0 && <div className="text-center py-8 text-slate-400 text-sm italic">No criteria added yet.</div>}
                </div>

                <div className="flex gap-2 mb-6">
                    <input
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="Type custom criteria..."
                        className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <button onClick={handleAdd} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors"><Plus size={20} /></button>
                </div>

                <button onClick={() => onSave(criteria)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                    <Check size={18} /> Save Configuration
                </button>
            </div>
        </div>
    );
}
