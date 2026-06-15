import { 
  BarChart3, 
  Users, 
  Banknote, 
  Fingerprint, 
  LifeBuoy, 
  LayoutDashboard, 
  CalendarCheck, 
  FileText 
} from 'lucide-react';

export const MODULE_MAP = {
  // WORKSPACE (Personal/Basic Access)
  "Dashboard": {
    path: "/hr",
    icon: LayoutDashboard,
    section: "WORKSPACE",
    label: "Dashboard"
  },
  "My Attendance": {
    path: "/hr/attendance",
    icon: CalendarCheck,
    section: "WORKSPACE",
    label: "My Attendance"
  },
  "My Payslips": {
    path: "/hr/payroll/payslips",
    icon: FileText,
    section: "WORKSPACE",
    label: "My Payslips"
  },

  // MANAGEMENT ACCESS (Admin/HR/Manager Access)
  "HR & Personnel": {
    path: "/hr/employees",
    icon: Users,
    section: "MANAGEMENT ACCESS",
    label: "HR & Personnel",
    submenu: [
      { name: "Employees", path: "/hr/employees" },
      { name: "Departments", path: "/hr/departments" }
    ]
  },
  "Payroll & Salary": {
    path: "/hr/payroll/dashboard",
    icon: Banknote,
    section: "MANAGEMENT ACCESS",
    label: "Payroll & Salary",
    submenu: [
      { name: "Dashboard", path: "/hr/payroll/dashboard" },
      { name: "Process", path: "/hr/payroll/process" },
      { name: "History", path: "/hr/payroll/run" }
    ]
  },
  "Attendance & Time": {
    path: "/hr/attendance",
    icon: Fingerprint,
    section: "MANAGEMENT ACCESS",
    label: "Attendance & Time"
  },

  // SUPPORT
  "Tickets": {
    path: "/hr/tickets",
    icon: LifeBuoy,
    section: "SUPPORT",
    label: "Tickets"
  }
};
