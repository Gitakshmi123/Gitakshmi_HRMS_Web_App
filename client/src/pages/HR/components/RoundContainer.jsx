import React from 'react';

export default function RoundContainer({ stageName, count, children, onAddCandidate }) {
  if (count === 0) return null; // "Only if at least one candidate is inside it"

  return (
    <div className="mb-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-4">
          <div className="h-8 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{stageName}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {count} Candidates Active
            </p>
          </div>
        </div>
        {/* Optional: Add action to add candidate manually to this round? */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {children}
      </div>
    </div>
  );
}
