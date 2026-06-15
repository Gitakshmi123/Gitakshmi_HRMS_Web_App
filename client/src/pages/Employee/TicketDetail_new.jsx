import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleRoute } from '../../utils/navigation';
import api from '../../utils/api';
import ChatBox from '../../components/Ticketing/ChatBox.jsx';
import TicketTimeline from '../../components/Ticketing/TicketTimeline.jsx';
import { 
    ArrowLeft, Ticket as TicketIcon, Clock, CheckCircle, 
    MessageSquare, History, Shield, User, Bot, Layout, Info, Sparkles
} from 'lucide-react';

export default function TicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('chat'); // chat, timeline, info

    useEffect(() => {
        fetchTicket();
    }, [id]);

    const fetchTicket = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data?.ticket || res.data?.data || res.data || null);
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center animate-pulse space-y-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            <p className="text-[10px] font-black uppercase text-slate-400">Syncing Request Details...</p>
        </div>
    );

    if (!ticket) return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">Ticket Not Found</h2>
            <button onClick={() => navigate(getRoleRoute('tickets', user?.role))} className="mt-4 text-indigo-600 font-bold uppercase text-[10px] tracking-[0.2em] underline underline-offset-4">Return to List</button>
        </div>
    );

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col font-outfit overflow-hidden bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl anim-slide-up">
            {/* Header */}
            <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(getRoleRoute('tickets', user?.role))}
                        className="p-3 bg-white dark:bg-slate-800 rounded-2xl hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-100 active:scale-95 shadow-sm"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 leading-none">Ticket #{String(ticket._id || '').slice(-6).toUpperCase()}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">{ticket.category || 'General'}</span>
                        </div>
                        <h1 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">{ticket.title}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm
                        ${ticket.status === 'DONE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30' : 
                          ticket.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/10' :
                          ticket.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/10' : 
                          ticket.status === 'UNREAD' ? 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800' :
                          'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/10'}`}>
                        {ticket.status}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Interaction Area */}
                <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-900/10 p-6">
                    {/* View Switcher Tabs */}
                    <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800 p-1 rounded-2xl w-fit border border-slate-100 dark:border-slate-700 shadow-sm">
                        {[
                            { id: 'chat', label: 'Conversation', icon: MessageSquare },
                            { id: 'info', label: 'Ticket Details', icon: Info },
                            { id: 'timeline', label: 'History Flow', icon: History }
                        ].map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                                    ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                <t.icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'chat' && (
                            <ChatBox 
                                ticketId={ticket._id} 
                                messages={ticket.messages || ticket.comments || []} 
                                onNewMessage={(newMsgs) => setTicket(prev => ({ ...prev, messages: newMsgs, comments: newMsgs }))}
                            />
                        )}

                        {activeTab === 'info' && (
                            <div className="h-full overflow-y-auto custom-scrollbar space-y-6 px-2 animate-slide-up">
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
                                    <div>
                                        <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-50 dark:border-slate-700 pb-2">Submission Context</h5>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed font-outfit whitespace-pre-wrap">{ticket.message || ticket.description}</p>
                                    </div>
                                    
                                    {ticket.formData && Object.keys(ticket.formData).length > 0 && (
                                        <div className="pt-6 border-t border-slate-50 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {Object.entries(ticket.formData).map(([k, v]) => (
                                                <div key={k}>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">{k.replace(/_/g, ' ')}</span>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v || '-')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'timeline' && (
                            <div className="h-full overflow-y-auto custom-scrollbar p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <TicketTimeline logs={ticket.activityLogs} />
                            </div>
                        )}
                    </div>
                </main>

                {/* Info Panel Right */}
                <aside className="hidden lg:flex w-72 flex-col border-l border-slate-100 dark:border-slate-800 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                    <div className="text-center">
                        <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-xl shadow-indigo-500/5 ring-4 ring-white dark:ring-slate-800 z-10 relative">
                            {ticket.assignedTo?.profilePic ? <img src={ticket.assignedTo.profilePic} className="w-full h-full object-cover rounded-[2rem]" /> : <Shield size={32} className="text-indigo-200" />}
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center text-white">
                                <Bot size={12} />
                            </div>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Support Specialist</h4>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1 truncate">{ticket.assignedTo?.name || 'Monitoring System'}</p>
                    </div>

                    <div className="h-px bg-slate-50 dark:bg-slate-800 mx-[-2rem]" />

                    <div className="space-y-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 leading-none">Target Deadline</span>
                            <div className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest">
                                <Clock size={12} strokeWidth={3} />
                                {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No SLA Set'}
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 leading-none">Smart Priority</span>
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest">
                                <Sparkles size={12} strokeWidth={3} />
                                {ticket.priority} Impact
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                            <h5 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2">Notice</h5>
                            <p className="text-[10px] font-medium leading-relaxed opacity-70 italic">Please share any screenshots or files directly in the conversation thread for faster resolution.</p>
                        </div>
                    </div>
                </aside>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1E293B; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-up { animation: slideUp 0.3s ease-out; }
            `}</style>
        </div>
    );
}
