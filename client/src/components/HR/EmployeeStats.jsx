import React from 'react';
import { Users, User, Briefcase, Calendar } from 'lucide-react';

/**
 * Metric cards for Employee Directory header.
 * Displays: Total Employees, Active Employees, Departments, New Joiners.
 */
export default function EmployeeStats({ stats = {} }) {
  const items = [
    {
      label: 'Total Employees',
      value: stats.total ?? 0,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-500',
    },
    {
      label: 'Active Employees',
      value: stats.active ?? 0,
      icon: User,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: 'border-emerald-500',
    },
    {
      label: 'Departments',
      value: stats.depts ?? 0,
      icon: Briefcase,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-500',
    },
    {
      label: 'New Joiners',
      value: stats.newJoiners ?? 0,
      icon: Calendar,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 relative overflow-hidden group"
          >
            <div
              className={`absolute top-0 left-0 w-1 h-full ${stat.borderColor.replace('border-', 'bg-')}`}
              aria-hidden
            />
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {stat.label}
                </p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stat.value}</h3>
              </div>
              <div
                className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}
              >
                <Icon size={22} strokeWidth={2} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
