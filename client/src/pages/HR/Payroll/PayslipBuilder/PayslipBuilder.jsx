import React, { useState, useEffect, useCallback } from 'react';
import {
    Save, ArrowLeft, Loader2, CheckCircle2, LayoutTemplate,
    Plus, Trash2, Copy, MoveUp, MoveDown, Layers, Settings2,
    Type, Image as ImageIcon, Minus, Square, Columns, Table as TableIcon,
    User, Building2, Wallet, CreditCard, FileText, ChevronRight,
    Undo2, Redo2, Monitor, Smartphone, Download, Eye
} from 'lucide-react';
import { Modal, Input, Dropdown, Button } from 'antd';
import { message } from '../../../../utils/antdGlobal';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../../utils/api';
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, AlignmentType, WidthType, BorderStyle, VerticalAlign,
    PageOrientation, HeadingLevel, HeightRule
} from 'docx';

import BuilderLayerPanel from './BuilderLayerPanel';
import BuilderPreview from './BuilderPreview';
import BuilderEditorPanel from './BuilderEditorPanel';
import ErrorBoundary from './ErrorBoundary';

export default function PayslipBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id || id === 'new';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [tempName, setTempName] = useState('');
    const [previewMode, setPreviewMode] = useState("desktop");
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Preview Data
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Core State
    const [config, setConfig] = useState({
        name: "New Payslip Template",
        sections: [],
        styles: {
            backgroundColor: '#ffffff',
            fontFamily: 'Inter',
            fontSize: '12px',
            color: '#000000',
            padding: '40px'
        }
    });

    // Variable definitions
    const variables = [
        { label: 'Employee Name', value: '{{EMPLOYEE_NAME}}', cat: 'Employee' },
        { label: 'Employee Code', value: '{{EMPLOYEE_CODE}}', cat: 'Employee' },
        { label: 'Department', value: '{{DEPARTMENT}}', cat: 'Employee' },
        { label: 'Designation', value: '{{DESIGNATION}}', cat: 'Employee' },
        { label: 'UAN', value: '{{UAN_NO}}', cat: 'Employee' },
        { label: 'PF No', value: '{{PF_NO}}', cat: 'Employee' },
        { label: 'PAN', value: '{{PAN_NUMBER}}', cat: 'Employee' },
        { label: 'Joining Date', value: '{{DATE_OF_JOINING}}', cat: 'Employee' },
        { label: 'Bank Name', value: '{{BANK_NAME}}', cat: 'Bank' },
        { label: 'Account No', value: '{{ACCOUNT_NO}}', cat: 'Bank' },
        { label: 'IFSC', value: '{{IFSC}}', cat: 'Bank' },
        { label: 'Month/Year', value: '{{MONTH_YEAR}}', cat: 'Period' },
        { label: 'Net Pay', value: '{{NET_PAY}}', cat: 'Financial' },
        { label: 'Gross Earnings', value: '{{GROSS_EARNINGS}}', cat: 'Financial' },
        { label: 'Total Deductions', value: '{{TOTAL_DEDUCTIONS}}', cat: 'Financial' },
        { label: 'LOP Days', value: '{{LOP_DAYS}}', cat: 'Financial' },
        { label: 'Paid Days', value: '{{PAID_DAYS}}', cat: 'Financial' },
        { label: 'Earnings List', value: '{{EARNINGS_LIST}}', cat: 'Dynamic' },
        { label: 'Deductions List', value: '{{DEDUCTIONS_LIST}}', cat: 'Dynamic' },
        { label: 'Reimbursements List', value: '{{REIMBURSEMENTS_LIST}}', cat: 'Dynamic' }
    ];

    useEffect(() => {
        const initBuilder = async () => {
            let companyInfo = {
                name: 'Your Company Name',
                address: '123 Business Avenue, Suite 500\nAhmedabad, Gujarat - 380015'
            };

            try {
                const tenantRes = await api.get('/tenants/me');
                if (tenantRes.data) {
                    companyInfo.name = tenantRes.data.name || companyInfo.name;
                    if (tenantRes.data.meta?.address) {
                        companyInfo.address = tenantRes.data.meta.address;
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch tenant info:', e);
            }

            if (!isNew) {
                await fetchTemplate();
            } else {
                const defaultConfig = {
                    name: "New Payslip Template",
                    sections: [
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'company-header',
                            content: {
                                showLogo: true,
                                logoSize: '80px',
                                companyName: companyInfo.name,
                                companyNameSize: '24px',
                                showAddress: true,
                                companyAddress: companyInfo.address
                            },
                            styles: { paddingTop: '20px', paddingBottom: '20px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'payslip-title',
                            content: {
                                text: 'Payslip for the month of {{MONTH_YEAR}}',
                                align: 'center',
                                size: '14px',
                                weight: 'bold',
                                showBorders: true
                            },
                            styles: { paddingTop: '10px', paddingBottom: '10px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'employee-details-grid',
                            content: {
                                title: 'Pay Summary',
                                columns: 2,
                                fields: [
                                    { label: 'Employee Name', value: '{{EMPLOYEE_NAME}}' },
                                    { label: 'Employee ID', value: '{{EMPLOYEE_CODE}}' },
                                    { label: 'Designation', value: '{{DESIGNATION}}' },
                                    { label: 'Bank Account No', value: '{{ACCOUNT_NO}}' },
                                    { label: 'Date of Joining', value: '{{DATE_OF_JOINING}}' },
                                    { label: 'LOP Days', value: '{{LOP_DAYS}}' },
                                    { label: 'Paid Days', value: '{{PAID_DAYS}}' },
                                    { label: 'PAN', value: '{{PAN_NUMBER}}' }
                                ]
                            },
                            styles: { paddingTop: '10px', paddingBottom: '10px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'split-payroll-table',
                            content: {
                                title: 'Payroll Summary',
                                customEarnings: [
                                    { name: 'Basic', amount: '{{BASIC}}', ytd: '{{YTD_BASIC}}' },
                                    { name: 'House Rent Allowance', amount: '{{HRA}}', ytd: '{{YTD_HRA}}' },
                                    { name: 'Conveyance Allowance', amount: '{{CONVEYANCE}}', ytd: '{{YTD_CONVEYANCE}}' },
                                    { name: 'Fixed Allowance', amount: '{{FIXED}}', ytd: '{{YTD_FIXED}}' }
                                ],
                                customDeductions: [
                                    { name: 'Professional Tax', amount: '{{PT}}', ytd: '{{YTD_PT}}' },
                                    { name: 'Provident Fund', amount: '{{PF}}', ytd: '{{YTD_PF}}' }
                                ],
                                showYTD: true
                            },
                            styles: { paddingTop: '10px', paddingBottom: '10px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'net-pay-box',
                            content: { title: 'Total Net Payable' },
                            styles: { paddingTop: '5px', paddingBottom: '5px' }
                        },
                        {
                            id: 'section-' + Math.random().toString(36).substr(2, 9),
                            type: 'document-footer',
                            content: { text: '-- This is a system-generated document. --' },
                            styles: { paddingTop: '20px', paddingBottom: '10px' }
                        }
                    ],
                    styles: {
                        backgroundColor: '#ffffff',
                        fontFamily: 'Inter',
                        fontSize: '12px',
                        color: '#000000',
                        padding: '30px'
                    }
                };
                setConfig(defaultConfig);
                saveToHistory(defaultConfig);
                setLoading(false);
            }
        };

        initBuilder();
        fetchEmployeesForPreview();
    }, [id, isNew]);

    const fetchEmployeesForPreview = async () => {
        try {
            const res = await api.get('/hr/employees?limit=100');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setEmployees(res.data.data);
                if (res.data.data.length > 0) {
                    setSelectedEmployee(res.data.data[0]);
                }
            }
        } catch (err) {
            console.warn('Failed to fetch employees:', err?.message);
        }
    };

    const fetchPayslipPreview = async (empId, month) => {
        if (!empId || !month) return;
        try {
            setLoadingPreview(true);
            const res = await api.get(`/payroll/payslips/${empId}?month=${month}`);
            if (res.data?.success && res.data.data) {
                setPreviewData(res.data.data);
            } else {
                setPreviewData(null);
            }
        } catch (err) {
            console.warn('Failed to fetch payslip:', err?.message);
            setPreviewData(null);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleEmployeeChange = (emp) => {
        setSelectedEmployee(emp);
        if (selectedMonth) {
            fetchPayslipPreview(emp._id, selectedMonth);
        }
    };

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        if (selectedEmployee) {
            fetchPayslipPreview(selectedEmployee._id, month);
        }
    };

    const fetchTemplate = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/payslip-templates/${id}`);
            if (res.data?.success && res.data.data) {
                const template = res.data.data;
                if (template.templateType === 'BUILDER' && template.builderConfig) {
                    setConfig(template.builderConfig);
                    saveToHistory(template.builderConfig);
                } else {
                    const fallbackConfig = {
                        name: template.name || 'Payslip Template',
                        sections: [],
                        styles: { backgroundColor: '#ffffff', padding: '30px', fontFamily: 'Inter', fontSize: '12px', color: '#000000' }
                    };
                    setConfig(fallbackConfig);
                    saveToHistory(fallbackConfig);
                }
            }
        } catch (err) {
            console.error('Template load error:', err);
            message.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const saveToHistory = (newConfig) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newConfig)));
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1];
            setConfig(JSON.parse(JSON.stringify(prev)));
            setHistoryIndex(historyIndex - 1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1];
            setConfig(JSON.parse(JSON.stringify(next)));
            setHistoryIndex(historyIndex + 1);
        }
    };

    const handleSave = async () => {
        if (isNew) {
            setTempName(config.name === 'New Payslip Template' ? '' : config.name);
            setSaveModalOpen(true);
            return;
        }
        await performSave(config.name);
    };

    const performSave = async (finalName) => {
        setSaving(true);
        try {
            const updatedConfig = { ...config, name: finalName };
            setConfig(updatedConfig);
            const payload = {
                name: finalName,
                templateType: 'BUILDER',
                builderConfig: updatedConfig,
                htmlContent: "<!-- BUILDER_GENERATED -->"
            };

            if (isNew) {
                const res = await api.post('/payslip-templates', payload);
                if (res.data?.success) {
                    message.success("Template created successfully");
                    navigate(`/hr/payroll/payslip-builder/${res.data.data?._id || res.data._id}`);
                }
            } else {
                await api.put(`/payslip-templates/${id}`, payload);
                message.success("Template saved successfully");
            }
        } catch (error) {
            message.error(error.response?.status === 409 ? "Template name already exists" : "Failed to save template");
        } finally {
            setSaving(false);
            setSaveModalOpen(false);
        }
    };

    const addBlock = (type) => {
        const blkId = Math.random().toString(36).substr(2, 9);
        const newBlock = {
            id: blkId,
            type,
            content: getDefaultContent(type),
            styles: getDefaultStyles(type)
        };
        const newConfig = { ...config, sections: [...config.sections, newBlock] };
        setConfig(newConfig);
        setSelectedBlockId(blkId);
        saveToHistory(newConfig);
    };

    const updateBlock = (blkId, newBlockData) => {
        const newConfig = {
            ...config,
            sections: config.sections.map(s => s.id === blkId ? { ...s, ...newBlockData } : s)
        };
        setConfig(newConfig);
        saveToHistory(newConfig);
    };

    const removeBlock = (blkId) => {
        const newConfig = {
            ...config,
            sections: config.sections.filter(s => s.id !== blkId)
        };
        setConfig(newConfig);
        if (selectedBlockId === blkId) setSelectedBlockId(null);
        saveToHistory(newConfig);
    };

    const duplicateBlock = (blkId) => {
        const index = config.sections.findIndex(s => s.id === blkId);
        if (index === -1) return;
        const original = config.sections[index];
        const copy = {
            ...JSON.parse(JSON.stringify(original)),
            id: Math.random().toString(36).substr(2, 9)
        };
        const newSections = [...config.sections];
        newSections.splice(index + 1, 0, copy);
        const newConfig = { ...config, sections: newSections };
        setConfig(newConfig);
        setSelectedBlockId(copy.id);
        saveToHistory(newConfig);
    };

    const moveBlock = (blkId, direction) => {
        const index = config.sections.findIndex(s => s.id === blkId);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === config.sections.length - 1) return;

        const newSections = [...config.sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];

        const newConfig = { ...config, sections: newSections };
        setConfig(newConfig);
        saveToHistory(newConfig);
    };

    const getDefaultContent = (type) => {
        switch (type) {
            case 'text': return { text: 'Enter your text here...', align: 'left', size: '14px', weight: 'normal' };
            case 'divider': return { thickness: '1px', color: '#e5e7eb', style: 'solid' };
            case 'spacer': return { height: '20px' };
            case 'company-header': return {
                showLogo: true,
                logoAlign: 'left',
                logoSize: '80px',
                companyName: '',
                companyNameSize: '24px',
                showAddress: true,
                companyAddress: ''
            };
            case 'payslip-title': return {
                text: 'Payslip for the month of {{MONTH_YEAR}}',
                align: 'center',
                size: '14px',
                weight: 'bold',
                showBorders: true
            };
            case 'employee-details-grid': return {
                title: 'Pay Summary',
                columns: 2,
                fields: [
                    { label: 'Employee Name', value: '{{EMPLOYEE_NAME}}' },
                    { label: 'Employee ID', value: '{{EMPLOYEE_CODE}}' },
                    { label: 'Designation', value: '{{DESIGNATION}}' },
                    { label: 'Bank Account No', value: '{{ACCOUNT_NO}}' },
                    { label: 'Date of Joining', value: '{{DATE_OF_JOINING}}' },
                    { label: 'LOP Days', value: '{{LOP_DAYS}}' },
                    { label: 'Paid Days', value: '{{PAID_DAYS}}' },
                    { label: 'PAN', value: '{{PAN_NUMBER}}' }
                ]
            };
            case 'earnings-table': return { title: 'Earnings', showYTD: true, customRows: [] };
            case 'deductions-table': return { title: 'Deductions', showYTD: true, customRows: [] };
            case 'split-payroll-table': return {
                title: 'Payroll Summary',
                customEarnings: [
                    { name: 'Basic', amount: '{{BASIC}}', ytd: '{{YTD_BASIC}}' },
                    { name: 'House Rent Allowance', amount: '{{HRA}}', ytd: '{{YTD_HRA}}' },
                    { name: 'Conveyance Allowance', amount: '{{CONVEYANCE}}', ytd: '{{YTD_CONVEYANCE}}' },
                    { name: 'Fixed Allowance', amount: '{{FIXED}}', ytd: '{{YTD_FIXED}}' }
                ],
                customDeductions: [
                    { name: 'Professional Tax', amount: '{{PT}}', ytd: '{{YTD_PT}}' },
                    { name: 'Provident Fund', amount: '{{PF}}', ytd: '{{YTD_PF}}' }
                ],
                showYTD: true
            };
            case 'reimbursements-table': return { title: 'Reimbursements', showYTD: false, customRows: [] };
            case 'net-pay-box': return { title: 'Total Net Payable', bgColor: '#f9fafb', textColor: '#111827' };
            case 'document-footer': return { text: '-- This is a system-generated document. --' };
            default: return {};
        }
    };

    const getDefaultStyles = (type) => ({
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingLeft: '0px',
        paddingRight: '0px',
        marginTop: '0px',
        marginBottom: '0px',
    });

    const exportToPDF = () => {
        const title = config.name || 'payslip-template';
        const docTitle = document.title;
        document.title = title;
        window.print();
        document.title = docTitle;
    };

    // Helper: Number to Words
    const numberToWords = (num) => {
        if (!num || num === 0) return '';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const scales = ['', 'Thousand', 'Lakh', 'Crore'];

        const convertBelow1000 = (n) => {
            if (n === 0) return '';
            if (n < 10) return ones[n];
            if (n < 20) return teens[n - 10];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
        };

        let words = '';
        let scaleIndex = 0;

        while (num > 0) {
            const remainder = num % (scaleIndex === 0 ? 1000 : 100);
            if (remainder !== 0) {
                words = convertBelow1000(remainder) + (scaleIndex > 0 ? ' ' + scales[scaleIndex] : '') + ' ' + words;
            }
            num = Math.floor(num / (scaleIndex === 0 ? 1000 : 100));
            scaleIndex++;
        }
        return words.trim() + ' Rupees Only';
    };

    const exportToWord = async () => {
        setSaving(true);
        const hide = message.loading('Generating premium Word document...', 0);

        try {
            const fetchImage = async (url) => {
                if (!url) return null;
                try {
                    const response = await fetch(url);
                    const buffer = await response.arrayBuffer();
                    return new Uint8Array(buffer);
                } catch (e) { return null; }
            };

            const docChildren = [];

            // Helper to get Employee Data
            const getEmpData = (field) => {
                if (!previewData) return `[${field}]`;
                const mapping = {
                    'EMPLOYEE_NAME': () => `${previewData.employeeDetails?.firstName || ''} ${previewData.employeeDetails?.lastName || ''}`,
                    'EMPLOYEE_CODE': () => previewData.employeeDetails?.employeeCode,
                    'DEPARTMENT': () => previewData.employeeDetails?.department?.name,
                    'DESIGNATION': () => previewData.employeeDetails?.designation?.name,
                    'DATE_OF_JOINING': () => previewData.employeeDetails?.joiningDate ? new Date(previewData.employeeDetails.joiningDate).toLocaleDateString() : '',
                    'PAN_NUMBER': () => previewData.employeeDetails?.panNumber,
                    'UAN_NO': () => previewData.employeeDetails?.uanNumber,
                    'PF_NO': () => previewData.employeeDetails?.pfNumber,
                    'BANK_NAME': () => previewData.employeeDetails?.bankDetails?.bankName,
                    'ACCOUNT_NO': () => previewData.employeeDetails?.bankDetails?.accountNumber,
                    'IFSC': () => previewData.employeeDetails?.bankDetails?.ifscCode,
                    'MONTH_YEAR': () => previewData.payslipDate ? new Date(previewData.payslipDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '',
                    'NET_PAY': () => `₹ ${(previewData.netPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    'GROSS_EARNINGS': () => `₹ ${(previewData.grossEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    'TOTAL_DEDUCTIONS': () => `₹ ${(previewData.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                };
                return mapping[field] ? mapping[field]() : `[${field}]`;
            };

            // Helper to replace variables
            const replaceVars = (text) => {
                if (!text) return '';
                let result = text;
                const vars = [
                    'EMPLOYEE_NAME', 'EMPLOYEE_CODE', 'DEPARTMENT', 'DESIGNATION', 'DATE_OF_JOINING',
                    'PAN_NUMBER', 'UAN_NO', 'PF_NO', 'BANK_NAME', 'ACCOUNT_NO', 'IFSC', 'MONTH_YEAR',
                    'NET_PAY', 'GROSS_EARNINGS', 'TOTAL_DEDUCTIONS'
                ];
                vars.forEach(v => {
                    result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), getEmpData(v));
                });
                return result;
            };

            for (const section of config.sections) {
                const { type, content, styles } = section;

                // --- COMPANY HEADER ---
                if (type === 'company-header') {
                    const logoCell = [];
                    if (content.showLogo && content.logoUrl) {
                        const imgData = await fetchImage(content.logoUrl);
                        if (imgData) {
                            const size = parseInt(content.logoSize) || 60;
                            logoCell.push(new Paragraph({
                                children: [new ImageRun({ data: imgData, transformation: { width: size, height: size } })],
                                alignment: AlignmentType.CENTER
                            }));
                        }
                    }

                    const infoCell = [
                        new Paragraph({
                            children: [new TextRun({ text: content.companyName || '', bold: true, size: 32, color: '000000' })],
                            alignment: content.logoPosition === 'right' ? AlignmentType.LEFT : AlignmentType.RIGHT
                        }),
                        ...(content.showAddress ? (content.companyAddress || '').split('\n').map(line =>
                            new Paragraph({
                                children: [new TextRun({ text: line, size: 18, color: '666666' })],
                                alignment: content.logoPosition === 'right' ? AlignmentType.LEFT : AlignmentType.RIGHT
                            })
                        ) : [])
                    ];

                    const cells = content.logoPosition === 'right'
                        ? [new TableCell({ children: infoCell, width: { size: 80, type: WidthType.PERCENTAGE } }), new TableCell({ children: logoCell, width: { size: 20, type: WidthType.PERCENTAGE } })]
                        : [new TableCell({ children: logoCell, width: { size: 20, type: WidthType.PERCENTAGE } }), new TableCell({ children: infoCell, width: { size: 80, type: WidthType.PERCENTAGE } })];

                    docChildren.push(new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                        rows: [new TableRow({ children: cells })],
                        margins: { bottom: 400 }
                    }));
                }

                // --- PAYSLIP TITLE ---
                else if (type === 'payslip-title') {
                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: replaceVars(content.text || 'Payslip'), bold: true, size: 28, allCaps: true })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 200 },
                        border: { top: { style: BorderStyle.SINGLE, space: 10, color: "EEEEEE" }, bottom: { style: BorderStyle.SINGLE, space: 10, color: "EEEEEE" } }
                    }));
                }

                // --- EMPLOYEE GRID ---
                else if (type === 'employee-details-grid') {
                    if (content.title) {
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text: content.title.toUpperCase(), bold: true, size: 20, color: '000000' })],
                            spacing: { before: 200, after: 100 }
                        }));
                    }
                    const fields = content.fields || [];
                    const rows = [];
                    for (let i = 0; i < fields.length; i += 2) {
                        const createCell = (fieldObj) => {
                            const label = typeof fieldObj === 'object' ? fieldObj.label : (fieldObj || '').replace(/_/g, ' ');
                            const val = typeof fieldObj === 'object' ? replaceVars(fieldObj.value) : getEmpData(fieldObj);

                            return new TableCell({
                                children: [new Paragraph({
                                    children: [
                                        new TextRun({ text: label + ' ', size: 18, color: '666666' }),
                                        new TextRun({ text: ': ', size: 18, color: '000000' }),
                                        new TextRun({ text: val || '', size: 18, bold: true, color: '000000' })
                                    ]
                                })],
                                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                                padding: { top: 50, bottom: 50 },
                                width: { size: 50, type: WidthType.PERCENTAGE }
                            });
                        };
                        rows.push(new TableRow({ children: [createCell(fields[i]), createCell(fields[i + 1])] }));
                    }
                    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, margins: { bottom: 300 } }));
                }

                // --- SPLIT PAYROLL TABLE ---
                else if (type === 'split-payroll-table') {
                    const createTableSide = (title, items, totalLabel, totalValue) => {
                        const tableRows = [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 16, color: '666666' })] })], shading: { fill: 'F9FAFB' }, borders: { bottom: { style: BorderStyle.SINGLE, color: 'DDDDDD' } } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'AMOUNT', bold: true, size: 16, color: '666666' })], alignment: AlignmentType.RIGHT })], shading: { fill: 'F9FAFB' }, borders: { bottom: { style: BorderStyle.SINGLE, color: 'DDDDDD' } } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'YTD', bold: true, size: 16, color: '666666' })], alignment: AlignmentType.RIGHT })], shading: { fill: 'F9FAFB' }, borders: { bottom: { style: BorderStyle.SINGLE, color: 'DDDDDD' } } })
                                ]
                            })
                        ];

                        (items || []).forEach(r => {
                            tableRows.push(new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.name || r.description || '', size: 16 })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + (r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), size: 16, bold: true })], alignment: AlignmentType.RIGHT })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + (r.ytd || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), size: 16, color: '999999' })], alignment: AlignmentType.RIGHT })] })
                                ]
                            }));
                        });

                        // Pad with empty rows if needed (to keep sides balanced in height)
                        const minRows = 8;
                        for (let k = (items?.length || 0); k < minRows; k++) {
                            tableRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: '' })] }), new TableCell({ children: [new Paragraph({ text: '' })] }), new TableCell({ children: [new Paragraph({ text: '' })] })] }));
                        }

                        // Total Row
                        tableRows.push(new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: totalLabel, bold: true, size: 16 })] })], shading: { fill: 'F9FAFB' } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }), bold: true, size: 16 })], alignment: AlignmentType.RIGHT })], shading: { fill: 'F9FAFB' } }),
                                new TableCell({ children: [new Paragraph({ text: "" })], shading: { fill: 'F9FAFB' } })
                            ]
                        }));

                        return new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: tableRows,
                            borders: { top: { style: BorderStyle.SINGLE, color: 'DDDDDD' }, bottom: { style: BorderStyle.SINGLE, color: 'DDDDDD' }, left: { style: BorderStyle.SINGLE, color: 'DDDDDD' }, right: { style: BorderStyle.SINGLE, color: 'DDDDDD' }, insideHorizontal: { style: BorderStyle.SINGLE, color: 'EEEEEE' }, insideVertical: { style: BorderStyle.SINGLE, color: 'DDDDDD' } }
                        });
                    };

                    const earningsData = previewData?.earnings?.length ? previewData.earnings : (content.customEarnings || []);
                    const deductionsData = previewData?.deductions?.length ? previewData.deductions : (content.customDeductions || []);

                    const grossValue = previewData?.grossEarnings || earningsData.reduce((sum, r) => sum + (parseFloat(replaceVars(r.amount?.toString())) || 0), 0);
                    const deductionsValue = previewData?.totalDeductions || deductionsData.reduce((sum, r) => sum + (parseFloat(replaceVars(r.amount?.toString())) || 0), 0);

                    const earningsTable = createTableSide('EARNINGS', earningsData, 'Gross Earnings', grossValue);
                    const deductionsTable = createTableSide('DEDUCTIONS', deductionsData, 'Total Deductions', deductionsValue);

                    docChildren.push(new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [earningsTable], width: { size: 50, type: WidthType.PERCENTAGE }, padding: { right: 100 } }),
                                    new TableCell({ children: [deductionsTable], width: { size: 50, type: WidthType.PERCENTAGE }, padding: { left: 100 } })
                                ]
                            })
                        ],
                        margins: { bottom: 300 }
                    }));
                }

                // --- TABLES (Earnings, Deductions, Reimbursements) ---
                else if (type.includes('table')) {
                    // (Keep existing separate tables logic for those who still use them)
                    const title = content.title || type.replace('-table', '');
                    const color = type === 'earnings-table' ? '2563EB' : type === 'deductions-table' ? 'EF4444' : '16A34A';

                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 20, color: color })],
                        spacing: { before: 200, after: 100 }
                    }));

                    const tableRows = [
                        new TableRow({
                            children: ['Description', 'Amount', 'YTD'].filter(h => h !== 'YTD' || content.showYTD).map(h => new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: '666666' })] })],
                                shading: { fill: 'F9FAFB' },
                                borders: { bottom: { style: BorderStyle.SINGLE, color: 'DDDDDD' } }
                            }))
                        })
                    ];

                    let rowsData = [];
                    if (content.customRows && content.customRows.length > 0) {
                        rowsData = content.customRows;
                    } else if (type === 'earnings-table') {
                        rowsData = previewData?.earnings || [{ name: 'Basic Salary', amount: 0, ytd: 0 }];
                    } else if (type === 'deductions-table') {
                        rowsData = previewData?.deductions || [{ name: 'EPF', amount: 0, ytd: 0 }];
                    } else {
                        rowsData = previewData?.reimbursements || [{ name: 'None', amount: 0, ytd: 0 }];
                    }

                    rowsData.forEach(r => {
                        const cells = [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.name || r.description || '', size: 18 })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + (r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), size: 18 })], alignment: AlignmentType.RIGHT })] })
                        ];
                        if (content.showYTD) {
                            cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + (r.ytd || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), size: 18, color: '999999' })], alignment: AlignmentType.RIGHT })] }));
                        }
                        tableRows.push(new TableRow({ children: cells }));
                    });

                    // Total Row
                    const totalAmt = rowsData.reduce((sum, r) => sum + (r.amount || 0), 0);
                    const totalYTD = rowsData.reduce((sum, r) => sum + (r.ytd || 0), 0);

                    const totalCells = [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL " + title.toUpperCase(), bold: true, size: 18 })] })], shading: { fill: type === 'earnings-table' ? 'EFF6FF' : type === 'deductions-table' ? 'FEF2F2' : 'F0FDF4' } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), bold: true, size: 18 })], alignment: AlignmentType.RIGHT })], shading: { fill: type === 'earnings-table' ? 'EFF6FF' : type === 'deductions-table' ? 'FEF2F2' : 'F0FDF4' } })
                    ];
                    if (content.showYTD) {
                        totalCells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "₹ " + totalYTD.toLocaleString('en-IN', { minimumFractionDigits: 2 }), size: 18 })], alignment: AlignmentType.RIGHT })], shading: { fill: type === 'earnings-table' ? 'EFF6FF' : type === 'deductions-table' ? 'FEF2F2' : 'F0FDF4' } }));
                    }
                    tableRows.push(new TableRow({ children: totalCells }));

                    docChildren.push(new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows,
                        borders: { top: { style: BorderStyle.SINGLE, color: 'EEEEEE' }, bottom: { style: BorderStyle.SINGLE, color: 'EEEEEE' }, left: { style: BorderStyle.SINGLE, color: 'EEEEEE' }, right: { style: BorderStyle.SINGLE, color: 'EEEEEE' }, insideHorizontal: { style: BorderStyle.SINGLE, color: 'EEEEEE' } }
                    }));
                    docChildren.push(new Paragraph({ text: "" })); // Spacer
                }

                // --- NET PAY BOX ---
                else if (type === 'net-pay-box') {
                    const netPay = previewData?.netPay || 0;
                    docChildren.push(new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: content.title || "NET SALARY PAYABLE", size: 16, color: '666666', bold: true })] }),
                                            new Paragraph({ children: [new TextRun({ text: `(${numberToWords(netPay)})`, size: 14, italics: true, color: '888888' })] })
                                        ],
                                        verticalAlign: VerticalAlign.CENTER,
                                        width: { size: 60, type: WidthType.PERCENTAGE },
                                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: "₹ " + netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 }), bold: true, size: 36 })], alignment: AlignmentType.RIGHT })],
                                        verticalAlign: VerticalAlign.CENTER,
                                        width: { size: 40, type: WidthType.PERCENTAGE },
                                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                                    })
                                ]
                            })
                        ],
                        borders: { top: { style: BorderStyle.SINGLE, size: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12 }, left: { style: BorderStyle.SINGLE, size: 12 }, right: { style: BorderStyle.SINGLE, size: 12 } },
                        margins: { top: 200, bottom: 200, left: 200, right: 200 }
                    }));
                }

                // --- DIVIDER ---
                else if (type === 'divider') {
                    docChildren.push(new Paragraph({
                        text: "",
                        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" } },
                        spacing: { before: 100, after: 100 }
                    }));
                }

                // --- TEXT ---
                else if (type === 'text') {
                    docChildren.push(new Paragraph({
                        children: [new TextRun({
                            text: replaceVars(content.text || ''),
                            size: content.size ? parseInt(content.size) * 2 : 24,
                            bold: content.weight === 'bold',
                            color: content.color ? content.color.replace('#', '') : '000000'
                        })],
                        alignment: content.align === 'center' ? AlignmentType.CENTER : content.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
                        spacing: { before: 100, after: 100 }
                    }));
                }

                // --- SPACER ---
                else if (type === 'spacer') {
                    docChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
                }

                // --- DOCUMENT FOOTER ---
                else if (type === 'document-footer') {
                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: replaceVars(content.text || ''), size: 16, color: '888888', italics: true })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 100 },
                        border: { top: { style: BorderStyle.SINGLE, space: 10, color: "EEEEEE" } }
                    }));
                }
            }

            const doc = new Document({
                sections: [{
                    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, right: 567, bottom: 567, left: 567 } } }, // A4 Narrow margins
                    children: docChildren
                }]
            });

            const blob = await Packer.toBlob(doc);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${config.name || 'payslip-template'}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            hide();
            message.success('Premium Word document generated!');
        } catch (err) {
            console.error(err);
            hide();
            message.error('Word export failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Loading Payslip Builder...</p>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans print:bg-white">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 px-6 py-0 z-40 shrink-0 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/hr/payslip-templates')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <LayoutTemplate size={20} className="text-blue-600" />
                                <input
                                    value={config.name}
                                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                    className="text-lg font-black text-gray-900 tracking-tight bg-transparent border-none focus:ring-0 w-64"
                                    placeholder="Enter Template Name"
                                    maxLength={60}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* History Controls */}
                        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className={`p-1.5 rounded-md ${historyIndex > 0 ? 'text-gray-700 hover:bg-white hover:shadow-sm' : 'text-gray-300'}`}
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 size={16} />
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className={`p-1.5 rounded-md ${historyIndex < history.length - 1 ? 'text-gray-700 hover:bg-white hover:shadow-sm' : 'text-gray-300'}`}
                                title="Redo (Ctrl+Y)"
                            >
                                <Redo2 size={16} />
                            </button>
                        </div>

                        {/* Preview Switcher */}
                        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setPreviewMode('desktop')}
                                className={`p-1.5 rounded-md ${previewMode === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Monitor size={16} />
                            </button>
                            <button
                                onClick={() => setPreviewMode('mobile')}
                                className={`p-1.5 rounded-md ${previewMode === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Smartphone size={16} />
                            </button>
                        </div>

                        <div className="h-6 w-px bg-gray-200"></div>

                        <Dropdown
                            menu={{
                                items: [
                                    { key: 'pdf', label: 'Download as PDF', icon: <FileText size={14} />, onClick: exportToPDF },
                                    { key: 'word', label: 'Download as Word (DOC)', icon: <div className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px] bg-blue-100 text-blue-600 rounded">W</div>, onClick: exportToWord }
                                ]
                            }}
                            placement="bottomRight"
                        >
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-all text-sm shadow-sm active:scale-95">
                                <Download size={16} className="text-blue-600" />
                                <span>Export</span>
                                <ChevronRight size={14} className="rotate-90 text-gray-400" />
                            </button>
                        </Dropdown>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg font-bold shadow-lg shadow-gray-200 hover:bg-black hover:shadow-xl transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                        >
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Template'}
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto print:block">
                    <div className="print:hidden">
                        <BuilderLayerPanel
                            config={config}
                            selectedBlockId={selectedBlockId}
                            onSelectBlock={setSelectedBlockId}
                            onMove={moveBlock}
                            onRemove={removeBlock}
                            onDuplicate={duplicateBlock}
                        />
                    </div>

                    <div className="flex-1 bg-gray-200/50 relative overflow-hidden flex flex-col items-center print:bg-white print:overflow-visible print:p-0 print:block">
                        <div className="w-full h-full p-8 overflow-y-auto scrollbar-hide flex justify-center print:p-0 print:overflow-visible print:block">
                            <div className={`builder-preview-canvas transition-all duration-500 ease-in-out print:shadow-none print:border-none print:w-full print:max-w-none print:mx-0 ${previewMode === "mobile" ? "w-[390px] min-h-[844px] bg-white shadow-2xl rounded-[40px] border-[12px] border-gray-900 overflow-y-auto scrollbar-hide relative print:rounded-none print:border-0" : "w-full max-w-[800px] bg-white shadow-2xl min-h-[1100px] border border-gray-100"}`}>
                                {previewMode === "mobile" && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-20 print:hidden"></div>}

                                <BuilderPreview
                                    config={config}
                                    selectedBlockId={selectedBlockId}
                                    onSelectBlock={setSelectedBlockId}
                                    isBuilder={true}
                                    previewMode={previewMode}
                                    previewData={previewData}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="print:hidden">
                        <BuilderEditorPanel
                            config={config}
                            selectedBlockId={selectedBlockId}
                            onUpdateConfig={setConfig}
                            onAddBlock={addBlock}
                            onUpdateBlock={updateBlock}
                            onRemoveBlock={removeBlock}
                            variables={variables}
                            employees={employees}
                            selectedEmployee={selectedEmployee}
                            selectedMonth={selectedMonth}
                            onEmployeeChange={handleEmployeeChange}
                            onMonthChange={handleMonthChange}
                            previewData={previewData}
                            loadingPreview={loadingPreview}
                        />
                    </div>
                </div>

                <Modal
                    title="Save Payslip Template"
                    open={saveModalOpen}
                    footer={null}
                    onCancel={() => setSaveModalOpen(false)}
                >
                    <div className="py-4">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Template Name</label>
                        <Input
                            placeholder="e.g., Premium Corporate Template"
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            onPressEnter={() => {
                                if (tempName.trim()) performSave(tempName);
                            }}
                            autoFocus
                        />
                        <div className="mt-6 flex justify-end gap-3">
                            <Button onClick={() => setSaveModalOpen(false)}>Cancel</Button>
                            <Button
                                type="primary"
                                loading={saving}
                                onClick={() => {
                                    if (!tempName.trim()) return message.warning('Please enter a name');
                                    performSave(tempName);
                                }}
                                className="bg-gray-900 hover:bg-black"
                            >
                                Save Template
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4; 
                        margin: 0mm; 
                    }
                    html, body {
                        width: 210mm !important;
                        height: 297mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background: white !important;
                    }
                    /* Hide EVERYTHING by default */
                    body * {
                        visibility: hidden !important;
                    }
                    /* Only show the canvas and its children */
                    .builder-preview-canvas, .builder-preview-canvas * {
                        visibility: visible !important;
                    }
                    .builder-preview-canvas {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        background: white !important;
                        padding: 15mm !important;
                        margin: 0 !important;
                        box-sizing: border-box !important;
                        box-shadow: none !important;
                        border: none !important;
                        transform: none !important;
                        z-index: 9999 !important;
                    }
                    /* Ensure no background colors or offsets from parents interfere */
                    #root, #root > div {
                        background: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                }
            ` }} />
        </ErrorBoundary>
    );
}
