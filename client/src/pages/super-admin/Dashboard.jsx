import React from 'react';
import { PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Search, Filter, MoreVertical, Eye } from 'lucide-react';

const STATS = [
  { 
    title: 'Total Companies', value: '124', change: '+ 12.5%', isPositive: true, 
    iconColor: 'text-blue-500', iconBg: 'bg-blue-50', lineColor: '#3b82f6',
    data: [4, 5, 4, 6, 5, 7, 6, 8]
  },
  { 
    title: 'Global Active Users', value: '12,842', change: '+ 8.3%', isPositive: true, 
    iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50', lineColor: '#10b981',
    data: [3, 4, 3, 5, 4, 6, 7, 8]
  },
  { 
    title: 'Total Modules', value: '18', change: '+ 5.6%', isPositive: true, 
    iconColor: 'text-purple-500', iconBg: 'bg-purple-50', lineColor: '#8b5cf6',
    data: [5, 5, 6, 5, 7, 6, 8, 9]
  },
  { 
    title: 'Inactive Tenants', value: '07', change: '- 12.0%', isPositive: false, 
    iconColor: 'text-red-500', iconBg: 'bg-red-50', lineColor: '#ef4444',
    data: [8, 7, 8, 6, 7, 5, 4, 3]
  },
];

const MODULE_DATA = [
  { name: 'Payroll', value: 35, count: 63, color: '#3b82f6' },
  { name: 'Attendance', value: 25, count: 45, color: '#22c55e' },
  { name: 'Leave Management', value: 20, count: 36, color: '#8b5cf6' },
  { name: 'Recruitment', value: 12, count: 22, color: '#f59e0b' },
  { name: 'Asset Management', value: 8, count: 14, color: '#06b6d4' },
];

const TABLE_DATA = [
  { id: 'CMP001', name: 'ABC Industries', sector: 'Manufacturing', status: 'Active' },
  { id: 'CMP002', name: 'TechNova Pvt Ltd', sector: 'IT Services', status: 'Pending' },
  { id: 'CMP003', name: 'Zenith Retail', sector: 'Retail', status: 'Inactive' },
  { id: 'CMP004', name: 'Global Pharma', sector: 'Healthcare', status: 'Active' },
  { id: 'CMP005', name: 'EduMaster Systems', sector: 'Education', status: 'Active' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor platform health, tenants and module utilization.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full ${stat.iconBg} ${stat.iconColor} flex items-center justify-center`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-600">{stat.title}</p>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-1">{stat.value}</h3>
              <p className={`text-[10px] font-medium ${stat.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                ↑ {stat.change} <span className="text-slate-400 font-normal ml-1">vs Last month</span>
              </p>
            </div>
            <div className="w-20 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stat.data.map(v => ({ value: v }))}>
                  <Line type="monotone" dataKey="value" stroke={stat.lineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Route */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800">Client Route</h3>
            <select className="text-xs border border-slate-200 rounded-md px-2 py-1 outline-none text-slate-600">
              <option>By Installed Tenants</option>
            </select>
          </div>
          
          <div className="relative h-48 flex items-center justify-center mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={MODULE_DATA}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {MODULE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800">18</span>
              <span className="text-xs text-slate-500">Total Modules</span>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            {MODULE_DATA.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <div className="text-slate-800 font-bold">
                  {item.value}% <span className="text-slate-400 font-normal ml-1">({item.count})</span>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-8 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors">
            View all modules →
          </button>
        </div>

        {/* Recent Infrastructure Activity */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Recent Infrastructure Activity</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search Company.." 
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 w-64"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                <Filter className="w-4 h-4" /> Filter
              </button>
              <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 font-bold text-slate-800">ID</th>
                  <th className="pb-4 font-bold text-slate-800">Company Name</th>
                  <th className="pb-4 font-bold text-slate-800">Sector</th>
                  <th className="pb-4 font-bold text-slate-800">Status</th>
                  <th className="pb-4 font-bold text-slate-800">Action</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_DATA.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-4 font-medium text-slate-800">{row.id}</td>
                    <td className="py-4 text-slate-600 font-medium">{row.name}</td>
                    <td className="py-4 text-slate-600">{row.sector}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        row.status === 'Active' ? 'bg-emerald-50 text-emerald-500' :
                        row.status === 'Pending' ? 'bg-amber-50 text-amber-500' :
                        'bg-red-50 text-red-500'
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
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-4">
            <p>Showing 1 to 5 of 125 entries</p>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50">&lt;</button>
              <button className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 font-medium rounded">1</button>
              <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded">2</button>
              <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded">3</button>
              <span className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>
              <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded">25</button>
              <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50">&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
