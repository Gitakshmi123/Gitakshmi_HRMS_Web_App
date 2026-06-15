import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_ROOT } from '../utils/api'; // Centralized axios instance with auth & tenant headers
import { useAuth } from '../context/AuthContext';

const isRequestCanceled = (error) =>
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    String(error?.message || '').toLowerCase().includes('aborted');

export default function NotificationDropdown() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();


    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/notifications');
            if (res.data) {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (error) {
            if (isRequestCanceled(error)) return;
            if (error.response?.status === 404) return;
            console.error("Failed to fetch notifications", error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            const initialTimer = window.setTimeout(fetchNotifications, 0);
            const interval = setInterval(fetchNotifications, 300000);
            return () => {
                window.clearTimeout(initialTimer);
                clearInterval(interval);
            };
        }
    }, [user, fetchNotifications]);

    // Close when clicking outside
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
                // Update local state
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (error) {
                console.error("Failed to mark read", error);
            }
        }

        // Unified Detail Redirection
        const { entityType, entityId } = notif;
        const isHr = ['hr', 'admin', 'company_super_admin'].includes(user?.role);
        const basePath = isHr ? '/hr/details' : '/employee/details';

        navigate(`${basePath}/${entityType}/${entityId}`);
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
                className="relative rounded-xl transition text-slate-600 dark:text-slate-300 flex items-center justify-center h-full w-full"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[10px] items-center justify-center font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                                No notifications yet.
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                {notifications.map((notif) => (
                                    <li
                                        key={notif._id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition ${!notif.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${notif.type === 'LEAVE_APPLIED' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                                                    {notif.sender?.profilePic ? (
                                                        <img src={String(notif.sender.profilePic).startsWith('http') ? notif.sender.profilePic : `${API_ROOT}${String(notif.sender.profilePic).startsWith('/') ? '' : '/'}${notif.sender.profilePic}`} alt="" className="h-8 w-8 rounded-full object-cover" />
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${!notif.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400">
                                                        {new Date(notif.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {!notif.isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-center">
                        <button
                            onClick={() => {
                                const isHr = ['hr', 'admin', 'company_super_admin'].includes(user?.role);
                                const basePath = isHr ? '/hr' : '/employee';
                                navigate(`${basePath}/my-requests`);
                                setIsOpen(false);
                            }}
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                            View all requests
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
