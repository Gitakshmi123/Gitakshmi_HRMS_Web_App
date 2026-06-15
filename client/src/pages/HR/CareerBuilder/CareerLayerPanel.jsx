import React from 'react';
import { GripVertical, Trash2, Settings } from 'lucide-react';

export default function CareerLayerPanel({ sections, selectedBlockId, onSelectBlock, onReorder, onRemoveBlock, canReorder = false, canDelete = false }) {

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
        <div className="flex flex-col h-full bg-white border-r border-gray-100 w-72">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Navigation</h3>
                <span className="text-xs font-bold text-gray-400">{sections.length} Sections</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {/* Global Page Settings Item */}
                <div
                    onClick={() => onSelectBlock('global-branding')}
                    className={`
                        group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none mb-2
                        ${selectedBlockId === 'global-branding' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50'}
                    `}
                >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                        <Settings size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${selectedBlockId === 'global-branding' ? 'text-blue-700' : 'text-gray-700'}`}>
                            Page Branding & Header
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Global Settings</p>
                    </div>
                </div>

                <div className="h-px bg-gray-100 my-2"></div>

                {sections.map((section, index) => {
                    const isSelected = selectedBlockId === section.id;
                    return (
                        <div
                            key={section.id}
                            draggable={canReorder}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            onClick={() => onSelectBlock(section.id)}
                            className={`
                                group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none
                                ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'}
                            `}
                        >
                            <div className={`text-gray-300 ${canReorder ? 'cursor-grab active:cursor-grabbing hover:text-gray-500' : 'cursor-default opacity-40'}`}>
                                <GripVertical size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {section.content?.title || section.type}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{section.type}</p>
                            </div>

                            {canDelete && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemoveBlock(section.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remove Section"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {sections.length === 0 && (
                    <div className="text-center py-10 px-4 border-2 border-dashed border-gray-100 rounded-xl">
                        <p className="text-xs text-gray-400 font-medium">No sections added.</p>
                        <p className="text-[10px] text-gray-300 mt-1">Add a section from the top-right menu.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
