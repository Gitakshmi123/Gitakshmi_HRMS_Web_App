import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Building2, Spline, UserCog, Users } from "lucide-react";

const tabs = [
  { label: "Employees", to: "/employees", icon: Users },
  { label: "Departments", to: "/departments", icon: Building2 },
  { label: "Users", to: "/users", icon: UserCog },
];

export default function PeopleTabs({ className = "" }) {
  const location = useLocation();
  const pathPrefix = location.pathname.startsWith("/tenant") ? "/tenant" : "/hr";

  return (
    <div className={`mb-5 flex flex-wrap gap-2 ${className}`.trim()}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.label}
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
        );
      })}
    </div>
  );
}
