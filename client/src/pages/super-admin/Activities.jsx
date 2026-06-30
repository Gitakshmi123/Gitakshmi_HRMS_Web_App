import React from 'react';
import { Building2 } from 'lucide-react';

export default function Activities() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Activities</h1>
        <p className="text-slate-500 text-sm mt-1">Configure and manage system modules, permissions, and feature settings.</p>
      </div>

      {/* Activities Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold text-slate-800">Activities</h3>
          <button className="flex items-center gap-2 text-sm text-blue-600 font-medium px-4 py-2 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            <Building2 className="w-4 h-4" /> Change Company
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <h4 className="text-lg font-bold text-slate-800 mb-2">No Activity Found</h4>
          <p className="text-sm text-slate-500">No recent logs or events recorded. Check back later or clear your active search filters.</p>
        </div>
      </div>
    </div>
  );
}
