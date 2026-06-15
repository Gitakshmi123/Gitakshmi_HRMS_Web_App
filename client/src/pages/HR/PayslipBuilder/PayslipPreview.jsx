import React, { useMemo, useState } from "react";
import { Plus, Info } from "lucide-react";
import { API_ROOT } from "../../../utils/api";
import {
    getSamplePayslipData,
    checkMissingEssentialPlaceholders,
    extractPlaceholders
} from "./utils/payslipUtils";

export default function PayslipPreview({ sections, selectedSectionId, onSelectSection }) {
    const sampleData = getSamplePayslipData();
    const [hoveredId, setHoveredId] = useState(null);

    const missing = useMemo(() => {
        // Simple heuristic for missing placeholders
        const allText = JSON.stringify(sections);
        return checkMissingEssentialPlaceholders(allText);
    }, [sections]);

    const replacePlaceholders = (text) => {
        if (!text || typeof text !== "string") return text;
        let fresh = text;
        Object.keys(sampleData).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, "g");
            fresh = fresh.replace(regex, sampleData[key]);
        });
        return fresh;
    };

    const resolveImageUrl = (url) => {
        if (!url || typeof url !== "string") return url;
        const processed = replacePlaceholders(url);
        // If it starts with /uploads, prepend the backend API_ROOT
        if (processed.startsWith("/uploads")) {
            return `${API_ROOT}${processed}`;
        }
        return processed;
    };

    const renderSection = (section) => {
        const isSelected = selectedSectionId === section.id;
        const isHovered = hoveredId === section.id;
        const p = section.props || section.content || {};
        const safe = (v, f = "") => (v !== undefined && v !== null ? replacePlaceholders(v) : f);

        const wrapperClass = `relative transition-all duration-200 cursor-pointer mb-6 group 
            ${isSelected ? "ring-2 ring-blue-500 ring-offset-4 rounded" : "hover:ring-1 hover:ring-blue-300 hover:ring-offset-2 rounded"}`;

        const SelectionOverlay = () => (
            <div className={`absolute -top-3 left-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-t font-bold z-10 
                ${isSelected || isHovered ? "opacity-100" : "opacity-0"}`}>
                {section.type.toUpperCase()}
            </div>
        );

        let content = null;

        switch (section.type) {
            case "company-header": {
                const align = p.headerAlign || "right";
                const isCenter = align === "center";
                const isLeft = align === "left";

                content = (
                    <div className={`flex ${isCenter ? "flex-col items-center text-center" : isLeft ? "flex-row-reverse justify-between items-start text-left" : "flex-row justify-between items-start text-right"} pb-6 border-b-2 border-slate-900 gap-6`}>
                        <div className={`${isCenter ? "w-full flex justify-center" : ""}`}>
                            {p.logo ? (
                                <img src={resolveImageUrl(p.logo)} alt="Logo" className="h-20 object-contain mb-4" />
                            ) : (
                                <div className="w-40 h-10 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase mb-4">No Logo Set</div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-slate-900 m-0 leading-tight tracking-tighter uppercase">{safe(p.companyName)}</h2>
                            <p className="text-[11px] text-slate-400 font-medium m-0 mt-1 uppercase tracking-widest">{safe(p.address)}</p>

                            <div className={`flex flex-wrap ${isCenter ? "justify-center" : isLeft ? "justify-start" : "justify-end"} gap-x-4 gap-y-1 mt-3`}>
                                <span className="text-[10px] font-bold text-slate-600 underline decoration-blue-200">{safe(p.email)}</span>
                                <span className="text-[10px] font-bold text-slate-600">{safe(p.phone)}</span>
                                {(p.extraFields || []).map((f, fi) => (
                                    <span key={fi} className="text-[10px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-slate-100">
                                        {f.label}: {safe(f.value)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );
                break;
            }

            case "payslip-title":
                content = (
                    <div style={{ textAlign: p.align || "center", marginTop: `${p.marginTop || 20}px` }}>
                        <h2 className={`text-xl font-bold m-0 ${p.underline ? "underline" : ""}`}>
                            {safe(p.title)}
                        </h2>
                    </div>
                );
                break;

            case "employee-grid":
                content = (
                    <div className="border border-slate-200 rounded overflow-hidden flex text-[12px]">
                        <div className="w-[40%] p-4 border-r border-slate-100">
                            {(p.left || []).map((i, idx) => (
                                <div key={idx} className="flex mb-1.5">
                                    <span className="w-24 text-slate-500">{i.label}</span>
                                    <span className="font-semibold">: {safe(i.value)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="w-[40%] p-4 border-r border-slate-100">
                            {(p.right || []).map((i, idx) => (
                                <div key={idx} className="flex mb-1.5">
                                    <span className="w-28 text-slate-500">{i.label}</span>
                                    <span className="font-semibold">: {safe(i.value)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="w-[20%] p-4 bg-slate-50 text-center flex flex-col justify-center border-l border-slate-100">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Net Payable</div>
                            <div className="text-2xl font-black text-blue-600 mb-4">{safe(p.netPay?.amount)}</div>
                            <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500">
                                Paid: <strong>{safe(p.netPay?.paidDays)}</strong> | LOP: <strong>{safe(p.netPay?.lopDays)}</strong>
                            </div>
                        </div>
                    </div>
                );
                break;

            case "table":
                content = (
                    <div className="table-section">
                        <h3 className="text-sm font-bold m-0 mb-2.5 text-slate-700 border-l-4 border-blue-600 pl-2.5">
                            {safe(p.title)}
                        </h3>
                        <table className="w-full border-collapse border border-slate-200">
                            <thead>
                                <tr className="bg-slate-50">
                                    {(p.columns || []).map((col, idx) => (
                                        <th key={idx} className="p-2.5 text-left border border-slate-200 text-[12px] font-semibold text-slate-600">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(p.rows || []).map((r, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-blue-50/30">
                                        {Array.isArray(r)
                                            ? r.map((cell, cIdx) => (
                                                <td key={cIdx} className={`p-2.5 border border-slate-100 text-[12px] ${cIdx > 0 ? "text-right" : ""}`}>
                                                    {safe(cell)}
                                                </td>
                                            ))
                                            : (
                                                <>
                                                    <td className="p-2.5 border border-slate-100 text-[12px]">{safe(r.label)}</td>
                                                    <td className="p-2.5 border border-slate-100 text-[12px] text-right">{safe(r.amount)}</td>
                                                    <td className="p-2.5 border border-slate-100 text-[12px] text-right">{safe(r.ytd)}</td>
                                                </>
                                            )
                                        }
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold">
                                    <td colSpan={(p.columns?.length || 3) - 1} className="p-2.5 border border-slate-200 text-[12px]">
                                        {safe(p.footerLabel)}
                                    </td>
                                    <td className="p-2.5 border border-slate-200 text-[12px] text-right text-blue-600">
                                        {safe(p.footerValue)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
                break;

            case "net-pay-summary":
                content = (
                    <div className="mt-8 border-t-2 border-slate-900 pt-8">
                        <div className="grid grid-cols-3 gap-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 border-r border-slate-200">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Earnings</div>
                                <div className="text-sm font-bold text-slate-900">{safe(p.gross)}</div>
                            </div>
                            <div className="p-4 bg-slate-50 border-r border-slate-200">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Deductions</div>
                                <div className="text-sm font-bold text-red-500">(-) {safe(p.deductions)}</div>
                            </div>
                            <div className="p-4 bg-blue-600">
                                <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Net Payable</div>
                                <div className="text-xl font-black text-white">{safe(p.netPay)}</div>
                            </div>
                        </div>

                        <div className="mt-4 px-1 flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">In Words</p>
                                <p className="text-[11px] font-bold text-slate-700 italic">
                                    {safe(p.netPayWords) || "Amount in words placeholder..."}
                                </p>
                            </div>
                        </div>
                    </div>
                );
                break;

            case "payslip-footer":
                content = (
                    <div className="pt-10 border-t border-slate-100 mt-12 bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                                <Info size={14} />
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-600 font-medium leading-relaxed whitespace-pre-wrap m-0">
                                    {safe(p.text)}
                                </p>
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        This is a computer generated document. No signature required.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
                break;

            default:
                content = <div className="p-4 border border-dashed border-slate-300 rounded text-center text-slate-400">Unknown Section: {section.type}</div>;
        }

        return (
            <div
                key={section.id}
                className={wrapperClass}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectSection(section.id);
                }}
                onMouseEnter={() => setHoveredId(section.id)}
                onMouseLeave={() => setHoveredId(null)}
            >
                <SelectionOverlay />
                {content}
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* TOOLBAR */}
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold italic shadow-md shadow-blue-100">P</div>
                    <div>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter leading-none">Smart Designer</h2>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Interactive Preview Mode</p>
                    </div>
                </div>

                {missing.length > 0 && (
                    <div className="bg-red-50 border border-red-100 px-3 py-1.5 rounded-full flex gap-2 items-center">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
                        <span className="text-red-600 font-bold text-[10px] uppercase">Missing Placeholders:</span>
                        <div className="flex gap-1">
                            {missing.map(m => (
                                <span key={m} className="px-2 py-0.5 bg-white text-red-500 rounded-full text-[9px] font-mono border border-red-100 shadow-sm">{m}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* A4 VIEWPORT CONTROLLER */}
            <div className="flex-1 overflow-auto bg-[#eef2f5] p-12 scrollbar-hide">
                <div className="mx-auto flex flex-col items-center">

                    {/* THE WHITE PAPER */}
                    <div
                        className="bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] rounded-sm overflow-hidden relative"
                        style={{
                            width: "210mm",
                            minHeight: "297mm",
                            height: "max-content", // Forces the container to grow with content
                            display: "flex",
                            flexDirection: "column"
                        }}
                        onClick={() => onSelectSection(null)}
                    >
                        {/* THE PADDING WRAPPER (SIMULATES A4 MARGINS) */}
                        <div className="p-[20mm] flex-1 flex flex-col">

                            {/* PAYSLIP CONTENT MAP */}
                            {sections.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-50 rounded-[3rem] p-20 shadow-inner bg-slate-50/20">
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl text-slate-200">
                                        <Plus size={32} />
                                    </div>
                                    <h3 className="font-black text-2xl uppercase tracking-tighter text-slate-400">Pure Canvas</h3>
                                    <p className="text-sm font-medium opacity-60">Drag or click components to build your template</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {sections.map(renderSection)}
                                </div>
                            )}

                            {/* DYNAMIC PAGE END MARKER (ALWAYS AT THE BOTTOM OF CONTENT) */}
                            <div className="mt-auto pt-20 pb-4 text-center">
                                <div className="flex items-center gap-4 justify-center opacity-10">
                                    <div className="h-[1px] flex-1 bg-slate-900" />
                                    <p className="text-[10px] font-black uppercase tracking-[1em] whitespace-nowrap">Official Document End</p>
                                    <div className="h-[1px] flex-1 bg-slate-900" />
                                </div>
                                <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest mt-4">System Generated Integrity Verified</p>
                            </div>
                        </div>

                        {/* PAGE PROGRESS INDICATOR (DECORATIVE) */}
                        <div className="absolute top-0 right-0 w-1 h-full bg-blue-500/5" />
                    </div>

                    {/* BOTTOM SPACING FOR SCROLLING */}
                    <div className="h-40 w-full shrink-0" />
                </div>
            </div>

            {/* STATUS BAR */}
            <div className="bg-slate-900 text-white/40 px-6 py-2.5 text-[9px] font-black flex justify-between uppercase tracking-widest">
                <div className="flex gap-4">
                    <span>STATUS: EDITING</span>
                    <span className="text-blue-400">TENANT: GITAKSHMI</span>
                </div>
                <div className="flex gap-4">
                    <span>FORMAT: ISO A4</span>
                    <span>SCALE: 100%</span>
                </div>
            </div>
        </div>
    );
}
