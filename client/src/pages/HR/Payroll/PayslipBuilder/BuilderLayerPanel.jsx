import React from 'react';
import { GripVertical, Trash2, Copy, MoveUp, MoveDown, Layers, Box, Settings2 } from 'lucide-react';

export default function BuilderLayerPanel({ config, selectedBlockId, onSelectBlock, onMove, onRemove, onDuplicate }) {
    // Safety Check
    if (!config || !config.sections || !Array.isArray(config.sections)) {
        console.warn('BuilderLayerPanel: config.sections is invalid', { config });
        return <div className="flex-1 bg-white border-r border-gray-100 p-4 text-red-500">Config Error</div>;
    }

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-100 w-72 shrink-0">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Outline</h3>
                </div>
                <span className="text-xs font-bold text-gray-400">{config.sections.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {config.sections.map((section, index) => {
                    const isSelected = selectedBlockId === section.id;
                    const blockName = getBlockName(section.type);

                    return (
                        <div
                            key={section.id}
                            onClick={() => onSelectBlock(section.id)}
                            className={`
                                group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none
                                ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'}
                            `}
                        >
                            <div className="text-gray-300 group-hover:text-gray-500">
                                <Box size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {blockName}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{section.type}</p>
                            </div>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMove(section.id, 'up'); }}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30"
                                >
                                    <MoveUp size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMove(section.id, 'down'); }}
                                    disabled={index === config.sections.length - 1}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30"
                                >
                                    <MoveDown size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDuplicate(section.id); }}
                                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-white rounded"
                                >
                                    <Copy size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(section.id); }}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {config.sections.length === 0 && (
                    <div className="text-center py-10 px-4 border-2 border-dashed border-gray-100 rounded-xl">
                        <p className="text-xs text-gray-400 font-medium">Your template is empty.</p>
                        <p className="text-[10px] text-gray-300 mt-1">Add components from the right panel.</p>
                    </div>
                )}
            </div>

            {/* Page Settings Button */}
            <div className="p-4 border-t border-gray-50">
                <button
                    onClick={() => onSelectBlock('page-settings')}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedBlockId === 'page-settings' ? 'bg-gray-100 border-gray-200 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
                >
                    <Settings2 size={16} className="text-gray-500" />
                    <span className="text-sm font-bold text-gray-700">Page Settings</span>
                </button>
            </div>
        </div>
    );
}

function getBlockName(type) {
    const names = {
        'text': 'Text Block',
        'heading': 'Heading',
        'divider': 'Divider Line',
        'image': 'Image / Logo',
        'spacer': 'Vertical Space',
        'row': 'Multi-column Row',
        'company-header': 'Company Header',
        'payslip-title': 'Payslip Title',
        'employee-details-grid': 'Employee Info Grid',
        'earnings-table': 'Earnings Table',
        'deductions-table': 'Deductions Table',
        'net-pay-box': 'Net Salary Box'
    };
    return names[type] || type;
}
