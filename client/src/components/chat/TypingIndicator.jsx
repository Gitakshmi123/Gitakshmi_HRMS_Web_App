import React from 'react';

export default function TypingIndicator({ who }) {
    return (
        <div className="flex items-center gap-3 px-6 py-4 animate-fade-in animate-slide-up duration-300">
            <div className="flex gap-1.5 p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
            </div>
            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{who || 'Someone'} is typing...</span>
        </div>
    );
}
