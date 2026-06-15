import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import { Bell, CheckCircle2, FileText, Clock, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function CandidateNotificationDropdown() {
    const { candidate } = useJobPortalAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        if (!candidate) return;
        try {
            const res = await api.get('/notifications');
            if (res.data) {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Poll every 1 minute
        return () => clearInterval(interval);
    }, [candidate]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const handleNotificationClick = async (notif) => {
        if (!notif.isRead) {
            try {
                await api.patch(`/notifications/${notif._id}/read`);
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (error) {
                console.error("Failed to mark read", error);
            }
        }

        // Redirection based on entityType
        if (notif.entityType === 'OfferLetter') {
            // Find application ID from notification if possible, or go to applications
            navigate('/candidate/applications');
        } else if (notif.entityType === 'BGVCase') {
            navigate('/candidate/profile');
        } else {
            navigate('/candidate/dashboard');
        }
        setIsOpen(false);
    };

    const markAllRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to mark all read", error);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-xl transition-all duration-300 ${isOpen ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
            >
                <Bell size={20} />

                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[9px] items-center justify-center font-black">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-4 w-[22rem] bg-white rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 text-sm tracking-tight uppercase">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[420px] overflow-y-auto scrollbar-hide">
                        {notifications.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                    <Bell size={24} className="text-slate-300" />
                                </div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No alerts yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif._id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`p-6 hover:bg-slate-50 cursor-pointer transition-all flex gap-4 ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="flex-shrink-0">
                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm 
                                                ${notif.entityType === 'OfferLetter' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    notif.entityType === 'BGVCase' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                        'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                                {notif.entityType === 'OfferLetter' ? <FileText size={20} /> :
                                                    notif.entityType === 'BGVCase' ? <ShieldCheck size={20} /> :
                                                        <Bell size={20} />}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className={`text-[13px] font-bold tracking-tight truncate ${!notif.isRead ? 'text-slate-900' : 'text-slate-600'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.isRead && <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0 shadow-sm shadow-blue-200" />}
                                            </div>
                                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                                {notif.message}
                                            </p>
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-3 flex items-center gap-1.5">
                                                <Clock size={10} /> {dayjs(notif.createdAt).fromNow()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-5 border-t border-slate-50 bg-slate-50/30 text-center">
                        <button
                            onClick={() => {
                                navigate('/candidate/dashboard');
                                setIsOpen(false);
                            }}
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ShieldCheck({ size }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
        </svg>
    );
}
