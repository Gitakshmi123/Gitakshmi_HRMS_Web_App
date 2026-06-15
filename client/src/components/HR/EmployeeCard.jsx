import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Eye,
  Edit2,
  MoreHorizontal,
  Calendar as CalendarIcon,
  IndianRupee,
  Briefcase,
} from 'lucide-react';
import dayjs from 'dayjs';
import { API_ROOT } from '../../utils/api';

const BACKEND_URL = API_ROOT || '';

/**
 * Derives display name from employee fields.
 */
function getDisplayName(emp) {
  if (!emp) return '';
  const parts = [];
  if (emp.firstName) parts.push(emp.firstName);
  if (emp.middleName) parts.push(emp.middleName.charAt(0).toUpperCase() + '.');
  if (emp.lastName) parts.push(emp.lastName);
  if (parts.length) return parts.join(' ');
  if (emp.name) return emp.name;
  if (emp.fullName) return emp.fullName;
  if (emp.displayName) return emp.displayName;
  return emp.email || emp.employeeId || '';
}

/**
 * Status badge styling.
 */
function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'active') { // Handle cases
    return { 
      label: 'Active', 
      className: 'bg-[#E8F8F2] text-[#10B981] border-transparent' 
    };
  }
  if (s === 'notice' || s === 'on leave') {
    return { 
      label: s === 'notice' ? 'On Notice' : 'On Leave', 
      className: 'bg-amber-50 text-amber-600 border-transparent' 
    };
  }
  return { 
    label: status || 'Inactive', 
    className: 'bg-slate-100 text-slate-500 border-transparent' 
  };
}

export default function EmployeeCard({
  employee,
  allEmployees = [],
  onViewProfile,
  onEdit,
  onApplyLeave,
  onSalaryStructure,
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = getDisplayName(employee);
  const employmentType = employee.employeeType || employee.employmentType || 'Full-Time';
  const statusBadge = getStatusBadge(employee.status);
  const joiningDate = employee.joiningDate
    ? dayjs(employee.joiningDate).format('DD MMM, YYYY')
    : '—';

  const handleSalary = () => {
    setMenuOpen(false);
    if (onSalaryStructure) onSalaryStructure(employee);
    else navigate(`/hr/salary-structure/${employee._id}?type=employee`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[12px] border border-slate-100 dark:border-slate-800 shadow-sm hover:translate-y-[-4px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-300 p-5 flex flex-col h-full relative group">
      {/* Top Section: Status & More menu */}
      <div className="flex justify-between items-start mb-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${statusBadge.className}`}
        >
          <span className="w-1 h-1 rounded-full bg-current mr-1.5" />
          {statusBadge.label}
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 z-50">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEdit && onEdit(employee); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Edit2 size={14} className="text-blue-500" /> Edit Employee
                </button>
                {onApplyLeave && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onApplyLeave(employee); }}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <CalendarIcon size={14} className="text-amber-500" /> Leave
                </button>
                )}
                <button
                  type="button"
                  onClick={handleSalary}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <IndianRupee size={14} className="text-emerald-500" /> Salary
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Avatar + name + role */}
      <div className="flex flex-col items-center text-center mb-5">
        <div className="relative mb-3">
          {employee.profilePic ? (
            <img
              src={String(employee.profilePic).startsWith('http') ? employee.profilePic : `${BACKEND_URL}${String(employee.profilePic).startsWith('/') ? '' : '/'}${employee.profilePic}`}
              alt=""
              className="w-20 h-20 rounded-full object-cover shadow-sm ring-4 ring-slate-50"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center text-xl font-bold ring-4 ring-slate-50">
              {(employee.firstName && employee.firstName[0]) || (employee.email && employee.email[0]) || '?'}
              {(employee.lastName && employee.lastName[0]) || ''}
            </div>
          )}
        </div>
        <h3 className="text-[16px] font-bold text-slate-800 dark:text-white leading-tight">
          {displayName}
        </h3>
        <p className="text-[12px] text-slate-400 mt-1 font-medium italic">
          {employee.designation || employee.role || '—'}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-[#F8FAFC] dark:bg-slate-800/50 rounded-lg p-4 flex flex-col gap-3 mb-5 flex-grow">
        <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium">
          <span className="text-slate-400">#</span>
          <span>{employee.employeeId || '—'}</span>
        </div>
        
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 min-w-0">
            <Briefcase size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{employee.department || 'General'}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarIcon size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{employmentType}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-blue-500">
          <Mail size={14} className="shrink-0 text-slate-400" />
          <a href={`mailto:${employee.email}`} className="truncate hover:underline">
            {employee.email || '—'}
          </a>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-blue-500">
          <Phone size={14} className="shrink-0 text-slate-400" />
          <span className="truncate">{employee.contactNo || employee.phone || '—'}</span>
        </div>
      </div>

      {/* Footer Row */}
      <div className="flex items-center justify-center pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-slate-400">
        <button
          onClick={() => onViewProfile && onViewProfile(employee)}
          className="text-slate-800 dark:text-slate-200 font-bold hover:text-blue-600 transition-colors flex items-center gap-1"
        >
          View details <span className="text-[14px] leading-none">›</span>
        </button>
      </div>
    </div>
  );
}
