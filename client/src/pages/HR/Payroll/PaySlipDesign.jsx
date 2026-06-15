import React, { useState } from "react";
import { Eye, Save, X } from "lucide-react";

export default function PayslipDesignPage() {
  const [templateName, setTemplateName] = useState("");
  const [selectedElement, setSelectedElement] = useState(null);

  const elements = [
    { type: "employee", label: "Employee Field" },
    { type: "payroll", label: "Payroll Field" },
    { type: "column", label: "Payroll Column" },
  ];

  return (
    <div className="p-6 space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          placeholder="Template Name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="border rounded px-3 py-2 w-64"
        />
        <div className="flex gap-2">
          <button className="border px-4 py-2 rounded flex items-center gap-2 text-gray-500">
            <Eye size={16} /> Preview
          </button>
          <button className="border px-4 py-2 rounded flex items-center gap-2">
            <X size={16} /> Cancel
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
            <Save size={16} /> Save Template
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel */}
        <div className="col-span-3 bg-white rounded-lg shadow p-4 h-[75vh]">
          <h3 className="font-semibold mb-3">Elements</h3>
          <div className="space-y-2">
            {elements.map((el) => (
              <button
                key={el.type}
                onClick={() => setSelectedElement(el)}
                className="w-full border rounded px-3 py-2 text-left hover:bg-gray-50"
              >
                + {el.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="col-span-6 bg-white rounded-lg shadow border-2 border-dashed h-[75vh] flex flex-col items-center justify-center">
          <p className="font-medium text-gray-500">
            Drag elements here to build your payslip
          </p>
          <p className="text-sm text-gray-400 mt-1">Or start with a template</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            {["Monthly Salary", "Hourly Wage", "Contract / Freelancer"].map(
              (t) => (
                <div
                  key={t}
                  className="border rounded-lg p-4 text-center cursor-pointer hover:shadow"
                >
                  <p className="font-semibold">{t}</p>
                  <p className="text-xs text-gray-400">Starter template</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Properties */}
        <div className="col-span-3 bg-white rounded-lg shadow p-4 h-[75vh]">
          <h3 className="font-semibold mb-3">Properties</h3>
          {!selectedElement ? (
            <p className="text-sm text-gray-400">
              Select an element to edit
            </p>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">{selectedElement.label}</p>
              <input className="border rounded px-3 py-2 w-full" placeholder="Label" />
              <input className="border rounded px-3 py-2 w-full" placeholder="Font Size" />
              <select className="border rounded px-3 py-2 w-full">
                <option>Left</option>
                <option>Center</option>
                <option>Right</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
