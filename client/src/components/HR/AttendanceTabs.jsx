import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Fingerprint, LayoutDashboard } from "lucide-react";
import { Can } from "../../components/rbac/PermissionGate";

const tabs = [
  { label: "Dashboard", to: "/attendance", icon: LayoutDashboard, permission: "attendance.dashboard" },
  { label: "Calendar", to: "/attendance-calendar", icon: CalendarDays, permission: "attendance.calendar" },
  { label: "Face Updates", to: "/face-update-requests", icon: Fingerprint, permission: "attendance.face" },
];

export default function AttendanceTabs({ className = "" }) {
  const location = useLocation();
  const pathPrefix = location.pathname.startsWith("/tenant") ? "/tenant" : "/hr";

  return (
    <div className={`mb-5 flex flex-wrap gap-2 ${className}`.trim()}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Can key={tab.label} module={tab.permission} action="view">
            <NavLink
              to={`${pathPrefix}${tab.to}`}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
                }`
              }
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </NavLink>
          </Can>
        );
      })}
    </div>
  );
}

