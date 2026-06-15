import React, { useState, useEffect } from "react";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { message } from "../../../utils/antdGlobal";
import api from "../../../utils/api";

import PayslipPreview from "./PayslipPreview";
import PayslipDesigner from "./PayslipDesigner";
import PayslipLayerPanel from "./PayslipLayerPanel";

// ⬇️ OUR NEW REAL DEFAULT TEMPLATE
import { DEFAULT_TEMPLATE } from "./utils/defaultTemplate";

import {
    convertDesignToHTML,
    checkMissingEssentialPlaceholders
} from "./utils/payslipUtils";

export default function PayslipBuilder({
    onClose,
    templateId = null,
    initialTemplateName = ""
}) {

    // ⭐ STATE
    const [loading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [sections, setSections] = useState([]);
    const [selectedSectionId, setSelectedSectionId] = useState(null);

    const [templateName, setTemplateName] = useState(initialTemplateName || "");
    const [showNameInput, setShowNameInput] = useState(!initialTemplateName);

    // ⭐ INITIALIZE DEFAULT TEMPLATE ON LOAD
    useEffect(() => {
        const fetchComponents = async () => {
            let baseTemplate = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));

            try {
                // 1. Fetch Earnings
                const earningsRes = await api.get("/payroll/earnings");
                const activeEarnings = earningsRes.data?.data?.filter(e => e.isActive) || [];

                if (activeEarnings.length > 0) {
                    const earningsTable = baseTemplate.find(s => s.id === "earnings-table");
                    if (earningsTable) {
                        earningsTable.props.rows = activeEarnings.map((e, idx) => [
                            e.payslipName || e.name,
                            `{{EARNING_AMOUNT_${idx + 1}}}`,
                            `{{EARNING_YTD_${idx + 1}}}`
                        ]);
                    }
                }

                // 2. Fetch Deductions
                const deductionsRes = await api.get("/deductions");
                const activeDeductions = deductionsRes.data?.data?.filter(d => d.isActive) || [];

                if (activeDeductions.length > 0) {
                    const deductionsTable = baseTemplate.find(s => s.id === "deductions-table");
                    if (deductionsTable) {
                        deductionsTable.props.rows = activeDeductions.map((d, idx) => [
                            d.name,
                            `{{DEDUCTION_AMOUNT_${idx + 1}}}`,
                            `{{DEDUCTION_YTD_${idx + 1}}}`
                        ]);
                    }
                }

            } catch (err) {
                console.warn("Could not fetch real components, using defaults:", err);
            } finally {
                setSections(baseTemplate);
                setSelectedSectionId(baseTemplate[0]?.id || null);
            }
        };

        fetchComponents();
    }, []);

    // ⭐ ADD A NEW SECTION
    const handleAddSection = () => {
        const newSection = {
            id: "section-" + Date.now(),
            type: "text-section",
            content: {
                title: "New Section",
                blocks: [
                    {
                        id: "block-" + Date.now(),
                        type: "text",
                        text: "Add your content here…",
                        fontSize: 12
                    }
                ],
                padding: 15,
                backgroundColor: "#ffffff"
            }
        };

        setSections([...sections, newSection]);
        setSelectedSectionId(newSection.id);
    };

    // ⭐ UPDATE SECTION PROPS
    const handleUpdateSection = (updated) => {
        setSections(sections.map(s => s.id === updated.id ? updated : s));
    };

    // ⭐ DELETE SECTION
    const handleDeleteSection = (id) => {
        const updated = sections.filter(s => s.id !== id);
        setSections(updated);
        setSelectedSectionId(updated[0]?.id || null);
    };

    // ⭐ DUPLICATE SECTION
    const handleDuplicateSection = (id) => {
        const found = sections.find(s => s.id === id);
        if (!found) return;

        const copy = JSON.parse(JSON.stringify(found));
        copy.id = "section-" + Date.now();

        setSections([...sections, copy]);
        setSelectedSectionId(copy.id);
        message.success("Section duplicated");
    };

    // ⭐ REORDER SECTIONS
    const handleReorderSection = (from, to) => {
        const arr = [...sections];
        const temp = arr[from];
        arr[from] = arr[to];
        arr[to] = temp;
        setSections(arr);
    };

    // ⭐ RESTORE DEFAULT TEMPLATE
    const handleRestoreDefaults = () => {
        if (window.confirm("Restore default Gitakshmi-format payslip?")) {
            setSections(DEFAULT_TEMPLATE);
            setSelectedSectionId(DEFAULT_TEMPLATE[0].id);
            message.info("Restored to default layout");
        }
    };

    // ⭐ SAVE TEMPLATE
    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            message.warning("Please enter a template name");
            setShowNameInput(true);
            return;
        }

        const html = convertDesignToHTML(sections);
        const missing = checkMissingEssentialPlaceholders(html);

        if (missing.length > 0) {
            const ok = window.confirm(
                "⚠ Missing essential placeholders:\n" +
                missing.join(", ") +
                "\nContinue anyway?"
            );
            if (!ok) return;
        }

        try {
            setSaving(true);

            const payload = {
                name: templateName.trim(),
                htmlContent: html,
                templateType: "CUSTOM",
                isActive: true,
                isDefault: false
            };

            if (templateId) {
                await api.put(`/payslip-templates/${templateId}`, payload);
                message.success("Template updated successfully");
            } else {
                await api.post(`/payslip-templates`, payload);
                message.success("Template saved successfully");
            }

            setTimeout(() => onClose?.(), 800);
        } catch (err) {
            console.error(err);
            message.error(err.response?.data?.message || "Failed to save template");
        } finally {
            setSaving(false);
        }
    };

    // ⭐ RENDER
    return (
        <div className="w-full h-screen flex flex-col bg-slate-100">

            {/* 🔵 HEADER */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center justify-between">

                    {/* Back + Title */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-blue-500 rounded-lg transition"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div>
                            <h1 className="text-2xl font-bold">🎨 Custom Payslip Builder</h1>
                            <p className="text-sm text-blue-100 mt-0.5">
                                Drag sections, customize styles, and preview in real-time
                            </p>
                        </div>
                    </div>

                    {/* Template Name + Save */}
                    <div className="flex items-center gap-3">

                        {showNameInput ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="Template name"
                                    className="px-3 py-2 rounded-lg text-slate-900 text-sm focus:ring-2 min-w-64"
                                    autoFocus
                                />
                                <button
                                    onClick={() => setShowNameInput(false)}
                                    className="px-3 py-2 bg-white text-blue-600 rounded-lg text-sm hover:bg-blue-50"
                                >
                                    ✓ Set
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => setShowNameInput(true)}
                                className="px-4 py-2 bg-white bg-opacity-20 rounded-lg cursor-pointer hover:bg-opacity-30"
                            >
                                {templateName || "Untitled Template"}
                            </div>
                        )}

                        <button
                            onClick={handleSaveTemplate}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Template
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 🔵 MAIN 3-COLUMN LAYOUT */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT PANEL */}
                <div className="w-72 border-r border-slate-300 overflow-hidden">
                    <PayslipLayerPanel
                        sections={sections}
                        selectedSectionId={selectedSectionId}
                        onSelectSection={setSelectedSectionId}
                        onAddSection={handleAddSection}
                        onDeleteSection={handleDeleteSection}
                        onDuplicateSection={handleDuplicateSection}
                        onReorderSection={handleReorderSection}
                        onRestoreDefaults={handleRestoreDefaults}
                    />
                </div>

                {/* MIDDLE PANEL */}
                <div className="w-80 border-r border-slate-300 bg-white overflow-hidden">
                    <PayslipDesigner
                        sections={sections}
                        selectedSectionId={selectedSectionId}
                        onUpdateSection={handleUpdateSection}
                        onDeleteSection={handleDeleteSection}
                        onSelectSection={setSelectedSectionId}
                    />
                </div>

                {/* RIGHT PANEL — LIVE PREVIEW */}
                <div className="flex-1 overflow-hidden bg-white">
                    <PayslipPreview
                        sections={sections}
                        selectedSectionId={selectedSectionId}
                        onSelectSection={setSelectedSectionId}
                    />
                </div>

            </div>

            {/* FOOTER */}
            <div className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-600 flex justify-between">
                <span><b>Tip:</b> Add sections on left, edit in center, preview on right.</span>
                <span>Sections: {sections.length} • Status: {selectedSectionId ? "Editing" : "Ready"}</span>
            </div>
        </div>
    );
}
