import React, { useRef, useState } from 'react';
import { Settings, Plus, X, GripVertical } from 'lucide-react';

export default function ApplyEditorPanel({ config, selectedSectionId, onUpdateSection, previewMode, setPreviewMode, canCreate = false, canEdit = false, canDelete = false }) {
    const canModify = canCreate || canEdit;
    const fieldCounterRef = useRef(0);
    const [draggedFieldIndex, setDraggedFieldIndex] = useState(null);
    const [dragOverFieldIndex, setDragOverFieldIndex] = useState(null);

    const handleReorderFields = (draggedIndex, targetIndex) => {
        if (draggedIndex === targetIndex) return;
        const reorderedFields = [...(currentSection.fields || [])];
        const [movedField] = reorderedFields.splice(draggedIndex, 1);
        reorderedFields.splice(targetIndex, 0, movedField);
        onUpdateSection(selectedSectionId, { fields: reorderedFields });
    };

    const getButtonStyle = (mode) => {
        const isActive = previewMode === mode;
        return {
            height: '38px',
            padding: '0 20px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: isActive ? '#4A5DFF' : '#ffffff',
            color: isActive ? '#ffffff' : '#333333',
            border: isActive ? '1px solid #4A5DFF' : '1px solid #E0E0E0',
        };
    };

    // Find the currently selected section
    const currentSection = config.sections.find(s => s.id === selectedSectionId);

    const renderPreviewSwitcher = () => (
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Preview Mode</label>
            <div className="flex items-center gap-[12px]">
                <button
                    style={getButtonStyle('desktop')}
                    onClick={() => setPreviewMode('desktop')}
                >
                    Desktop Preview
                </button>
                <button
                    style={getButtonStyle('mobile')}
                    onClick={() => setPreviewMode('mobile')}
                >
                    Mobile Preview
                </button>
            </div>
        </div>
    );

    if (!canModify) {
        return (
            <div className="w-80 bg-white border-l border-gray-200 p-8 flex flex-col items-center justify-center text-center shrink-0">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                    <Settings size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Read Only / Delete Mode</h3>
                <p className="text-xs text-gray-500">Section editing disabled chhe. Left panel thi j available actions karsho.</p>
            </div>
        );
    }

    // SPECIAL CASE: Hero Section
    if (selectedSectionId === 'hero') {
        const banner = config.banner || {};
        return (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 h-full overflow-hidden text-gray-800 font-sans z-30 shadow-xl">
                {renderPreviewSwitcher()}
                <div className="px-6 py-5 border-b border-gray-100 bg-white">
                    <h2 className="text-sm font-black text-gray-900 tracking-tight text-blue-600">Hero Section</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Banner Customization</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Section Heading */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section Heading (Title)</label>
                        <input
                            type="text"
                            value={banner.title || ''}
                            onChange={(e) => onUpdateSection('hero', { title: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="e.g. Join Our Amazing Team"
                        />
                    </div>

                    {/* Headline Text */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Headline Text (Subtitle)</label>
                        <textarea
                            value={banner.subtitle || ''}
                            onChange={(e) => onUpdateSection('hero', { subtitle: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all h-24 resize-none"
                            placeholder="Innovate, grow, and build the future with us."
                        />
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Background Style */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Background Style</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                            <button
                                onClick={() => onUpdateSection('hero', { bgType: 'gradient' })}
                                className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${banner.bgType !== 'image' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                            >
                                Gradient
                            </button>
                            <button
                                onClick={() => onUpdateSection('hero', { bgType: 'image' })}
                                className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${banner.bgType === 'image' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                            >
                                Image
                            </button>
                        </div>

                        {banner.bgType === 'image' ? (
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Image URL</label>
                                <input
                                    type="text"
                                    value={banner.bgImage || ''}
                                    onChange={(e) => onUpdateSection('hero', { bgImage: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-blue-500 outline-none"
                                    placeholder="https://images.unsplash.com/..."
                                />
                                <p className="text-[9px] text-gray-400 italic">Enter a direct image link for the banner background.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Tailwind Gradient Classes</label>
                                <input
                                    type="text"
                                    value={banner.bgColor || ''}
                                    onChange={(e) => onUpdateSection('hero', { bgColor: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-mono focus:border-blue-500 outline-none"
                                    placeholder="from-blue-600 to-purple-600"
                                />
                                <div className="grid grid-cols-4 gap-2">
                                    {['from-blue-600 to-indigo-700', 'from-purple-600 to-pink-500', 'from-emerald-500 to-indigo-700', 'from-slate-800 to-slate-900'].map(g => (
                                        <div
                                            key={g}
                                            onClick={() => onUpdateSection('hero', { bgColor: g })}
                                            className={`h-8 rounded-lg cursor-pointer border-2 bg-gradient-to-r ${g} ${banner.bgColor === g ? 'border-white ring-2 ring-blue-400' : 'border-transparent'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (!selectedSectionId || !currentSection) {
        return (
            <div className="w-80 bg-white border-l border-gray-200 p-8 flex flex-col items-center justify-center text-center shrink-0">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                    <Settings size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">No Section Selected</h3>
                <p className="text-xs text-gray-500">Select a section from the left or click on the preview to edit properties.</p>
            </div>
        );
    }

    const handleAddField = () => {
        fieldCounterRef.current += 1;
        const newField = {
            id: `field_${selectedSectionId || 'section'}_${fieldCounterRef.current}`,
            label: "New Field",
            type: "text",
            required: false,
            width: "full",
            placeholder: "",
            helpText: ""
        };
        const updatedFields = [...(currentSection.fields || []), newField];
        onUpdateSection(selectedSectionId, { fields: updatedFields });
    };

    const updateField = (fieldId, updates) => {
        const updatedFields = currentSection.fields.map(f =>
            f.id === fieldId ? { ...f, ...updates } : f
        );
        onUpdateSection(selectedSectionId, { fields: updatedFields });
    };

    const removeField = (fieldId) => {
        const updatedFields = currentSection.fields.filter(f => f.id !== fieldId);
        onUpdateSection(selectedSectionId, { fields: updatedFields });
    };

    return (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 h-full overflow-hidden text-gray-800 font-sans z-30 shadow-xl">
            {renderPreviewSwitcher()}
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
                <div>
                    <h2 className="text-sm font-black text-gray-900 tracking-tight">Edit Section</h2>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Properties</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Section Title */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section Title</label>
                    <input
                        type="text"
                        value={currentSection.title}
                        onChange={(e) => onUpdateSection(selectedSectionId, { title: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>

                <div className="h-px bg-gray-100"></div>

                {/* Fields List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fields</label>
                        {canCreate && (
                            <button
                                onClick={handleAddField}
                                className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100 transition flex items-center gap-1"
                            >
                                <Plus size={12} /> Add Field
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {currentSection.fields?.map((field, idx) => (
                            <div 
                                key={field.id || idx} 
                                draggable={canEdit}
                                onDragStart={(e) => {
                                    setDraggedFieldIndex(idx);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                }}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    setDragOverFieldIndex(idx);
                                }}
                                onDragLeave={() => {}}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedFieldIndex !== null) {
                                        handleReorderFields(draggedFieldIndex, idx);
                                    }
                                    setDraggedFieldIndex(null);
                                    setDragOverFieldIndex(null);
                                }}
                                onDragEnd={() => {
                                    setDraggedFieldIndex(null);
                                    setDragOverFieldIndex(null);
                                }}
                                className={`bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4 group hover:border-blue-300 hover:shadow-md transition-all relative ${
                                    draggedFieldIndex === idx ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/20' : ''
                                } ${
                                    dragOverFieldIndex === idx && draggedFieldIndex !== idx ? 'border-t-4 border-t-blue-500 scale-[1.01]' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        {canEdit && (
                                            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                                                <GripVertical size={14} />
                                            </div>
                                        )}
                                        <span className="text-xs font-bold text-gray-400">Field #{idx + 1}</span>
                                    </div>
                                    {canDelete && (
                                        <button onClick={() => removeField(field.id)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                                    )}
                                </div>

                                {/* ID Row */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between">
                                        System ID <span className="text-[9px] text-blue-500 normal-case">(fatherName, dob, mobile)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={field.id}
                                        onChange={(e) => updateField(field.id, { id: e.target.value })}
                                        className="w-full bg-slate-100 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-600 focus:border-blue-500 outline-none"
                                        placeholder="system_key"
                                    />
                                </div>

                                {/* Label & Type Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Label</label>
                                        <input
                                            type="text"
                                            value={field.label}
                                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Type</label>
                                        <select
                                            value={field.type}
                                            onChange={(e) => updateField(field.id, { type: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-blue-500 outline-none"
                                        >
                                            <option value="text">Text Input</option>
                                            <option value="textarea">Text Area</option>
                                            <option value="email">Email</option>
                                            <option value="tel">Phone</option>
                                            <option value="file">File Upload</option>
                                            <option value="image">Image Upload</option>
                                            <option value="select">Dropdown</option>
                                            <option value="date">Date</option>
                                            <option value="url">URL</option>
                                            <option value="tags">Tags (Multi-value)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Width & Required Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Width</label>
                                        <select
                                            value={field.width}
                                            onChange={(e) => updateField(field.id, { width: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-blue-500 outline-none"
                                        >
                                            <option value="full">Full Width</option>
                                            <option value="half">Half (1/2)</option>
                                            <option value="third">Third (1/3)</option>
                                            <option value="quarter">Quarter (1/4)</option>
                                            <option value="fifth">Fifth (1/5)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <span className="text-xs font-bold text-gray-600">Required</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Placeholder */}
                                {['text', 'email', 'tel', 'url', 'textarea'].includes(field.type) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Placeholder</label>
                                        <input
                                            type="text"
                                            value={field.placeholder || ''}
                                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-blue-500 outline-none"
                                            placeholder="e.g. Enter your name..."
                                        />
                                    </div>
                                )}

                                {field.type === 'image' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Help Text</label>
                                        <input
                                            type="text"
                                            value={field.helpText || ''}
                                            onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-blue-500 outline-none"
                                            placeholder="PNG, JPG, JPEG or WEBP up to 5MB"
                                        />
                                    </div>
                                )}

                                {/* Options for Select */}
                                {field.type === 'select' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Options (comma separated)</label>
                                        <input
                                            type="text"
                                            value={field.options?.join(', ') || ''}
                                            onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:border-blue-500 outline-none"
                                            placeholder="Option A, Option B, Option C"
                                        />
                                    </div>
                                )}

                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
