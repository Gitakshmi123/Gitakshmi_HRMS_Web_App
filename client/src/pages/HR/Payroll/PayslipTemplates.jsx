import React, { useState, useEffect } from 'react';
import { Modal, Spin, Switch, Tooltip, Upload, Button } from 'antd';
import { showToast, showConfirmToast } from '../../../utils/uiNotifications';
import api from '../../../utils/api';
import { Edit2, Trash2, Plus, Eye, Download, FileText, CheckCircle, AlertTriangle, FileCode, Check, Upload as UploadIcon, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import usePagePermissions from '../../../hooks/usePagePermissions';

const PLACEHOLDERS = [
    '{{EMPLOYEE_NAME}}', '{{EMPLOYEE_ID}}', '{{DEPARTMENT}}', '{{DESIGNATION}}',
    '{{MONTH}}', '{{YEAR}}', '{{BASIC}}', '{{SPECIAL}}', '{{HRA}}', '{{GROSS}}',
    '{{EPF}}', '{{ESI}}', '{{PT}}', '{{INCOME_TAX}}', '{{TOTAL_DEDUCTIONS}}',
    '{{NET_PAY}}', '{{PRESENT}}', '{{LEAVES}}', '{{LOP}}', '{{TOTAL_DAYS}}',
    '{{GENERATED_ON}}'
];

const DEFAULT_HTML = `<h2 style="text-align:center">PAYSLIP</h2>
<p style="text-align:center">{{MONTH}}</p>

<div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
    <div>
        <b>{{EMPLOYEE_NAME}}</b><br/>
        ID: {{EMPLOYEE_ID}}<br/>
        Dept: {{DEPARTMENT}}<br/>
        Designation: {{DESIGNATION}}
    </div>
    <div style="text-align: right;">
        Generated on: {{GENERATED_ON}}
    </div>
</div>

<hr/>

<div style="display: flex; gap: 40px;">
    <div style="flex: 1;">
        <h4>Earnings</h4>
        <table style="width: 100%;">
            <tr><td>Basic</td><td style="text-align: right;">₹{{BASIC}}</td></tr>
            <tr><td>Special Allowance</td><td style="text-align: right;">₹{{SPECIAL}}</td></tr>
            <tr><td>HRA</td><td style="text-align: right;">₹{{HRA}}</td></tr>
            <tr style="font-weight: bold; border-top: 1px solid #eee;">
                <td>Gross Earnings</td>
                <td style="text-align: right;">₹{{GROSS}}</td>
            </tr>
        </table>
    </div>
    <div style="flex: 1;">
        <h4>Deductions</h4>
        <table style="width: 100%;">
            <tr><td>EPF</td><td style="text-align: right;">₹{{EPF}}</td></tr>
            <tr><td>ESI</td><td style="text-align: right;">₹{{ESI}}</td></tr>
            <tr><td>Professional Tax</td><td style="text-align: right;">₹{{PT}}</td></tr>
            <tr><td>Income Tax (TDS)</td><td style="text-align: right;">₹{{INCOME_TAX}}</td></tr>
            <tr style="font-weight: bold; border-top: 1px solid #eee;">
                <td>Total Deductions</td>
                <td style="text-align: right;">₹{{TOTAL_DEDUCTIONS}}</td>
            </tr>
        </table>
    </div>
</div>

<hr/>
<div style="text-align: right; margin-top: 20px;">
    <h3 style="margin: 0;">Net Payable: ₹{{NET_PAY}}</h3>
</div>

<hr/>
<div style="font-size: 12px; color: #666;">
    <b>Attendance Summary:</b> Present: {{PRESENT}}, Leaves: {{LEAVES}}, LOP: {{LOP}}, Total Days: {{TOTAL_DAYS}}
</div>`;

// Component to render BUILDER type template preview
const TemplateBuildPreview = ({ config, templateName, small = false }) => {
    const [sampleData] = useState({
        EMPLOYEE_NAME: 'John Doe',
        EMPLOYEE_ID: 'EMP001',
        DEPARTMENT: 'Engineering',
        DESIGNATION: 'Senior Developer',
        MONTH: 'January 2024',
        YEAR: '2024',
        BASIC: 50000,
        SPECIAL: 5000,
        HRA: 10000,
        GROSS: 65000,
        EPF: 1800,
        ESI: 650,
        PT: 200,
        INCOME_TAX: 5000,
        TOTAL_DEDUCTIONS: 7650,
        NET_PAY: 57350,
        PRESENT: 25,
        LEAVES: 3,
        LOP: 0,
        TOTAL_DAYS: 28,
        GENERATED_ON: new Date().toLocaleDateString()
    });

    const renderComponent = (component, key) => {
        if (!component) return null;

        const { type, content = {} } = component;

        switch (type) {
            case 'company-header':
                const align = content.logoAlign || 'left';
                const flexDir = align === 'right' ? 'row-reverse' : align === 'center' ? 'column' : 'row';
                const textAlign = align === 'center' ? 'center' : 'left';

                return (
                    <div key={key} style={{
                        display: 'flex',
                        flexDirection: flexDir,
                        alignItems: 'center', // Vertically center logo and text
                        gap: small ? '8px' : '20px',
                        textAlign: textAlign,
                        marginBottom: small ? 6 : 20,
                        paddingBottom: small ? 2 : 10,
                        borderBottom: small ? '1px solid #eee' : '2px solid #eee'
                    }}>
                        {content.showLogo && content.logoImage && (
                            <img
                                src={content.logoImage}
                                alt="Logo"
                                style={{
                                    height: small ? '28px' : (content.logoSize || '80px'),
                                    width: 'auto',
                                    objectFit: 'contain',
                                    display: 'block'
                                }}
                            />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {content.companyName && (
                                <span style={{
                                    margin: small ? '2px 0' : '0 0 5px 0',
                                    fontSize: small ? 11 : (content.companyNameSize || '24px'),
                                    fontWeight: 'bold',
                                    display: 'block',
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {content.companyName}
                                </span>
                            )}
                            {content.showAddress && content.companyAddress && !small && (
                                <p style={{ fontSize: '12px', color: '#666', margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {content.companyAddress}
                                </p>
                            )}
                        </div>
                    </div>
                );

            case 'employee-details-grid':
                if (small) return null;
                return (
                    <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <p><strong>Employee Name:</strong> {sampleData.EMPLOYEE_NAME}</p>
                            <p><strong>Employee ID:</strong> {sampleData.EMPLOYEE_ID}</p>
                            <p><strong>Department:</strong> {sampleData.DEPARTMENT}</p>
                            <p><strong>Designation:</strong> {sampleData.DESIGNATION}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p><strong>Month:</strong> {sampleData.MONTH}</p>
                            <p><strong>Generated On:</strong> {sampleData.GENERATED_ON}</p>
                        </div>
                    </div>
                );

            case 'earnings-table':
                return (
                    <div key={key} style={{ marginBottom: small ? 6 : 20 }}>
                        <span style={{ fontWeight: 'bold', fontSize: small ? 10 : 16 }}>{content.title || 'Earnings'}</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: small ? 9 : 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f5f5' }}>
                                    <th style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'left' }}>Description</th>
                                    <th style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>Amount</th>
                                    {content.showYTD && !small && <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>YTD</th>}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd' }}>Basic</td>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.BASIC}</td>
                                    {content.showYTD && !small && <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.BASIC * 3}</td>}
                                </tr>
                                <tr>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd' }}>HRA</td>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.HRA}</td>
                                    {content.showYTD && !small && <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.HRA * 3}</td>}
                                </tr>
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd' }}>Gross Earnings</td>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.GROSS}</td>
                                    {content.showYTD && !small && <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.GROSS * 3}</td>}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );

            case 'deductions-table':
                return (
                    <div key={key} style={{ marginBottom: small ? 6 : 20 }}>
                        <span style={{ fontWeight: 'bold', fontSize: small ? 10 : 16 }}>{content.title || 'Deductions'}</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: small ? 9 : 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#fee' }}>
                                    <th style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'left' }}>Description</th>
                                    <th style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>Amount</th>
                                    {content.showYTD && !small && <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>YTD</th>}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd' }}>EPF</td>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.EPF}</td>
                                    {content.showYTD && !small && <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.EPF * 3}</td>}
                                </tr>
                                <tr>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd' }}>ESI</td>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.ESI}</td>
                                    {content.showYTD && !small && <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.ESI * 3}</td>}
                                </tr>
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#faf5f5' }}>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd' }}>Total Deductions</td>
                                    <td style={{ padding: small ? 2 : 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.TOTAL_DEDUCTIONS}</td>
                                    {content.showYTD && !small && <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>₹{sampleData.TOTAL_DEDUCTIONS * 3}</td>}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );

            case 'net-pay-box':
                return (
                    <div key={key} style={{
                        padding: small ? 4 : 15,
                        backgroundColor: '#f0f9ff',
                        border: small ? '1px solid #0ea5e9' : '2px solid #0ea5e9',
                        borderRadius: 8,
                        marginBottom: small ? 6 : 20,
                        textAlign: 'center'
                    }}>
                        <span style={{ margin: 0, fontWeight: 'bold', fontSize: small ? 10 : 16 }}>{content.title || 'Net Payable'}</span>
                        <div style={{ fontSize: small ? 11 : 24, fontWeight: 'bold', margin: small ? '2px 0' : '5px 0', color: '#0369a1' }}>
                            ₹{sampleData.NET_PAY.toLocaleString()}
                        </div>
                        {!small && (
                            <p style={{ fontSize: '12px', color: '#666', margin: '5px 0', fontStyle: 'italic' }}>
                                Fifty Seven Thousand Three Hundred Fifty Rupees Only
                            </p>
                        )}
                    </div>
                );

            case 'text':
                if (small) return null;
                return (
                    <p key={key} style={{ margin: '10px 0', fontSize: content.fontSize || '14px' }}>
                        {content.text || 'Sample text'}
                    </p>
                );

            default:
                return null;
        }
    };

    if (!config || !config.sections || !Array.isArray(config.sections)) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                <p>Invalid template configuration</p>
            </div>
        );
    }

    return (
        <div style={{
            padding: small ? 6 : 40,
            backgroundColor: '#fff',
            maxWidth: small ? 320 : 800,
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif',
            fontSize: small ? 10 : 14,
            minHeight: small ? 60 : undefined,
            overflow: 'hidden'
        }}>
            {config.sections.map((section, idx) => renderComponent(section, idx))}
            {!small && <hr style={{ marginTop: '20px', borderTop: '1px solid #ddd' }} />}
            {!small && (
                <p style={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: '10px' }}>
                    This is a preview with sample data
                </p>
            )}
        </div>
    );
};

export default function PayslipTemplates() {
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('payroll.payslips');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [showSelectionModal, setShowSelectionModal] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showBuilderModal, setShowBuilderModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [selectedType, setSelectedType] = useState('HTML');
    const [fileList, setFileList] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        htmlContent: DEFAULT_HTML,
        isActive: true,
        isDefault: false,
        templateType: 'HTML'
    });
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [selectedBuilderTemplate, setSelectedBuilderTemplate] = useState(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/payslip-templates');
            setTemplates(res.data?.data || []);
        } catch (error) {
            console.error(error);
            showToast('error', 'Error', 'Failed to fetch templates');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const startCreation = () => {
        setShowSelectionModal(true);
    };

    const handleTypeSelect = (type) => {
        if (type === 'BUILDER') {
            setShowSelectionModal(false);
            navigate(`/hr/payroll/payslip-builder/new`);
            return;
        }

        setSelectedType(type);
        setFormData({
            name: '',
            htmlContent: type === 'HTML' ? DEFAULT_HTML : '',
            isActive: true,
            isDefault: templates.length === 0,
            templateType: type
        });
        setIsEditing(false);
        setCurrentId(null);
        setFileList([]);
        setShowSelectionModal(false);
        setShowModal(true);
    };

    const openEditModal = (template) => {
        if (template.templateType === 'BUILDER') {
            navigate(`/hr/payroll/payslip-builder/${template._id}`);
            return;
        }
        setFormData({
            name: template.name,
            htmlContent: template.htmlContent || '',
            isActive: template.isActive,
            isDefault: template.isDefault,
            templateType: template.templateType || 'HTML'
        });
        setSelectedType(template.templateType || 'HTML');
        setIsEditing(true);
        setCurrentId(template._id);
        setFileList([]);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedType === 'WORD' && !isEditing) {
                if (fileList.length === 0) {
                    showToast('error', 'Required', 'Please upload a Word file');
                    return;
                }

                const uploadData = new FormData();
                uploadData.append('wordFile', fileList[0].originFileObj);
                uploadData.append('name', formData.name);
                uploadData.append('isDefault', formData.isDefault);

                await api.post('/payslip-templates/upload-word', uploadData);
            } else {
                if (isEditing) {
                    await api.put(`/payslip-templates/${currentId}`, formData);
                } else {
                    await api.post('/payslip-templates', formData);
                }
            }

            setShowModal(false);
            showToast('success', 'Success', 'Template saved successfully');
            fetchTemplates();
        } catch (error) {
            console.error(error);
            showToast('error', 'Error', error.response?.data?.message || 'Failed to save template');
        }
    };

    const handleDelete = async (id) => {
        showConfirmToast({
            title: 'Delete Template',
            description: 'Are you sure you want to delete this template?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/payslip-templates/${id}`);
                    showToast('success', 'Success', 'Template deleted successfully');
                    fetchTemplates();
                } catch (error) {
                    console.error(error);
                    showToast('error', 'Error', 'Failed to delete template');
                }
            }
        });
    };

    const handlePreview = async (templateToPreview = null) => {
        // Use provided template or current formData
        const previewData = templateToPreview || formData;

        if (previewData.templateType === 'WORD') {
            showToast('info', 'Not Available', 'Preview for Word templates is coming soon. please use test generation.');
            return;
        }

        if (previewData.templateType === 'BUILDER') {
            // For BUILDER type, show the template in a modal
            setSelectedBuilderTemplate(previewData);
            setShowBuilderModal(true);
            return;
        }

        try {
            const res = await api.post('/payslip-templates/preview', {
                htmlContent: previewData.htmlContent
            });
            setPreviewHtml(res.data.data.html);
            setShowPreview(true);
        } catch (error) {
            showToast('error', 'Error', 'Failed to generate preview');
        }
    };

    const insertPlaceholder = (ph) => {
        if (selectedType === 'WORD') return;
        const textarea = document.getElementById('template-html');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const content = formData.htmlContent;
        const newContent = content.substring(0, start) + ph + content.substring(end);

        setFormData(prev => ({ ...prev, htmlContent: newContent }));

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + ph.length, start + ph.length);
        }, 0);
    };

    return (
        <div className="w-full px-4 py-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Payslip Templates
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Manage HTML or Word designs for dynamic payslips.</p>
                </div>
                {canCreate && (
                    <button
                        onClick={startCreation}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                    >
                        <Plus size={16} /> Create Template
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Spin size="large" />
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-lg shadow-sm text-gray-500 border border-slate-200">
                    No templates found. Create your first template.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(tpl => (
                        <div key={tpl._id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        {tpl.name}
                                        {tpl.isDefault && (
                                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase">Default</span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${tpl.templateType === 'WORD' ? 'bg-purple-100 text-purple-700' : (tpl.templateType === 'BUILDER' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}`}>
                                            {tpl.templateType === 'WORD' ? <FileText size={10} /> : (tpl.templateType === 'BUILDER' ? <Palette size={10} /> : <FileCode size={10} />)}
                                            {tpl.templateType || 'HTML'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(tpl.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full ${tpl.isActive ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                            </div>
                            <div className="mb-4">
                                {tpl.templateType === 'BUILDER' && tpl.builderConfig ? (
                                    <div className="border border-slate-200 rounded bg-slate-50 overflow-hidden flex items-center justify-center" style={{ height: 90, minHeight: 90, maxHeight: 90, minWidth: 180, maxWidth: 320, margin: '0 auto' }}>
                                        <TemplateBuildPreview config={tpl.builderConfig} templateName={tpl.name} small />
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 h-16 overflow-hidden bg-slate-50 p-2 rounded border border-slate-100 font-mono opacity-60">
                                        {tpl.templateType === 'WORD' ? `Word Template: ${tpl.placeholders?.length || 0} fields detected.` : (tpl.htmlContent?.substring(0, 150) + '...')}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                <div className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                                    {tpl.placeholders?.length || 0} Placeholders detected
                                </div>
                                <div className="flex gap-2">
                                    {tpl.templateType !== 'WORD' && (
                                        <button onClick={() => handlePreview(tpl)} className="text-slate-600 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-50 transition">
                                            <Eye size={16} />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => openEditModal(tpl)} className="text-slate-600 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-50 transition">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => handleDelete(tpl._id)} className="text-slate-600 hover:text-red-600 p-1.5 rounded-md hover:bg-slate-50 transition">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Selection Modal */}
            <Modal
                title="Select Template Type"
                open={showSelectionModal}
                onCancel={() => setShowSelectionModal(false)}
                footer={null}
                width={700}
                centered
            >
                <div className="grid grid-cols-3 gap-4 py-4">
                    <button
                        onClick={() => handleTypeSelect('HTML')}
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition group"
                    >
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition">
                            <FileCode size={24} />
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-slate-800">HTML Editor</div>
                            <div className="text-[10px] text-slate-500 mt-1">Write your own HTML markup with live preview.</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleTypeSelect('WORD')}
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-purple-500 hover:bg-purple-50 transition group"
                    >
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 transition">
                            <FileText size={24} />
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-slate-800">Word Template</div>
                            <div className="text-[10px] text-slate-500 mt-1">Upload a .docx file with &#123;&#123;tags&#125;&#125; placeholders.</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleTypeSelect('BUILDER')}
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition group"
                    >
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition">
                            <Palette size={24} />
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-slate-800">Visual Builder 2.0</div>
                            <div className="text-[10px] text-slate-500 mt-1">Drag & drop design with live preview. No coding needed.</div>
                        </div>
                    </button>
                </div>
            </Modal>

            {/* Editor Modal */}
            <Modal
                title={isEditing ? `Edit Template: ${formData.name}` : `New ${selectedType} Template`}
                open={showModal}
                onCancel={() => setShowModal(false)}
                width={selectedType === 'WORD' ? 600 : 1000}
                footer={null}
                className="top-5"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Template Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Performance Bonus Payslip"
                                    className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex items-center gap-6 pt-5">
                                <div className="flex items-center gap-2">
                                    <Switch size="small" checked={formData.isActive} onChange={(val) => setFormData(prev => ({ ...prev, isActive: val }))} />
                                    <label className="text-xs font-medium text-slate-700">Active</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch size="small" checked={formData.isDefault} onChange={(val) => setFormData(prev => ({ ...prev, isDefault: val }))} />
                                    <label className="text-xs font-medium text-slate-700">Default</label>
                                </div>
                            </div>
                        </div>

                        {selectedType === 'HTML' ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3 space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-semibold text-slate-600 uppercase">HTML Content</label>
                                            <button type="button" onClick={handlePreview} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                                <Eye size={12} /> Live Preview
                                            </button>
                                        </div>
                                        <textarea
                                            id="template-html"
                                            name="htmlContent"
                                            required
                                            rows={18}
                                            value={formData.htmlContent}
                                            onChange={handleInputChange}
                                            className="w-full border border-slate-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs bg-slate-900 text-emerald-400"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <h4 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">Insert Placeholder</h4>
                                    <div className="space-y-1.5 overflow-y-auto max-h-[500px]">
                                        {PLACEHOLDERS.map(ph => (
                                            <button key={ph} type="button" onClick={() => insertPlaceholder(ph)} className="w-full text-left px-2 py-1.5 border border-slate-200 text-[10px] font-mono rounded bg-white hover:bg-blue-50 transition">
                                                {ph}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 py-4">
                                {!isEditing ? (
                                    <div className="bg-slate-50 p-8 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                                        <Upload
                                            beforeUpload={() => false}
                                            fileList={fileList}
                                            onChange={({ fileList }) => setFileList(fileList.slice(-1))}
                                            accept=".docx"
                                        >
                                            <Button icon={<UploadIcon size={16} />} className="bg-white hover:border-purple-500">
                                                Click to Upload Word Template
                                            </Button>
                                        </Upload>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-slate-700">Upload your .docx file</p>
                                            <p className="text-xs text-slate-400 mt-1">Make sure to use &#123;&#123;UPPERCASE_TAGS&#125;&#125; in the document.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex items-center gap-3">
                                        <FileText className="text-purple-600" />
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">Existing Word Document Linked</div>
                                            <div className="text-xs text-slate-500">Editing Word templates properties only. Re-upload is only for new templates.</div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-amber-50 p-3 rounded border border-amber-200 flex items-start gap-2">
                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-[10px] text-amber-800 leading-tight">
                                        Note: PDF conversion requires technical accuracy. Ensure markers like <span className="font-bold">&#123;&#123;NET_PAY&#125;&#125;</span> are spelled exactly right.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50">
                            Cancel
                        </button>
                        <button type="submit" className="px-6 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                            {isEditing ? 'Update Template' : 'Save Template'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Preview Modal */}
            <Modal
                title="Template Preview (Sample Data)"
                open={showPreview}
                onCancel={() => setShowPreview(false)}
                footer={null}
                width={800}
            >
                <div className="bg-white p-8 border border-slate-200 shadow-inner max-h-[600px] overflow-y-auto rounded" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </Modal>

            {/* Builder Template Preview Modal */}
            <Modal
                title={selectedBuilderTemplate ? `Template Preview: ${selectedBuilderTemplate.name}` : 'Template Preview'}
                open={showBuilderModal}
                onCancel={() => {
                    setShowBuilderModal(false);
                    setSelectedBuilderTemplate(null);
                }}
                footer={null}
                width={900}
                styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
            >
                {selectedBuilderTemplate && selectedBuilderTemplate.builderConfig && (
                    <TemplateBuildPreview
                        config={selectedBuilderTemplate.builderConfig}
                        templateName={selectedBuilderTemplate.name}
                    />
                )}
                {(!selectedBuilderTemplate || !selectedBuilderTemplate.builderConfig) && (
                    <div className="p-8 text-center text-gray-500">
                        <p>Invalid template configuration</p>
                    </div>
                )}
            </Modal>

        </div>
    );
}
