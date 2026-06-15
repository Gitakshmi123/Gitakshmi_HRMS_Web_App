import React from 'react';
import {
    GripVertical, Trash2, Copy, MoveUp, MoveDown,
    Type, Building2, User, FileText, Minus, Square,
    Plus, Layers, Image as ImageIcon
} from 'lucide-react';

export default function BuilderLayerPanel({ sections, selectedId, onSelect, onAdd, onRemove, onMove, onDuplicate }) {
    const componentTypes = [
        { type: 'company-header', label: 'Company Header', icon: Building2 },
        { type: 'text', label: 'Text Block', icon: Type },
        { type: 'employee-details-grid', label: 'Details Grid', icon: User },
        { type: 'document-footer', label: 'Doc Footer', icon: FileText },
        { type: 'image', label: 'Custom Image', icon: ImageIcon },
        { type: 'divider', label: 'Divider Line', icon: Minus },
        { type: 'spacer', label: 'Vertical Spacer', icon: Square },
    ];

    return (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Component Library */}
            <div className="p-6 border-b border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Component Library</h3>
                <div className="grid grid-cols-2 gap-3">
                    {componentTypes.map(comp => (
                        <button
                            key={comp.type}
                            onClick={() => onAdd(comp.type)}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                                <comp.icon size={20} />
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-slate-800">{comp.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Canvas Layers */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Document Structure</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-lg">{sections.length} Layers</span>
                </div>

                <div className="space-y-2">
                    {sections.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                            <Layers size={32} className="text-slate-300 mb-3" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Your canvas is empty.<br />Add a component to start.
                            </p>
                        </div>
                    ) : (
                        sections.map((section, index) => {
                            const isSelected = selectedId === section.id;
                            const Icon = componentTypes.find(c => c.type === section.type)?.icon || Type;

                            return (
                                <div
                                    key={section.id}
                                    onClick={() => onSelect(section.id)}
                                    className={`
                                        group flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer
                                        ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'}
                                    `}
                                >
                                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                        <Icon size={16} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[10px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                            {section.type.replace(/-/g, ' ')}
                                        </p>
                                        <p className={`text-[9px] font-medium truncate ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                                            Section {index + 1}
                                        </p>
                                    </div>

                                    <div className={`flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMove(section.id, 'up'); }}
                                            disabled={index === 0}
                                            className={`p-1 rounded-md transition-all ${isSelected ? 'hover:bg-white/20 text-white disabled:opacity-20' : 'hover:bg-slate-100 text-slate-400'}`}
                                        >
                                            <MoveUp size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMove(section.id, 'down'); }}
                                            disabled={index === sections.length - 1}
                                            className={`p-1 rounded-md transition-all ${isSelected ? 'hover:bg-white/20 text-white disabled:opacity-20' : 'hover:bg-slate-100 text-slate-400'}`}
                                        >
                                            <MoveDown size={12} />
                                        </button>
                                        <div className={`w-px h-4 mx-1 ${isSelected ? 'bg-white/20' : 'bg-slate-100'}`}></div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRemove(section.id); }}
                                            className={`p-1 rounded-md transition-all ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
