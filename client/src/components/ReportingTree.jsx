import React, { useEffect, useState } from 'react';
import api, { API_ROOT } from '../utils/api';
import { User, ChevronUp } from 'lucide-react';

const BACKEND_URL = API_ROOT || '';

const getProfilePic = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function ReportingTree() {
    const [tree, setTree] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTree = async () => {
            try {
                const res = await api.get('/employee/reporting-tree');
                setTree(res.data);
            } catch (err) {
                console.error("Failed to fetch reporting tree", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTree();
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Hierarchy...</span>
        </div>
    );
    if (!tree) return null;

    return (
        <div className="w-full flex justify-center py-4">
            <div className="flex flex-col items-center gap-1 relative">
                
                {/* Level 2: Manager's Manager (HUD Node) */}
                {tree.level2 && (
                    <div className="flex flex-col items-center group/node">
                        <div className="relative p-[1px] rounded-2xl bg-gradient-to-br from-slate-200 to-transparent dark:from-white/10 dark:to-transparent">
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-100 dark:border-white/5 w-44 text-center shadow-sm">
                                <div className="relative inline-block mb-2">
                                    {tree.level2.profilePic ? (
                                        <img src={getProfilePic(tree.level2.profilePic)} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-white/10" />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-white/5">
                                            <User size={16} />
                                        </div>
                                    )}
                                    <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                                </div>
                                <div className="text-[10px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tighter">{tree.level2.name}</div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5 opacity-60 font-mono">L.02_ACCESS</div>
                            </div>
                        </div>
                        {/* High-Tech Connection String */}
                        <div className="h-6 w-[2px] bg-gradient-to-b from-indigo-500 to-indigo-500 opacity-20 group-hover/node:opacity-50 transition-opacity"></div>
                    </div>
                )}

                {/* Level 1: Direct Manager (Highlighted Node) */}
                {tree.level1 ? (
                    <div className="flex flex-col items-center group/node">
                        <div className="relative p-[1.5px] rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-500 shadow-lg shadow-indigo-500/10">
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-[14px] border border-white/10 w-52 text-center">
                                <div className="relative inline-block mb-3">
                                    <div className="absolute -inset-2 bg-indigo-500/10 rounded-full blur-md opacity-0 group-hover/node:opacity-100 transition-opacity"></div>
                                    {tree.level1.profilePic ? (
                                        <img src={getProfilePic(tree.level1.profilePic)} alt="" className="relative w-11 h-11 rounded-full object-cover border-2 border-indigo-500/20" />
                                    ) : (
                                        <div className="relative w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                            <User size={20} />
                                        </div>
                                    )}
                                    <div className="absolute -right-1.5 -bottom-0.5 px-1.5 py-0.5 bg-indigo-500 text-[6px] font-black text-white rounded-full uppercase tracking-tighter">Manager</div>
                                </div>
                                <div className="text-xs font-black text-slate-900 dark:text-white truncate mb-1">{tree.level1.name}</div>
                                <div className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest truncate">{tree.level1.designation}</div>
                            </div>
                        </div>
                        {/* Pulsating Link */}
                        <div className="h-8 w-[2px] bg-indigo-500 relative">
                            <div className="absolute inset-0 bg-indigo-400 blur-sm opacity-50"></div>
                            <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 rounded-full animate-heartbeat"></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center mb-4">
                        <div className="px-6 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-800 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Direct Link Offline
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 border-dashed border-l"></div>
                    </div>
                )}

                {/* Level 0: You (The Core Node) */}
                <div className="relative p-1 rounded-3xl bg-slate-900 dark:bg-white/5 border border-slate-700 shadow-2xl group/self">
                    <div className="bg-slate-900 dark:bg-slate-950 px-8 py-5 rounded-[20px] w-64 text-center relative overflow-hidden">
                        {/* HUD Scanline Effect on Avatar */}
                        <div className="relative inline-block mb-3">
                            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl group-hover/self:bg-indigo-500/30 transition-all"></div>
                            {tree.level0.profilePic ? (
                                <img src={getProfilePic(tree.level0.profilePic)} alt="" className="relative w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-lg" />
                            ) : (
                                <div className="relative w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-indigo-500 border-2 border-indigo-500/30">
                                    <User size={24} />
                                </div>
                            )}
                            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                                <div className="w-full h-[1px] bg-indigo-400/30 absolute top-0 left-0 animate-shimmer"></div>
                            </div>
                        </div>
                        
                        <div className="text-sm font-black text-white mb-1 uppercase tracking-tight">{tree.level0.name}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">{tree.level0.designation}</div>
                        
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500 text-[8px] font-black text-white rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-white opacity-40 animate-pulse"></span>
                            PROTOCOL_AGENT
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
