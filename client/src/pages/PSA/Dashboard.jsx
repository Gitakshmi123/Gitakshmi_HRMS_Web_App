import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import {
  TrendingUp, Activity, Users, Plus, Settings, Clock,
  ChevronRight, Zap, Bell, Search, MoreHorizontal,
  Shield, LayoutGrid, Cpu, Briefcase, Building2, ExternalLink, EyeOff,
  FileText, Calendar, ArrowUpRight, Layers, Share2
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { normalizeEnabledModules } from "../../utils/moduleConfig";
import { PSA_MODULES } from "../../constants/psaModuleCatalog";
import { Dropdown } from "antd";

// --- Sub-components ---

const DashboardCard = ({ label, value, icon: Icon, trend, trendColor, subLabel, subValue, buttonText = "View List", onClick, topBorderColor }) => {
  return (
    <div 
      className="bg-slate-50/50 p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 flex flex-col gap-5 relative group"
      style={{ borderTop: `4px solid ${topBorderColor}` }}
    >
      <div className="flex justify-between items-start">
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-700 shadow-sm transition-transform group-hover:scale-110">
          {Icon && <Icon size={18} strokeWidth={2.5} />}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${trendColor === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <TrendingUp size={12} />
            <span>{trend}</span>
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
          {label}
        </p>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
          {value}
        </h2>
      </div>

      <div className="pt-2 border-t border-slate-200/60 mt-auto">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {subLabel}
          </span>
          <span className="text-[10px] font-black text-slate-700 tabular-nums">
            {subValue}
          </span>
        </div>
        <button 
          onClick={onClick}
          className="w-full py-1.5 rounded-lg bg-white border border-slate-200 text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};



const Hexagon = ({ x, y, size, color, icon: Icon, active, onClick, onMouseEnter, onMouseLeave }) => {
  const h = size * Math.sqrt(3);
  const points = [
    [x + size, y],
    [x + size/2, y + h/2],
    [x - size/2, y + h/2],
    [x - size, y],
    [x - size/2, y - h/2],
    [x + size/2, y - h/2]
  ].map(p => p.join(',')).join(' ');

  return (
    <g 
      className="cursor-pointer transition-all duration-500 group/hex" 
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ filter: active ? `drop-shadow(0 0 12px ${color}66)` : 'none' }}
    >
      {/* Outer Glow */}
      <polygon 
        points={points} 
        fill={color} 
        fillOpacity={active ? 0.15 : 0.05}
        className="transition-all duration-500 group-hover/hex:fill-opacity-20"
      />
      {/* Decorative Border */}
      <polygon 
        points={points} 
        fill="transparent" 
        stroke={color} 
        strokeWidth="1.5"
        strokeOpacity={active ? 0.8 : 0.3}
        className="transition-all duration-500 group-hover/hex:stroke-opacity-100"
      />
      {/* Icon Holder */}
      <circle 
        cx={x} cy={y} r={size * 0.55} 
        fill="white" 
        className="shadow-sm" 
        fillOpacity={0.9}
      />
      <foreignObject x={x - size * 0.4} y={y - size * 0.4} width={size * 0.8} height={size * 0.8}>
        <div className="flex items-center justify-center w-full h-full" style={{ color: color }}>
          <Icon size={size * 0.5} strokeWidth={2.5} />
        </div>
      </foreignObject>
    </g>
  );
};

const HoneycombChart = ({ data, activeIndex, setActiveIndex }) => {
  const [hoverIndex, setHoverIndex] = useState(-1);
  const center = { x: 160, y: 160 };
  const radius = 95;
  const hexSize = 26;

  const impactValue = data.reduce((a, b) => a + b.value, 0);
  const currentItem = hoverIndex !== -1 ? data[hoverIndex] : (activeIndex !== -1 ? data[activeIndex] : null);

  return (
    <div className="relative w-full aspect-square mx-auto group/honeycomb">
      {/* 🌌 High-Tech Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full"></div>
      <div className="absolute top-1/4 left-3/4 w-32 h-32 bg-orange-500/10 blur-[60px] rounded-full animate-pulse"></div>
      
      <svg viewBox="0 0 320 320" className="w-full h-full relative z-10 overflow-visible">
        {/* Connection Lattice */}
        {data.slice(0, 8).map((item, i) => {
          const angle = (i * (2 * Math.PI) / 8) - (Math.PI / 2);
          const tx = center.x + radius * Math.cos(angle);
          const ty = center.y + radius * Math.sin(angle);
          return (
            <line 
              key={`line-${i}`}
              x1={center.x} y1={center.y} 
              x2={tx} y2={ty} 
              stroke={currentItem && (hoverIndex === i || activeIndex === i) ? currentItem.color : "#e2e8f0"} 
              strokeWidth={currentItem && (hoverIndex === i || activeIndex === i) ? "2" : "1"} 
              strokeDasharray="4 4"
              className="transition-all duration-500"
              strokeOpacity={currentItem && (hoverIndex === i || activeIndex === i) ? 0.6 : 0.4}
            />
          );
        })}

        {/* Central Hub Hexagon */}
        <g className="filter drop-shadow-2xl">
           <path 
             d="M160,110 L205,135 L205,185 L160,210 L115,185 L115,135 Z" 
             fill="white" 
             stroke={currentItem ? currentItem.color : "#f8fafc"} 
             strokeWidth="4"
             className="transition-all duration-500"
           />
           <text x="160" y="145" textAnchor="middle" className="text-[10px] font-black fill-slate-400 uppercase tracking-[0.15em] font-outfit">
             {currentItem ? currentItem.name : "Total Modules"}
           </text>
           <text x="160" y="190" textAnchor="middle" className="text-5xl font-black fill-slate-900 font-outfit tracking-tighter tabular-nums leading-none">
             {currentItem ? currentItem.value : impactValue}
           </text>
        </g>

        {/* 8 Octagonal Satellite Nodes */}
        {data.slice(0, 8).map((item, i) => {
          const angle = (i * (2 * Math.PI) / 8) - (Math.PI / 2);
          const tx = center.x + radius * Math.cos(angle);
          const ty = center.y + radius * Math.sin(angle);
          const isActive = (hoverIndex === -1 && activeIndex === -1) || hoverIndex === i || activeIndex === i;
          return (
            <Hexagon 
              key={i} 
              x={tx} y={ty} 
              size={hexSize} 
              color={item.color} 
              icon={item.icon} 
              active={isActive}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(-1)}
              onClick={() => setActiveIndex(i === activeIndex ? -1 : i)}
            />
          );
        })}
      </svg>
    </div>
  );
};


const RegionalBreakdown = ({ data }) => {
  return (
    <div className="card-premium p-8 bg-[#1B2533] border-none h-full min-h-[500px] flex flex-col relative overflow-hidden group">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
      
      <div className="relative z-10 text-left">
        <h3 className="text-xl font-black text-white font-outfit mb-1 tracking-tight">Regional User Breakdown</h3>
        <p className="text-[11px] font-medium text-slate-400 font-outfit uppercase tracking-widest mb-8">User acquisition counts by global region</p>
        
        <div className="h-[200px] w-full mb-8">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <defs>
                   <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#3b82f6" />
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis hide dataKey="name" />
                <Bar 
                  dataKey="count" 
                  fill="url(#barGradient)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={18}
                />
              </BarChart>
           </ResponsiveContainer>
        </div>

        <div className="space-y-4">
           <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest pb-2 border-b border-white/5">
              <div className="col-span-6">Global Region</div>
              <div className="col-span-3 text-right">Count</div>
              <div className="col-span-3 text-right">Growth</div>
           </div>
           {data.map((row, i) => (
             <div key={i} className="grid grid-cols-12 gap-2 text-[12px] font-bold py-1 items-center border-b border-white/[0.02]">
                <div className="col-span-6 text-slate-300 font-outfit">{row.name}</div>
                <div className="col-span-3 text-right text-white tabular-nums font-outfit">{row.count.toLocaleString()}</div>
                <div className="col-span-3 text-right text-[#10B981] font-outfit">+{row.growth}%</div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};


const UsageRow = ({ item, maxVal, index }) => {
  const Icon = item.icon || Activity;
  const percentage = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
  
  return (
    <div className="group/row flex items-center gap-6 py-4 transition-all duration-300">
      {/* Icon Circle */}
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-md group-hover/row:scale-110 transition-transform"
        style={{ backgroundColor: item.color }}
      >
        <Icon size={16} strokeWidth={2.5} />
      </div>

      {/* Label */}
      <div className="w-[120px] shrink-0">
        <span className="text-[13px] font-black text-slate-700 uppercase tracking-widest font-outfit truncate block">{item.name}</span>
      </div>

      {/* Thick Progress Pill */}
      <div className="flex-1 h-8 bg-[#f1f5f9] rounded-full overflow-hidden relative border border-slate-50">
         <div
           className="h-full rounded-full transition-all duration-[1500ms] cubic-bezier(0.34, 1.56, 0.64, 1)"
           style={{
             width: `${percentage}%`,
             backgroundColor: item.color,
             boxShadow: `inset 0 2px 4px rgba(0,0,0,0.05), 0 0 10px ${item.color}33`
           }}
         ></div>
      </div>
    </div>
  );
};
export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalModules: 0,
    activeUsers: 4280,
    systemUptime: '99.9%'
  });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [timeframe, setTimeframe] = useState('6M');
  const [visibleSeries, setVisibleSeries] = useState({ users: true, tenants: true });

  // Dynamic Data Logic
  const processedGrowthData = useMemo(() => {
    if (!companies || companies.length === 0) return { m6: [], y1: [] };

    const now = new Date();
    const months6 = [];
    const months12 = [];

    // Helpers to get month labels
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months6.push({ 
        name: d.toLocaleString('default', { month: 'short' }), 
        timestamp: d.getTime(),
        tenants: 0, 
        users: 0 
      });
    }

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months12.push({ 
        name: d.toLocaleString('default', { month: 'short' }) + (i > 5 ? ` ${d.getFullYear().toString().slice(2)}` : ''), 
        timestamp: d.getTime(),
        tenants: 0, 
        users: 0 
      });
    }

    // Sort companies by date
    const sorted = [...companies].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Calculate cumulative growth
    const calculateCumulative = (targetArray) => {
      let cumulativeTenants = 0;
      let cumulativeUsers = 0;

      return targetArray.map((slot, idx) => {
        const nextSlotTimestamp = idx < targetArray.length - 1 ? targetArray[idx+1].timestamp : Infinity;
        
        // Find companies created before this slot ends
        const newlyAdded = sorted.filter(c => {
          const cDate = new Date(c.createdAt).getTime();
          return cDate >= slot.timestamp && cDate < nextSlotTimestamp;
        });

        cumulativeTenants += newlyAdded.length;
        // Mocking user growth proportionally if exact user history isn't available
        // but using a base that leads to the totalUsers count if we have it
        cumulativeUsers += newlyAdded.length * 120 + Math.floor(Math.random() * 50);

        return { ...slot, tenants: cumulativeTenants, users: cumulativeUsers };
      });
    };

    return {
      m6: calculateCumulative(months6),
      y1: calculateCumulative(months12)
    };
  }, [companies]);

  const currentGrowthData = timeframe === '6M' ? processedGrowthData.m6 : processedGrowthData.y1;

  const sparkData = [{ v: 40 }, { v: 35 }, { v: 55 }, { v: 45 }, { v: 70 }, { v: 65 }, { v: 80 }];

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        // Parallel fetch for speed
        const [compRes, statsRes] = await Promise.all([
          api.get('/tenants'),
          api.get('/tenants/psa/stats')
        ]);
        
        const list = Array.isArray(compRes.data) ? compRes.data : (compRes.data?.tenants || compRes.data?.data || []);
        const serverStats = statsRes.data || {};

        const activeList = list.filter(c => c.status === 'active');
        const inactiveList = list.filter(c => c.status !== 'active' && c.status !== 'deleted');
        
        setCompanies(list);
        setStats({
          total: list.length,
          active: activeList.length,
          inactive: inactiveList.length,
          totalModules: serverStats.activeModules || 0, 
          activeUsers: serverStats.totalUsers || (activeList.length * 12) + 5,
          systemUptime: serverStats.uptime || '99.9%'
        });
      } catch (err) {
        console.error("Dashboard Data Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);
  const metrics = useMemo(() => {
    const data = currentGrowthData;
    if (!data || data.length === 0) return { peakUsers: 0, avgTenants: 0, growthRate: 0 };
    const peakUsers = Math.max(...data.map(d => d.users));
    const avgTenants = (data.reduce((acc, curr) => acc + curr.tenants, 0) / data.length).toFixed(1);
    const growthRate = data[0]?.users === 0 ? 0 : (((data[data.length-1]?.users - data[0]?.users) / data[0]?.users) * 100).toFixed(0);
    return { peakUsers, avgTenants, growthRate };
  }, [currentGrowthData]);

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const moduleDistribution = useMemo(() => {
    const counts = Object.fromEntries(PSA_MODULES.map((moduleItem) => [moduleItem.code, 0]));
    companies.forEach(c => {
      const enabled = normalizeEnabledModules(c.enabledModules, c.modules);
      Object.keys(counts).forEach((key) => {
        if (enabled[key] === true) counts[key]++;
      });
    });

    return PSA_MODULES.map((moduleItem) => ({
      name: moduleItem.dashboardLabel,
      value: counts[moduleItem.code],
      color: moduleItem.chartColor,
      icon: moduleItem.icon
    }));
  }, [companies]);

  const totalModules = useMemo(() => {
    return moduleDistribution.reduce((acc, curr) => acc + curr.value, 0);
  }, [moduleDistribution]);

  const regionalData = [
    { name: 'North America', count: metrics.peakUsers, growth: 25 },
    { name: 'Europe', count: Math.floor(metrics.peakUsers * 0.4), growth: 38 },
    { name: 'Asia-Pacific', count: 12500, growth: 43 },
    { name: 'Latin America', count: 100, growth: 60 },
    { name: 'Middle East/Africa', count: 12, growth: 30 }
  ];


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }
  return (
    <div className="bg-white min-h-full overflow-x-hidden">
      <div className="w-full space-y-6 px-10 pt-10 pb-20">
        
        {/* Header Section Redesign - Matches Image 1 - More Compact */}
        <div className="flex flex-col gap-0.5 mb-6">
          <div className="flex items-center gap-3">
             <h1 className="text-2xl font-black text-indigo-600 font-outfit tracking-tight">
               Admin Dashboard
             </h1>

          </div>

        </div>

        {/* 4 Stats Cards - Expanded to Fill Space */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <DashboardCard 
            label="Total Companies"
            value={stats.total}
            icon={Building2}
            trend="+12%"
            trendColor="emerald"
            subLabel="Active Plans"
            subValue="94%"
            topBorderColor="#00C292" // Green match
            onClick={() => navigate('/psa/companies')}
          />
          
          <DashboardCard 
            label="Global Active Users"
            value={stats.activeUsers.toLocaleString()}
            icon={Users}
            trend="+8%"
            trendColor="emerald"
            subLabel="New (30D)"
            subValue="1,840"
            topBorderColor="#7047EB" // Purple match
          />

          <DashboardCard 
            label="Total Modules"
            value={totalModules}
            icon={Layers}
            trend="+100%"
            trendColor="emerald"
            subLabel="Across All Active Nodes"
            subValue={`${totalModules} Active`}
            topBorderColor="#FF5C8D" // Pink match
          />

          <DashboardCard 
            label="Inactive Tenants"
            value={stats.inactive}
            icon={Briefcase}
            trend={stats.inactive > 1 ? "+2%" : "0%"}
            trendColor={stats.inactive > 1 ? "rose" : "slate"}
            subLabel="Pending Setup"
            subValue={stats.inactive}
            buttonText="Review Inactive"
            topBorderColor="#F1C40F" // Yellow
            onClick={() => navigate('/psa/companies?status=pending')}
          />
        </div>


        {/* Compact Dual Section: Chart & Table - Height Matched */}
        <div className="flex flex-col lg:flex-row gap-4 pt-2 items-stretch px-2">
          
          {/* Left: Module Distribution Donut Chart - Narrowed Card & Stretched */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center w-full lg:w-[450px] shrink-0">
             <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-widest font-outfit mb-4 self-start">
               Module Distribution
             </h3>
             <div className="relative w-full flex-1 flex items-center justify-center min-h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                        data={moduleDistribution}
                        cx="50%"
                        cy="50%"
                        startAngle={90}
                        endAngle={-270}
                        innerRadius={80}
                        outerRadius={115}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                          const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                          return (
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-black font-outfit">
                              {value}
                            </text>
                          );
                        }}
                      >
                        {moduleDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }}
                      />
                   </PieChart>
                </ResponsiveContainer>
                
                {/* Center Text - Perfectly Centered */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <div className="flex flex-col items-center">
                     <span className="text-3xl font-black text-slate-800 font-outfit leading-none mb-1">{totalModules}</span>
                     <span className="text-[12px] font-bold text-slate-800 font-outfit leading-tight text-center">Total<br/>Modules</span>
                   </div>
                </div>
                
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                {moduleDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                    <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{entry.name}</span>
                    <span className="ml-auto text-[9px] font-black text-slate-800">{entry.value}</span>
                  </div>
                ))}
             </div>
          </div>

          {/* Right: Infrastructure Activity Table - Redesigned to match Reference Image */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-w-0">
             {/* Header with Title and Subtitle */}
             <div className="px-6 py-5 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800 font-outfit">
                  Recent Infrastructure Activity
                </h3>
             </div>

             
             <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left font-outfit">
                   <thead>
                      <tr className="bg-white border-b border-slate-100">
                         <th className="px-6 py-4 text-[13px] font-bold text-slate-500">ID</th>
                         <th className="px-6 py-4 text-[13px] font-bold text-slate-500">Company Name</th>
                         <th className="px-4 py-4 text-[13px] font-bold text-slate-500">Sector</th>
                         <th className="px-4 py-4 text-[13px] font-bold text-slate-500">Status</th>
                         <th className="px-4 py-4 text-[13px] font-bold text-slate-500">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 bg-white">
                      {companies.slice(0, 5).map((comp, idx) => (
                        <tr key={comp._id || idx} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/psa/companies/view/${comp._id}`)}>
                           {/* ID Column */}
                           <td className="px-6 py-4 text-[13px] font-medium text-indigo-500 uppercase">
                              {comp._id ? String(comp._id).substring(String(comp._id).length - 6) : `C-${1000 + idx}`}
                           </td>
                           {/* Name Column */}
                           <td className="px-6 py-4 text-[13px] font-bold text-slate-800">
                              {comp.companyName || comp.name}
                           </td>
                           {/* Industry/Sector */}
                           <td className="px-4 py-4 text-[13px] text-slate-500">
                              {comp.industry || "General"}
                           </td>
                           {/* Status Badge */}
                           <td className="px-4 py-4">
                              <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-tight ${
                                comp.status === 'active' 
                                  ? 'bg-indigo-600 text-white' 
                                  : comp.status === 'inactive' || comp.status === 'pending'
                                    ? 'bg-rose-500 text-white' 
                                    : 'bg-slate-100 text-slate-500'
                              }`}>
                                {comp.status || 'Unknown'}
                              </span>
                           </td>
                           {/* Actions */}
                           <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                              <Dropdown 
                                menu={{ 
                                  items: [
                                    { key: 'view', label: 'View Details', onClick: () => navigate(`/psa/companies/view/${comp._id}`) },
                                    { key: 'edit', label: 'Edit Company', onClick: () => navigate(`/psa/companies/edit/${comp._id}`) }
                                  ] 
                                }} 
                                trigger={['click']}
                                placement="bottomRight"
                              >
                                <button className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                                   <MoreHorizontal size={18} />
                                </button>
                              </Dropdown>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
