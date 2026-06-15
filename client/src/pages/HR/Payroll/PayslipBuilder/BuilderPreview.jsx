import React from 'react';

// Helper function to convert number to words
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
        if (n < 100) {
            return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        }
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
    };

    let words = '';
    let scaleIndex = 0;

    while (num > 0) {
        if (scaleIndex === 0) {
            const remainder = num % 1000;
            if (remainder !== 0) {
                words = convertBelow1000(remainder) + ' ' + words;
            }
            num = Math.floor(num / 1000);
        } else if (scaleIndex === 1) {
            const remainder = num % 100;
            if (remainder !== 0) {
                words = convertBelow1000(remainder) + ' ' + scales[scaleIndex] + ' ' + words;
            }
            num = Math.floor(num / 100);
        } else {
            const remainder = num % 100;
            if (remainder !== 0) {
                words = convertBelow1000(remainder) + ' ' + scales[scaleIndex] + ' ' + words;
            }
            num = Math.floor(num / 100);
        }
        scaleIndex++;
    }

    return words.trim() + ' Rupees Only';
};

export default function BuilderPreview({ config, selectedBlockId, onSelectBlock, isBuilder, previewMode, previewData }) {
    // Safety Check
    if (!config) {
        console.warn('BuilderPreview: config is undefined');
        return <div className="p-4 text-red-500 text-center">No config provided</div>;
    }

    if (!config.sections || !Array.isArray(config.sections)) {
        console.warn('BuilderPreview: config.sections is invalid', { config });
        return <div className="p-4 text-gray-500 text-center">No sections configured</div>;
    }

    const pageStyles = {
        backgroundColor: config.styles?.backgroundColor || '#ffffff',
        fontFamily: config.styles?.fontFamily || 'Inter',
        fontSize: config.styles?.fontSize || '12px',
        color: config.styles?.color || '#000000',
        padding: config.styles?.padding || '30px',
        minHeight: '100%'
    };

    return (
        <div style={pageStyles} className="relative transition-all shadow-inner">
            {config.sections.map((section) => (
                <div
                    key={section.id}
                    onClick={() => isBuilder && onSelectBlock(section.id)}
                    className={`
                        relative group transition-all
                        ${isBuilder ? 'cursor-pointer hover:bg-blue-50/30' : ''}
                        ${isBuilder && selectedBlockId === section.id ? 'ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/50 shadow-sm print:ring-0 print:bg-transparent print:shadow-none' : ''}
                        print:p-0 print:m-0
                    `}
                    style={{
                        paddingTop: section.styles?.paddingTop || '0px',
                        paddingBottom: section.styles?.paddingBottom || '0px',
                        paddingLeft: section.styles?.paddingLeft || '0px',
                        paddingRight: section.styles?.paddingRight || '0px',
                        marginTop: section.styles?.marginTop || '0px',
                        marginBottom: section.styles?.marginBottom || '0px',
                    }}
                >
                    {isBuilder && (
                        <div className={`
                            builder-section-label
                            absolute -top-6 left-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-t-lg transition-opacity duration-200 pointer-events-none z-20 print:hidden
                            ${selectedBlockId === section.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                        `}>
                            {section.type}
                        </div>
                    )}

                    <RenderComponent type={section.type} content={section.content} globalStyles={config.styles} previewData={previewData} />
                </div>
            ))}
        </div>
    );
}

function RenderComponent({ type, content, globalStyles, previewData }) {
    // Safety Check
    if (!type) {
        console.warn('RenderComponent: No type provided');
        return <div className="p-4 bg-red-50 text-red-500 rounded border border-red-200 text-sm">Missing component type</div>;
    }

    // Fallback content if not provided
    const safeContent = content || {};

    // Helper to extract employee data from previewData
    const getEmployeeData = (field) => {
        if (!previewData) return `[${field}]`;

        const mapping = {
            'EMPLOYEE_NAME': () => `${previewData.employeeDetails?.firstName || ''} ${previewData.employeeDetails?.lastName || ''}`,
            'EMPLOYEE_CODE': () => previewData.employeeDetails?.employeeCode,
            'DEPARTMENT': () => previewData.employeeDetails?.department?.name,
            'DESIGNATION': () => previewData.employeeDetails?.designation?.name,
            'DATE_OF_JOINING': () => previewData.employeeDetails?.joiningDate ? new Date(previewData.employeeDetails.joiningDate).toLocaleDateString('en-GB') : '',
            'PAN_NUMBER': () => previewData.employeeDetails?.panNumber,
            'UAN_NO': () => previewData.employeeDetails?.uanNumber,
            'PF_NO': () => previewData.employeeDetails?.pfNumber,
            'BANK_NAME': () => previewData.employeeDetails?.bankDetails?.bankName,
            'ACCOUNT_NO': () => previewData.employeeDetails?.bankDetails?.accountNumber,
            'IFSC': () => previewData.employeeDetails?.bankDetails?.ifscCode,
            'MONTH_YEAR': () => previewData.payslipDate ? new Date(previewData.payslipDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '',
            'NET_PAY': () => `₹ ${(previewData.netPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            'GROSS_EARNINGS': () => `₹ ${(previewData.grossEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            'TOTAL_DEDUCTIONS': () => `₹ ${(previewData.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            'LOP_DAYS': () => previewData.lopDays ?? 0,
            'PAID_DAYS': () => previewData.paidDays ?? 0
        };

        return mapping[field] ? mapping[field]() : `[${field}]`;
    };

    // Helper to replace variables with real data
    const replaceVars = (text) => {
        if (!text) return '';
        let result = String(text);

        // 1. Static/Mapped variables
        const vars = [
            'EMPLOYEE_NAME', 'EMPLOYEE_CODE', 'DEPARTMENT', 'DESIGNATION', 'DATE_OF_JOINING',
            'PAN_NUMBER', 'UAN_NO', 'PF_NO', 'BANK_NAME', 'ACCOUNT_NO', 'IFSC', 'MONTH_YEAR',
            'NET_PAY', 'GROSS_EARNINGS', 'TOTAL_DEDUCTIONS', 'LOP_DAYS', 'PAID_DAYS'
        ];
        vars.forEach(v => {
            const val = getEmployeeData(v);
            if (val !== `[${v}]`) {
                result = result.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), String(val));
            }
        });

        // 2. Dynamic variables from breakdown (if preview data exists)
        if (previewData) {
            const allComponents = [...(previewData.earnings || []), ...(previewData.deductions || [])];
            allComponents.forEach(comp => {
                const varName = comp.name.toUpperCase().replace(/\s+/g, '_');

                // Replace amount
                const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
                result = result.replace(regex, (comp.amount || 0).toFixed(2));

                // Replace YTD
                const ytdRegex = new RegExp(`\\{\\{YTD_${varName}\\}\\}`, 'g');
                result = result.replace(ytdRegex, (comp.ytd || 0).toFixed(2));
            });
        }

        return result;
    };

    switch (type) {
        case 'company-header':
            return (
                <div className={`flex items-center gap-6 ${safeContent.logoAlign === 'right' ? 'flex-row-reverse' : safeContent.logoAlign === 'center' ? 'flex-col' : 'flex-row'}`}>
                    {safeContent.showLogo && (
                        <div className="flex-shrink-0">
                            {safeContent.logoImage ? (
                                <img
                                    src={safeContent.logoImage}
                                    alt="Company Logo"
                                    style={{
                                        height: safeContent.logoSize || '80px',
                                        width: 'auto',
                                        maxWidth: '160px'
                                    }}
                                    className="object-contain"
                                />
                            ) : (
                                <div className="bg-gray-100 rounded flex items-center justify-center border border-gray-200 font-bold text-gray-400 text-[10px] text-center p-2 uppercase" style={{ width: safeContent.logoSize || '80px', height: safeContent.logoSize || '80px' }}>
                                    LOGO
                                </div>
                            )}
                        </div>
                    )}
                    <div className={`flex-1 ${safeContent.logoAlign === 'center' ? 'text-center' : ''}`}>
                        <h1 style={{ fontSize: safeContent.companyNameSize || '24px' }} className="font-bold text-gray-900 leading-tight">
                            {safeContent.companyName ?? ''}
                        </h1>
                        {safeContent.showAddress && (
                            <p className="text-gray-600 mt-1 whitespace-pre-line leading-relaxed text-xs">
                                {safeContent.companyAddress ?? ''}
                            </p>
                        )}
                    </div>
                </div>
            );

        case 'payslip-title':
            return (
                <div className={`py-2 px-4 my-2 mb-4 text-center ${safeContent.showBorders !== false ? 'border-y border-gray-200' : ''}`} style={{ textAlign: safeContent.align || 'center' }}>
                    <h2
                        style={{
                            fontSize: safeContent.size || '14px',
                            fontWeight: safeContent.weight === 'bold' ? '800' : 'normal'
                        }}
                        className="text-gray-900 leading-tight"
                    >
                        {replaceVars(safeContent.text || 'Payslip')}
                    </h2>
                </div>
            );

        case 'employee-details-grid':
            return (
                <div className="mb-4">
                    {safeContent.title && <h3 className="text-[11px] font-bold uppercase text-gray-900 mb-2">{safeContent.title}</h3>}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${safeContent.columns || 2}, 1fr)`,
                        gap: '5px 40px'
                    }} className="text-[11px]">
                        {safeContent.fields?.map((f, idx) => {
                            const isObj = f && typeof f === 'object';
                            const label = isObj ? f.label : String(f || '').replace(/_/g, ' ');
                            const value = isObj ? replaceVars(f.value) : getEmployeeData(f);

                            return (
                                <div key={idx} className="flex items-start">
                                    <span className="text-gray-500 w-32 shrink-0">{label}</span>
                                    <span className="text-gray-900 shrink-0 px-2">:</span>
                                    <span className="text-gray-900 font-bold flex-1">{value}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );

        case 'split-payroll-table':
            const defaultEarnings = [
                { name: 'Basic', amount: '{{BASIC}}', ytd: '{{YTD_BASIC}}' },
                { name: 'House Rent Allowance', amount: '{{HRA}}', ytd: '{{YTD_HRA}}' },
                { name: 'Conveyance Allowance', amount: '{{CONVEYANCE}}', ytd: '{{YTD_CONVEYANCE}}' },
                { name: 'Children Education Allowance', amount: '{{CEA}}', ytd: '{{YTD_CEA}}' },
                { name: 'Transport Allowance', amount: '{{TRANSPORT}}', ytd: '{{YTD_TRANSPORT}}' },
                { name: 'Fixed Medical Allowance', amount: '{{MEDICAL}}', ytd: '{{YTD_MEDICAL}}' },
                { name: 'Mobile Allowance', amount: '{{MOBILE}}', ytd: '{{YTD_MOBILE}}' },
                { name: 'Book & Periodicals', amount: '{{BOOKS}}', ytd: '{{YTD_BOOKS}}' },
                { name: 'Uniform Allowance', amount: '{{UNIFORM}}', ytd: '{{YTD_UNIFORM}}' },
                { name: 'Compensatory Allowance', amount: '{{COMPENSATORY}}', ytd: '{{YTD_COMPENSATORY}}' },
                { name: 'Fixed Allowance', amount: '{{FIXED}}', ytd: '{{YTD_FIXED}}' },
                { name: 'Bonus', amount: '{{BONUS}}', ytd: '{{YTD_BONUS}}' }
            ];

            const defaultDeductions = [
                { name: 'Professional Tax', amount: '{{PT}}', ytd: '{{YTD_PT}}' }
            ];

            const isMockData = !previewData || !previewData.earnings?.length;

            // Prepare dynamic data if requested
            let earningsData = safeContent.customEarnings || defaultEarnings;
            let deductionsData = safeContent.customDeductions || defaultDeductions;

            if (safeContent.dynamic && previewData) {
                earningsData = (previewData.earnings || []).map(e => ({
                    name: e.name,
                    amount: `{{${e.name.toUpperCase().replace(/\s+/g, '_')}}}`,
                    ytd: e.ytd
                }));
                deductionsData = (previewData.deductions || []).map(d => ({
                    name: d.name,
                    amount: `{{${d.name.toUpperCase().replace(/\s+/g, '_')}}}`,
                    ytd: d.ytd
                }));
            } else if (!isMockData) {
                // If not dynamic but we have preview data, use it
                earningsData = previewData.earnings;
                deductionsData = previewData.deductions;
            }

            const formatValue = (val, isYtd = false) => {
                if (val === undefined || val === null) return isYtd ? '-' : '₹ 0.00';
                const replaced = replaceVars(String(val));
                if (replaced.includes('{{')) return isYtd ? '-' : replaced;

                const num = parseFloat(replaced.replace(/[₹\s,]/g, ''));
                if (isNaN(num)) return replaced;
                if (num === 0 && isYtd) return '-';

                return num.toLocaleString('en-IN', { minimumFractionDigits: 2, style: 'currency', currency: 'INR' }).replace('INR', '₹');
            };

            const isMissingVar = (val) => {
                if (val === undefined || val === null) return false;
                const replaced = replaceVars(String(val));
                return replaced.includes('{{');
            };

            const grossEarningsValue = previewData?.grossEarnings || (Array.isArray(earningsData) ? earningsData.reduce((sum, item) => {
                const amt = typeof item.amount === 'number' ? item.amount : 0;
                return sum + amt;
            }, 0) : 0);

            const totalDeductionsValue = previewData?.totalDeductions || (Array.isArray(deductionsData) ? deductionsData.reduce((sum, item) => {
                const amt = typeof item.amount === 'number' ? item.amount : 0;
                return sum + amt;
            }, 0) : 0);

            const grossEarnings = isMockData ? replaceVars('{{GROSS_EARNINGS}}') : "₹ " + (grossEarningsValue).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const totalDeductions = isMockData ? replaceVars('{{TOTAL_DEDUCTIONS}}') : "₹ " + (totalDeductionsValue).toLocaleString('en-IN', { minimumFractionDigits: 2 });

            return (
                <div className="grid grid-cols-2 border border-gray-300 rounded-sm overflow-hidden mb-4">
                    {/* Earnings Side */}
                    <div className="border-r border-gray-300 flex flex-col">
                        <div className="grid grid-cols-[1fr,80px,80px] bg-gray-50 border-b border-gray-300 text-[10px] font-bold uppercase text-gray-700">
                            <div className="p-1.5 px-2">EARNINGS</div>
                            <div className="p-1.5 px-2 text-right">AMOUNT</div>
                            <div className="p-1.5 px-2 text-right">YTD</div>
                        </div>
                        <div className="flex-1 min-h-[180px]">
                            {earningsData.filter(item => !isMissingVar(item.amount)).map((item, i) => (
                                <div key={i} className="grid grid-cols-[1fr,80px,80px] text-[10px] text-gray-800 border-b border-gray-100 last:border-b-0">
                                    <div className="p-1.5 px-2 truncate leading-tight font-medium">{replaceVars(item.name || item.description)}</div>
                                    <div className="p-1.5 px-2 text-right font-bold text-gray-900">{formatValue(item.amount)}</div>
                                    <div className="p-1.5 px-2 text-right text-gray-400">{formatValue(item.ytd, true)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-[1fr,80px,80px] bg-gray-50 border-t border-gray-300 text-[10px] font-bold text-gray-900 mt-auto">
                            <div className="p-1.5 px-2">Gross Earnings</div>
                            <div className="p-1.5 px-2 text-right font-black">{grossEarnings}</div>
                            <div className="p-1.5 px-2"></div>
                        </div>
                    </div>

                    {/* Deductions Side */}
                    <div className="flex flex-col">
                        <div className="grid grid-cols-[1fr,80px,80px] bg-gray-50 border-b border-gray-300 text-[10px] font-bold uppercase text-gray-700">
                            <div className="p-1.5 px-2">DEDUCTIONS</div>
                            <div className="p-1.5 px-2 text-right">AMOUNT</div>
                            <div className="p-1.5 px-2 text-right">YTD</div>
                        </div>
                        <div className="flex-1 min-h-[180px]">
                            {deductionsData.filter(item => !isMissingVar(item.amount)).map((item, i) => (
                                <div key={i} className="grid grid-cols-[1fr,80px,80px] text-[10px] text-gray-800 border-b border-gray-100 last:border-b-0">
                                    <div className="p-1.5 px-2 truncate leading-tight font-medium">{replaceVars(item.name || item.description)}</div>
                                    <div className="p-1.5 px-2 text-right font-bold text-red-600">{formatValue(item.amount)}</div>
                                    <div className="p-1.5 px-2 text-right text-gray-400">{formatValue(item.ytd, true)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-[1fr,80px,80px] bg-gray-50 border-t border-gray-300 text-[10px] font-bold text-gray-900 mt-auto">
                            <div className="p-1.5 px-2">Total Deductions</div>
                            <div className="p-1.5 px-2 text-right font-black">{totalDeductions}</div>
                            <div className="p-1.5 px-2"></div>
                        </div>
                    </div>
                </div>
            );

        case 'net-pay-box':
            const isMockNet = !previewData || previewData.netPay === undefined;
            const netPayVal = isMockNet ? '{{NET_PAY}}' : "₹ " + (previewData.netPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const netPayWords = isMockNet ? '{{NET_PAY_WORDS}}' : numberToWords(previewData.netPay || 0);

            return (
                <div className="bg-gray-50 border-y border-gray-200 py-3 px-4 my-4 flex justify-between items-center text-gray-900">
                    <div>
                        <div className="flex items-baseline">
                            <span className="text-sm font-black uppercase tracking-tight">{content.title || 'Total Net Payable'}</span>
                            <span className="text-sm font-black ml-4">{netPayVal}</span>
                            <span className="text-[10px] text-gray-500 font-medium italic ml-2">
                                ({netPayWords})
                            </span>
                        </div>
                        <div className="text-[9px] text-gray-400 italic mt-1">
                            **Total Net Payable = Gross Earnings - Total Deductions
                        </div>
                    </div>
                </div>
            );

        case 'document-footer':
            return (
                <div className="mt-12 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-8 italic">
                    {safeContent.text || '-- This is a system-generated document. --'}
                </div>
            );

        case 'text':
            return (
                <div style={{
                    textAlign: safeContent.align || 'left',
                    fontSize: safeContent.size || '14px',
                    fontWeight: safeContent.weight || 'normal',
                    color: safeContent.color || 'inherit'
                }}>
                    {replaceVars(safeContent.text)}
                </div>
            );

        case 'divider':
            return (
                <div style={{
                    height: safeContent.thickness || '1px',
                    backgroundColor: safeContent.color || '#e5e7eb',
                    borderBottomStyle: safeContent.style || 'solid',
                    width: '100%',
                    margin: '8px 0'
                }} />
            );

        case 'spacer':
            return <div style={{ height: safeContent.height || '20px' }} />;

        default:
            return <div className="p-4 bg-gray-50 text-gray-400 text-xs text-center rounded border border-dashed">Unknown Component: {type}</div>;
    }
}
