import React from 'react';
import { GripVertical, Trash2, Plus, CreditCard } from 'lucide-react';

export default function ApplyLayerPanel({
    sections,
    selectedSectionId,
    onSelectSection,
    onReorder,
    onRemoveSection,
    onAddSection,
    canCreate = false,
    canReorder = false,
    canDelete = false
}) {

    // Simple drag and drop logic
    const handleDragStart = (e, index) => {
        e.dataTransfer.setData('text/plain', index);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // allow drop
    };

    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        if (!canReorder) return;
        const fromIndex = Number(e.dataTransfer.getData('text/plain'));
        if (fromIndex !== toIndex) {
            onReorder(fromIndex, toIndex);
        }
    };

    return (
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 z-30">
            <div className="p-4 border-b border-gray-100">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Form Sections</h2>
                <p className="text-[10px] text-gray-400">Reorder application steps</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {/* Hero / Banner Section (Special - Fixed at Top) */}
                <div
                    onClick={() => onSelectSection('hero')}
                    className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedSectionId === 'hero'
                        ? 'bg-blue-50 border-blue-200 shadow-sm'
                        : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50'
                        }`}
                >
                    <div className="text-blue-500">
                        <CreditCard size={14} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <span className={`block text-xs font-black truncate ${selectedSectionId === 'hero' ? 'text-blue-700' : 'text-gray-700'}`}>
                            HERO SECTION
                        </span>
                        <span className="text-[10px] text-gray-400 italic">Custom banner props</span>
                    </div>
                </div>

                <div className="h-px bg-gray-100 mx-2 my-2"></div>

                {sections.map((section, index) => (
                    <div
                        key={section.id}
                        draggable={canReorder}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => onSelectSection(section.id)}
                        className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${selectedSectionId === section.id
                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                            : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50'
                            }`}
                    >
                        <div className={`text-gray-300 ${canReorder ? 'group-hover:text-gray-400 cursor-grab active:cursor-grabbing' : 'cursor-default opacity-40'}`}>
                            <GripVertical size={14} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <span className={`block text-xs font-bold truncate ${selectedSectionId === section.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                {section.title}
                            </span>
                            <span className="text-[10px] text-gray-400">{section.fields?.length || 0} fields</span>
                        </div>

                        {!section.fixed && canDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveSection(section.id); }}
                                className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {canCreate && (
                    <button
                        onClick={() => onAddSection('group')}
                        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={14} />
                        Add Section
                    </button>
                )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                    <GripVertical size={12} />
                    <span>Drag handle to reorder sections</span>
                </div>
            </div>
        </div>
    );
}
