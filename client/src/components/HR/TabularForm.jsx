import React from 'react';

export function TabularContainer({ children, className = '' }) {
  return (
    <div className={`w-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col ${className}`}>
      {children}
    </div>
  );
}

export function TabularRow({ children, columns = 4 }) {
  // columns = 4 means 2 label-input pairs. columns = 2 means 1 label-input pair.
  const gridClass = columns === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid ${gridClass} border-b border-slate-200 dark:border-slate-800 last:border-b-0`}>
      {children}
    </div>
  );
}

export function TabularField({ label, required, children, className = '' }) {
  return (
    <>
      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
        <span className="truncate">{label}</span>
        {required && <span className="text-rose-500 ml-1">*</span>}
      </div>
      <div className={`p-3 bg-white dark:bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col justify-center ${className}`}>
        {children}
      </div>
    </>
  );
}

export function TabularCustomFieldLabel({ value, onChange, onRemove, required }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-2 flex items-center justify-between border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
      <div className="flex items-center flex-1">
        <input
          value={value}
          onChange={onChange}
          className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-transparent outline-none w-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded px-1 transition-colors"
        />
        {required && <span className="text-rose-500 ml-1">*</span>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      )}
    </div>
  );
}
