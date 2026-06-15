import React from 'react';
import { Form, Input, Select, Switch, Tag, Button, Alert } from 'antd';
import { Type, Key, AlignJustify, Lock, Trash2, Plus, Settings2 } from 'lucide-react';

const { Option } = Select;

export default function FieldPropertiesPanel({ field, onUpdate }) {
    if (!field) return null;

    const handleChange = (key, value) => {
        onUpdate({ [key]: value });
    };

    const handleDropdownChange = (idx, key, value) => {
        const newOptions = [...(field.dropdownOptions || [])];
        if (!newOptions[idx]) newOptions[idx] = {};
        newOptions[idx][key] = value;
        onUpdate({ dropdownOptions: newOptions });
    };

    const addOption = () => {
        const newOptions = [...(field.dropdownOptions || []), { label: 'New Option', value: 'new_value' }];
        onUpdate({ dropdownOptions: newOptions });
    };

    const removeOption = (idx) => {
        const newOptions = [...(field.dropdownOptions || [])];
        newOptions.splice(idx, 1);
        onUpdate({ dropdownOptions: newOptions });
    };

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <Settings2 size={18} className="text-indigo-600" />
                <h2 className="text-sm font-black uppercase text-slate-800 tracking-widest">Field Properties</h2>
            </div>

            <Form layout="vertical" className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin">

                {/* Core Field Info */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-4">
                    <Form.Item label={<span className="text-xs font-bold text-slate-500 uppercase">Label Text</span>} className="mb-0">
                        <Input
                            value={field.label}
                            onChange={(e) => handleChange('label', e.target.value)}
                            className="font-bold rounded-xl h-10 border-slate-200 focus:border-indigo-500"
                        />
                    </Form.Item>

                    <Form.Item label={<span className="text-xs font-bold text-slate-500 uppercase">Input Placeholder</span>} className="mb-0">
                        <Input
                            value={field.placeholder}
                            onChange={(e) => handleChange('placeholder', e.target.value)}
                            className="rounded-xl h-10 border-slate-200 text-sm"
                        />
                    </Form.Item>

                    <Form.Item label={<span className="text-xs font-bold text-slate-500 uppercase">Input Type</span>} className="mb-0">
                        <Select
                            value={field.fieldType}
                            onChange={(val) => handleChange('fieldType', val)}
                            disabled={field.isSystem && field.fieldType !== 'select'}
                            className="h-10 border-slate-200 w-full"
                        >
                            <Option value="text">Text Input</Option>
                            <Option value="number">Number</Option>
                            <Option value="email">Email</Option>
                            <Option value="textarea">Multi-line Text</Option>
                            <Option value="select">Dropdown Menu</Option>
                            <Option value="date">Date Picker</Option>
                            <Option value="file">File Upload</Option>
                            <Option value="checkbox">Checkbox</Option>
                        </Select>
                        {field.isSystem && <div className="mt-2 flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100"><Lock size={10} /> System Locked Type</div>}
                    </Form.Item>
                </div>

                {/* Validation & Display Logic */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Required</span>
                        <Switch
                            checked={field.required}
                            onChange={(checked) => handleChange('required', checked)}
                            className="bg-slate-200 w-12"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Width</span>
                        <Select
                            value={field.width}
                            onChange={(val) => handleChange('width', val)}
                            className="w-full text-xs"
                            size="small"
                        >
                            <Option value="full">Full (100%)</Option>
                            <Option value="half">Half (50%)</Option>
                            <Option value="third">Third (33%)</Option>
                            <Option value="quarter">Quarter (25%)</Option>
                        </Select>
                    </div>
                </div>

                {/* Dropdown Options Editor */}
                {(field.fieldType === 'select' || field.fieldType === 'dropdown') && (
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl relative">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Dropdown Options</h3>
                            <button
                                type="button"
                                onClick={addOption}
                                className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded-lg font-bold uppercase transition-colors"
                            >
                                <Plus size={10} /> Add
                            </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                            {field.dropdownOptions?.length > 0 ? (
                                field.dropdownOptions.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-center group">
                                        <Input
                                            placeholder="Label"
                                            value={opt.label}
                                            onChange={(e) => handleDropdownChange(idx, 'label', e.target.value)}
                                            size="small"
                                            className="rounded-lg text-xs font-bold flex-1"
                                        />
                                        <Input
                                            placeholder="Value"
                                            value={opt.value}
                                            onChange={(e) => handleDropdownChange(idx, 'value', e.target.value)}
                                            size="small"
                                            className="rounded-lg text-xs font-bold text-slate-500 w-20 bg-slate-100 border-none"
                                        />
                                        <button
                                            onClick={() => removeOption(idx)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">
                                    <p className="text-[10px] text-slate-400 italic">No options defined</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Database Key / Field ID */}
                <div className={`p-4 rounded-2xl border ${field.isSystem ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Key size={14} className={field.isSystem ? "text-orange-400" : "text-slate-400"} />
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${field.isSystem ? "text-orange-800" : "text-slate-500"}`}>Database Mapping Key</h4>
                    </div>
                    <Input
                        value={field.dbKey || ''}
                        onChange={(e) => !field.isSystem && handleChange('dbKey', e.target.value)}
                        disabled={field.isSystem}
                        className={`rounded-xl h-10 border-slate-200 font-mono text-xs ${field.isSystem ? 'bg-white/50 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-700'}`}
                        placeholder="unique_field_key"
                    />
                    {field.isSystem && <p className="text-[10px] text-orange-600 mt-2 flex items-center gap-1"><Lock size={10} /> This is a core system field and cannot be re-mapped.</p>}
                    {!field.isSystem && <p className="text-[10px] text-slate-400 mt-2">Unique key for database storage. Use underscores (e.g., my_field_name).</p>}
                </div>
            </Form>
        </div>
    );
}
