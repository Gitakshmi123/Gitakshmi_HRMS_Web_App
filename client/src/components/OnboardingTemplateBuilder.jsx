import React, { useState } from 'react';
import { Plus, Trash2, Settings, Type, FileText, CheckSquare, Hash, Calendar, ChevronDown, ChevronUp, GripVertical, Save, X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
    { value: 'text', label: 'Short Text', icon: Type },
    { value: 'textarea', label: 'Long Text', icon: FileText },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'file', label: 'File Upload', icon: FileText },
    { value: 'select', label: 'Dropdown', icon: ChevronDown },
    { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
];

export default function OnboardingTemplateBuilder({ onSave, onCancel, initialData }) {
    const [template, setTemplate] = useState(initialData || {
        name: '',
        description: '',
        version: 1,
        status: 'draft',
        sections: [
            {
                id: 'sec_' + Date.now(),
                title: 'Personal Information',
                order: 0,
                fields: []
            }
        ]
    });

    const isPublished = template.status === 'published';

    const [saving, setSaving] = useState(false);

    const addSection = () => {
        const newSection = {
            id: 'sec_' + Date.now(),
            title: 'New Section',
            order: template.sections.length,
            fields: []
        };
        setTemplate({ ...template, sections: [...template.sections, newSection] });
    };

    const updateSection = (secId, key, value) => {
        setTemplate({
            ...template,
            sections: template.sections.map(s => s.id === secId ? { ...s, [key]: value } : s)
        });
    };

    const deleteSection = (secId) => {
        setTemplate({
            ...template,
            sections: template.sections.filter(s => s.id !== secId)
        });
    };

    const addField = (secId) => {
        const newField = {
            id: 'fld_' + Date.now(),
            name: 'new_field_' + Date.now(),
            label: 'New Field',
            type: 'text',
            isRequired: false,
            isPublic: true,
            order: 0
        };
        setTemplate({
            ...template,
            sections: template.sections.map(s => 
                s.id === secId ? { ...s, fields: [...s.fields, newField] } : s
            )
        });
    };

    const updateField = (secId, fieldId, key, value) => {
        setTemplate({
            ...template,
            sections: template.sections.map(s => {
                if (s.id === secId) {
                    return {
                        ...s,
                        fields: s.fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
                    };
                }
                return s;
            })
        });
    };

    const deleteField = (secId, fieldId) => {
        setTemplate({
            ...template,
            sections: template.sections.map(s => 
                s.id === secId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s
            )
        });
    };

    const handleSave = async () => {
        if (!template.name) return toast.error('Please enter template name');
        if (template.sections.length === 0) return toast.error('Please add at least one section');

        setSaving(true);
        try {
            const res = template._id 
                ? await api.put(`/onboarding/templates/${template._id}`, template)
                : await api.post('/onboarding/templates', template);
            toast.success(template._id ? 'Template Updated!' : 'Onboarding Template Saved!');
            onSave?.(res.data.template);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!template._id) return toast.error('Save as draft first');
        setSaving(true);
        try {
            const res = await api.post(`/onboarding/templates/${template._id}/publish`);
            setTemplate(res.data.template);
            toast.success('Template Published!');
        } catch (error) {
            toast.error('Failed to publish');
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicate = async () => {
        if (!template._id) return toast.error('Original template not saved');
        setSaving(true);
        try {
            const res = await api.post(`/onboarding/templates/${template._id}/duplicate`);
            setTemplate(res.data.template);
            toast.success('New version (v' + res.data.template.version + ') created!');
        } catch (error) {
            toast.error('Failed to duplicate');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] max-w-4xl w-full">
            {/* Header */}
            <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">Onboarding Template Builder</h2>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-black uppercase">v{template.version || 1}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                            {template.status || 'draft'}
                        </span>
                    </div>
                    <p className="text-slate-400 text-xs">Design your dynamic onboarding workflow</p>
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-8 custom-scrollbar">
                {/* Meta Details */}
                <div className="space-y-4">
                    <input 
                        type="text" 
                        value={template.name} 
                        onChange={e => setTemplate({...template, name: e.target.value})}
                        placeholder="Template Name (e.g. Engineering Onboarding)"
                        className="w-full text-2xl font-bold bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none pb-2 transition-all"
                    />
                    <textarea 
                        value={template.description}
                        onChange={e => setTemplate({...template, description: e.target.value})}
                        placeholder="Brief description of this template..."
                        className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        rows={2}
                    />
                </div>

                {/* Sections List */}
                <div className="space-y-6">
                    {template.sections.map((section, sIdx) => (
                        <div key={section.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                            {/* Section Header */}
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                        {sIdx + 1}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={section.title}
                                        onChange={e => updateSection(section.id, 'title', e.target.value)}
                                        className="bg-transparent font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-400"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isPublished && (
                                        <button onClick={() => deleteSection(section.id)} className="p-2 text-slate-400 hover:text-red-500 transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Fields List */}
                            <div className="p-6 space-y-4">
                                {section.fields.map((field, fIdx) => (
                                    <div key={field.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-wrap items-center gap-4 group">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-300 cursor-grab active:cursor-grabbing">
                                            <GripVertical size={14} />
                                        </div>
                                        
                                        <div className="flex-1 min-w-[200px]">
                                            <input 
                                                type="text" 
                                                value={field.label}
                                                onChange={e => updateField(section.id, field.id, 'label', e.target.value)}
                                                className="w-full bg-transparent font-bold text-sm text-slate-700 outline-none"
                                                placeholder="Field Label"
                                            />
                                        </div>

                                        <select 
                                            value={field.type}
                                            onChange={e => updateField(section.id, field.id, 'type', e.target.value)}
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 outline-none"
                                        >
                                            {FIELD_TYPES.map(ft => (
                                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                                            ))}
                                        </select>

                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={field.isRequired}
                                                    onChange={e => updateField(section.id, field.id, 'isRequired', e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                                                />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Required</span>
                                            </label>
                                            {!isPublished && (
                                                <button onClick={() => deleteField(section.id, field.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {!isPublished && (
                                    <button 
                                        onClick={() => addField(section.id)}
                                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 text-xs font-bold hover:bg-indigo-50/50 hover:border-indigo-200 hover:text-indigo-500 transition-all"
                                    >
                                        <Plus size={14} />
                                        Add Field to {section.title}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {!isPublished && (
                        <button 
                            onClick={addSection}
                            className="w-full py-6 bg-white border-2 border-dashed border-indigo-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-indigo-500 hover:bg-indigo-50/50 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Plus size={24} />
                            </div>
                            <span className="font-bold text-sm uppercase tracking-widest">Add New Section</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-end gap-4">
                <button 
                    onClick={onCancel}
                    className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
                >
                    Cancel
                </button>
                <div className="flex gap-2">
                    {isPublished ? (
                        <button 
                            onClick={handleDuplicate}
                            disabled={saving}
                            className="px-8 py-3 bg-amber-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-600 transition-all"
                        >
                            Create New Version
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >
                                Save Draft
                            </button>
                            <button 
                                onClick={handlePublish}
                                disabled={saving}
                                className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all"
                            >
                                Publish Version
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}} />
        </div>
    );
}
