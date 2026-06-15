import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Trash2, GripVertical, Settings2, Edit } from 'lucide-react';
import { Tag } from 'antd';

export default function DraggableField({ field, index, isSelected, onSelect, onDelete }) {

    // Exact styles from Step1/Step2 hardcoded forms
    const labelStyle = "text-slate-500 font-black uppercase text-[11px] tracking-[0.15em] mb-2 block";
    const inputStyle = "h-12 w-full rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 px-3 flex items-center text-sm truncate opacity-80 pointer-events-none";

    const getGridSpan = (width) => {
        switch (width) {
            case 'full': return 'md:col-span-2 lg:col-span-4';
            case 'half': return 'md:col-span-1 lg:col-span-2';
            case 'quarter': return 'md:col-span-1 lg:col-span-1';
            default: return 'md:col-span-2 lg:col-span-4';
        }
    };

    return (
        <Draggable draggableId={field.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`relative group ${getGridSpan(field.width)} transition-all duration-200 ${snapshot.isDragging ? 'z-50 shadow-2xl scale-105 rotate-1 opacity-90' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect();
                    }}
                >
                    <div className={`
                        relative bg-white p-4 rounded-2xl border-2 transition-all cursor-pointer h-full flex flex-col justify-between
                        ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-xl shadow-indigo-100' : 'border-slate-100 hover:border-slate-300 hover:shadow-lg hover:bg-slate-50'}
                    `}>
                        {/* Drag Handle - Moved to Left */}
                        <div {...provided.dragHandleProps} className="absolute left-3 top-3 p-1 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <GripVertical size={16} />
                        </div>

                        {/* Field Preview */}
                        <div className="space-y-2 pointer-events-none mt-2">
                            <label className={`${labelStyle} flex items-center gap-6`}>
                                <span className="ml-6">{field.label}</span> {field.required && <span className="text-red-500">*</span>}
                            </label>

                            {/* Input Mockup based on type */}
                            {field.fieldType === 'textarea' ? (
                                <div className={`${inputStyle} h-24 items-start pt-3 bg-slate-50`}>
                                    <span className="text-slate-400 italic font-mono text-xs">{field.placeholder || "Matches exact design..."}</span>
                                </div>
                            ) : field.fieldType === 'select' ? (
                                <div className={`${inputStyle} justify-between bg-white`}>
                                    <span className="text-slate-400 font-bold text-xs">{field.placeholder || "Select option"}</span>
                                    <span className="text-slate-300">▼</span>
                                </div>
                            ) : field.fieldType === 'file' ? (
                                <div className={`${inputStyle} justify-center bg-slate-100 border-dashed border-2 border-slate-300 text-slate-400`}>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Upload File Area</span>
                                </div>
                            ) : (
                                <div className={inputStyle}>
                                    <span className="text-slate-400 italic font-medium text-xs font-mono">{field.placeholder || "Enter value..."}</span>
                                </div>
                            )}
                        </div>

                        {/* Metadata Badges */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-50 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                            <Tag className="rounded-md bg-slate-100 border-none text-[9px] font-black uppercase text-slate-500">{field.fieldType}</Tag>
                            {field.width === 'full' && <Tag className="rounded-md bg-indigo-50 border-none text-[9px] font-black uppercase text-indigo-500">Full Width</Tag>}
                            {field.isSystem && <Tag className="rounded-md bg-amber-50 border-none text-[9px] font-black uppercase text-amber-600">Locked</Tag>}
                        </div>

                        {/* Actions Overlay - Explicit Right Position */}
                        {!snapshot.isDragging && (
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:text-red-700 transition shadow-sm border border-red-100"
                                    title="Delete Field"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
}
