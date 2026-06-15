import React, { useState } from 'react';
import { ChevronDown, PlusCircle } from 'lucide-react';

export default function MoveToRoundDropdown({
    rounds = [],
    onSelectRound,
    onAddCustomRound,
    className = ""
}) {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (roundName) => {
        onSelectRound(roundName);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center gap-2 py-2 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md transition-all active:scale-95 w-full"
            >
                <span>OTHER ROUND</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 min-w-[200px] overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="py-1 max-h-[200px] overflow-y-auto">
                        <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                            Select Round
                        </div>
                        {rounds.map((round) => (
                            <button
                                key={round}
                                onClick={() => handleSelect(round)}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500"></span>
                                {round}
                            </button>
                        ))}
                    </div>
                    {onAddCustomRound && (
                        <button
                            onClick={() => {
                                onAddCustomRound();
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors border-t border-indigo-100 flex items-center gap-2"
                        >
                            <PlusCircle size={14} />
                            Create New Round
                        </button>
                    )}
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
