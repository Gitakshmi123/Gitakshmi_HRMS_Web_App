import React from 'react';
import { Search, Building2, CheckCircle2, XCircle, Eye, MoreVertical } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const STATS = [
  { 
    title: 'Total Companies', value: '245', change: '+ 12% this month', isPositive: true, 
    iconColor: 'text-blue-600', iconBg: 'bg-blue-600', icon: Building2, lineColor: '#93c5fd', chartBg: 'bg-blue-50',
    data: [4, 5, 4, 6, 5, 7, 6, 8]
  },
  { 
    title: 'Active Companies', value: '218', change: '↑ 89% of total', isPositive: true, 
    iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500', icon: CheckCircle2, lineColor: '#86efac', chartBg: 'bg-emerald-50',
    data: [3, 4, 3, 5, 4, 6, 7, 8]
  },
  { 
    title: 'Inactive Companies', value: '17', change: '↓ 11% of total', isPositive: false, 
    iconColor: 'text-rose-500', iconBg: 'bg-rose-500', icon: XCircle, lineColor: '#fca5a5', chartBg: 'bg-rose-50',
    data: [8, 7, 8, 6, 7, 5, 4, 3]
  },
];

const TABLE_DATA = [
  { 
    id: 'ACM001', name: 'Acme Technologies Pvt. Ltd.', parent: 'Acme Group', 
    email: 'admin@acme.com', status: 'Active', color: 'bg-indigo-500', initial: 'AT' 
  },
  { 
    id: 'INF023', name: 'Infosoft Solutions Pvt. Ltd.', parent: 'Infosoft Group', 
    email: 'hr@infosoft.com', status: 'Pending', color: 'bg-emerald-500', initial: 'I' 
  },
  { 
    id: 'NGC087', name: 'NextGen Corporation', parent: 'NextGen Group', 
    email: 'admin@nextgen.com', status: 'Inactive', color: 'bg-rose-500', initial: 'NG' 
  },
  { 
    id: 'BBD112', name: 'BlueBird Digital Pvt. Ltd.', parent: 'BlueBird Group', 
    email: 'contact@bluebird.com', status: 'Active', color: 'bg-blue-600', initial: 'BB' 
  },
  { 
    id: 'SLI085', name: 'Softline Industries', parent: 'Softline Holdings', 
    email: 'admin@softline.com', status: 'Active', color: 'bg-emerald-500', initial: 'SI' 
  },
];

export default function Companies() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Companies</h1>
        <p className="text-slate-500 text-sm mt-1">Manage, monitor, and organize all registered companies from a single workspace.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STATS.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex gap-4">
              <div className={`w-12 h-12 rounded-full ${stat.iconBg} text-white flex items-center justify-center shrink-0`}>
                <stat.icon className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">{stat.title}</p>
                <h3 className="text-3xl font-bold text-slate-800 mb-1">{stat.value}</h3>
                <p className={`text-xs font-medium ${stat.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {stat.change}
                </p>
              </div>
            </div>
            <div className={`w-20 h-20 rounded-full ${stat.chartBg} flex items-center justify-center`}>
              <div className="w-12 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stat.data.map(v => ({ value: v }))}>
                    <Line type="monotone" dataKey="value" stroke={stat.lineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Parent Companies..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            + Create Company
          </button>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-800">
                <th className="pb-4 font-bold uppercase tracking-wider">COMPANY NAME</th>
                <th className="pb-4 font-bold uppercase tracking-wider">CODE</th>
                <th className="pb-4 font-bold uppercase tracking-wider">ADMIN EMAIL</th>
                <th className="pb-4 font-bold uppercase tracking-wider">STATUS</th>
                <th className="pb-4 font-bold uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_DATA.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${row.color} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                        {row.initial}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Parent: {row.parent}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-slate-600 font-medium">{row.id}</td>
                  <td className="py-4 text-slate-600">{row.email}</td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      row.status === 'Active' ? 'bg-emerald-50 text-emerald-500' :
                      row.status === 'Pending' ? 'bg-amber-50 text-amber-500' :
                      'bg-rose-50 text-rose-500'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-4">
                      <button className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium text-xs">
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button className="text-slate-400 hover:text-slate-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
          <p>Showing 1 to 5 of 125 entries</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50">&lt;</button>
            <button className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 font-medium rounded">1</button>
            <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded border border-transparent">2</button>
            <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded border border-transparent">3</button>
            <span className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>
            <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded border border-transparent">25</button>
            <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
