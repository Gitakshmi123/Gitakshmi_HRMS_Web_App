import React from 'react';

const HRDashboardGrid = ({ children }) => {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPI Row (Separated Cards with Gap) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {React.Children.toArray(children).slice(0, 6)}
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {React.Children.toArray(children).slice(6, 8)}
      </div>

      {/* Distribution & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          {React.Children.toArray(children).slice(8, 9)}
        </div>
        <div className="lg:col-span-5">
          {React.Children.toArray(children).slice(9, 10)}
        </div>
      </div>

      {/* Recruitment & Calendar Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          {React.Children.toArray(children).slice(10, 11)}
        </div>
        <div className="lg:col-span-4">
          {React.Children.toArray(children).slice(11, 12)}
        </div>
      </div>

      {/* Quick Actions & Full Width Table */}
      <div className="space-y-6">
        {React.Children.toArray(children).slice(12)}
      </div>
    </div>
  );
};

export default HRDashboardGrid;
