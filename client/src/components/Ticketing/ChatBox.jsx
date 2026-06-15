import React, { useState, useEffect, useRef } from 'react';
import api, { API_ROOT } from '../../utils/api';
import { 
    Send, User, Bot, Clock, Shield, Paperclip, X, ArrowUpRight, 
    Image as ImageIcon, FileText, Video as VideoIcon, File,
    MoreVertical, Download, Play, FileJson
} from 'lucide-react';
import clsx from 'clsx';

export default function ChatBox({ ticketId, messages: initialMessages, onNewMessage }) {
    const [messages, setMessages] = useState(initialMessages || []);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const menuRef = useRef(null);

    const getFileIcon = (type, name) => {
        if (type?.includes('image')) return <ImageIcon size={14} />;
        if (type?.includes('video')) return <VideoIcon size={14} />;
        if (type?.includes('pdf')) return <FileText size={14} className="text-rose-500" />;
        if (name?.endsWith('.doc') || name?.endsWith('.docx')) return <FileText size={14} className="text-blue-500" />;
        return <File size={14} />;
    };

    const renderAttachment = (att, isEmployee) => {
        const isImage = att.fileType?.includes('image');
        const isVideo = att.fileType?.includes('video');
        const fileUrl = `${API_ROOT}${att.fileUrl}`;

        if (isImage) {
            return (
                <div className="mt-2 group relative">
                    <img 
                        src={fileUrl} 
                        alt={att.fileName} 
                        className="max-w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(fileUrl, '_blank')}
                    />
                    <a 
                        href={fileUrl} 
                        download 
                        className="absolute bottom-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Download size={12} />
                    </a>
                </div>
            );
        }

        if (isVideo) {
            return (
                <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-black overflow-hidden relative group">
                    <video className="max-w-full max-h-48" preload="metadata">
                        <source src={fileUrl} type={att.fileType} />
                    </video>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all cursor-pointer" onClick={() => window.open(fileUrl, '_blank')}>
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
                            <Play size={16} fill="currentColor" />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <a 
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                    "flex items-center gap-3 p-3 mt-2 rounded-xl transition-all text-[10px] font-bold uppercase",
                    isEmployee 
                        ? "bg-white/10 text-white border border-white/20 hover:bg-white/20" 
                        : "bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700 hover:border-indigo-200"
                )}
            >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    {getFileIcon(att.fileType, att.fileName)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="truncate">{att.fileName}</p>
                    <p className="text-[8px] opacity-60 mt-0.5">{att.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                </div>
                <Download size={12} className="opacity-50" />
            </a>
        );
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setMessages(initialMessages || []);
    }, [initialMessages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || sending) return;

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('text', newMessage);
            if (selectedFile) {
                formData.append('attachment', selectedFile);
            }

            const res = await api.post(`/tickets/${ticketId}/comments`, formData);
            
            const updatedTicket = res.data.ticket;
            const updatedMessages = updatedTicket.comments || [];
            
            setMessages(updatedMessages);
            setNewMessage('');
            setSelectedFile(null);
            if (onNewMessage) onNewMessage(updatedMessages);
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Messages Area */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                        <Bot size={40} strokeWidth={1} />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-2">No messages yet</p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.senderRole === 'employee' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] flex items-start gap-2 ${msg.senderRole === 'employee' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-800 shadow-sm
                                    ${msg.senderRole === 'system' ? 'bg-indigo-100 text-indigo-600' : 
                                      msg.senderRole === 'hr' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                                    {msg.senderRole === 'system' ? <Bot size={14} /> : 
                                     msg.senderRole === 'hr' ? <Shield size={14} /> : <User size={14} />}
                                </div>
                                
                                <div className={`flex flex-col ${msg.senderRole === 'employee' ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-4 py-2.5 rounded-2xl text-xs font-medium shadow-sm
                                        ${msg.senderRole === 'employee' ? 'bg-indigo-600 text-white rounded-tr-none' : 
                                          msg.senderRole === 'system' ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 italic rounded-tl-none' : 
                                          'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none'}`}>
                                        <div className="whitespace-pre-wrap">{msg.text || msg.content}</div>
                                        {msg.attachments?.map((att, i) => (
                                            <div key={i}>
                                                {renderAttachment(att, msg.senderRole === 'employee')}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 px-1">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {selectedFile && (
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <Paperclip size={12} className="text-indigo-600" />
                            <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{selectedFile.name}</span>
                        </div>
                        <button type="button" onClick={() => setSelectedFile(null)} className="text-rose-500 hover:text-rose-700">
                            <X size={14} />
                        </button>
                    </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2 items-center relative">
                    <input 
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                            setSelectedFile(e.target.files[0]);
                            setShowAttachmentMenu(false);
                        }}
                    />
                    
                    <div className="relative" ref={menuRef}>
                        <button 
                            type="button"
                            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                            className={clsx(
                                "p-2.5 rounded-full transition-all border",
                                showAttachmentMenu ? "bg-indigo-600 border-indigo-600 text-white rotate-45 shadow-lg shadow-indigo-600/30" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:bg-slate-100"
                            )}
                        >
                            {showAttachmentMenu ? <X size={18} /> : <Paperclip size={18} />}
                        </button>

                        {showAttachmentMenu && (
                            <div className="absolute bottom-full left-0 mb-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2 min-w-[200px] animate-in slide-in-from-bottom-2 duration-200 z-50">
                                <div className="grid grid-cols-1 gap-1">
                                    {[
                                        { label: 'Images', icon: <ImageIcon size={14} />, color: 'text-purple-500', bg: 'bg-purple-50', accept: 'image/*' },
                                        { label: 'Videos', icon: <VideoIcon size={14} />, color: 'text-amber-500', bg: 'bg-amber-50', accept: 'video/*' },
                                        { label: 'Documents', icon: <FileText size={14} />, color: 'text-blue-500', bg: 'bg-blue-50', accept: '.pdf,.doc,.docx' },
                                        { label: 'Camera', icon: <VideoIcon size={14} />, color: 'text-rose-500', bg: 'bg-rose-50', accept: 'image/*', capture: 'environment' },
                                    ].map((opt, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                                fileInputRef.current.accept = opt.accept;
                                                if (opt.capture) fileInputRef.current.capture = opt.capture;
                                                else fileInputRef.current.removeAttribute('capture');
                                                fileInputRef.current.click();
                                            }}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
                                        >
                                            <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", opt.bg, opt.color)}>
                                                {opt.icon}
                                            </div>
                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-transparent focus:border-indigo-100 dark:focus:border-indigo-900/30 px-6 py-3 rounded-[2rem] text-xs font-bold outline-none transition-all dark:text-white"
                    />
                    <button 
                        type="submit"
                        disabled={sending || (!newMessage.trim() && !selectedFile)}
                        className="w-12 h-12 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all disabled:opacity-30 shadow-lg shadow-indigo-600/20 flex items-center justify-center active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
