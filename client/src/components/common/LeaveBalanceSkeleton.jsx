import React from 'react';

export default function LeaveBalanceSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative group">
          <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800"></div>
          <div className="relative p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse w-10 h-10"></div>
              <div className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse w-16 h-5"></div>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <div className="h-8 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-5"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50">
                <div className="h-2 w-12 bg-slate-200 dark:bg-slate-600 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-16 bg-slate-200 dark:bg-slate-600 rounded animate-pulse"></div>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50">
                <div className="h-2 w-16 bg-slate-200 dark:bg-slate-600 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-16 bg-slate-200 dark:bg-slate-600 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
