import React, { useState } from 'react';
import { Download, Check, FileText, CheckCircle2, Clock } from 'lucide-react';

function JoiningLetterWorkflowPanel({ letterId, joiningLetterUrl, workflow, apiBase, onSign, onAction, loading }) {
    const [revisionNote, setRevisionNote] = useState('');
    const [showRevisionInput, setShowRevisionInput] = useState(false);

    const API_BASE_CLEAN = (apiBase || '').replace(/\/api$/, '');

    const status = (workflow?.status || '').toUpperCase();
    const isPending = status === 'ISSUED' || status === 'SENT' || status === 'SIGNED';
    const isAccepted = status === 'ACCEPTED' || status === 'SIGNED_AND_STAMPED';
    const isRejected = status === 'REJECTED';
    const isExpired = status === 'EXPIRED';
    const isRevisionRequested = status === 'REVISIONREQUESTED' || status === 'REQUESTED';

    const handleRevisionSubmit = () => {
        onAction('request-revision', revisionNote);
        setShowRevisionInput(false);
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] group transition-all duration-500 hover:shadow-xl">
            <div className="flex flex-col gap-3">
                {/* View/Download Primary */}
                <button
                    onClick={() => window.open(joiningLetterUrl, '_blank')}
                    className="w-full h-14 bg-slate-50 border border-slate-100 text-slate-800 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"
                >
                    <Download size={18} className="text-slate-400 group-hover/btn:text-blue-600 transition-colors" /> View Original Letter
                </button>

                {/* Status Logic */}
                {isAccepted && (
                    <div className="flex flex-col items-center justify-center p-8 bg-emerald-50/50 rounded-[2rem] border border-emerald-100/50 text-emerald-600 animate-in zoom-in-95 duration-500">
                        <div className="p-4 bg-emerald-500 rounded-2xl text-white shadow-xl shadow-emerald-200 mb-4">
                            <CheckCircle2 size={32} />
                        </div>
                        <h4 className="text-lg font-black uppercase tracking-tight mb-1">Successfully Accepted</h4>
                        <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Document digitally filed</p>
                    </div>
                )}

                {/* Show Signed Badge if signed but not yet accepted */}
                {status === 'SIGNED' && (
                    <div className="flex items-center justify-center gap-2 py-4 text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-100 mb-2 font-bold text-[10px] uppercase tracking-widest">
                        <CheckCircle2 size={16} /> Letter Signed
                    </div>
                )}

                {/* Direct Sign Button if not signed yet */}
                {isPending && status !== 'SIGNED' && (
                    <button
                        onClick={onSign}
                        className="w-full h-14 bg-[#0F172A] text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                    >
                        <FileText size={18} /> Sign Joining Letter
                    </button>
                )}

                {/* Accept / Reject (only if pending) */}
                {isPending && letterId && (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            disabled={loading}
                            onClick={() => { if (window.confirm('Reject this joining letter?')) onAction('reject'); }}
                            className="bg-white border-2 border-rose-100 text-rose-500 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            disabled={loading}
                            onClick={() => {
                                if (status !== 'SIGNED') {
                                    if (window.confirm('You have not signed the letter yet. Sign now?')) {
                                        onSign();
                                    }
                                    return;
                                }
                                if (window.confirm('Accept this joining letter?')) onAction('accept');
                            }}
                            className="bg-emerald-500 text-white py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Accept'}
                        </button>
                    </div>
                )}

                {/* Request Revision (if expired or rejected) */}
                {(isExpired || isRejected) && letterId && !isRevisionRequested && (
                    <div className="pt-2 border-t border-slate-50 mt-1">
                        {!showRevisionInput ? (
                            <button
                                disabled={loading}
                                onClick={() => setShowRevisionInput(true)}
                                className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                            >
                                Request Joining Letter Again
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <textarea
                                    value={revisionNote}
                                    onChange={e => setRevisionNote(e.target.value)}
                                    placeholder="Add a note to HR (optional)..."
                                    rows={2}
                                    className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium text-slate-700"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setShowRevisionInput(false)} className="bg-slate-50 text-slate-600 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all">
                                        Cancel
                                    </button>
                                    <button
                                        disabled={loading}
                                        onClick={handleRevisionSubmit}
                                        className="bg-blue-600 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'Sending...' : 'Send Request'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Revision Requested Badge */}
                {isRevisionRequested && (
                    <div className="py-4 px-6 bg-amber-50 rounded-2xl border border-amber-100 text-amber-600 font-bold text-[10px] uppercase tracking-widest text-center">
                        Waiting for HR to issue new letter
                    </div>
                )}
            </div>
        </div>
    );
}

export default JoiningLetterWorkflowPanel;
