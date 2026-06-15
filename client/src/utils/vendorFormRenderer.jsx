import React from 'react';
import { Form, Input, Select, DatePicker, Checkbox, Upload, Button, Card, Divider } from 'antd';
import { Upload as LucideUpload, Globe, Landmark, ShieldCheck, Briefcase, Receipt, Settings2, Building2, Contact2, CheckCircle2, ChevronRight, FileText } from 'lucide-react';

const { Option } = Select;
const { TextArea } = Input;

// Helper to normalize config
export const normalizeConfig = (config) => {
    if (!config || !config.sections || !config.fields) {
        return { sections: [], fields: [] };
    }
    return config;
};

// Section Style Mapper based on ID or fallback
const getSectionStyle = (id, index) => {
    const styles = {
        'sec_identity': { bg: 'bg-slate-50/50', iconBg: 'bg-indigo-600', iconColor: 'text-white', icon: <Globe size={20} /> },
        'sec_banking': { bg: 'bg-red-50/30', iconBg: 'bg-red-600', iconColor: 'text-white', icon: <Landmark size={20} /> },
        'sec_compliance': { bg: 'bg-emerald-50/30', iconBg: 'bg-emerald-600', iconColor: 'text-white', icon: <ShieldCheck size={20} /> },
        'sec_m_gen': { bg: 'bg-slate-50/50', iconBg: 'bg-indigo-600', iconColor: 'text-white', icon: <Briefcase size={20} /> },
        'sec_m_bank': { bg: 'bg-red-50/30', iconBg: 'bg-red-600', iconColor: 'text-white', icon: <Landmark size={20} /> },
        'sec_m_tax': { bg: 'bg-emerald-50/30', iconBg: 'bg-emerald-600', iconColor: 'text-white', icon: <Receipt size={20} /> },
        'sec_m_erp': { bg: 'bg-slate-50/50', iconBg: 'bg-slate-900', iconColor: 'text-white', icon: <Settings2 size={20} /> },
    };

    if (styles[id]) return styles[id];

    // Fallback cyclic styles
    const fallbacks = [
        { bg: 'bg-slate-50/50', iconBg: 'bg-indigo-600', iconColor: 'text-white', icon: <FileText size={20} /> },
        { bg: 'bg-orange-50/30', iconBg: 'bg-orange-600', iconColor: 'text-white', icon: <Briefcase size={20} /> },
        { bg: 'bg-blue-50/30', iconBg: 'bg-blue-600', iconColor: 'text-white', icon: <Settings2 size={20} /> },
    ];
    return fallbacks[index % fallbacks.length];
};

export const renderFormFields = (config, form, handleFileUpload) => {
    const { sections, fields } = normalizeConfig(config);

    // Group fields
    const fieldsBySection = {};
    fields.forEach(field => {
        if (!fieldsBySection[field.section]) {
            fieldsBySection[field.section] = [];
        }
        fieldsBySection[field.section].push(field);
    });

    // Grid Span Helper
    const getGridSpan = (width) => {
        switch (width) {
            case 'full': return 'md:col-span-4';
            case 'half': return 'md:col-span-2';
            case 'third': return 'md:col-span-1 md:col-span-1-3'; // Antd grid is 24, but here we use css grid cols-4
            // actually we use grid-cols-1 md:grid-cols-4.
            // 4 cols = full. 2 cols = half. 1 col = quarter.
            case 'quarter': return 'md:col-span-1';
            default: return 'md:col-span-4';
        }
    };

    // Antd Grid Col Span (if we were using Row/Col) - but we use CSS Grid
    // We need to ensure the classNames match the grid setup in the parent container

    const labelStyle = "text-slate-500 font-black uppercase text-[11px] tracking-[0.15em] mb-2 block";
    const inputStyle = "h-14 rounded-2xl border-slate-200 focus:shadow-lg focus:shadow-indigo-50 transition-all font-bold text-slate-700";

    return (
        <div className="space-y-10">
            {sections.sort((a, b) => a.order - b.order).map((section, index) => {
                const sectionFields = (fieldsBySection[section.id] || []).sort((a, b) => a.order - b.order);
                if (sectionFields.length === 0) return null;

                const style = getSectionStyle(section.id, index);

                return (
                    <Card key={section.id} className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-50 overflow-hidden">
                        {/* Section Header */}
                        <div className={`p-8 border-b border-slate-50 ${style.bg} flex items-center gap-4`}>
                            <div className={`w-10 h-10 ${style.iconBg} rounded-2xl flex items-center justify-center ${style.iconColor} shadow-lg`}>
                                {style.icon}
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{section.title}</h2>
                        </div>

                        {/* Fields Grid */}
                        <div className="p-10 grid grid-cols-1 md:grid-cols-4 gap-8">
                            {sectionFields.map(field => {
                                let inputElement = <Input className={inputStyle} placeholder={field.placeholder} />;

                                switch (field.fieldType) {
                                    case 'textarea':
                                        inputElement = <TextArea className={`${inputStyle} py-4`} rows={4} placeholder={field.placeholder} />;
                                        break;
                                    case 'select':
                                        inputElement = (
                                            <Select className="w-full h-14" size="large" placeholder={field.placeholder || "Select Option"}>
                                                {field.dropdownOptions?.map(opt => (
                                                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                                                ))}
                                            </Select>
                                        );
                                        break;
                                    case 'date':
                                        inputElement = <DatePicker className="w-full h-14 rounded-2xl" />;
                                        break;
                                    case 'file':
                                        // Special handling for file upload
                                        inputElement = (
                                            <Upload
                                                showUploadList={true}
                                                beforeUpload={() => false}
                                                maxCount={1}
                                                onChange={(info) => {
                                                    // Trigger parent handler if provided
                                                    if (handleFileUpload) handleFileUpload(info, field.dbKey || field.id);
                                                }}
                                            >
                                                <Button icon={<LucideUpload size={16} />} className="h-12 bg-white text-slate-900 rounded-xl font-black uppercase text-xs border border-slate-200 hover:bg-indigo-50 px-6">
                                                    {field.placeholder || "Upload File"}
                                                </Button>
                                            </Upload>
                                        );
                                        break;
                                    case 'email':
                                        inputElement = <Input type="email" className={inputStyle} placeholder={field.placeholder} />;
                                        break;
                                    case 'phone':
                                        inputElement = <Input className={inputStyle} placeholder={field.placeholder} prefix={<Contact2 size={16} className="text-slate-300 mr-2" />} />;
                                        break;
                                    // Add more types as needed
                                }

                                return (
                                    <Form.Item
                                        key={field.id}
                                        label={<span className={labelStyle}>{field.label} :</span>}
                                        name={field.dbKey || field.id}
                                        className={getGridSpan(field.width)}
                                        rules={[{ required: field.required, message: 'Required' }]}
                                    >
                                        {inputElement}
                                    </Form.Item>
                                );
                            })}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};
