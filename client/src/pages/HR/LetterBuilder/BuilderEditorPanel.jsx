import React, { useState } from 'react';
import {
    Plus, Type, Hash, Image as ImageIcon, Minus, Square,
    Columns, Table as TableIcon, User, Building2, Wallet,
    CreditCard, FileText, ChevronRight, Settings2, Trash2,
    AlignLeft, AlignCenter, AlignRight, Bold, Palette, Layout,
    Eye, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Modal, Input, Dropdown, Button, Select, Switch, Slider, ColorPicker, Tabs, Card } from 'antd';
import { message } from '../../../utils/antdGlobal';

export default function BuilderEditorPanel({ selectedBlock, onUpdate, globalStyles, onUpdateGlobalStyles, variables }) {
    const [activeTab, setActiveTab] = useState('settings');

    const components = [
        {
            group: 'Letter Basics',
            items: [
                { type: 'company-header', label: 'Header', icon: Building2 },
                { type: 'text', label: 'Text Block', icon: Type },
                { type: 'employee-details-grid', label: 'Detail Grid', icon: User },
                { type: 'document-footer', label: 'Footer', icon: FileText },
            ]
        },
        {
            group: 'Elements',
            items: [
                { type: 'divider', label: 'Divider', icon: Minus },
                { type: 'spacer', label: 'Spacer', icon: Square },
            ]
        }
    ];

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex h-14 border-b border-slate-100 p-1 bg-slate-50/50">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Settings2 size={14} /> Properties
                </button>
                <button
                    onClick={() => setActiveTab('vars')}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'vars' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Hash size={14} /> Variables
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeTab === 'settings' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        {selectedBlock ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedBlock.type.replace(/-/g, ' ')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Component Settings</p>
                                    </div>
                                </div>

                                <BlockSpecificSettings
                                    block={selectedBlock}
                                    onUpdate={onUpdate}
                                    variables={variables}
                                />

                                <div className="pt-6 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Spacing & Layout</h4>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vertical Padding</label>
                                                <span className="text-[10px] font-mono text-slate-400">Top/Bottom</span>
                                            </div>
                                            <div className="flex items-center gap-4 px-2">
                                                <Slider
                                                    min={0} max={100}
                                                    value={parseInt(selectedBlock.styles?.paddingTop || 0)}
                                                    onChange={(v) => onUpdate({ styles: { ...selectedBlock.styles, paddingTop: v + 'px', paddingBottom: v + 'px' } })}
                                                    className="flex-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Design Settings</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Global Styles</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Paper Background</label>
                                        <div className="flex items-center gap-4">
                                            <ColorPicker
                                                value={globalStyles.backgroundColor}
                                                onChange={(c) => onUpdateGlobalStyles({ ...globalStyles, backgroundColor: c.toHexString() })}
                                            />
                                            <span className="text-xs font-mono font-bold text-slate-400">{globalStyles.backgroundColor}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Typography</label>
                                        <Select
                                            className="w-full h-11 rounded-xl"
                                            value={globalStyles.fontFamily}
                                            onChange={(v) => onUpdateGlobalStyles({ ...globalStyles, fontFamily: v })}
                                            options={[
                                                { label: 'Inter (Modern)', value: 'Inter' },
                                                { label: 'Roboto (Sans)', value: 'Roboto' },
                                                { label: 'Merriweather (Serif)', value: 'Merriweather' },
                                                { label: 'Montserrat (Geometric)', value: 'Montserrat' },
                                            ]}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Page Margins</label>
                                            <span className="text-[10px] font-mono text-slate-400">{globalStyles.padding}</span>
                                        </div>
                                        <Slider
                                            min={10} max={100}
                                            value={parseInt(globalStyles.padding)}
                                            onChange={(v) => onUpdateGlobalStyles({ ...globalStyles, padding: v + 'px' })}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <p className="text-[10px] text-indigo-900 font-bold leading-relaxed">
                                        💡 Pro Tip: Select any component on the canvas to edit its specific properties and spacing.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'vars' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Smart Variables</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Dynamic Data Placeholders</p>
                        </div>

                        {['Candidate', 'Position', 'Financial', 'Company', 'Period'].map(cat => (
                            <div key={cat} className="space-y-3">
                                <h4 className="text-[9px] font-black text-indigo-900 uppercase tracking-[0.2em] ml-1">{cat}</h4>
                                <div className="grid gap-2">
                                    {variables.filter(v => v.cat === cat).map(v => (
                                        <div
                                            key={v.value}
                                            onClick={() => {
                                                navigator.clipboard.writeText(v.value);
                                                message.success(`Copied ${v.value}`);
                                            }}
                                            className="group flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
                                        >
                                            <span className="text-[10px] font-bold text-slate-600">{v.label}</span>
                                            <code className="text-[9px] font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg group-hover:bg-indigo-900 group-hover:text-white transition-all">{v.value}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function BlockSpecificSettings({ block, onUpdate, variables }) {
    const { type, content } = block;
    const change = (key, value) => onUpdate({ content: { ...content, [key]: value } });

    switch (type) {
        case 'text':
            return (
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Text Content</label>
                        <Input.TextArea
                            rows={6}
                            value={content.text}
                            onChange={(e) => change('text', e.target.value)}
                            className="rounded-xl text-xs font-medium bg-slate-50 border-slate-100 focus:bg-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex col-span-2">
                            {['left', 'center', 'right', 'justify'].map(a => (
                                <button
                                    key={a}
                                    onClick={() => change('align', a)}
                                    className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${content.align === a ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-400'}`}
                                >
                                    {a === 'left' && <AlignLeft size={16} />}
                                    {a === 'center' && <AlignCenter size={16} />}
                                    {a === 'right' && <AlignRight size={16} />}
                                    {a === 'justify' && <Layout size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Font Size</label>
                            <Select
                                className="w-full h-11"
                                value={content.size || '14px'}
                                onChange={(v) => change('size', v)}
                                options={[
                                    { label: 'Small', value: '12px' },
                                    { label: 'Normal', value: '14px' },
                                    { label: 'Medium', value: '16px' },
                                    { label: 'Large', value: '20px' },
                                    { label: 'Extra Large', value: '24px' },
                                ]}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Text Color</label>
                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 h-11">
                                <ColorPicker value={content.color || '#000000'} onChange={(c) => change('color', c.toHexString())} />
                                <span className="text-[9px] font-mono text-slate-400">{content.color || '#000000'}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => change('weight', content.weight === 'bold' ? 'normal' : 'bold')}
                        className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${content.weight === 'bold' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                    >
                        <Bold size={14} /> Bold Text
                    </button>
                </div>
            );

        case 'company-header':
            return (
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Company Name</label>
                        <Input
                            value={content.companyName}
                            onChange={(e) => change('companyName', e.target.value)}
                            className="h-11 rounded-xl text-xs font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Name Size</label>
                            <Slider min={16} max={48} value={parseInt(content.companyNameSize || 24)} onChange={(v) => change('companyNameSize', v + 'px')} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Name Color</label>
                            <ColorPicker value={content.companyNameColor || '#000000'} onChange={(c) => change('companyNameColor', c.toHexString())} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Office Address</label>
                        <Input.TextArea
                            rows={3}
                            value={content.companyAddress}
                            onChange={(e) => change('companyAddress', e.target.value)}
                            className="rounded-xl text-[11px] bg-slate-50"
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Show Logo</span>
                        <Switch checked={content.showLogo} onChange={(v) => change('showLogo', v)} />
                    </div>
                    {content.showLogo && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Logo Alignment</label>
                                <Select
                                    className="w-full h-11"
                                    value={content.logoAlign}
                                    onChange={(v) => change('logoAlign', v)}
                                    options={[{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }]}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Logo Size</label>
                                <Slider min={40} max={200} value={parseInt(content.logoSize || 80)} onChange={(v) => change('logoSize', v + 'px')} />
                            </div>
                        </div>
                    )}
                </div>
            );

        case 'employee-details-grid':
            return (
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Header Title</label>
                        <Input
                            value={content.title}
                            onChange={(e) => change('title', e.target.value)}
                            className="h-11 rounded-xl text-xs font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Grid Columns</label>
                            <Select
                                className="w-full h-11"
                                value={content.columns || 2}
                                onChange={(v) => change('columns', v)}
                                options={[{ label: '1 Column', value: 1 }, { label: '2 Columns', value: 2 }]}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Title Color</label>
                            <ColorPicker value={content.titleColor || '#000000'} onChange={(c) => change('titleColor', c.toHexString())} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fields Configuration</label>
                        {content.fields.map((f, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Label"
                                        value={f.label}
                                        onChange={(e) => {
                                            const nf = [...content.fields];
                                            nf[i].label = e.target.value;
                                            change('fields', nf);
                                        }}
                                        className="flex-1 text-[10px] font-bold"
                                    />
                                    <button
                                        onClick={() => {
                                            const nf = content.fields.filter((_, idx) => idx !== i);
                                            change('fields', nf);
                                        }}
                                        className="p-2 text-slate-300 hover:text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <Input
                                    placeholder="Value or Variable"
                                    value={f.value}
                                    onChange={(e) => {
                                        const nf = [...content.fields];
                                        nf[i].value = e.target.value;
                                        change('fields', nf);
                                    }}
                                    className="text-[10px] font-mono font-black text-indigo-900 bg-white"
                                />
                            </div>
                        ))}
                        <button
                            onClick={() => change('fields', [...content.fields, { label: 'New Field', value: '{{variable}}' }])}
                            className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-900 transition-all"
                        >
                            <Plus size={14} className="inline mr-2" /> Add Field
                        </button>
                    </div>
                </div>
            );

        case 'image':
            return (
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Image Source URL</label>
                        <Input
                            placeholder="https://example.com/image.png"
                            value={content.url}
                            onChange={(e) => change('url', e.target.value)}
                            className="h-11 rounded-xl text-xs"
                        />
                        <p className="mt-2 text-[9px] text-slate-400 italic">Pro Tip: Use a transparent PNG for signatures.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Image Width</label>
                            <Slider min={50} max={600} value={parseInt(content.width || 200)} onChange={(v) => change('width', v + 'px')} />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alignment</label>
                            <div className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex">
                                {['left', 'center', 'right'].map(a => (
                                    <button
                                        key={a}
                                        onClick={() => change('align', a)}
                                        className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${content.align === a ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-400'}`}
                                    >
                                        {a === 'left' && <AlignLeft size={16} />}
                                        {a === 'center' && <AlignCenter size={16} />}
                                        {a === 'right' && <AlignRight size={16} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    {content.url && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                            <img src={content.url} alt="Preview" className="max-w-full h-auto max-h-32 object-contain" />
                        </div>
                    )}
                </div>
            );

        default:
            return <div className="text-xs text-slate-400 italic">No specific settings for this component type.</div>;
    }
}
