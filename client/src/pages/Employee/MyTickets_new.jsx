import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleRoute } from '../../utils/navigation';
import api from '../../utils/api';
import { 
    Ticket as TicketIcon, Search, Filter, Clock, CheckCircle, 
    MoreVertical, MessageSquare, ChevronRight, User, Shield, LifeBuoy
} from 'lucide-react';

export default function MyTickets() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await api.get('/tickets/my');
            setTickets(res.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (s) => {
        switch (s) {
            case 'UNREAD': return 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-800/30';
            case 'OPEN': return 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30';
            case 'IN_PROGRESS': return 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800/30';
            case 'DONE': return 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30';
            case 'REJECTED': return 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            default: return 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
        }
    };

    const filteredTickets = tickets.filter(t => 
        t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] font-outfit overflow-hidden">
            <header className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6 bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-t-[3rem] shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-600/20 flex items-center justify-center">
                        <LifeBuoy size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">Support History</h1>
                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Track and manage your requests</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text"
                            placeholder="Search requests..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-6 py-3 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl text-xs font-bold w-64 md:w-80 outline-none focus:ring-2 ring-indigo-500/10 transition-all text-slate-700 dark:text-slate-200"
                        />
                    </div>
                    <button 
                        onClick={() => navigate(getRoleRoute('tickets/submit', user?.role))}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        New Request
                    </button>
                </div>
            </header>

            <main className="flex-1 bg-white/50 dark:bg-slate-900/30 overflow-y-auto custom-scrollbar p-6 rounded-b-[3rem] border-x border-b border-slate-100 dark:border-slate-800 shadow-inner">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array(6).fill(0).map((_, i) => (
                            <div key={i} className="h-48 bg-white dark:bg-slate-800 rounded-3xl animate-pulse shadow-sm" />
                        ))}
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                        <TicketIcon size={64} strokeWidth={1} className="text-slate-300 mb-4" />
                        <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">No Active Requests</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Any requests you submit will appear here</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up pb-10">
                        {filteredTickets.map(ticket => (
                            <div 
                                key={ticket._id}
                                onClick={() => navigate(getRoleRoute(`tickets/${ticket._id}`, user?.role))}
                                className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col overflow-hidden relative w-[100px] h-[100px] shrink-0"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`px-1 rounded-sm text-[6px] font-black uppercase tracking-widest shadow-sm ${getStatusStyle(ticket.status)}`}>
                                        {ticket.status.charAt(0)}
                                    </span>
                                    <div className="w-5 h-5 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        <ChevronRight size={10} />
                                    </div>
                                </div>
                                
                                <h3 className="text-[9px] font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-2 group-hover:text-indigo-600 transition-colors leading-tight mb-1">
                                    {ticket.title}
                                </h3>

                                <div className="mt-auto pt-1 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[5px] font-black text-slate-300 uppercase tracking-widest leading-none mb-0.5">Priority</span>
                                        <span className={`text-[7px] font-black uppercase tracking-tighter leading-none ${ticket.priority === 'HIGH' ? 'text-rose-500' : 'text-indigo-600'}`}>
                                            {ticket.priority.charAt(0)}
                                        </span>
                                    </div>
                                    <div className="w-4 h-4 rounded-md bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600">
                                        <Shield size={8} />
                                    </div>
                                </div>
                                {ticket.messages?.length > 0 && (
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/20 translate-y-[-100%] group-hover:translate-y-2">
                                        <MessageSquare size={10} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">{ticket.messages.length} Active</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1E293B; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-up { animation: slideUp 0.4s ease-out; }
            `}</style>
        </div>
    );
}
