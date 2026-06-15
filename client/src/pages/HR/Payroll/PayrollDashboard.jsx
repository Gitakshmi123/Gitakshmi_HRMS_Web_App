import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { IndianRupee, Users, TrendingUp, Calendar, ArrowRight, Play, FileText, PieChart, BarChart3, LineChart as LineChartIcon, DollarSign, ShieldAlert, Shield, Lock } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Can } from '../../../components/rbac/PermissionGate';
import usePagePermissions from '../../../hooks/usePagePermissions';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function PayrollDashboard() {
    const { canView, loading: permLoading } = usePagePermissions('payroll.stats');
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState(null);

    useEffect(() => {
        loadDashboardData();
    }, []);

    async function loadDashboardData() {
        try {
            setLoading(true);
            const res = await api.get('/payroll/dashboard');
            if (res.data.success) {
                setDashboard(res.data.data);
            }
        } catch (err) {
            console.error("Failed to load dashboard data", err);
        } finally {
            setLoading(false);
        }
    }

    const StatCard = ({ title, value, subtitle, icon, accent }) => (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all duration-500 group flex flex-col justify-between h-full relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 ${accent} opacity-5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity duration-500`} />
            
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform duration-500`}>
                    {icon ? React.createElement(icon, { size: 20, className: `text-slate-600 dark:text-slate-300`, strokeWidth: 2.5 }) : null}
                </div>
            </div>

            <div>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">{title}</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{value}</h3>
                </div>
                {subtitle && <p className="text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-2 leading-relaxed opacity-60">{subtitle}</p>}
            </div>
        </div>
    );

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                    <p className="font-semibold text-slate-900 mb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: ₹{entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (permLoading) return null;

    if (!canView) {
        return <Navigate to="/hr/dashboard" replace />;
    }

    return (
        <div className="p-4 sm:p-6 w-full mx-auto space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Real-time insights and business metrics</div>
                </div>
                <Can module="payroll.process" action="create">
                    <Link to="/hr/payroll/process" className="px-5 py-2.5 sm:px-5 sm:py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 flex items-center gap-2 transition-all duration-300 font-black text-[10px] tracking-widest uppercase">
                        <Play className="h-4 w-4" /> Run Payroll
                    </Link>
                </Can>
            </div>

            {loading ? (
                <div className="p-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-slate-500 mt-4 text-sm">Loading analytics...</p>
                </div>
            ) : dashboard ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard
                            title="Last Payroll Cost"
                            value={`₹${dashboard.summary.lastPayrollCost.toLocaleString()}`}
                            subtitle="Net Pay Disbursed"
                            icon={IndianRupee}
                            accent="bg-emerald-500"
                        />
                        <StatCard
                            title="Employees Paid"
                            value={dashboard.summary.employeesPaid}
                            subtitle="Last processed cycle"
                            icon={Users}
                            accent="bg-blue-500"
                        />
                        <StatCard
                            title="YTD Net Pay"
                            value={`₹${dashboard.summary.ytdCost.toLocaleString()}`}
                            subtitle={`Total for ${new Date().getFullYear()}`}
                            icon={TrendingUp}
                            accent="bg-purple-500"
                        />
                        <StatCard
                            title="YTD Gross Pay"
                            value={`₹${dashboard.summary.ytdGross.toLocaleString()}`}
                            subtitle="Total Earnings"
                            icon={DollarSign}
                            accent="bg-rose-500"
                        />
                        <StatCard
                            title="YTD Deductions"
                            value={`₹${dashboard.summary.ytdDeductions.toLocaleString()}`}
                            subtitle="Total Holdbacks"
                            icon={ShieldAlert}
                            accent="bg-amber-500"
                        />
                    </div>

                    {/* Charts Section */}
                    {dashboard.charts.monthly.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Gross vs Net Bar Chart */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                        <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="font-black text-slate-800 dark:text-white text-[10px] uppercase tracking-widest">Gross vs Net Pay</h3>
                                </div>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={dashboard.charts.monthly}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '11px' }} />
                                        <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="gross" fill="#10b981" name="Gross Pay" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="net" fill="#3b82f6" name="Net Pay" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Payroll Trend Line Chart */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
                                        <LineChartIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="font-black text-slate-800 dark:text-white text-[10px] uppercase tracking-widest">Payroll Trend (Last 6 Months)</h3>
                                </div>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={dashboard.charts.monthly}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '11px' }} />
                                        <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Line type="monotone" dataKey="net" stroke="#8b5cf6" strokeWidth={2} name="Net Pay" dot={{ fill: '#8b5cf6', r: 4 }} />
                                        <Line type="monotone" dataKey="gross" stroke="#10b981" strokeWidth={2} name="Gross Pay" dot={{ fill: '#10b981', r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Earnings vs Deductions Pie Chart */}
                    {dashboard.charts.earningsVsDeductions.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60 p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                                    <PieChart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="font-black text-slate-800 dark:text-white text-[10px] uppercase tracking-widest">Earnings vs Deductions (YTD)</h3>
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                                <RechartsPieChart>
                                    <Pie
                                        data={dashboard.charts.earningsVsDeductions}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {dashboard.charts.earningsVsDeductions.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#000' }} />
                                    <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '8px', color: 'var(--tooltip-text)' }} />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Recent Runs Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-[10px] uppercase tracking-widest">
                                <div className="p-1.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg">
                                    <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                Recent Payroll Runs
                            </h3>
                            <Can module="payroll.run" action="view">
                                <Link to="/hr/payroll/process" className="text-[10px] font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors">
                                    View All <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Can>
                        </div>
                        <div className="flex flex-col p-4">
                            <div className="hidden lg:grid grid-cols-5 items-center px-4 py-2 mb-2">
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Period</div>
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</div>
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</div>
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employees</div>
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Net Pay</div>
                            </div>
                            <div className="space-y-2">
                                {dashboard.recentRuns.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">No payroll runs found yet.</p>
                                    </div>
                                ) : (
                                    dashboard.recentRuns.map(run => (
                                        <div key={run._id} className="bg-white dark:bg-slate-900 lg:grid lg:grid-cols-5 flex flex-col items-center px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all gap-2 lg:gap-0">
                                            <div className="w-full lg:text-left flex lg:flex-row justify-between items-center text-sm font-bold text-slate-800 dark:text-white">
                                                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</span>
                                                {run.period}
                                            </div>
                                            <div className="w-full lg:text-left flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
                                                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                                                {new Date(run.runDate).toLocaleDateString()}
                                            </div>
                                            <div className="w-full lg:text-left flex justify-between items-center">
                                                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                                <span className={`inline-flex px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-md border 
                                                        ${run.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200/50 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' :
                                                        run.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                                            run.status === 'CALCULATED' ? 'bg-purple-50 text-purple-700 border-purple-200/50 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' :
                                                                run.status === 'CALCULATED_WITH_ERRORS' ? 'bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                                                                'bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'}`}>
                                                    {run.status}
                                                </span>
                                            </div>
                                            <div className="w-full lg:text-left flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Employees</span>
                                                {run.employeesPaid}
                                            </div>
                                            <div className="w-full lg:text-right flex justify-between items-center text-sm font-black text-slate-800 dark:text-white">
                                                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Pay</span>
                                                ₹{run.totalNetPay.toLocaleString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/50 p-5">
                        <h3 className="font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                            <div className="p-1.5 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg">
                                <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            Quick Actions
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <Can module="payroll.salary" action="view">
                                <Link to="/hr/payroll/salary-components" className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600/50 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all group bg-slate-50 dark:bg-slate-800/30">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Manage Components</span>
                                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                </Link>
                            </Can>
                            <Can module="payroll.salary" action="create">
                                <Link to="/hr/payroll/salary-templates/new" className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600/50 hover:bg-purple-50/50 dark:hover:bg-purple-500/5 transition-all group bg-slate-50 dark:bg-slate-800/30">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">Design Salary Template</span>
                                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                                </Link>
                            </Can>
                            <Can module="payroll.payslips" action="view">
                                <Link to="/hr/payroll/payslips" className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-all group bg-slate-50 dark:bg-slate-800/30">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Download Payslips</span>
                                    <FileText className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                                </Link>
                            </Can>
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="inline-block mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black tracking-widest uppercase">No data available. Run your first payroll to see analytics.</p>
                </div>
            )}
        </div>
    );
}
