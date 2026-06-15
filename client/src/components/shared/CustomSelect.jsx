import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * CustomSelect — Modern, animated dropdown component with smart positioning
 * Props:
 *   value        – selected value (string)
 *   onChange     – (value: string) => void
 *   options      – [{ label, value }]
 *   placeholder  – string
 *   className    – optional extra wrapper class
 *   icon         – optional JSX icon shown on left
 */
export default function CustomSelect({ value, onChange, options = [], placeholder = 'Select...', className = '', triggerClassName = '', icon }) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const [openUp, setOpenUp] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const ref = useRef(null);
    const panelRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        function handle(e) { 
            if (ref.current && !ref.current.contains(e.target) && panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // Clear search on close
    useEffect(() => {
        if (!open) {
            setSearchQuery('');
        }
    }, [open]);

    // Smart positioning logic
    useLayoutEffect(() => {
        if (open && ref.current) {
            const updatePosition = () => {
                const rect = ref.current.getBoundingClientRect();
                const scrollY = window.scrollY || window.pageYOffset;
                const scrollX = window.scrollX || window.pageXOffset;
                
                const spaceBelow = window.innerHeight - rect.bottom;
                const dropdownHeight = Math.min(options.length * 45 + 50, 280); // estimate height including search
                
                const shouldOpenUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                setOpenUp(shouldOpenUp);
                
                setCoords({
                    top: shouldOpenUp ? rect.top + scrollY : rect.bottom + scrollY,
                    left: rect.left + scrollX,
                    width: rect.width
                });
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [open, options.length]);

    const selected = options.find(o => o.value === value);
    const label = selected?.label || placeholder;
    const isPlaceholder = !selected;

    const triggerClass = typeof triggerClassName === 'function' ? triggerClassName(open) : triggerClassName;

    // Filter options based on search query
    const filteredOptions = options.filter(opt =>
        String(opt.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(opt.value || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const dropdownPanel = open && createPortal(
        <div
            ref={panelRef}
            className="fixed z-[9999] bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-300/50 overflow-hidden flex flex-col"
            style={{ 
                top: openUp ? 'auto' : `${coords.top + 8}px`,
                bottom: openUp ? `${window.innerHeight - coords.top + 8}px` : 'auto',
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                maxHeight: '280px',
                animation: openUp ? 'csDropInUp .15s cubic-bezier(.4,0,.2,1)' : 'csDropIn .15s cubic-bezier(.4,0,.2,1)'
            }}
        >
            <div className="p-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or code..."
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50/50"
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                />
            </div>
            <div className="overflow-y-auto py-1.5 custom-scrollbar flex-1">
                {filteredOptions.length === 0 ? (
                    <div className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-widest text-center">No options found</div>
                ) : filteredOptions.map(opt => {
                    const isActive = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`
                                w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all uppercase tracking-tight
                                ${isActive
                                    ? 'bg-indigo-50 text-[#4F46E5]'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }
                            `}
                        >
                            {isActive && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                    className="shrink-0">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            )}
                            {!isActive && <span className="w-3" />}
                            {opt.label}
                        </button>
                    );
                })}
            </div>
            <style>{`
                @keyframes csDropIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
                @keyframes csDropInUp {
                    from { opacity: 0; transform: translateY(8px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>,
        document.body
    );

    return (
        <div ref={ref} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={triggerClass || `
                    w-full h-11 pl-4 pr-10 rounded-2xl border text-sm font-medium
                    flex items-center gap-2.5 text-left
                    transition-all duration-200 outline-none
                    ${open
                        ? 'border-[#4F46E5] ring-4 ring-[#4F46E5]/10 bg-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }
                    ${isPlaceholder ? 'text-slate-400' : 'text-slate-700'}
                `}
            >
                {icon && (
                    <span className={`shrink-0 transition-colors ${open ? 'text-[#4F46E5]' : 'text-slate-300'}`}>
                        {icon}
                    </span>
                )}
                <span className="flex-1 truncate">{label}</span>

                {/* Chevron */}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-[#4F46E5]' : ''}`}
                    >
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </span>
            </button>

            {dropdownPanel}
        </div>
    );
}
