import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical, FileText, FileSpreadsheet } from 'lucide-react';
import FieldSidebar from './FieldSidebar';
import FieldPropertiesPanel from './FieldPropertiesPanel';
import DraggableField from './DraggableField';
import SectionEditor from './SectionEditor';
import { Layout } from 'lucide-react';

export default function VendorBuilder({ config, onChange }) {
    const [selectedFieldId, setSelectedFieldId] = useState(null);
    const [selectedSectionId, setSelectedSectionId] = useState(null);

    const handleFieldSelect = (fieldId) => {
        setSelectedFieldId(fieldId);
        setSelectedSectionId(null);
    };

    const handleSectionSelect = (sectionId) => {
        setSelectedSectionId(sectionId);
        setSelectedFieldId(null);
    };

    const updateConfig = (newConfig) => {
        onChange(newConfig);
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;
        const { source, destination } = result;

        // Reordering sections
        if (result.type === 'SECTION') {
            const newSections = Array.from(config.sections);
            const [moved] = newSections.splice(source.index, 1);
            newSections.splice(destination.index, 0, moved);

            // Update orders
            const updatedSections = newSections.map((s, idx) => ({ ...s, order: idx + 1 }));
            updateConfig({ ...config, sections: updatedSections });
            return;
        }

        // Reordering fields within section
        if (source.droppableId === destination.droppableId) {
            const sectionId = source.droppableId;
            const fieldsInSection = config.fields.filter(f => f.section === sectionId).sort((a, b) => a.order - b.order);
            const [moved] = fieldsInSection.splice(source.index, 1);
            fieldsInSection.splice(destination.index, 0, moved);

            // Re-assign orders
            const updatedFields = config.fields.map(f => {
                if (f.section === sectionId) {
                    const newIndex = fieldsInSection.findIndex(x => x.id === f.id);
                    return { ...f, order: newIndex + 1 };
                }
                return f;
            });

            updateConfig({ ...config, fields: updatedFields });
        } else {
            // Moving between sections
            const sourceSectionId = source.droppableId;
            const destSectionId = destination.droppableId;

            const sourceFields = config.fields.filter(f => f.section === sourceSectionId).sort((a, b) => a.order - b.order);
            const destFields = config.fields.filter(f => f.section === destSectionId).sort((a, b) => a.order - b.order);

            const [moved] = sourceFields.splice(source.index, 1);
            moved.section = destSectionId;
            destFields.splice(destination.index, 0, moved);

            // Update all orders
            const updatedFields = config.fields.map(f => {
                if (f.id === moved.id) return { ...moved, order: destination.index + 1 };
                if (f.section === sourceSectionId) {
                    const idx = sourceFields.findIndex(x => x.id === f.id);
                    return { ...f, order: idx + 1 };
                }
                if (f.section === destSectionId) {
                    const idx = destFields.findIndex(x => x.id === f.id);
                    return { ...f, order: idx + 1 };
                }
                return f;
            });

            updateConfig({ ...config, fields: updatedFields });
        }
    };

    const addField = (presetType) => {
        if (!config.sections.length) return;
        const targetSection = selectedSectionId || config.sections[0].id;

        const newField = {
            id: `field_${Date.now()}`,
            label: 'New Field',
            placeholder: 'Enter detail...',
            fieldType: presetType || 'text',
            required: false,
            width: 'half',
            section: targetSection,
            order: config.fields.filter(f => f.section === targetSection).length + 1,
            dbKey: `custom_field_${Date.now()}`,
            dropdownOptions: []
        };

        updateConfig({ ...config, fields: [...config.fields, newField] });
        setSelectedFieldId(newField.id);
    };

    const addSection = () => {
        const newSection = {
            id: `section_${Date.now()}`,
            title: 'New Section',
            order: config.sections.length + 1
        };
        updateConfig({ ...config, sections: [...config.sections, newSection] });
        setSelectedSectionId(newSection.id);
    };

    const deleteField = (id) => {
        updateConfig({ ...config, fields: config.fields.filter(f => f.id !== id) });
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    const deleteSection = (id) => {
        // Also delete fields in section
        updateConfig({
            ...config,
            sections: config.sections.filter(s => s.id !== id),
            fields: config.fields.filter(f => f.section !== id)
        });
        if (selectedSectionId === id) setSelectedSectionId(null);
    };

    const getSelectedField = () => config.fields.find(f => f.id === selectedFieldId);
    const getSelectedSection = () => config.sections.find(s => s.id === selectedSectionId);

    const getSectionStyle = (index) => {
        const styles = [
            { bg: 'bg-slate-50/50', iconBg: 'bg-indigo-600', iconColor: 'text-white' }, // Sec 1
            { bg: 'bg-red-50/30', iconBg: 'bg-red-600', iconColor: 'text-white' },       // Sec 2
            { bg: 'bg-emerald-50/30', iconBg: 'bg-emerald-600', iconColor: 'text-white' }, // Sec 3
            { bg: 'bg-slate-50/50', iconBg: 'bg-slate-900', iconColor: 'text-white' }      // Sec 4
        ];
        return styles[index % styles.length];
    };

    return (
        <div className="flex flex-1 overflow-hidden h-full">
            {/* Left Sidebar: Components */}
            <FieldSidebar onAddField={addField} onAddSection={addSection} />

            {/* Middle: Canvas */}
            <div className="flex-1 bg-slate-50 relative overflow-y-auto scrollbar-hide p-4 md:p-8 flex justify-center">
                <div className="w-full max-w-5xl space-y-8 pb-20">

                    {/* Header Preview */}
                    <div className="flex items-center gap-6 mb-10 opacity-70 px-4">
                        <div className={`p-5 rounded-[2rem] shadow-xl ${config.formType === 'step1' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-slate-900 shadow-slate-200'}`}>
                            {config.formType === 'step1' ? <FileText className="text-white" size={36} /> : <FileSpreadsheet className="text-white" size={36} />}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
                                {config.formType === 'step1' ? 'Vendor Enrollment' : 'Master Profile'}
                            </h1>
                            <p className="text-slate-400 font-bold text-lg mt-1 italic">
                                {config.formType === 'step1' ? 'Basic Registration Form' : 'Detailed Master Data'}
                            </p>
                        </div>
                    </div>

                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="sections-list" type="SECTION">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-8">
                                    {config.sections.sort((a, b) => a.order - b.order).map((section, index) => {
                                        const style = getSectionStyle(index);
                                        return (
                                            <Draggable key={section.id} draggableId={section.id} index={index}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`group relative rounded-[2.5rem] border-2 transition-all duration-200 overflow-hidden ${selectedSectionId === section.id ? 'border-indigo-500 shadow-xl shadow-indigo-100 bg-white scale-[1.01]' : 'border-slate-100 hover:border-slate-300 bg-white shadow-sm'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSectionSelect(section.id);
                                                        }}
                                                    >
                                                        {/* Section Header */}
                                                        <div className={`p-6 border-b border-slate-50 ${style.bg} flex items-center justify-between`}>
                                                            <div className="flex items-center gap-4">
                                                                <div {...provided.dragHandleProps} className="cursor-grab text-slate-300 hover:text-slate-600">
                                                                    <GripVertical size={20} />
                                                                </div>
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${style.iconBg} ${style.iconColor}`}>
                                                                    <span className="font-bold text-xs">{index + 1}</span>
                                                                </div>
                                                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{section.title}</h2>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-400 px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">SECTION {index + 1}</div>
                                                        </div>

                                                        {/* Fields Area */}
                                                        <Droppable droppableId={section.id} type="FIELD">
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.droppableProps}
                                                                    className={`p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[120px] transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/30' : ''}`}
                                                                >
                                                                    {config.fields
                                                                        .filter(f => f.section === section.id)
                                                                        .sort((a, b) => a.order - b.order)
                                                                        .map((field, fIndex) => (
                                                                            <DraggableField
                                                                                key={field.id}
                                                                                field={field}
                                                                                index={fIndex}
                                                                                isSelected={selectedFieldId === field.id}
                                                                                onSelect={() => handleFieldSelect(field.id)}
                                                                                onDelete={() => deleteField(field.id)}
                                                                            />
                                                                        ))
                                                                    }
                                                                    {provided.placeholder}

                                                                    {/* Drop Hint */}
                                                                    {config.fields.filter(f => f.section === section.id).length === 0 && (
                                                                        <div className="col-span-full border-2 border-dashed border-slate-200 rounded-2xl h-24 flex items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-50/50">
                                                                            Drop fields here
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Droppable>
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    <div
                        onClick={addSection}
                        className="mt-8 border-2 border-dashed border-slate-300 rounded-[2.5rem] h-28 flex items-center justify-center text-slate-400 font-bold text-sm uppercase tracking-widest cursor-pointer hover:border-indigo-400 hover:text-indigo-600 hover:bg-white hover:shadow-xl transition-all gap-3"
                    >
                        <div className="p-2 bg-slate-200 rounded-full group-hover:bg-indigo-100 transition-colors">
                            <Plus size={24} />
                        </div>
                        Add New Section
                    </div>
                </div>
            </div>

            {/* Right: Properties */}
            <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto hidden xl:block">
                {selectedFieldId && (
                    <FieldPropertiesPanel
                        field={getSelectedField()}
                        onUpdate={(updates) => {
                            updateConfig({
                                ...config,
                                fields: config.fields.map(f => f.id === selectedFieldId ? { ...f, ...updates } : f)
                            })
                        }}
                    />
                )}
                {selectedSectionId && (
                    <SectionEditor
                        section={getSelectedSection()}
                        onUpdate={(updates) => {
                            updateConfig({
                                ...config,
                                sections: config.sections.map(s => s.id === selectedSectionId ? { ...s, ...updates } : s)
                            })
                        }}
                        onDelete={() => deleteSection(selectedSectionId)}
                    />
                )}
                {!selectedFieldId && !selectedSectionId && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                        <Layout size={48} className="mb-4 opacity-20" />
                        <p className="font-bold text-sm">Select an element to edit properties</p>
                    </div>
                )}
            </div>
        </div>
    );
}
