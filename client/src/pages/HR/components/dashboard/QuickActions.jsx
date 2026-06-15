import React from 'react';
import { UserPlus, FileCheck, Briefcase, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

const QuickActions = () => {
  const actions = [
    { label: 'Add Employee', icon: UserPlus, path: '/hr/employees', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'Approve Leave', icon: FileCheck, path: '/hr/leave-approvals', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Create Job', icon: Briefcase, path: '/hr/requirement', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Run Payroll', icon: CreditCard, path: '/hr/payroll', color: 'bg-rose-50 text-rose-600 border-rose-100' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <Link
          key={index}
          to={action.path}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md group ${action.color}`}
        >
          <div className="p-2 rounded-lg bg-white shadow-sm transition-transform group-hover:scale-110">
            <action.icon size={20} />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase">{action.label}</span>
        </Link>
      ))}
    </div>
  );
};

export default QuickActions;
