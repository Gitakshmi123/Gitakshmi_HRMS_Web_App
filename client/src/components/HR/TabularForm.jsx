import React from 'react';

export function TabularContainer({ children, className = '' }) {
  return (
    <div className={`w-full overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950 ${className}`}>
      <div className="tabular-form-sheet w-full overflow-x-auto">
        <div className="min-w-[860px]">
          {children}
        </div>
      </div>
      <style>{`
        .tabular-form-row-cols-2 > :nth-child(2n) {
          border-right: 0 !important;
        }

        .tabular-form-row-cols-2 > :nth-child(n+3) {
          border-top: 1px solid #cbd5e1 !important;
        }

        .tabular-form-row-cols-4 > :nth-child(4n) {
          border-right: 0 !important;
        }

        .tabular-form-row-cols-4 > :nth-child(n+5) {
          border-top: 1px solid #cbd5e1 !important;
        }

        .dark .tabular-form-row-cols-2 > :nth-child(n+3),
        .dark .tabular-form-row-cols-4 > :nth-child(n+5) {
          border-top-color: #334155 !important;
        }

        .tabular-form-sheet input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .tabular-form-sheet select,
        .tabular-form-sheet textarea {
          width: 100% !important;
          min-height: 38px !important;
          border: 1px solid transparent !important;
          border-radius: 6px !important;
          background: transparent !important;
          padding: 0 10px !important;
          color: #0f172a !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          line-height: 1.25rem !important;
          outline: none !important;
          box-shadow: none !important;
        }

        .tabular-form-sheet textarea {
          min-height: 72px !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          resize: vertical;
        }

        .tabular-form-sheet select {
          cursor: pointer;
        }

        .tabular-form-sheet input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .tabular-form-sheet select:focus,
        .tabular-form-sheet textarea:focus {
          border-color: #818cf8 !important;
          background: #ffffff !important;
          box-shadow: inset 0 0 0 1px #818cf8 !important;
        }

        .tabular-form-sheet input[readonly],
        .tabular-form-sheet select:disabled,
        .tabular-form-sheet textarea:read-only {
          color: #64748b !important;
          background: #f8fafc !important;
          cursor: not-allowed;
        }

        .tabular-form-sheet input::placeholder,
        .tabular-form-sheet textarea::placeholder {
          color: #94a3b8 !important;
          font-weight: 500 !important;
        }

        .tabular-form-sheet p {
          margin-top: 4px;
          line-height: 1rem;
        }

        .dark .tabular-form-sheet input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .dark .tabular-form-sheet select,
        .dark .tabular-form-sheet textarea {
          color: #e2e8f0 !important;
        }

        .dark .tabular-form-sheet input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .dark .tabular-form-sheet select:focus,
        .dark .tabular-form-sheet textarea:focus {
          background: #020617 !important;
        }

        .dark .tabular-form-sheet input[readonly],
        .dark .tabular-form-sheet select:disabled,
        .dark .tabular-form-sheet textarea:read-only {
          color: #94a3b8 !important;
          background: #0f172a !important;
        }
      `}</style>
    </div>
  );
}

export function TabularRow({ children, columns = 4 }) {
  // columns = 4 means 2 label-input pairs. columns = 2 means 1 label-input pair.
  const gridTemplateColumns = columns === 2
    ? 'minmax(190px, 240px) minmax(520px, 1fr)'
    : 'minmax(165px, 200px) minmax(245px, 1fr) minmax(165px, 200px) minmax(245px, 1fr)';

  return (
    <div
      className={`tabular-form-row-cols-${columns} grid min-h-[52px] border-b border-slate-300 last:border-b-0 dark:border-slate-700`}
      style={{ gridTemplateColumns }}
    >
      {children}
    </div>
  );
}

export function TabularField({ label, required, children, className = '' }) {
  return (
    <>
      <div className="flex min-h-[52px] items-center border-r border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        <span className="leading-4">{label}</span>
        {required && <span className="ml-1 text-rose-500">*</span>}
      </div>
      <div className={`tabular-form-cell flex min-h-[52px] flex-col justify-center border-r border-slate-300 bg-white px-2 py-1.5 last:border-r-0 dark:border-slate-700 dark:bg-slate-950 ${className}`}>
        {children}
      </div>
    </>
  );
}

export function TabularCustomFieldLabel({ value, onChange, onRemove, required }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between border-r border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-1 items-center">
        <input
          value={value}
          onChange={onChange}
          className="h-9 w-full rounded border border-transparent bg-transparent px-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 outline-none transition-colors hover:border-slate-300 hover:bg-white focus:border-indigo-400 focus:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-950 dark:focus:border-indigo-500"
        />
        {required && <span className="ml-1 text-rose-500">*</span>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      )}
    </div>
  );
}

export function TabularSectionHeader({ icon: Icon, title, children }) {
  return (
    <div className="flex min-h-[42px] items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon size={16} className="shrink-0 text-indigo-500" />}
        <span className="truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}
