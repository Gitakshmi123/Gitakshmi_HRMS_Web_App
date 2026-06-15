import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Megaphone, Plus, Trash2, Pin, X, Send, Bell, Info, Award, Calendar } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, Input, Select, Button, message, Tag } from 'antd';
import clsx from 'clsx';

const isRequestCanceled = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  String(error?.message || '').toLowerCase().includes('aborted');

export default function AnnouncementDropdown() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = ['admin', 'hr', 'company_super_admin', 'company_admin', 'super_admin'].includes(user?.roleName?.toLowerCase() || user?.role?.toLowerCase());

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'General',
    isPinned: false
  });

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.get('/announcements');
      if (res.data?.success) {
        setAnnouncements(res.data.data);
      }
    } catch (error) {
      if (isRequestCanceled(error)) return;
      console.error("Failed to fetch announcements", error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const initialTimer = window.setTimeout(fetchAnnouncements, 0);
      const interval = setInterval(fetchAnnouncements, 300000);
      return () => {
        window.clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }
  }, [user, fetchAnnouncements]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreate = async () => {
    if (!form.title || !form.content) return message.error('Please fill all fields');
    setLoading(true);
    try {
      const res = await api.post('/announcements', form);
      if (res.data?.success) {
        message.success('Announcement published! 📢');
        setIsModalOpen(false);
        setForm({ title: '', content: '', category: 'General', isPinned: false });
        fetchAnnouncements();
      }
    } catch {
      message.error('Failed to publish');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/announcements/${id}`);
      message.success('Removed');
      fetchAnnouncements();
    } catch {
      message.error('Delete failed');
    }
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'News': return <Info size={14} />;
      case 'Event': return <Calendar size={14} />;
      case 'Policy': return <Award size={14} />;
      default: return <Bell size={14} />;
    }
  };

  return (
    <div className="relative h-full w-full flex items-center justify-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-full w-full items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-slate-50 active:scale-90"
        title="Announcements"
      >
        <Megaphone size={18} className={clsx(announcements.length > 0 && "animate-wiggle")} />
        {announcements.length > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[90] bg-slate-900/10 backdrop-blur-[2px] transition-all animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-3 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl z-[100] animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Company Announcements</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Stay updated</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setIsModalOpen(true); setIsOpen(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-slate-300 mb-3 border border-slate-100">
                  <Megaphone size={24} />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No announcements yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcements.map((ann) => (
                  <div 
                    key={ann._id} 
                    onClick={() => { setSelectedAnnouncement(ann); setIsOpen(false); }}
                    className={clsx(
                      "group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md",
                      ann.isPinned ? "border-indigo-100 bg-indigo-50/30" : "border-slate-100 bg-white"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Tag color={ann.category === 'Policy' ? 'gold' : ann.category === 'News' ? 'blue' : ann.category === 'Event' ? 'green' : 'default'} className="m-0 text-[9px] font-black uppercase px-2 py-0 border-none rounded-md">
                            <span className="flex items-center gap-1">{getCategoryIcon(ann.category)}{ann.category}</span>
                          </Tag>
                          {ann.isPinned && <Pin size={12} className="text-indigo-500 fill-indigo-500" />}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{ann.title}</h4>
                        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                            {ann.createdBy?.firstName?.[0]}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {ann.createdBy?.firstName} • {new Date(ann.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {new Date(ann.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(ann._id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    )}

      <Modal
        title={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        centered
        width={450}
        className="announcement-modal"
      >
        <div className="p-1">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Create Announcement</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Broadcast to all employees</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title</p>
              <Input 
                placeholder="e.g., Company Offsite 2024" 
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                className="rounded-xl border-slate-200 h-11 text-sm font-semibold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</p>
              <Select 
                className="w-full h-11 announcement-select"
                value={form.category}
                onChange={val => setForm({...form, category: val})}
                options={[
                  { label: 'General', value: 'General' },
                  { label: 'News', value: 'News' },
                  { label: 'Event', value: 'Event' },
                  { label: 'Policy', value: 'Policy' },
                ]}
              />
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Message Content</p>
              <Input.TextArea 
                placeholder="Write your announcement here..." 
                value={form.content}
                onChange={e => setForm({...form, content: e.target.value})}
                rows={4}
                className="rounded-xl border-slate-200 text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
              <input 
                type="checkbox" 
                id="pinned"
                checked={form.isPinned}
                onChange={e => setForm({...form, isPinned: e.target.checked})}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="pinned" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Pin this announcement to top</label>
            </div>

            <Button 
              type="primary" 
              onClick={handleCreate} 
              loading={loading}
              icon={<Send size={16} />}
              className="w-full h-12 rounded-xl bg-indigo-600 font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 border-none mt-2"
            >
              Publish Announcement
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={null}
        open={!!selectedAnnouncement}
        onCancel={() => setSelectedAnnouncement(null)}
        footer={null}
        centered
        width={550}
        className="announcement-detail-modal"
      >
        {selectedAnnouncement && (
          <div className="relative overflow-hidden">
            {/* Header Background Accent */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-50 to-white -z-10" />
            
            <div className="p-1">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 text-indigo-600">
                    {getCategoryIcon(selectedAnnouncement.category)}
                  </div>
                  <Tag color={selectedAnnouncement.category === 'Policy' ? 'gold' : selectedAnnouncement.category === 'News' ? 'blue' : selectedAnnouncement.category === 'Event' ? 'green' : 'default'} className="m-0 text-[10px] font-bold uppercase px-3 py-1 border-none rounded-lg tracking-widest">
                    {selectedAnnouncement.category}
                  </Tag>
                </div>
                {selectedAnnouncement.isPinned && (
                  <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-100/50 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-indigo-200">
                    <Pin size={12} fill="currentColor" />
                    Important
                  </div>
                )}
              </div>

              <h3 className="text-3xl font-bold text-slate-800 tracking-tight leading-tight mb-6">
                {selectedAnnouncement.title}
              </h3>

              <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm mb-8 min-h-[150px]">
                <p className="text-[16px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedAnnouncement.content}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-lg font-bold text-white shadow-xl shadow-slate-200">
                    {selectedAnnouncement.createdBy?.firstName?.[0]}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-slate-800">{selectedAnnouncement.createdBy?.firstName} {selectedAnnouncement.createdBy?.lastName}</p>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                      {new Date(selectedAnnouncement.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(selectedAnnouncement.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAnnouncement(null)}
                  className="h-12 px-8 rounded-2xl bg-white border border-slate-200 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .announcement-select .ant-select-selector {
          border-radius: 12px !important;
          height: 44px !important;
          padding-top: 6px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          border-color: #e2e8f0 !important;
        }
        .announcement-modal .ant-modal-content,
        .announcement-detail-modal .ant-modal-content {
          border-radius: 24px;
          padding: 24px;
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(10deg); }
          75% { transform: rotate(-10deg); }
        }
        .animate-wiggle {
          animation: wiggle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
