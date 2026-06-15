import React from 'react';
import { Type, Mail, Hash, AlignLeft, Calendar, Phone, CheckSquare, List, Upload, Lock, FileText } from 'lucide-react';

const fieldTypes = [
    { icon: <Type size={18} />, label: 'Text Input', type: 'text' },
    { icon: <Hash size={18} />, label: 'Number', type: 'number' },
    { icon: <Mail size={18} />, label: 'Email', type: 'email' },
    { icon: <AlignLeft size={18} />, label: 'Text Area', type: 'textarea' },
    { icon: <Calendar size={18} />, label: 'Date', type: 'date' },
    { icon: <Phone size={18} />, label: 'Phone', type: 'phone' },
    { icon: <List size={18} />, label: 'Select', type: 'select' },
    { icon: <CheckSquare size={18} />, label: 'Checkbox', type: 'checkbox' },
    { icon: <Upload size={18} />, label: 'File Upload', type: 'file' },
];

export default function FieldSidebar({ onAddField, onAddSection }) {
    return (
        <div className="w-80 border-r border-slate-200 bg-white h-full overflow-y-auto p-6 hidden lg:block scrollbar-hide">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-6">Component Library</h2>

            <div className="grid grid-cols-2 gap-4">
                {fieldTypes.map((item, index) => (
                    <div
                        key={index}
                        onClick={() => onAddField(item.type)}
                        className="group flex flex-col items-center justify-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-100 transition-all active:scale-95"
                    >
                        <div className="text-slate-400 group-hover:text-indigo-600 transition-colors">
                            {item.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600 group-hover:text-indigo-900">{item.label}</span>
                    </div>
                ))}
            </div>

            <div className="my-8 h-px bg-slate-100" />

            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-6">Layout Elements</h2>
            <button
                onClick={onAddSection}
                className="w-full flex items-center justify-center gap-3 p-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95"
            >
                Add New Section
            </button>
        </div>
    );
}
