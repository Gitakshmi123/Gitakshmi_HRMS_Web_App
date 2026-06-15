import React from 'react';

export default function Sidebar({ children }) {
  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen p-6 flex flex-col justify-between shadow-xl">
      {children || <div className="text-white">ESS Portal</div>}
    </aside>
  );
}
