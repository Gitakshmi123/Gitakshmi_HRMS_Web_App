import React from 'react';
import { Building2, Package, ArrowLeftRight } from 'lucide-react';

export default function Modules() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Module Configuration</h1>
        <p className="text-slate-500 text-sm mt-1">Configure and manage system modules, permissions, and feature settings.</p>
      </div>

      {/* Selected Company Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">Selected Company</h3>
          <button className="flex items-center gap-2 text-sm text-blue-600 font-medium px-4 py-2 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            <Building2 className="w-4 h-4" /> Change Company
          </button>
        </div>
        
        <div className="border border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-slate-800 mb-2">No Company Selected</h4>
          <p className="text-sm text-slate-500">Please select a company to view and configure active modules.</p>
        </div>
      </div>

      {/* Module config area card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col min-h-[400px]">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800">Selected Company</h3>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-32 h-32 mb-6 opacity-80">
            {/* Custom SVG illustration mimicking the box with arrow */}
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 20 L50 60 M40 30 L50 20 L60 30" stroke="#e0e7ff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 50 L50 65 L80 50 M20 65 L50 80 L80 65" stroke="#c7d2fe" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 50 L50 35 L80 50 L50 65 Z" stroke="#e0e7ff" strokeWidth="4" strokeLinejoin="round" fill="#e0e7ff" fillOpacity="0.3"/>
            </svg>
          </div>
          <h4 className="text-lg font-bold text-slate-800 mb-2">No Company Selected</h4>
          <p className="text-sm text-slate-500">Please select a company to view and configure active modules.</p>
        </div>
      </div>
    </div>
  );
}
