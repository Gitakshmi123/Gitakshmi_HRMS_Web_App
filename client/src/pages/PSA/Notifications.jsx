import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  ShieldAlert,
  Layers,
  Clock,
  MoreHorizontal
} from 'lucide-react';
import api from '../../utils/api';

const NotificationItem = ({ notif, onRead }) => {
  const isRead = notif.isRead;
  const dateStr = new Date(notif.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  const timeStr = new Date(notif.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getVisuals = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('security') || t.includes('alert') || t.includes('failed')) {
      return { icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' };
    }
    if (t.includes('module') || t.includes('config')) {
      return { icon: Layers, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' };
    }
    return { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' };
  };

  const visuals = getVisuals(notif.entityType || notif.title);
  const Icon = visuals.icon;

  return (
    <div 
      onClick={() => !isRead && onRead(notif._id)}
      className={`group bg-white border ${isRead ? 'border-slate-100 opacity-75' : 'border-indigo-100 shadow-sm'} rounded-xl p-4 transition-all hover:shadow-md cursor-pointer flex gap-5 items-start`}
    >
      <div className={`w-10 h-10 rounded-xl ${visuals.bg} flex items-center justify-center ${visuals.color} shrink-0 border ${visuals.border}`}>
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className={`text-[13px] ${isRead ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'} truncate tracking-tight`}>
            {notif.title}
          </h3>
          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap uppercase tracking-tighter">
            {dateStr} • {timeStr}
          </span>
        </div>
        <p className="text-[12px] font-medium text-slate-500 leading-relaxed line-clamp-2">
          {notif.message}
        </p>
      </div>

      {!isRead && (
        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0 animate-pulse" />
      )}
    </div>
  );
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const filtered = notifications.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 font-outfit pb-16 px-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[14px] font-bold text-slate-900 tracking-tight uppercase">Security & System Alerts</h1>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Real-time platform notifications</p>
        </div>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={markAllRead}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg transition-all active:scale-95"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search alerts . ."
            className="w-full h-10 bg-white border border-slate-200 rounded-lg pl-11 pr-4 focus:outline-none transition-all text-[13px] font-medium placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={fetchNotifications}
          className="flex items-center gap-2 px-6 h-10 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
             <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
               <RefreshCw className="animate-spin" size={24} />
               <span className="text-[10px] font-semibold uppercase tracking-widest font-outfit">Syncing notifications...</span>
             </div>
          ) : filtered.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white/50">
               <Bell size={32} className="opacity-20" />
               <span className="text-[10px] font-semibold uppercase tracking-widest font-outfit">No notifications found</span>
             </div>
          ) : (
             filtered.map(notif => (
               <NotificationItem key={notif._id} notif={notif} onRead={markRead} />
             ))
          )}
        </div>

        {/* Legend / Info Card */}
        <div className="space-y-4">
           <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mb-4">Alert Legend</h4>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
                       <ShieldAlert size={14} />
                    </div>
                    <div>
                       <p className="text-[11px] font-bold text-slate-700">Security Alerts</p>
                       <p className="text-[9px] font-medium text-slate-400 uppercase">Critical System Events</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                       <Layers size={14} />
                    </div>
                    <div>
                       <p className="text-[11px] font-bold text-slate-700">System Updates</p>
                       <p className="text-[9px] font-medium text-slate-400 uppercase">Module & Config Changes</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                       <Bell size={14} />
                    </div>
                    <div>
                       <p className="text-[11px] font-bold text-slate-700">General</p>
                       <p className="text-[9px] font-medium text-slate-400 uppercase">Routine Notifications</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
              <h4 className="text-[13px] font-bold mb-1 relative z-10">Notification Center</h4>
              <p className="text-[11px] text-indigo-100 font-medium relative z-10 opacity-80">
                You are currently monitoring platform-wide events. Unread alerts indicate actions that may require your attention.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
