import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react';
import { Button, Input, Select, Switch } from 'antd';
import { message } from '../utils/antdGlobal';

const { Option } = Select;

// Quick Add Presets
const COMMON_CRITERIA = [
    { label: "Technical Skills", type: "rating" },
    { label: "Communication", type: "rating" },
    { label: "Problem Solving", type: "rating" },
    { label: "Cultural Fit", type: "rating" },
    { label: "Leadership", type: "text" },
    { label: "Teamwork", type: "rating" }
];

export default function FeedbackTemplateBuilder({ initialTemplate, onSave, onCancel }) {
    const [templateName, setTemplateName] = useState(initialTemplate?.templateName || '');
    const [criteria, setCriteria] = useState(initialTemplate?.criteria || []);
    const [newCriteriaLabel, setNewCriteriaLabel] = useState('');

    const handleAddCriteria = () => {
        if (!newCriteriaLabel.trim()) return;
        setCriteria([...criteria, {
            id: `crit-${Date.now()}`,
            label: newCriteriaLabel,
            type: 'rating',
            required: true
        }]);
        setNewCriteriaLabel('');
    };

    const handleQuickAdd = (preset) => {
        setCriteria([...criteria, {
            id: `crit-${Date.now()}`,
            label: preset.label,
            type: preset.type,
            required: true
        }]);
    };

    const handleRemove = (index) => {
        const newCriteria = [...criteria];
        newCriteria.splice(index, 1);
        setCriteria(newCriteria);
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(criteria);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setCriteria(items);
    };

    const handleSave = () => {
        if (!templateName.trim()) {
            message.error("Template name is required");
            return;
        }
        if (criteria.length === 0) {
            message.warning("Add at least one criteria");
            return;
        }
        onSave({ templateName, criteria });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Feedback Template Builder</h3>
                <Button type="text" icon={<X size={18} />} onClick={onCancel} />
            </div>

            <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Template Name</label>
                <Input
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g., Technical Interview Form"
                    className="font-semibold text-slate-700"
                />
            </div>

            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Criteria</label>

                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="criteria-list" ignoreContainerClipping={true}>
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 mb-4">
                                {criteria.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg group hover:border-indigo-200 transition-colors"
                                            >
                                                <div {...provided.dragHandleProps} className="text-slate-400 cursor-grab hover:text-slate-600">
                                                    <GripVertical size={16} />
                                                </div>
                                                <Input
                                                    value={item.label}
                                                    onChange={e => {
                                                        const newC = [...criteria];
                                                        newC[index].label = e.target.value;
                                                        setCriteria(newC);
                                                    }}
                                                    className="flex-1 border-none bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-100 py-1"
                                                />
                                                <Select
                                                    value={item.type}
                                                    onChange={val => {
                                                        const newC = [...criteria];
                                                        newC[index].type = val;
                                                        setCriteria(newC);
                                                    }}
                                                    style={{ width: 130 }}
                                                    className="text-xs shrink-0"
                                                >
                                                    <Option value="rating">Rating (1-5)</Option>
                                                    <Option value="text">Text</Option>
                                                    <Option value="yesno">Yes/No</Option>
                                                </Select>
                                                <div className="flex items-center gap-1.5 shrink-0 px-1">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Req</span>
                                                    <Switch
                                                        size="small"
                                                        checked={item.required}
                                                        onChange={checked => {
                                                            const newC = [...criteria];
                                                            newC[index].required = checked;
                                                            setCriteria(newC);
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<Trash2 size={16} />}
                                                    onClick={() => handleRemove(index)}
                                                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                <div className="flex gap-2 mb-4">
                    <Input
                        value={newCriteriaLabel}
                        onChange={e => setNewCriteriaLabel(e.target.value)}
                        onPressEnter={handleAddCriteria}
                        placeholder="Add new criteria..."
                        className="flex-1"
                    />
                    <Button type="primary" icon={<Plus size={16} />} onClick={handleAddCriteria}>Add</Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {COMMON_CRITERIA.map(c => (
                        <Button key={c.label} size="small" onClick={() => handleQuickAdd(c)} className="text-xs">
                            + {c.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button onClick={onCancel}>Cancel</Button>
                <Button type="primary" onClick={handleSave} icon={<Check size={16} />} className="bg-emerald-500 hover:bg-emerald-600 custom-shadow">
                    Save Template
                </Button>
            </div>
        </div>
    );
}
