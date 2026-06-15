import React, { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';

const MoveToRoundDropdown = ({ 
    rounds = [], 
    onSelectRound, 
    onClose,
    onAddCustomRound
}) => {
    const [showAddInput, setShowAddInput] = useState(false);
    const [newRoundName, setNewRoundName] = useState('');

    const handleAddRound = (e) => {
        e.stopPropagation();
        if (newRoundName.trim() && onAddCustomRound) {
            onAddCustomRound(newRoundName.trim());
            setNewRoundName('');
            setShowAddInput(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAddRound(e);
        } else if (e.key === 'Escape') {
            setShowAddInput(false);
            setNewRoundName('');
        }
    };

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 min-w-[240px] overflow-hidden">
            {/* Dropdown Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Select Next Round
                </span>
            </div>

            {/* Rounds List */}
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {rounds && rounds.length > 0 ? (
                    rounds.map((round, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                onSelectRound(round);
                                onClose();
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                        >
                            <div>
                                <div className="text-[11px] font-black text-slate-800 group-hover:text-indigo-700 transition-colors">
                                    {round}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                    Move candidate to {round}
                                </div>
                            </div>
                            <ChevronRight 
                                size={14} 
                                className="text-slate-300 group-hover:text-indigo-600 transition-colors group-hover:translate-x-1"
                            />
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-3 text-center">
                        <div className="text-[10px] text-slate-400 font-bold">
                            No rounds available
                        </div>
                    </div>
                )}

                {/* Add Custom Round Input */}
                {showAddInput ? (
                    <div className="px-4 py-3 border-t border-slate-100 bg-indigo-50/30">
                        <input
                            type="text"
                            value={newRoundName}
                            onChange={(e) => setNewRoundName(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Enter round name..."
                            className="w-full px-3 py-2 text-[11px] border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleAddRound}
                                disabled={!newRoundName.trim()}
                                className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Add
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddInput(false);
                                    setNewRoundName('');
                                }}
                                className="px-3 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAddInput(true);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                    >
                        <div className="p-1.5 bg-indigo-100 rounded-lg">
                            <Plus size={12} className="text-indigo-600" />
                        </div>
                        <div>
                            <div className="text-[11px] font-black text-indigo-700">
                                Add Custom Round
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5">
                                Create a new round name
                            </div>
                        </div>
                    </button>
                )}
            </div>

            {/* Footer Info */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                <div className="text-[9px] font-bold text-slate-400">
                    {rounds.length} round{rounds.length !== 1 ? 's' : ''} available
                </div>
            </div>
        </div>
    );
};

export default MoveToRoundDropdown;
