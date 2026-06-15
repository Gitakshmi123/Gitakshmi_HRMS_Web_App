import React from 'react';
import { Form, Input, Button } from 'antd';
import { Layout, Trash2 } from 'lucide-react';

export default function SectionEditor({ section, onUpdate, onDelete }) {
    if (!section) return null;

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <Layout size={18} className="text-indigo-600" />
                <h2 className="text-sm font-black uppercase text-slate-800 tracking-widest">Section Settings</h2>
            </div>

            <Form layout="vertical" className="flex-1 overflow-y-auto space-y-6 pr-2">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-4">
                    <Form.Item label={<span className="text-xs font-bold text-slate-500 uppercase">Section ID</span>} className="mb-0">
                        <Input
                            value={section.id}
                            disabled
                            className="font-mono text-xs rounded-xl h-10 border-slate-200 bg-slate-100 text-slate-400 select-all"
                        />
                    </Form.Item>

                    <Form.Item label={<span className="text-xs font-bold text-slate-500 uppercase">Section Title</span>} className="mb-0">
                        <Input
                            value={section.title}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                            className="font-black text-lg rounded-xl h-12 border-slate-200 focus:border-indigo-500"
                        />
                    </Form.Item>
                </div>

                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-red-400 tracking-widest flex items-center gap-2">
                        <Trash2 size={12} /> Danger Zone
                    </h3>
                    <p className="text-[10px] text-red-600/70 font-medium">Deleting a section will also remove all fields contained within it. This action cannot be undone.</p>
                    <button
                        onClick={onDelete}
                        className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold text-xs uppercase hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm"
                    >
                        Delete Section & Fields
                    </button>
                </div>
            </Form>
        </div>
    );
}
