import {
  BarChart3,
  Briefcase,
  Calendar,
  Clock,
  FileCheck,
  FileText,
  Globe,
  ShieldCheck,
  UserCircle2,
  Users,
  Zap,
  Settings2,
  Lock
} from 'lucide-react';

export const PSA_MODULES = [
  { code: 'hr', id: 'hr', label: 'HR Management', shortLabel: 'HR', dashboardLabel: 'HR Ops', icon: Users, color: 'text-blue-600', chartColor: '#3b82f6', bg: 'bg-blue-50', border: 'hover:border-blue-200' },
  { code: 'payroll', id: 'payroll', label: 'Payroll System', shortLabel: 'Payroll', dashboardLabel: 'Payroll', icon: BarChart3, color: 'text-emerald-600', chartColor: '#a855f7', bg: 'bg-emerald-50', border: 'hover:border-emerald-200' },
  { code: 'attendance', id: 'attendance', label: 'Attendance', shortLabel: 'Attendance', dashboardLabel: 'Attendance', icon: Clock, color: 'text-rose-600', chartColor: '#6366f1', bg: 'bg-rose-50', border: 'hover:border-rose-200' },
  { code: 'leave', id: 'leave', label: 'Leave Management', shortLabel: 'Leave', dashboardLabel: 'Leave Mgt', icon: Calendar, color: 'text-amber-600', chartColor: '#F99F7A', bg: 'bg-amber-50', border: 'hover:border-amber-200' },
  { code: 'employeePortal', id: 'employeePortal', label: 'Employee Portal', shortLabel: 'Emp Portal', dashboardLabel: 'Emp Portal', icon: UserCircle2, color: 'text-indigo-600', chartColor: '#ED4E8C', bg: 'bg-indigo-50', border: 'hover:border-indigo-200' },
  { code: 'recruitment', id: 'recruitment', label: 'Recruitment', shortLabel: 'Recruitment', dashboardLabel: 'Recruitment', icon: Briefcase, color: 'text-sky-600', chartColor: '#f59e0b', bg: 'bg-sky-50', border: 'hover:border-sky-200' },
  { code: 'backgroundVerification', id: 'backgroundVerification', label: 'BGV', shortLabel: 'BGV', dashboardLabel: 'BGV', icon: ShieldCheck, color: 'text-violet-600', chartColor: '#0ea5e9', bg: 'bg-violet-50', border: 'hover:border-violet-200' },
  { code: 'documentManagement', id: 'documentManagement', label: 'Doc Management', shortLabel: 'Documents', dashboardLabel: 'Documents', icon: FileText, color: 'text-fuchsia-600', chartColor: '#ef4444', bg: 'bg-fuchsia-50', border: 'hover:border-fuchsia-200' },
  { code: 'socialMediaIntegration', id: 'socialMediaIntegration', label: 'Social Media', shortLabel: 'Social Media', dashboardLabel: 'Social Media', icon: Globe, color: 'text-pink-600', chartColor: '#ec4899', bg: 'bg-pink-50', border: 'hover:border-pink-200' },
  { code: 'onboarding', id: 'onboarding', label: 'Onboarding', shortLabel: 'Onboarding', dashboardLabel: 'Onboarding', icon: Zap, color: 'text-orange-600', chartColor: '#f97316', bg: 'bg-orange-50', border: 'hover:border-orange-200' },
  { code: 'policy', id: 'policy', label: 'Policy', shortLabel: 'Policy', dashboardLabel: 'Policy', icon: FileCheck, color: 'text-teal-600', chartColor: '#14b8a6', bg: 'bg-teal-50', border: 'hover:border-teal-200' },
  { code: 'reports', id: 'reports', label: 'Reports', shortLabel: 'Reports', dashboardLabel: 'Reports', icon: FileText, color: 'text-cyan-600', chartColor: '#06b6d4', bg: 'bg-cyan-50', border: 'hover:border-cyan-200' },
  { code: 'customStudio', id: 'customStudio', label: 'Custom Studio', shortLabel: 'Custom Studio', dashboardLabel: 'Custom Studio', icon: Settings2, color: 'text-slate-600', chartColor: '#475569', bg: 'bg-slate-50', border: 'hover:border-slate-200' },
  { code: 'accessControl', id: 'accessControl', label: 'Access Control', shortLabel: 'Access', dashboardLabel: 'Access', icon: Lock, color: 'text-red-600', chartColor: '#ef4444', bg: 'bg-red-50', border: 'hover:border-red-200' },
];

export const PSA_MODULE_CODES = PSA_MODULES.map((moduleItem) => moduleItem.code);

export function getPsaModuleByCode(code) {
  return PSA_MODULES.find((moduleItem) => moduleItem.code === code || moduleItem.id === code) || null;
}
