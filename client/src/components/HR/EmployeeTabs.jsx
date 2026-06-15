import React from 'react';
import { User, Heart, MapPin, FileText } from 'lucide-react';

const TABS = [
  { id: 1, label: 'Identity Details', icon: User },
  { id: 2, label: 'Family Background', icon: Heart },
  { id: 3, label: 'Address', icon: MapPin },
  { id: 4, label: 'Official Records', icon: FileText },
];

/**
 * Tab navigation for Employee Onboarding (Step 1 content).
 * Horizontal tabs with icons; active tab highlight.
 */
export default function EmployeeTabs({ activeTab = 1, onTabChange, children }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-gray-100 dark:border-slate-800 overflow-x-auto no-scrollbar pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange && onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px
                ${isActive
                  ? 'text-slate-900 dark:text-indigo-400 border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }
              `}
            >
              <Icon size={18} className={isActive ? 'text-slate-800' : 'text-slate-400'} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="p-2">
        {children}
      </div>
    </div>
  );
}
