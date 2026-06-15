import React, { useState } from "react";
import {
    Copy,
    Trash2,
    ChevronUp,
    ChevronDown,
    Plus,
} from "lucide-react";
import { PAYSLIP_PLACEHOLDERS } from "./utils/payslipUtils";

export default function PayslipLayerPanel({
    sections,
    selectedSectionId,
    onSelectSection,
    onAddSection,
    onDeleteSection,
    onDuplicateSection,
    onReorderSection,
    onRestoreDefaults,
}) {
    const [showPlaceholders, setShowPlaceholders] = useState(false);

    // ⭐ NEW MAPPING FOR NEW BUILDER TYPES
    const getSectionLabel = (section) => {
        switch (section.type) {
            case "company-header":
                return `🏢 Company Header`;

            case "payslip-title":
                return `📄 Payslip Title`;

            case "employee-grid":
                return `👤 Employee Info`;

            case "table":
                return `📊 ${section.props.title || "Table"}`;

            case "net-pay-summary":
                return `🎯 Net Pay Summary`;

            case "payslip-footer":
                return `📝 Footer`;

            default:
                return section.type;
        }
    };

    // Group placeholders by category
    const placeholderCategories = {};
    PAYSLIP_PLACEHOLDERS.forEach((ph) => {
        if (!placeholderCategories[ph.category]) {
            placeholderCategories[ph.category] = [];
        }
        placeholderCategories[ph.category].push(ph);
    });

    const sortedSections = [...(sections || [])].sort(
        (a, b) => (a.order || 0) - (b.order || 0)
    );

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* HEADER */}
            <div className="border-b border-slate-200 px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50">
                <h3 className="font-bold text-slate-900 mb-3">
                    Sections & Components
                </h3>

                <div className="relative group">
                    <button
                        className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <Plus size={14} /> Add Section
                    </button>
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                        {[
                            { type: "company-header", label: "🏢 Company Header" },
                            { type: "payslip-title", label: "📄 Payslip Title" },
                            { type: "employee-grid", label: "👤 Employee Info" },
                            { type: "split-payroll-table", label: "📊 Split Payroll Table" },
                            { type: "table", label: "📅 Single Table" },
                            { type: "net-pay-summary", label: "🎯 Net Pay Summary" },
                            { type: "separator", label: "➖ Separator / Line" },
                            { type: "payslip-footer", label: "📝 Footer" },
                        ].map((item) => (
                            <button
                                key={item.type}
                                onClick={() => onAddSection(item.type)}
                                className="w-full px-4 py-2.5 text-left text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 border-b border-slate-50 last:border-0 transition-colors"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto">

                {/* SECTION LIST */}
                <div className="p-3 space-y-2">
                    {sortedSections.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <p className="text-sm">No sections yet</p>
                            <p className="text-xs mt-1">
                                Click "Add Section" to start
                            </p>
                        </div>
                    ) : (
                        sortedSections.map((section, idx) => (
                            <div
                                key={section.id}
                                className={`p-3 rounded-lg border-2 transition cursor-pointer ${selectedSectionId === section.id
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                                onClick={() => onSelectSection(section.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                            {getSectionLabel(section)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Type: {section.type}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {/* Move Up */}
                                        {idx > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReorderSection(idx, idx - 1);
                                                }}
                                                className="p-1 hover:bg-slate-200 rounded"
                                                title="Move Up"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                        )}

                                        {/* Move Down */}
                                        {idx < sortedSections.length - 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReorderSection(idx, idx + 1);
                                                }}
                                                className="p-1 hover:bg-slate-200 rounded"
                                                title="Move Down"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        )}

                                        {/* Duplicate */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDuplicateSection(section.id);
                                            }}
                                            className="p-1 hover:bg-yellow-100 text-yellow-700 rounded"
                                            title="Duplicate"
                                        >
                                            <Copy size={14} />
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteSection(section.id);
                                            }}
                                            className="p-1 hover:bg-red-100 text-red-600 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* DIVIDER */}
                <div className="border-t border-slate-200 my-3"></div>

                {/* PLACEHOLDER DROPDOWN */}
                <div className="px-3 pb-3">
                    <button
                        onClick={() => setShowPlaceholders(!showPlaceholders)}
                        className="w-full text-left text-sm font-semibold text-slate-700 py-2 px-2 hover:bg-slate-100 rounded flex justify-between"
                    >
                        <span>📋 Available Placeholders</span>
                        <span className="text-xs">
                            {showPlaceholders ? "▼" : "▶"}
                        </span>
                    </button>

                    {showPlaceholders && (
                        <div className="mt-2 space-y-3">
                            {Object.entries(placeholderCategories).map(
                                ([category, placeholders]) => (
                                    <div key={category}>
                                        <p className="text-xs font-bold text-slate-900 mb-1.5 px-1">
                                            {category}
                                        </p>

                                        <div className="space-y-1">
                                            {placeholders.map((ph) => (
                                                <div
                                                    key={ph.name}
                                                    className="bg-slate-50 p-2 rounded border border-slate-200 text-xs hover:bg-blue-50 transition cursor-help"
                                                    title={ph.description}
                                                >
                                                    <div className="font-mono text-blue-600 font-bold">
                                                        {ph.name}
                                                    </div>
                                                    <div className="text-slate-600 text-[10px] mt-0.5">
                                                        {ph.description}
                                                    </div>
                                                    {ph.essential && (
                                                        <div className="text-red-600 text-[10px] font-bold mt-1">
                                                            ⭐ Essential
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* RESTORE DEFAULT BUTTON */}
                <div className="px-3 pb-3 border-t border-slate-200 pt-3">
                    <button
                        onClick={onRestoreDefaults}
                        className="w-full px-3 py-2 bg-amber-100 text-amber-800 text-xs font-medium rounded hover:bg-amber-200 transition border border-amber-300"
                    >
                        🔄 Restore Default Design
                    </button>
                </div>
            </div>
        </div>
    );
}
