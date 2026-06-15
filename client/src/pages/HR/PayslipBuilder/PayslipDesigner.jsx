import { Trash2, Settings, Info, Plus, X, Sparkles, Upload, Loader2 } from "lucide-react";
import { message } from "../../../utils/antdGlobal";
import React from "react";
import api, { API_ROOT } from "../../../utils/api";
import { getSamplePayslipData } from "./utils/payslipUtils";

export default function PayslipDesigner({
    selectedSectionId,
    onSelectSection,
    onUpdateSection,
    onDeleteSection,
    sections
}) {
    const [uploading, setUploading] = React.useState(false);
    const sampleData = getSamplePayslipData();

    const resolveImageUrl = (url) => {
        if (!url || typeof url !== "string") return url;
        if (url.startsWith("/uploads")) return `${API_ROOT}${url}`;
        return url;
    };

    // Helper to evaluate placeholders for UI
    const evaluate = (text) => {
        if (!text || typeof text !== "string") return text;
        let fresh = text;
        Object.keys(sampleData).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, "g");
            fresh = fresh.replace(regex, sampleData[key]);
        });
        return fresh;
    };

    const selectedSection = sections?.find((s) => s.id === selectedSectionId);

    if (!selectedSection) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white border-l border-slate-200">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-200 animate-pulse">
                    <Sparkles size={40} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">Design Workspace</h3>
                <p className="text-slate-500 text-sm max-w-[240px] leading-relaxed">
                    Select any component in the preview to unlock its specific customization tools.
                </p>
            </div>
        );
    }

    const p = selectedSection.props || selectedSection.content || {};

    const handleFieldChange = (field, value) => {
        onUpdateSection({
            ...selectedSection,
            props: { ...p, [field]: value },
            content: { ...p, [field]: value }
        });
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            message.error('Only JPG, PNG and WebP allowed');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/uploads/doc', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.url) {
                handleFieldChange("logo", res.data.url);
                message.success("Logo uploaded successfully");
            }
        } catch (err) {
            message.error("Logo upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleTableCellChange = (rowIndex, colIndex, value) => {
        const rows = [...(p.rows || [])];
        if (Array.isArray(rows[rowIndex])) {
            rows[rowIndex] = [...rows[rowIndex]];
            rows[rowIndex][colIndex] = value;
        } else {
            const keys = ["label", "amount", "ytd"];
            rows[rowIndex] = { ...rows[rowIndex], [keys[colIndex]]: value };
        }
        handleFieldChange("rows", rows);
    };

    const addTableRow = () => {
        const rows = [...(p.rows || [])];
        if (rows.length > 0 && Array.isArray(rows[0])) {
            rows.push(["New Particular", "0", "0"]);
        } else {
            rows.push({ label: "New Particular", amount: "0", ytd: "0" });
        }
        handleFieldChange("rows", rows);
    };

    const deleteTableRow = (idx) => {
        handleFieldChange("rows", (p.rows || []).filter((_, i) => i !== idx));
    };

    const updateGridItem = (side, idx, field, value) => {
        const list = [...(p[side] || [])];
        list[idx] = { ...list[idx], [field]: value };
        handleFieldChange(side, list);
    };

    const addGridItem = (side) => {
        const list = [...(p[side] || [])];
        list.push({ label: "New Detail", value: "Value" });
        handleFieldChange(side, list);
    };

    const deleteGridItem = (side, idx) => {
        handleFieldChange(side, (p[side] || []).filter((_, i) => i !== idx));
    };

    return (
        <div className="h-full flex flex-col bg-white border-l border-slate-200">
            {/* HEADER */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest leading-none">
                            {selectedSection.type.replace("-", " ")}
                        </h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-black uppercase tracking-tighter">Configuration</p>
                    </div>
                </div>
                <button
                    onClick={() => onDeleteSection(selectedSection.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-all"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 scrollbar-hide">

                {/* COMPANY BRANDING */}
                {selectedSection.type === "company-header" && (
                    <div className="space-y-8">
                        {/* LOGO SECTION */}
                        <div className="p-6 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shadow-lg shadow-blue-50">
                                    <Sparkles size={12} className="text-blue-600" />
                                </div>
                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Logo Branding</h4>
                            </div>

                            <div className="relative border-4 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-blue-400 hover:bg-white transition-all group overflow-hidden bg-white/50 cursor-pointer shadow-inner">
                                {uploading ? (
                                    <div className="flex flex-col items-center py-4">
                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest animate-pulse">Processing...</p>
                                    </div>
                                ) : (
                                    <>
                                        {p.logo ? (
                                            <div className="space-y-4">
                                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xl max-w-[180px] mx-auto">
                                                    <img src={resolveImageUrl(p.logo)} alt="Logo" className="h-14 object-contain mx-auto" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Change Logo</p>
                                                    <p className="text-[9px] text-slate-400">Click to upload new file</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-12 group-hover:scale-110 transition-all shadow-lg">
                                                    <Upload size={24} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Upload Company Logo</p>
                                                    <p className="text-[9px] text-slate-400 tracking-tight">PNG, JPG, WebP (Max 2MB)</p>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                            onChange={handleLogoUpload}
                                        />
                                    </>
                                )}
                            </div>

                            <div className="px-2 pt-2">
                                <CleanField label="Or paste Image URL" value={p.logo} onChange={v => handleFieldChange("logo", v)} />
                            </div>
                        </div>

                        {/* CORE IDENTITY */}
                        <div className="space-y-6">
                            <CleanField label="Brand / Company Name" value={p.companyName} evaluate={evaluate} onChange={v => handleFieldChange("companyName", v)} />
                            <CleanField label="Address Line" value={p.address} evaluate={evaluate} onChange={v => handleFieldChange("address", v)} />

                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Header Text Alignment</label>
                                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200">
                                    {["left", "center", "right"].map(align => (
                                        <button
                                            key={align}
                                            onClick={() => handleFieldChange("headerAlign", align)}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${p.headerAlign === align || (!p.headerAlign && align === "right") ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
                                        >
                                            {align}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mt-8">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Header Info</h4>
                                <button
                                    onClick={() => {
                                        const extra = [...(p.extraFields || [])];
                                        extra.push({ label: "Label", value: "Value" });
                                        handleFieldChange("extraFields", extra);
                                    }}
                                    className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black hover:scale-105 transition-all shadow-xl shadow-blue-100 uppercase"
                                >
                                    + ADD FIELD
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <CleanField label="Official Email" value={p.email} evaluate={evaluate} onChange={v => handleFieldChange("email", v)} />
                                <CleanField label="Contact Phone" value={p.phone} evaluate={evaluate} onChange={v => handleFieldChange("phone", v)} />
                            </div>

                            {/* DYNAMIC EXTRA FIELDS */}
                            <div className="grid grid-cols-1 gap-4">
                                {(p.extraFields || []).map((field, fIdx) => (
                                    <div key={fIdx} className="group relative bg-[#f8fafc] border border-slate-100 p-5 rounded-3xl flex gap-4 items-end transition-all hover:bg-white hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-50/50">
                                        <button
                                            onClick={() => {
                                                const extra = p.extraFields.filter((_, i) => i !== fIdx);
                                                handleFieldChange("extraFields", extra);
                                            }}
                                            className="absolute -right-2 -top-2 w-7 h-7 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 shadow-xl opacity-0 group-hover:opacity-100 z-10 transition-all hover:scale-110"
                                        >
                                            <X size={14} />
                                        </button>
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Label</label>
                                            <input
                                                className="w-full text-xs font-black bg-transparent border-none p-0 focus:text-blue-600 outline-none"
                                                value={field.label}
                                                onChange={e => {
                                                    const extra = [...p.extraFields];
                                                    extra[fIdx].label = e.target.value;
                                                    handleFieldChange("extraFields", extra);
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Value</label>
                                            <input
                                                className="w-full text-xs font-medium bg-transparent border-none p-0 outline-none"
                                                value={field.value}
                                                onChange={e => {
                                                    const extra = [...p.extraFields];
                                                    extra[fIdx].value = e.target.value;
                                                    handleFieldChange("extraFields", extra);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* PAYSLIP TITLE */}
                {selectedSection.type === "payslip-title" && (
                    <div className="space-y-6">
                        <CleanField label="Main Header Text" value={p.title} evaluate={evaluate} onChange={v => handleFieldChange("title", v)} hint="{{MONTH}} {{YEAR}}" />
                        <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alignment</label>
                                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200">
                                    {["left", "center", "right"].map(align => (
                                        <button
                                            key={align}
                                            onClick={() => handleFieldChange("align", align)}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${p.align === align ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
                                        >
                                            {align}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3 text-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decoration</label>
                                <button
                                    onClick={() => handleFieldChange("underline", !p.underline)}
                                    className={`w-full py-2.5 flex items-center justify-center rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-tighter ${p.underline ? "bg-blue-50 border-blue-600 text-blue-600 shadow-inner" : "bg-white border-slate-100 text-slate-300"}`}
                                >
                                    {p.underline ? "Underline: ON" : "Underline: OFF"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PERSONNEL DETAILS (EMPLOYEE GRID) */}
                {selectedSection.type === "employee-grid" && (
                    <div className="space-y-12">
                        {["left", "right"].map((side) => (
                            <div key={side} className="space-y-6">
                                <div className="flex justify-between items-center border-b-2 border-slate-50 pb-3">
                                    <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">{side} Side Details</h4>
                                    <button onClick={() => addGridItem(side)} className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black shadow-xl shadow-blue-100 uppercase">+ ADD</button>
                                </div>
                                <div className="space-y-4">
                                    {(p[side] || []).map((item, idx) => (
                                        <div key={idx} className="group relative bg-[#f8fafc] border border-slate-100 hover:border-blue-400 p-5 rounded-3xl transition-all hover:bg-white hover:shadow-2xl hover:shadow-blue-50/50">
                                            <button onClick={() => deleteGridItem(side, idx)} className="absolute -right-3 -top-3 w-8 h-8 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 shadow-xl opacity-0 group-hover:opacity-100 z-10 transition-all hover:scale-110">
                                                <X size={14} />
                                            </button>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Label Name</label>
                                                    <input
                                                        className="w-full text-xs font-black py-1 outline-none bg-transparent focus:text-blue-600 leading-none"
                                                        value={evaluate(item.label)}
                                                        onChange={e => updateGridItem(side, idx, "label", e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Data Key</label>
                                                    <input
                                                        className="w-full text-[10px] font-mono font-bold text-slate-300 bg-transparent outline-none truncate"
                                                        value={item.value}
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* DYNAMIC DATA TABLE (EARNINGS/DEDUCTIONS) */}
                {selectedSection.type === "table" && (
                    <div className="space-y-10">
                        <CleanField label="Table Heading" value={p.title} evaluate={evaluate} onChange={v => handleFieldChange("title", v)} />

                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-900 px-5 py-3 rounded-2xl shadow-xl">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Data Structure</h4>
                                <button
                                    onClick={addTableRow}
                                    className="px-4 py-2 text-[10px] font-black bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-400/20 hover:scale-105 transition-all uppercase"
                                >
                                    + ADD ROW
                                </button>
                            </div>

                            <div className="space-y-4">
                                {(p.rows || []).map((row, rIdx) => (
                                    <div key={rIdx} className="group relative bg-white border-2 border-slate-50 hover:border-blue-400 p-6 rounded-[2rem] transition-all hover:shadow-2xl hover:shadow-blue-50/50">
                                        <button
                                            onClick={() => deleteTableRow(rIdx)}
                                            className="absolute -right-3 -top-3 w-9 h-9 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 z-10 shadow-2xl transition-all"
                                        >
                                            <X size={16} />
                                        </button>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Particular Label</label>
                                                <input
                                                    className="w-full text-base font-black border-none py-1 outline-none transition-all placeholder:text-slate-100 bg-transparent focus:text-blue-600"
                                                    value={evaluate(Array.isArray(row) ? row[0] : row.label)}
                                                    onChange={e => handleTableCellChange(rIdx, 0, e.target.value)}
                                                    placeholder="Type name here..."
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-6 pt-2">
                                                <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Amount Key</label>
                                                    <input
                                                        className="w-full text-[10px] font-mono text-blue-500 bg-transparent outline-none"
                                                        value={Array.isArray(row) ? row[1] : row.amount}
                                                        onChange={e => handleTableCellChange(rIdx, 1, e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">YTD Key</label>
                                                    <input
                                                        className="w-full text-[10px] font-mono text-slate-300 bg-transparent outline-none"
                                                        value={Array.isArray(row) ? row[2] : row.ytd}
                                                        onChange={e => handleTableCellChange(rIdx, 2, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-10 border-t-4 border-slate-50 mt-10 space-y-8">
                                <CleanField label="Summary Label (e.g. Total Earnings)" value={p.footerLabel} evaluate={evaluate} onChange={v => handleFieldChange("footerLabel", v)} />
                                <CleanField label="Dynamic Total Mapping" value={p.footerValue} evaluate={evaluate} onChange={v => handleFieldChange("footerValue", v)} />
                            </div>
                        </div>
                    </div>
                )}

                {/* NET PAY SUMMARY */}
                {selectedSection.type === "net-pay-summary" && (
                    <div className="space-y-8 p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-blue-900/10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-black text-[10px]">∑</div>
                            <h4 className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Final Calculation</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <CleanField label="Gross Mapping" value={p.gross} evaluate={evaluate} onChange={v => handleFieldChange("gross", v)} isDark />
                            <CleanField label="Deduction Mapping" value={p.deductions} evaluate={evaluate} onChange={v => handleFieldChange("deductions", v)} isDark />
                        </div>
                        <div className="pt-6 border-t border-white/10 space-y-6">
                            <CleanField label="Net Pay Placeholder" value={p.netPay} evaluate={evaluate} onChange={v => handleFieldChange("netPay", v)} isDark />
                            <CleanField label="Amount in Words (Key)" value={p.netPayWords} evaluate={evaluate} onChange={v => handleFieldChange("netPayWords", v)} isDark hint="{{NET_WORDS}}" />
                        </div>
                    </div>
                )}

                {/* NOTES & FOOTER */}
                {selectedSection.type === "payslip-footer" && (
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Document Disclaimer / Notes</label>
                            <textarea
                                className="w-full p-6 text-sm border-2 border-slate-50 focus:border-blue-500 rounded-[2rem] min-h-[220px] outline-none shadow-inner transition-all leading-relaxed font-medium bg-slate-50/50"
                                value={p.text || ""}
                                onChange={e => handleFieldChange("text", e.target.value)}
                                placeholder="Write your footer message here..."
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 opacity-50">
                                <div className="w-4 h-[1px] bg-slate-300" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Output</p>
                                <div className="flex-1 h-[1px] bg-slate-300" />
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl text-xs text-slate-500 border border-slate-100 leading-loose">
                                {evaluate(p.text)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* FOOTER INFO */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Interactive Builder v3.0</p>
                <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
            </div>
        </div>
    );
}

// 🧱 ATOMIC COMPONENTS
const CleanField = ({ label, value, onChange, hint, evaluate, isDark }) => {
    const isDynamic = String(value).includes("{{");

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-white/40" : "text-slate-400"}`}>{label}</label>
                {hint && <span className="text-[9px] font-black text-blue-500/50">{hint}</span>}
            </div>
            <div className="relative group">
                <input
                    type="text"
                    className={`w-full px-5 py-4 text-sm font-black rounded-2xl outline-none shadow-sm transition-all ${isDark
                        ? "bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-blue-500"
                        : "bg-white border-2 border-slate-50 focus:border-blue-500 text-slate-900"
                        }`}
                    value={evaluate && isDynamic ? evaluate(value) : value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="..."
                />
                {isDynamic && (
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter transition-opacity ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-500"
                        }`}>
                        Linked
                    </div>
                )}
            </div>
            {isDynamic && (
                <div className="flex items-center gap-2 pl-4">
                    <div className={`w-1 h-3 rounded-full ${isDark ? "bg-white/10" : "bg-blue-100"}`} />
                    <p className={`text-[9px] font-mono tracking-tighter ${isDark ? "text-white/20" : "text-slate-300"}`}>Key: {value}</p>
                </div>
            )}
        </div>
    );
};
