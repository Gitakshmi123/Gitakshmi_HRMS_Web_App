import React from 'react';

const StatsCard = ({ label, value, icon: Icon, color, trend, subLabel }) => {
  // Extract a base color class based on the text color provided in standard Tailwind convention (e.g., text-indigo-600 -> bg-indigo-600)
  const borderColorClass = color.text ? color.text.replace('text-', 'bg-') : 'bg-gray-200';
  const iconColorClass = color.text || 'text-gray-500';

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 px-6 py-7 relative transition-all group hover:bg-gray-50/50 hover:shadow-[0_4px_25px_rgba(0,0,0,0.06)] flex flex-col justify-between overflow-hidden">
      {/* Fasto bold top colored border */}
      <div className="absolute top-0 left-0 w-full h-1 opacity-90 z-10">
        <div className={`w-full h-[5px] ${borderColorClass} shadow-[0_0_10px_currentColor] opacity-90`}></div>
      </div>

      <div className="flex justify-between items-start mb-6 relative z-10">
        <h3 className="text-[34px] font-[800] text-[#111827] leading-none tracking-tight">{value}</h3>
      </div>

      <div className="relative z-10">
        <p className="text-[13px] text-[#6B7280] font-semibold tracking-wide">{label}</p>

        {/* Only show sub details if present, keeping it minimal like fasto */}
        {(trend) && (
          <div className="mt-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${trend.includes('+') ? 'text-green-600 bg-green-50' : trend.includes('-') ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100'}`}>
              {trend}
            </span>
            {subLabel && <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">{subLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
