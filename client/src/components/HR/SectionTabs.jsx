import React from "react";
import { NavLink } from "react-router-dom";

export default function SectionTabs({ tabs, className = "" }) {
  if (!tabs?.length) return null;

  const isCustom = className.includes('border-none') || className.includes('mb-0');
  const defaultClasses = isCustom ? "" : "mb-5 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-20";
  
  return (
    <div className={`overflow-x-auto no-scrollbar ${defaultClasses} ${className}`.trim()}>
      <div className="flex min-w-max items-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          if (tab.isExternal) {
            return (
              <button
                key={tab.label}
                type="button"
                onClick={tab.onClick}
                className="relative inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13px] font-semibold text-slate-500 transition hover:text-[#1e293b]"
              >
                {Icon ? <Icon size={16} strokeWidth={2} /> : null}
                <span>{tab.label}</span>
              </button>
            );
          }
          return (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end !== false}
              className={({ isActive }) =>
                `relative inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${
                  isActive
                    ? "border-[#1e293b] text-[#1e293b]"
                    : "border-transparent text-slate-500 hover:text-[#1e293b]"
                }`
              }
            >
              {Icon ? <Icon size={16} strokeWidth={2} /> : null}
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
