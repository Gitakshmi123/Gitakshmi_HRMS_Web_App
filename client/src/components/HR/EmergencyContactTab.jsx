import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Tab 5: Emergency Contact Details — Specific emergency contact information.
 */
export default function EmergencyContactTab({
  emergencyContactName,
  setEmergencyContactName,
  emergencyContactNumber,
  setEmergencyContactNumber,
  errors = {},
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
            Contact Person Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName?.(e.target.value)}
            className={`w-full px-4 py-2 bg-white dark:bg-slate-900 border-2 rounded-xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.emergencyContactName ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-rose-500'}`}
            placeholder="Full name of emergency contact"
          />
          {errors.emergencyContactName && <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1 pl-1">{errors.emergencyContactName}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
            Emergency Phone Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            maxLength={15}
            onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
            value={emergencyContactNumber}
            onChange={(e) => setEmergencyContactNumber?.(e.target.value)}
            className={`w-full px-4 py-2 bg-white dark:bg-slate-900 border-2 rounded-xl outline-none text-sm font-bold text-slate-700 transition-all ${errors.emergencyContactNumber ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-rose-500'}`}
            placeholder="e.g. 9876543210"
          />
          {errors.emergencyContactNumber && <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1 pl-1">{errors.emergencyContactNumber}</p>}
        </div>
      </div>
    </div>
  );
}
