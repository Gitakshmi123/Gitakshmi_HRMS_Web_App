import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

// Helper function to convert number to words (kept for salary related fields)
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
        if (remainder !== 0) words = convertBelow1000(remainder) + (scaleIndex > 0 ? ' ' + scales[scaleIndex] : '') + ' ' + words;
        num = Math.floor(num / (scaleIndex === 0 ? 1000 : 100));
        scaleIndex++;
    }
    return words.trim() + ' Rupees Only';
};

export default function BuilderPreview({ config, selectedBlockId, onSelectBlock, isBuilder, previewMode, previewData }) {
    if (!config) return <div className="p-4 text-red-500 text-center">No config provided</div>;
    if (!config.sections || !Array.isArray(config.sections)) return <div className="p-4 text-gray-500 text-center">No sections configured</div>;

    const pageStyles = {
        backgroundColor: config.styles?.backgroundColor || '#ffffff',
        fontFamily: config.styles?.fontFamily || 'Inter',
        fontSize: config.styles?.fontSize || '12px',
        color: config.styles?.color || '#000000',
        padding: config.styles?.padding || '40px',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column'
    };

    return (
        <div style={pageStyles} className="relative transition-all">
            {config.sections.map((section) => (
                <div
                    key={section.id}
                    onClick={() => isBuilder && onSelectBlock(section.id)}
                    className={`
                        relative group transition-all
                        ${isBuilder ? 'cursor-pointer hover:bg-blue-50/30' : ''}
                        ${isBuilder && selectedBlockId === section.id ? 'ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/50' : ''}
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
                            absolute -top-6 left-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-t-lg transition-opacity duration-200 pointer-events-none z-20
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
    if (!type) return null;
    const safeContent = content || {};

    const replaceVars = (text) => {
        if (!text) return '';
        let result = String(text);
        if (!previewData) return result;

        Object.keys(previewData).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, String(previewData[key]));
        });
        return result;
    };

    switch (type) {
        case 'company-header':
            return (
                <div className={`flex items-center gap-6 ${safeContent.logoAlign === 'right' ? 'flex-row-reverse' : safeContent.logoAlign === 'center' ? 'flex-col' : 'flex-row'}`}>
                    {safeContent.showLogo && (
                        <div className="flex-shrink-0">
                            {safeContent.logoImage ? (
                                <img src={safeContent.logoImage} alt="Logo" style={{ height: safeContent.logoSize || '80px', width: 'auto' }} />
                            ) : (
                                <div className="bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 font-black text-slate-300 text-[10px] uppercase tracking-widest shadow-inner" style={{ width: safeContent.logoSize || '80px', height: safeContent.logoSize || '80px' }}>LOGO</div>
                            )}
                        </div>
                    )}
                    <div className={`flex-1 ${safeContent.logoAlign === 'center' ? 'text-center' : ''}`}>
                        <h1 
                            style={{ 
                                fontSize: safeContent.companyNameSize || '24px',
                                color: safeContent.companyNameColor || '#000000'
                            }} 
                            className="font-bold leading-tight"
                        >
                            {safeContent.companyName}
                        </h1>
                        {safeContent.showAddress && (
                            <p className="text-slate-500 mt-2 whitespace-pre-line leading-relaxed text-xs font-medium italic opacity-80">
                                {safeContent.companyAddress}
                            </p>
                        )}
                    </div>
                </div>
            );

        case 'employee-details-grid':
            return (
                <div className="mb-4">
                    {safeContent.title && (
                        <h3 
                            style={{ color: safeContent.titleColor || '#000000' }}
                            className="text-[11px] font-black uppercase tracking-widest mb-4 border-b border-slate-100 pb-2"
                        >
                            {safeContent.title}
                        </h3>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${safeContent.columns || 2}, 1fr)`, gap: '12px 40px' }} className="text-[11px]">
                        {safeContent.fields?.map((f, idx) => (
                            <div key={idx} className="flex items-start bg-slate-50/30 p-2 rounded-lg border border-slate-50">
                                <span className="text-slate-400 font-bold uppercase tracking-tighter w-32 shrink-0">{f.label}</span>
                                <span className="text-slate-300 shrink-0 px-2">|</span>
                                <span className="text-slate-800 font-black flex-1 truncate">{replaceVars(f.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );

        case 'document-footer':
            return (
                <div className="mt-auto text-center text-[10px] text-slate-400 border-t border-slate-100 pt-10 font-bold uppercase tracking-widest opacity-60">
                    {replaceVars(safeContent.text || '-- Generated via Gitakshmi Visual Builder --')}
                </div>
            );

        case 'text':
            return (
                <div style={{
                    textAlign: safeContent.align || 'left',
                    fontSize: safeContent.size || '14px',
                    fontWeight: safeContent.weight || 'normal',
                    color: safeContent.color || 'inherit',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6'
                }}>
                    {replaceVars(safeContent.text)}
                </div>
            );

        case 'image':
            return (
                <div style={{ textAlign: safeContent.align || 'center' }}>
                    {safeContent.url ? (
                        <img 
                            src={safeContent.url} 
                            alt="Custom" 
                            style={{ 
                                width: safeContent.width || '200px', 
                                height: 'auto',
                                display: 'inline-block' 
                            }} 
                        />
                    ) : (
                        <div className="py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                            <ImageIcon size={32} className="mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Empty Image Block</span>
                        </div>
                    )}
                </div>
            );

        case 'divider':
            return <div style={{ height: safeContent.thickness || '1px', backgroundColor: safeContent.color || '#e5e7eb', margin: '8px 0' }} />;

        case 'spacer':
            return <div style={{ height: safeContent.height || '20px' }} />;

        default:
            return <div className="p-4 bg-gray-50 text-gray-400 text-xs text-center rounded border border-dashed">Component: {type}</div>;
    }
}
