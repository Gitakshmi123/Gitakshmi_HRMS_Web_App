import React from 'react';

const ChartCard = ({ title, children, subtitle }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      <div className="flex flex-col mb-6">
        <h3 className="text-lg font-semibold text-gray-900 leading-none">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-[250px] w-full">
        {children}
      </div>
    </div>
  );
};

export default ChartCard;
