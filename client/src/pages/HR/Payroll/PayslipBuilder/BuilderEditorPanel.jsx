import React, { useState } from 'react';
import {
    Plus, Type, Hash, Image as ImageIcon, Minus, Square,
    Columns, Table as TableIcon, User, Building2, Wallet,
    CreditCard, FileText, ChevronRight, Settings2, Trash2,
    AlignLeft, AlignCenter, AlignRight, Bold, Palette, Layout,
    Eye, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Modal, Input, Dropdown, Button, Select, Switch, Slider, ColorPicker, Tabs, Card } from 'antd';
import { message } from '../../../../utils/antdGlobal';

export default function BuilderEditorPanel({ config, selectedBlockId, onUpdateConfig, onAddBlock, onUpdateBlock, onRemoveBlock, variables, employees, selectedEmployee, selectedMonth, onEmployeeChange, onMonthChange, previewData, loadingPreview }) {
    const [activeTab, setActiveTab] = useState('add');

    // Safety check: Ensure config and sections exist
    if (!config || !config.sections) {
        console.warn('BuilderEditorPanel: config or config.sections is undefined', { config });
        return <div className="flex-1 bg-white border-l border-gray-100 p-4 text-red-500">Config Error</div>;
    }

    // Components list grouped by category
    const components = [
        {
            group: 'Payslip Basics',
            items: [
                { type: 'company-header', label: 'Company Header', icon: Building2 },
                { type: 'payslip-title', label: 'Payslip Title', icon: FileText },
                { type: 'employee-details-grid', label: 'Employee Info', icon: User },
            ]
        },
        {
            group: 'Payroll Tables',
            items: [
                { type: 'earnings-table', label: 'Earnings Table', icon: TableIcon },
                { type: 'deductions-table', label: 'Deductions Table', icon: TableIcon },
                { type: 'split-payroll-table', label: 'Split Payroll Table', icon: Columns },
                { type: 'reimbursements-table', label: 'Reimbursements Table', icon: TableIcon },
                { type: 'net-pay-box', label: 'Net Pay Summary', icon: Wallet },
                { type: 'document-footer', label: 'Doc Footer', icon: FileText },
            ]
        },
        {
            group: 'Basic Elements',
            items: [
                { type: 'text', label: 'Text Block', icon: Type },
                { type: 'divider', label: 'Divider Line', icon: Minus },
                { type: 'spacer', label: 'Vertical Spacer', icon: Square },
                { type: 'image', label: 'Static Image', icon: ImageIcon },
            ]
        }
    ];

    const selectedBlock = config.sections.find(s => s.id === selectedBlockId);

    // If a block is selected, automatically switch to settings tab once
    // (Logic handled by useEffect in parent or here if needed, but for now manually or via click)

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-100 w-80 shrink-0">
            <div className="flex h-12 border-b border-gray-50 overflow-hidden px-2 py-1 items-center gap-1">
                <button
                    onClick={() => setActiveTab('add')}
                    className={`flex-1 flex items-center justify-center gap-2 h-full rounded-lg text-xs font-bold transition-all ${activeTab === 'add' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Plus size={14} /> Add
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 flex items-center justify-center gap-2 h-full rounded-lg text-xs font-bold transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Settings2 size={14} /> Edit
                </button>
                <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex-1 flex items-center justify-center gap-2 h-full rounded-lg text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Preview with Real Data"
                >
                    <Eye size={14} /> Preview
                </button>
                <button
                    onClick={() => setActiveTab('vars')}
                    className={`flex-1 flex items-center justify-center gap-2 h-full rounded-lg text-xs font-bold transition-all ${activeTab === 'vars' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Hash size={14} /> Data
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'add' && (
                    <div className="space-y-6">
                        {components.map(group => (
                            <div key={group.group}>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">{group.group}</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {group.items.map(item => (
                                        <button
                                            key={item.type}
                                            onClick={() => onAddBlock(item.type)}
                                            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-blue-600 group-hover:bg-white transition-all">
                                                <item.icon size={20} />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700 leading-tight">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'settings' && selectedBlockId === 'page-settings' && (
                    <PageSettings config={config} onUpdateConfig={onUpdateConfig} />
                )}

                {activeTab === 'settings' && selectedBlock && (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
                            <div>
                                <h3 className="text-sm font-black text-gray-900">{selectedBlock.type.replace(/-/g, ' ').toUpperCase()}</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Properties</p>
                            </div>
                            <button
                                onClick={() => onRemoveBlock(selectedBlockId)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <BlockSpecificSettings
                                block={selectedBlock}
                                onUpdate={(content) => onUpdateBlock(selectedBlockId, { content })}
                                variables={variables}
                            />

                            <div className="pt-4 border-t border-gray-50">
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                                    <Layout size={12} /> Spacing & Layout
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Vertical Padding</label>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-gray-400">T</span>
                                            <Slider
                                                min={0} max={100}
                                                value={parseInt(selectedBlock.styles?.paddingTop || 0)}
                                                onChange={(v) => onUpdateBlock(selectedBlockId, { styles: { ...selectedBlock.styles, paddingTop: v + 'px' } })}
                                                className="flex-1"
                                            />
                                            <span className="text-[10px] font-mono text-gray-400">B</span>
                                            <Slider
                                                min={0} max={100}
                                                value={parseInt(selectedBlock.styles?.paddingBottom || 0)}
                                                onChange={(v) => onUpdateBlock(selectedBlockId, { styles: { ...selectedBlock.styles, paddingBottom: v + 'px' } })}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Vertical Margin</label>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-gray-400">T</span>
                                            <Slider
                                                min={0} max={100}
                                                value={parseInt(selectedBlock.styles?.marginTop || 0)}
                                                onChange={(v) => onUpdateBlock(selectedBlockId, { styles: { ...selectedBlock.styles, marginTop: v + 'px' } })}
                                                className="flex-1"
                                            />
                                            <span className="text-[10px] font-mono text-gray-400">B</span>
                                            <Slider
                                                min={0} max={100}
                                                value={parseInt(selectedBlock.styles?.marginBottom || 0)}
                                                onChange={(v) => onUpdateBlock(selectedBlockId, { styles: { ...selectedBlock.styles, marginBottom: v + 'px' } })}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && !selectedBlock && selectedBlockId !== 'page-settings' && (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <Settings2 size={24} className="text-gray-400" />
                        </div>
                        <p className="text-sm font-bold text-gray-500">Select a component<br />to edit properties</p>
                    </div>
                )}

                {activeTab === 'preview' && (
                    <div>
                        <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-wider mb-4">
                            Preview with Real Data
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Select Employee</label>
                                <Select
                                    className="w-full"
                                    placeholder="Choose employee..."
                                    value={selectedEmployee?._id || undefined}
                                    onChange={(empId) => {
                                        const emp = employees.find(x => x._id === empId);
                                        onEmployeeChange(emp);
                                    }}
                                    options={employees.map(emp => ({
                                        label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                                        value: emp._id
                                    }))}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Select Month</label>
                                <Select
                                    className="w-full"
                                    placeholder="Choose month..."
                                    value={selectedMonth || undefined}
                                    onChange={(month) => onMonthChange(month)}
                                    options={[
                                        { label: 'February 2026', value: '2026-02' },
                                        { label: 'January 2026', value: '2026-01' },
                                        { label: 'December 2025', value: '2025-12' },
                                        { label: 'November 2025', value: '2025-11' },
                                        { label: 'October 2025', value: '2025-10' },
                                        { label: 'September 2025', value: '2025-09' },
                                        { label: 'August 2025', value: '2025-08' }
                                    ]}
                                />
                            </div>

                            {loadingPreview && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 text-blue-600">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-xs font-bold">Loading payslip data...</span>
                                </div>
                            )}

                            {previewData && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200 text-green-600">
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs font-bold">Payslip data loaded successfully</span>
                                </div>
                            )}

                            {!loadingPreview && !previewData && selectedEmployee && selectedMonth && (
                                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-600">
                                    <AlertCircle size={16} />
                                    <span className="text-xs font-bold">No payslip found for this employee/month</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-[10px] text-gray-600 font-medium leading-relaxed">
                                <b>ℹ️ Info:</b> Select an employee and month to preview your payslip template with real data from the system.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'vars' && (
                    <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Available Variables</h4>
                        <div className="space-y-4">
                            {['Employee', 'Bank', 'Period', 'Financial', 'Dynamic'].map(cat => (
                                <div key={cat}>
                                    <p className="text-[9px] font-black text-blue-600 uppercase mb-2 ml-1">{cat}</p>
                                    <div className="space-y-1">
                                        {variables.filter(v => v.cat === cat).map(v => (
                                            <div
                                                key={v.value}
                                                className="group flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100/50 hover:bg-white hover:border-blue-200 transition-all cursor-pointer"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(v.value);
                                                    message.success(`Copied ${v.value}`);
                                                }}
                                            >
                                                <span className="text-[10px] font-bold text-gray-700">{v.label}</span>
                                                <code className="text-[9px] px-1.5 py-0.5 bg-white border border-gray-200 rounded text-blue-600 font-mono group-hover:bg-blue-600 group-hover:text-white transition-all">{v.value}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                                <b>Pro Tip:</b> Use these variables in Text blocks or Payslip Titles. The system will automatically replace them with real data during payroll generation.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PageSettings({ config, onUpdateConfig }) {
    return (
        <div className="animate-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm font-black text-gray-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <Palette size={16} className="text-blue-600" /> Page Settings
            </h3>
            <div className="space-y-6">
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Background Color</label>
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <ColorPicker
                            value={config.styles?.backgroundColor || '#ffffff'}
                            onChange={(color) => onUpdateConfig({ ...config, styles: { ...config.styles, backgroundColor: color.toHexString() } })}
                        />
                        <span className="text-xs font-mono font-bold text-gray-500">{config.styles?.backgroundColor || '#ffffff'}</span>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Base Font Family</label>
                    <Select
                        className="w-full"
                        value={config.styles?.fontFamily || 'Inter'}
                        onChange={(v) => onUpdateConfig({ ...config, styles: { ...config.styles, fontFamily: v } })}
                        options={[
                            { label: 'Inter', value: 'Inter' },
                            { label: 'Roboto', value: 'Roboto' },
                            { label: 'Montserrat', value: 'Montserrat' },
                            { label: 'Merriweather', value: 'Merriweather' },
                        ]}
                    />
                </div>

                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Default Margins</label>
                    <Slider
                        min={0} max={100}
                        value={parseInt(config.styles?.padding || 30)}
                        onChange={(v) => onUpdateConfig({ ...config, styles: { ...config.styles, padding: v + 'px' } })}
                    />
                </div>
            </div>
        </div>
    );
}

function BlockSpecificSettings({ block, onUpdate, variables }) {
    const { type, content } = block;

    const change = (key, value) => {
        onUpdate({ ...content, [key]: value });
    };

    switch (type) {
        case 'text':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Text Content</label>
                        <Input.TextArea
                            rows={4}
                            value={content.text}
                            onChange={(e) => change('text', e.target.value)}
                            className="text-xs"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Align</label>
                            <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                {['left', 'center', 'right'].map(a => (
                                    <button
                                        key={a}
                                        onClick={() => change('align', a)}
                                        className={`flex-1 flex items-center justify-center p-1.5 rounded-md ${content.align === a ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        {a === 'left' && <AlignLeft size={14} />}
                                        {a === 'center' && <AlignCenter size={14} />}
                                        {a === 'right' && <AlignRight size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Weight</label>
                            <button
                                onClick={() => change('weight', content.weight === 'bold' ? 'normal' : 'bold')}
                                className={`w-full flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${content.weight === 'bold' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'}`}
                            >
                                <Bold size={14} /> <span className="text-[10px] font-bold">BOLD</span>
                            </button>
                        </div>
                    </div>
                </div>
            );

        case 'company-header':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Company Name</label>
                        <Input
                            value={content.companyName ?? ''}
                            onChange={e => change('companyName', e.target.value)}
                            className="text-xs"
                            placeholder="Enter company name"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Company Name Size</label>
                        <Select
                            className="w-full"
                            value={content.companyNameSize || '24px'}
                            onChange={v => change('companyNameSize', v)}
                            options={[
                                { label: 'Small (18px)', value: '18px' },
                                { label: 'Medium (24px)', value: '24px' },
                                { label: 'Large (32px)', value: '32px' },
                                { label: 'XL (40px)', value: '40px' }
                            ]}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Show Logo</span>
                        <Switch size="small" checked={content.showLogo} onChange={v => change('showLogo', v)} />
                    </div>

                    {content.showLogo && (
                        <>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Upload Logo</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                const base64 = event.target?.result;
                                                change('logoImage', base64);
                                                console.log('✅ Logo uploaded');
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs cursor-pointer hover:border-blue-400 transition-colors"
                                />
                                <p className="text-[9px] text-gray-400 mt-1">PNG, JPG, or GIF (Max 2MB)</p>
                            </div>

                            {content.logoImage && (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-2">Logo Preview</p>
                                    <img
                                        src={content.logoImage}
                                        alt="Logo"
                                        className="h-12 rounded-lg border border-gray-200"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Logo Size</label>
                                <Select
                                    className="w-full"
                                    value={content.logoSize || '80px'}
                                    onChange={v => change('logoSize', v)}
                                    options={[
                                        { label: 'Small (60px)', value: '60px' },
                                        { label: 'Medium (80px)', value: '80px' },
                                        { label: 'Large (100px)', value: '100px' },
                                        { label: 'XL (120px)', value: '120px' }
                                    ]}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Logo Position</label>
                        <Select
                            className="w-full"
                            value={content.logoAlign}
                            onChange={v => change('logoAlign', v)}
                            options={[{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }]}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Show Address</span>
                        <Switch size="small" checked={content.showAddress} onChange={v => change('showAddress', v)} />
                    </div>

                    {content.showAddress && (
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Company Address</label>
                            <Input.TextArea
                                rows={3}
                                value={content.companyAddress ?? ''}
                                onChange={e => change('companyAddress', e.target.value)}
                                placeholder="Enter company address..."
                                className="text-xs"
                            />
                        </div>
                    )}
                </div>
            );

        case 'payslip-title':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Title Template</label>
                        <Input
                            value={content.text}
                            onChange={e => change('text', e.target.value)}
                            className="text-xs"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Align</label>
                            <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                {['left', 'center', 'right'].map(a => (
                                    <button
                                        key={a}
                                        onClick={() => change('align', a)}
                                        className={`flex-1 flex items-center justify-center p-1.5 rounded-md ${content.align === a ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        {a === 'left' && <AlignLeft size={14} />}
                                        {a === 'center' && <AlignCenter size={14} />}
                                        {a === 'right' && <AlignRight size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Weight</label>
                            <button
                                onClick={() => change('weight', content.weight === 'bold' ? 'normal' : 'bold')}
                                className={`w-full flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${content.weight === 'bold' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'}`}
                            >
                                <Bold size={14} /> <span className="text-[10px] font-bold uppercase">{content.weight || 'NORMAL'}</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Size</label>
                        <Select
                            className="w-full"
                            value={content.size || '14px'}
                            onChange={v => change('size', v)}
                            options={[
                                { label: 'Small (12px)', value: '12px' },
                                { label: 'Standard (14px)', value: '14px' },
                                { label: 'Medium (16px)', value: '16px' },
                                { label: 'Large (18px)', value: '18px' },
                                { label: 'Heading (20px)', value: '20px' }
                            ]}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Show Borders</span>
                        <Switch size="small" checked={content.showBorders} onChange={v => change('showBorders', v)} />
                    </div>
                </div>
            );

        case 'employee-details-grid':
            return (
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Grid Header Title</label>
                        <Input
                            value={content.title}
                            onChange={e => change('title', e.target.value)}
                            className="text-xs"
                            placeholder="e.g. Pay Summary"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Grid Columns</label>
                        <Select
                            className="w-full"
                            value={content.columns}
                            onChange={v => change('columns', v)}
                            options={[{ label: '1 Column', value: 1 }, { label: '2 Columns', value: 2 }, { label: '3 Columns', value: 3 }]}
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-50">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Configure Fields</h4>
                            <Dropdown
                                menu={{
                                    items: variables.filter(v => v.cat !== 'Dynamic').map(v => ({
                                        key: v.value,
                                        label: v.label,
                                        onClick: () => {
                                            const newField = { label: v.label, value: v.value };
                                            const currentFields = Array.isArray(content.fields) ? content.fields : [];
                                            change('fields', [...currentFields, newField]);
                                        }
                                    }))
                                }}
                                trigger={['click']}
                            >
                                <button className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all">
                                    <Plus size={12} /> Add Field
                                </button>
                            </Dropdown>
                        </div>

                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {Array.isArray(content.fields) && content.fields.map((field, idx) => {
                                const isObj = typeof field === 'object';
                                const label = isObj ? field.label : field.replace(/_/g, ' ');
                                const val = isObj ? field.value : `{{${field}}}`;

                                return (
                                    <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-black text-blue-500 uppercase">Field {idx + 1}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        const newFields = [...content.fields];
                                                        const removed = newFields.splice(idx, 1);
                                                        change('fields', newFields);
                                                    }}
                                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Input
                                                size="small"
                                                prefix={<span className="text-[9px] font-bold text-gray-400 w-10">LABEL</span>}
                                                value={label}
                                                onChange={(e) => {
                                                    const newFields = [...content.fields];
                                                    if (isObj) newFields[idx] = { ...field, label: e.target.value };
                                                    else newFields[idx] = { label: e.target.value, value: val };
                                                    change('fields', newFields);
                                                }}
                                                className="text-[10px]"
                                            />
                                            <Input
                                                size="small"
                                                prefix={<span className="text-[9px] font-bold text-gray-400 w-10">VALUE</span>}
                                                value={val}
                                                onChange={(e) => {
                                                    const newFields = [...content.fields];
                                                    if (isObj) newFields[idx] = { ...field, value: e.target.value };
                                                    else newFields[idx] = { label: label, value: e.target.value };
                                                    change('fields', newFields);
                                                }}
                                                className="text-[10px] font-mono text-blue-600"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );

        case 'earnings-table':
        case 'deductions-table':
        case 'reimbursements-table':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Table Title</label>
                        <Input
                            value={content.title}
                            onChange={e => change('title', e.target.value)}
                            className="text-xs"
                        />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">Show YTD Column</span>
                        <Switch size="small" checked={content.showYTD} onChange={v => change('showYTD', v)} />
                    </div>

                    {/* Custom Rows Manager */}
                    <div className="pt-4 border-t border-gray-50">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Custom Rows</h4>
                            <button
                                onClick={() => {
                                    const newRow = { id: Date.now().toString(), name: 'New Row', amount: 0, ytd: 0 };
                                    const currentRows = Array.isArray(content.customRows) ? content.customRows : [];
                                    change('customRows', [...currentRows, newRow]);
                                    console.log('✅ New row added:', newRow);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                            >
                                <Plus size={12} /> Add Row
                            </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {Array.isArray(content.customRows) && content.customRows.length > 0 ? (
                                content.customRows.map((row, idx) => (
                                    <div key={row.id || idx} className="flex gap-2 items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <Input
                                            size="small"
                                            placeholder="Row name"
                                            value={row.name || ''}
                                            onChange={(e) => {
                                                const updatedRows = content.customRows.map((r, i) =>
                                                    i === idx ? { ...r, name: e.target.value } : r
                                                );
                                                change('customRows', updatedRows);
                                            }}
                                            className="flex-1 text-[11px]"
                                        />
                                        <Input
                                            size="small"
                                            type="number"
                                            placeholder="0"
                                            value={row.amount || 0}
                                            onChange={(e) => {
                                                const updatedRows = content.customRows.map((r, i) =>
                                                    i === idx ? { ...r, amount: parseFloat(e.target.value) || 0 } : r
                                                );
                                                change('customRows', updatedRows);
                                            }}
                                            className="w-20 text-[11px]"
                                        />
                                        <button
                                            onClick={() => {
                                                const updatedRows = content.customRows.filter((_, i) => i !== idx);
                                                change('customRows', updatedRows);
                                                console.log('❌ Row deleted');
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                            title="Delete row"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[10px] text-gray-400 italic p-3 text-center">No custom rows. Click "Add Row" to create one.</p>
                            )}
                        </div>
                    </div>
                </div>
            );

        case 'split-payroll-table':
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100 mb-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Dynamic Mode</span>
                            <span className="text-[9px] text-blue-500 font-medium leading-none mt-1">Show all employee components</span>
                        </div>
                        <Switch size="small" checked={content.dynamic} onChange={v => change('dynamic', v)} />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 px-1">Table Title</label>
                        <Input
                            value={content.title}
                            onChange={e => change('title', e.target.value)}
                            className="text-xs"
                        />
                    </div>

                    <div className="flex items-center justify-between py-2 px-1 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Show YTD Column</span>
                        <Switch size="small" checked={content.showYTD} onChange={v => change('showYTD', v)} />
                    </div>

                    {!content.dynamic ? (
                        <>
                            {/* Earnings Rows */}
                            <div className="pt-4 border-t border-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Earnings Rows</h4>
                                    <button
                                        onClick={() => {
                                            const newRow = { id: Date.now().toString(), name: 'New Earning', amount: 0, ytd: 0 };
                                            const currentRows = Array.isArray(content.customEarnings) ? content.customEarnings : [];
                                            change('customEarnings', [...currentRows, newRow]);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                                    >
                                        <Plus size={12} /> Add
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {Array.isArray(content.customEarnings) && content.customEarnings.map((row, idx) => (
                                        <div key={row.id || idx} className="flex gap-1 items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                                            <Input
                                                size="small"
                                                placeholder="Name"
                                                value={row.name || ''}
                                                onChange={(e) => {
                                                    const updatedRows = content.customEarnings.map((r, i) => i === idx ? { ...r, name: e.target.value } : r);
                                                    change('customEarnings', updatedRows);
                                                }}
                                                className="flex-1 text-[10px]"
                                            />
                                            <Input
                                                size="small"
                                                placeholder="Amt"
                                                value={row.amount}
                                                onChange={(e) => {
                                                    const updatedRows = content.customEarnings.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r);
                                                    change('customEarnings', updatedRows);
                                                }}
                                                className="w-16 text-[10px]"
                                            />
                                            <button
                                                onClick={() => {
                                                    const updatedRows = content.customEarnings.filter((_, i) => i !== idx);
                                                    change('customEarnings', updatedRows);
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Deductions Rows */}
                            <div className="pt-4 border-t border-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-wider">Deductions Rows</h4>
                                    <button
                                        onClick={() => {
                                            const newRow = { id: Date.now().toString(), name: 'New Deduction', amount: 0, ytd: 0 };
                                            const currentRows = Array.isArray(content.customDeductions) ? content.customDeductions : [];
                                            change('customDeductions', [...currentRows, newRow]);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                                    >
                                        <Plus size={12} /> Add
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {Array.isArray(content.customDeductions) && content.customDeductions.map((row, idx) => (
                                        <div key={row.id || idx} className="flex gap-1 items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                                            <Input
                                                size="small"
                                                placeholder="Name"
                                                value={row.name || ''}
                                                onChange={(e) => {
                                                    const updatedRows = content.customDeductions.map((r, i) => i === idx ? { ...r, name: e.target.value } : r);
                                                    change('customDeductions', updatedRows);
                                                }}
                                                className="flex-1 text-[10px]"
                                            />
                                            <Input
                                                size="small"
                                                placeholder="Amt"
                                                value={row.amount}
                                                onChange={(e) => {
                                                    const updatedRows = content.customDeductions.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r);
                                                    change('customDeductions', updatedRows);
                                                }}
                                                className="w-16 text-[10px]"
                                            />
                                            <button
                                                onClick={() => {
                                                    const updatedRows = content.customDeductions.filter((_, i) => i !== idx);
                                                    change('customDeductions', updatedRows);
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="pt-6 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                                <Settings2 className="text-blue-600" size={24} />
                            </div>
                            <h5 className="text-[10px] font-black text-gray-900 uppercase mb-1">Dynamic Rendering On</h5>
                            <p className="text-[9px] text-gray-400 font-medium px-4">
                                This table will automatically show all earnings and deductions assigned to the selected employee.
                            </p>
                        </div>
                    )}
                </div>
            );

        case 'net-pay-box':
            return (
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Label</label>
                        <Input
                            value={content.title}
                            onChange={e => change('title', e.target.value)}
                            className="text-xs"
                            placeholder="e.g. Total Net Payable"
                        />
                    </div>
                </div>
            );

        case 'document-footer':
            return (
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Footer Text</label>
                    <Input.TextArea
                        rows={3}
                        value={content.text}
                        onChange={e => change('text', e.target.value)}
                        className="text-xs"
                        placeholder="Enter footer disclaimer..."
                    />
                </div>
            );

        default:
            return <p className="text-[10px] text-gray-400 italic">No specific settings for this component type.</p>;
    }
}
