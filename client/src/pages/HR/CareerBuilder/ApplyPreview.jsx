import React, { useState } from 'react';
import { UploadCloud, ChevronDown, User, MapPin, Briefcase, GripVertical } from 'lucide-react';

export default function ApplyPreview({ config, selectedSectionId, onSelectSection, previewMode = 'desktop', onUpdateSection }) {
    const isMobileView = previewMode === 'mobile';
    const [draggedFieldId, setDraggedFieldId] = useState(null);
    const [dragOverFieldId, setDragOverFieldId] = useState(null);

    // Helper to calculate grid span based on width prop
    const getGridSpan = (width) => {
        switch (width) {
            case 'full': return 60;
            case 'half': return 30;
            case 'third': return 20;
            case 'quarter': return 15;
            case 'fifth': return 12;
            default: return 60;
        }
    };

    const handleReorderFields = (sectionId, draggedId, targetId) => {
        const section = config.sections.find(s => s.id === sectionId);
        if (!section || !section.fields) return;

        const fields = [...section.fields];
        const draggedIndex = fields.findIndex(f => f.id === draggedId);
        const targetIndex = fields.findIndex(f => f.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

        const [movedField] = fields.splice(draggedIndex, 1);
        fields.splice(targetIndex, 0, movedField);

        if (onUpdateSection) {
            onUpdateSection(sectionId, { fields });
        }
    };

    return (
        <div className={`bg-white flex flex-col ${isMobileView ? 'min-h-full w-full' : 'rounded-[2rem] shadow-2xl min-h-[800px] border border-gray-100 overflow-hidden'}`}>

            {/* 1. Header / Banner Area */}
            <div
                onClick={() => onSelectSection('hero')}
                className={`h-48 w-full relative cursor-pointer group transition-all duration-300 ${selectedSectionId === 'hero' ? 'ring-4 ring-blue-500 ring-inset ring-offset-0 z-20 shadow-2xl' : ''}`}
                style={config.banner?.bgType === 'image' ? {
                    backgroundImage: `url(${config.banner.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                } : {}}
            >
                {config.banner?.bgType !== 'image' && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${config.banner?.bgColor || 'from-blue-600 to-purple-600'}`}></div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>

                <div className="absolute bottom-0 left-0 w-full p-8 text-white">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider mb-3 inline-block">
                        Engineering
                    </span>
                    <h1 className="text-3xl font-black mb-1">{config.banner?.title || 'Senior Frontend Engineer'}</h1>
                    <p className="text-sm font-medium opacity-90 max-w-lg line-clamp-2">
                        {config.banner?.subtitle || 'Remote • Full-time • Join our growing team in building the next generation of HR technology.'}
                    </p>
                </div>

                {selectedSectionId === 'hero' && (
                    <div className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                        Hero Section
                    </div>
                )}
            </div>

            {/* 2. Form Content */}
            <div className="p-8 space-y-8 bg-gray-50/50 flex-1">
                {config.sections.map((section) => (
                    <div
                        key={section.id}
                        onClick={() => onSelectSection(section.id)}
                        className={`bg-white rounded-2xl p-6 border transition-all duration-300 relative group
                            ${selectedSectionId === section.id
                                ? 'border-blue-500 shadow-lg ring-4 ring-blue-500/10'
                                : 'border-gray-100 shadow-sm hover:border-blue-200'
                            }`}
                    >
                        {/* Selected Indicator */}
                        {selectedSectionId === section.id && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl rounded-tr-xl">
                                Editing
                            </div>
                        )}

                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                            {section.title}
                        </h3>

                        <div className="apply-form-grid gap-5">
                            {section.fields?.map((field) => {
                                const isEditing = selectedSectionId === section.id;
                                const fieldSpan = isMobileView ? 60 : getGridSpan(field.width);
                                return (
                                    <div 
                                        key={field.id} 
                                        style={{ '--apply-field-span': fieldSpan }}
                                        draggable={isEditing}
                                        onDragStart={(e) => {
                                            if (!isEditing) return;
                                            setDraggedFieldId(field.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.stopPropagation();
                                        }}
                                        onDragOver={(e) => {
                                            if (!isEditing) return;
                                            e.preventDefault();
                                        }}
                                        onDragEnter={(e) => {
                                            if (!isEditing) return;
                                            e.preventDefault();
                                            setDragOverFieldId(field.id);
                                        }}
                                        onDragLeave={() => {}}
                                        onDrop={(e) => {
                                            if (!isEditing) return;
                                            e.preventDefault();
                                            if (draggedFieldId && draggedFieldId !== field.id) {
                                                handleReorderFields(section.id, draggedFieldId, field.id);
                                            }
                                            setDraggedFieldId(null);
                                            setDragOverFieldId(null);
                                        }}
                                        onDragEnd={() => {
                                            setDraggedFieldId(null);
                                            setDragOverFieldId(null);
                                        }}
                                        className={`apply-form-field transition-all duration-200 ${
                                            isEditing ? 'relative cursor-grab active:cursor-grabbing hover:bg-blue-50/40 rounded-xl p-1 -m-1 border border-transparent hover:border-blue-200' : ''
                                        } ${
                                            draggedFieldId === field.id ? 'opacity-30 border-dashed border-blue-400 bg-blue-50/10' : ''
                                        } ${
                                            dragOverFieldId === field.id && draggedFieldId !== field.id ? 'border-2 border-blue-500 scale-[1.02] shadow-md bg-blue-50/20' : ''
                                        }`}
                                    >
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1 flex items-center gap-1.5 select-none">
                                                {isEditing && (
                                                    <span className="text-gray-300 hover:text-gray-500 cursor-grab">
                                                        <GripVertical size={11} />
                                                    </span>
                                                )}
                                                <span>{field.label}</span>
                                                {field.required && <span className="text-red-500">*</span>}
                                            </label>

                                        {/* Render Field Input based on type */}
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none h-32"
                                                placeholder={field.placeholder}
                                                disabled
                                            />
                                        ) : field.type === 'select' ? (
                                            <div className="relative">
                                                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-gray-500" disabled>
                                                    <option>Select...</option>
                                                    {field.options?.map(opt => <option key={opt}>{opt}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            </div>
                                        ) : field.type === 'file' || field.type === 'image' ? (
                                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                                <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <UploadCloud size={20} />
                                                </div>
                                                <p className="text-sm font-bold text-gray-700">Click to upload or drag and drop</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {field.helpText || (field.type === 'image' ? "PNG, JPG, JPEG or WEBP up to 5MB" : "PDF, DOCX up to 5MB")}
                                                </p>
                                            </div>
                                        ) : (
                                            <input
                                                type={field.type}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                                                placeholder={field.placeholder}
                                                disabled
                                            />
                                        )}

                                        {!['file', 'image'].includes(field.type) && field.helpText && (
                                            <p className="text-[10px] text-gray-400 mt-1 ml-1">{field.helpText}</p>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Submit Area Mockup */}
                <div className="pt-4 pb-8 flex justify-end">
                    <button disabled className="px-8 py-4 bg-gray-900 text-white rounded-xl font-bold shadow-xl opacity-90 cursor-not-allowed">
                        Submit Application
                    </button>
                </div>
            </div>
        </div>
    );
}
