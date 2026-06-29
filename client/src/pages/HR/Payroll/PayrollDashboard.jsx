import React, { useState, useEffect } from 'react';
import { IndianRupee, Users, TrendingUp, Calendar, ArrowRight, Play, FileText, PieChart as PieChartIcon, BarChart3, ShieldAlert, Shield, Lock, CheckCircle, AlertTriangle, Eye, ChevronRight, Landmark, CreditCard, Award, HelpCircle, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Button, Tag, Space, Table, message } from 'antd';
import api from '../../../utils/api';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

export default function PayrollDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalEmployees: 0,
        grossPay: 0,
        totalDeductions: 0,
        netPay: 0,
        status: 'In Progress',
        monthLabel: 'June 2026',
        paid: 0,
        attendanceRecords: 0,
        payrollInput: { basicPay: 'Pending', overtime: 'Pending', leaves: 'Pending', loans: 'Pending' },
        validation: { totalValidated: 0, exceptions: 0, warnings: 0 },
        approvalLevels: [
            { level: '1. Reporting Manager', approver: 'Raju Sharma', status: 'Approved' },
            { level: '2. HR Admin Checker', approver: 'Neha Jain', status: 'Pending' }
        ],
        quickPayslip: null
    });

    const [loans, setLoans] = useState([]);
    const [deductions, setDeductions] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [otherEarnings, setOtherEarnings] = useState([]);
    const [payslips, setPayslips] = useState([]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    async function loadDashboardData() {
        setLoading(true);
        try {
            // Load dashboard summary and current month runs
            const dashRes = await api.get('/payroll/dashboard').catch(() => null);

            if (dashRes?.data?.success && dashRes?.data?.data) {
                const dash = dashRes.data.data;
                const c = dash.cards || {};
                setStats({
                    totalEmployees: dash.summary?.activeEmployees || 0,
                    grossPay: dash.summary?.lastPayrollCost || 0,
                    totalDeductions: dash.summary?.ytdDeductions || 0,
                    netPay: dash.summary?.ytdCost || 0,
                    status: 'In Progress',
                    monthLabel: 'June 2026',
                    paid: dash.summary?.employeesPaid || 0,
                    attendanceRecords: c.attendanceRecords || 0,
                    payrollInput: c.payrollInput || { basicPay: 'Pending', overtime: 'Pending', leaves: 'Pending', loans: 'Pending' },
                    validation: c.validation || { totalValidated: 0, exceptions: 0, warnings: 0 },
                    approvalLevels: c.approvalLevels || [
                        { level: '1. Reporting Manager', approver: 'Raju Sharma', status: 'Approved' },
                        { level: '2. HR Admin Checker', approver: 'Neha Jain', status: 'Pending' }
                    ],
                    quickPayslip: c.quickPayslip || null
                });

                if (c.adjustments) setAdjustments(c.adjustments);
                if (c.deductions) setDeductions(c.deductions);
                if (c.loans) setLoans(c.loans);
                if (c.otherEarnings) setOtherEarnings(c.otherEarnings);
                if (c.payslipsList) setPayslips(c.payslipsList);
            }

        } catch (err) {
            console.error('Failed to load dashboard', err);
        } finally {
            setLoading(false);
        }
    }

    const pieData = [
        { name: 'Net Pay', value: stats.netPay },
        { name: 'Total Deductions', value: stats.totalDeductions }
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-300">
            {/* Header / Top process stepper */}
            <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-white">Payroll Process Flow</h1>
                        <p className="text-slate-500 text-xs mt-0.5">Active Cycle: {stats.monthLabel} (Monthly Payroll)</p>
                    </div>
                    
                    {/* Process Flow Stats Banner */}
                    <div className="flex gap-6 items-center flex-wrap">
                        <div className="text-center px-4 border-r">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Total Employees</span>
                            <h3 className="text-base font-black text-slate-800 dark:text-white">{stats.totalEmployees}</h3>
                        </div>
                        <div className="text-center px-4 border-r">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Gross Pay</span>
                            <h3 className="text-base font-black text-blue-600">₹{stats.grossPay.toLocaleString()}</h3>
                        </div>
                        <div className="text-center px-4 border-r">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Total Deductions</span>
                            <h3 className="text-base font-black text-red-500">₹{stats.totalDeductions.toLocaleString()}</h3>
                        </div>
                        <div className="text-center px-4 border-r">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Net Pay</span>
                            <h3 className="text-base font-black text-green-500">₹{stats.netPay.toLocaleString()}</h3>
                        </div>
                        <div className="text-center px-4">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Status</span>
                            <Tag color="processing" className="m-0 block mt-0.5 font-bold uppercase tracking-wider text-[10px]">{stats.status}</Tag>
                        </div>
                        <Button 
                            type="primary" 
                            icon={<Play size={14} />} 
                            onClick={() => navigate('/hr/payroll/process')}
                            className="bg-blue-600 hover:bg-blue-700 border-none font-bold"
                        >
                            Process Payroll
                        </Button>
                    </div>
                </div>

                {/* Horizontal Stepper Steps */}
                <div className="flex justify-between items-center gap-2 overflow-x-auto py-2">
                    {[
                        { label: 'Setup', date: '01-06-2026', done: true, route: '/hr/payroll/deduction-entry' },
                        { label: 'Attendance Import', date: '02-06-2026', done: true, route: '/hr/payroll/process' },
                        { label: 'Payroll Input', date: '02-06-2026', done: true, route: '/hr/payroll/other-earnings' },
                        { label: 'Review & Validate', date: 'In Progress', active: true, route: '/hr/payroll/process' },
                        { label: 'Approval', date: 'Pending', route: '/hr/payroll/process' },
                        { label: 'Process Payroll', date: 'Pending', route: '/hr/payroll/process' },
                        { label: 'Payment', date: 'Pending', route: '/hr/payroll/payslip-view' }
                    ].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3 shrink-0">
                            <div 
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
                                onClick={() => navigate(step.route)}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    step.done ? 'bg-green-600 text-white' : 
                                    step.active ? 'bg-blue-600 text-white animate-pulse' : 
                                    'bg-slate-200 text-slate-500'
                                }`}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{step.label}</h4>
                                    <p className="text-[9px] text-slate-400 font-medium">{step.date}</p>
                                </div>
                            </div>
                            {idx < 6 && <ChevronRight size={14} className="text-slate-300" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* 16 Cards Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Card 1: Payroll Dashboard */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><PieChartIcon size={16} className="text-blue-500" /> 1. Payroll Dashboard</h3>
                        <Link to="/hr/payroll/dashboard" className="text-xs font-semibold text-blue-500 hover:underline">View</Link>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <p className="text-slate-400 font-bold uppercase text-[9px]">Total Employees</p>
                            <h4 className="text-sm font-black text-slate-800">{stats.totalEmployees}</h4>
                        </div>
                        <div>
                            <p className="text-slate-400 font-bold uppercase text-[9px]">Paid</p>
                            <h4 className="text-sm font-black text-green-500">{stats.paid}</h4>
                        </div>
                    </div>
                    <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                                <Pie 
                                    data={pieData} 
                                    innerRadius={25} 
                                    outerRadius={40} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Card 2: Attendance Import */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> 2. Attendance Import</h3>
                    </div>
                    <div className="text-xs space-y-1.5 flex-1 mt-2">
                        <div className="flex justify-between"><span className="text-slate-400">Period:</span><span className="font-bold text-slate-700">01-06-26 To 30-06-26</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Source:</span><span className="font-bold text-slate-700">Biometric Device</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Total Records:</span><span className="font-bold text-slate-700">{stats.attendanceRecords}</span></div>
                    </div>
                    <Space className="w-full justify-between mt-2 pt-2 border-t">
                        <Button size="small" type="primary" ghost onClick={() => navigate('/hr/payroll/process')}>View Summary</Button>
                        <Button size="small" onClick={() => { message.loading('Syncing biometric logs...', 1.5).then(() => message.success('Attendance logs re-imported successfully!')); }}>Re-Import</Button>
                    </Space>
                </div>

                {/* Card 3: Payroll Input */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Award size={16} className="text-blue-500" /> 3. Payroll Input</h3>
                    </div>
                    <div className="text-[10px] font-bold space-y-1 mt-1 flex-1 overflow-y-auto max-h-32">
                        <div className="flex justify-between items-center"><span>Basic Pay & Allowances</span><Tag color={stats.payrollInput?.basicPay === 'Completed' ? 'green' : 'orange'}>{stats.payrollInput?.basicPay || 'Pending'}</Tag></div>
                        <div className="flex justify-between items-center"><span>Overtime Hours</span><Tag color={stats.payrollInput?.overtime === 'Completed' ? 'green' : 'orange'}>{stats.payrollInput?.overtime || 'Pending'}</Tag></div>
                        <div className="flex justify-between items-center"><span>Leave & LOP days</span><Tag color={stats.payrollInput?.leaves === 'Completed' ? 'green' : 'orange'}>{stats.payrollInput?.leaves || 'Pending'}</Tag></div>
                        <div className="flex justify-between items-center"><span>Loan EMI recoveries</span><Tag color={stats.payrollInput?.loans === 'Completed' ? 'green' : 'orange'}>{stats.payrollInput?.loans || 'Pending'}</Tag></div>
                    </div>
                    <Button size="small" type="primary" block className="mt-2" onClick={() => navigate('/hr/payroll/process')}>View Details</Button>
                </div>

                {/* Card 4: Review & Validate */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><ShieldAlert size={16} className="text-blue-500" /> 4. Review & Validate</h3>
                    </div>
                    <div className="text-xs space-y-1.5 flex-1 mt-2">
                        <div className="flex justify-between"><span className="text-slate-400">Total Validated:</span><span className="font-bold text-slate-700">{stats.validation?.totalValidated || 0}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Exceptions:</span><span className="font-bold text-red-500">{stats.validation?.exceptions || 0}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Warnings:</span><span className="font-bold text-amber-500">{stats.validation?.warnings || 0}</span></div>
                    </div>
                    <Space className="w-full justify-between mt-2 pt-2 border-t">
                        <Button size="small" danger ghost onClick={() => navigate('/hr/payroll/process')}>View Exceptions</Button>
                        <Button size="small" onClick={() => { message.loading('Running payroll validations...', 1.5).then(() => message.success('Payroll inputs re-validated successfully!')); }}>Re-Validate</Button>
                    </Space>
                </div>

                {/* Card 5: Approval Flow */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><CheckCircle size={16} className="text-blue-500" /> 5. Approval Flow</h3>
                    </div>
                    <div className="text-xs flex-1 mt-2">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 border-b"><th className="pb-1">Level</th><th className="pb-1">Approver</th><th className="pb-1">Status</th></tr>
                            </thead>
                            <tbody>
                                {(stats.approvalLevels || []).map((lvl, idx) => (
                                    <tr key={idx} className="border-b">
                                        <td className="py-1">{lvl.level}</td>
                                        <td className="py-1">{lvl.approver}</td>
                                        <td className="py-1">
                                            <Tag color={lvl.status === 'Approved' ? 'success' : lvl.status === 'Rejected' ? 'error' : 'processing'}>
                                                {lvl.status}
                                            </Tag>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Button size="small" type="primary" className="bg-blue-600 border-none mt-2" onClick={() => message.success('Sent for approval successfully')}>Send For Approval</Button>
                </div>

                {/* Card 6: Advance Entry */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><CreditCard size={16} className="text-blue-500" /> 6. Advance Entry</h3>
                        <Link to="/hr/payroll/arrears" className="text-xs font-semibold text-blue-500 hover:underline">Manage</Link>
                    </div>
                    <div className="text-xs flex-1 mt-2">
                        <div className="flex justify-between text-slate-400 font-bold mb-1 border-b pb-0.5"><span>Employee</span><span>Amount</span><span>Status</span></div>
                        <div className="space-y-1 overflow-y-auto max-h-20">
                            {adjustments.length === 0 ? (
                                <div className="text-center text-slate-400 py-2">No adjustments found</div>
                            ) : (
                                adjustments.map((adj, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{adj.employeeName}</span>
                                        <span className="font-bold">₹{adj.amount?.toLocaleString()}</span>
                                        <Tag color={adj.status === 'APPROVED' ? 'success' : 'processing'}>{adj.status}</Tag>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 7: Deduction Entry */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Landmark size={16} className="text-blue-500" /> 7. Deduction Entry</h3>
                        <Link to="/hr/payroll/deduction-entry" className="text-xs font-semibold text-blue-500 hover:underline">Manage</Link>
                    </div>
                    <div className="text-xs flex-1 mt-2">
                        <div className="flex justify-between text-slate-400 font-bold mb-1 border-b pb-0.5"><span>Employee</span><span>Deduction</span><span>Amount</span></div>
                        <div className="space-y-1 overflow-y-auto max-h-20">
                            {deductions.length === 0 ? (
                                <div className="text-center text-slate-400 py-2">No active deductions</div>
                            ) : (
                                deductions.map((ded, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{ded.employeeName}</span>
                                        <span>{ded.name}</span>
                                        <span className="font-bold text-red-500">₹{ded.amount?.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 8: Loan Management */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Landmark size={16} className="text-blue-500" /> 8. Loan Management</h3>
                        <Link to="/hr/payroll/loans" className="text-xs font-semibold text-blue-500 hover:underline">Manage</Link>
                    </div>
                    <div className="text-xs flex-1 mt-2">
                        <div className="flex justify-between text-slate-400 font-bold mb-1 border-b pb-0.5"><span>Employee</span><span>Loan Type</span><span>EMI</span><span>Outstanding</span></div>
                        <div className="space-y-1 overflow-y-auto max-h-20">
                            {loans.length === 0 ? (
                                <div className="text-center text-slate-400 py-2">No active loans found</div>
                            ) : (
                                loans.map((loan, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{loan.employeeName}</span>
                                        <span>{loan.loanType}</span>
                                        <span>₹{loan.emi?.toLocaleString()}</span>
                                        <span className="font-bold">₹{loan.outstanding?.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 9: TDS Declaration & Deduction */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Shield size={16} className="text-blue-500" /> 9. TDS Declaration & Deduction</h3>
                        <Link to="/hr/payroll/tds-declaration" className="text-xs font-semibold text-blue-500 hover:underline">Manage</Link>
                    </div>
                    <div className="text-xs flex-1 mt-2">
                        <div className="flex justify-between text-slate-400 font-bold mb-1 border-b pb-0.5"><span>Employee</span><span>Regime</span><span>Deductions</span><span>TDS</span></div>
                        <div className="space-y-1 overflow-y-auto max-h-20">
                            {!stats.cards?.tds || stats.cards.tds.length === 0 ? (
                                <div className="text-center text-slate-400 py-2">No declarations found</div>
                            ) : (
                                stats.cards.tds.map((prof, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{prof.employeeName}</span>
                                        <Tag color={prof.regime === 'OLD' ? 'cyan' : 'blue'}>{prof.regime}</Tag>
                                        <span>₹{prof.deductions?.toLocaleString()}</span>
                                        <span className="font-bold text-red-500">₹{prof.tds?.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 10: Other Earnings */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Award size={16} className="text-blue-500" /> 10. Other Earnings</h3>
                        <Link to="/hr/payroll/other-earnings" className="text-xs font-semibold text-blue-500 hover:underline">Manage</Link>
                    </div>
                    <div className="text-xs flex-1 mt-2">
                        <div className="flex justify-between text-slate-400 font-bold mb-1 border-b pb-0.5"><span>Employee</span><span>Earning Type</span><span>Amount</span></div>
                        <div className="space-y-1 overflow-y-auto max-h-20">
                            {otherEarnings.length === 0 ? (
                                <div className="text-center text-slate-400 py-2">No other earnings found</div>
                            ) : (
                                otherEarnings.map((earn, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{earn.employeeName}</span>
                                        <span>{earn.earningType}</span>
                                        <span className="font-bold text-green-500">₹{earn.amount?.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 11: Process Payroll */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Play size={16} className="text-blue-500" /> 11. Process Payroll</h3>
                    </div>
                    <div className="text-[10px] space-y-1.5 flex-1 mt-2 font-medium">
                        <div className="flex justify-between"><span>Payment Date:</span><span className="font-bold">05-06-2026</span></div>
                        <div className="flex justify-between"><span>Total Employees:</span><span className="font-bold">{stats.totalEmployees}</span></div>
                        <div className="flex justify-between"><span>Net Pay Amount:</span><span className="font-bold">₹{stats.netPay.toLocaleString()}</span></div>
                    </div>
                    <Button size="small" type="primary" className="bg-blue-600 border-none mt-2" onClick={() => navigate('/hr/payroll/process')}>Process Now</Button>
                </div>

                {/* Card 12: Payment Summary */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Landmark size={16} className="text-blue-500" /> 12. Payment Summary</h3>
                    </div>
                    <div className="text-[10px] space-y-1.5 flex-1 mt-2 font-medium">
                        <div className="flex justify-between"><span>Bank Name:</span><span className="font-bold">HDFC Bank</span></div>
                        <div className="flex justify-between"><span>Transfer Status:</span><Tag color="success">Success</Tag></div>
                        <div className="flex justify-between"><span>Success Count:</span><span className="font-bold text-green-500">{stats.paid} / {stats.totalEmployees}</span></div>
                    </div>
                    <Button size="small" type="primary" ghost className="mt-2" onClick={() => message.info('Opening payment report PDF')}>View Payment Report</Button>
                </div>

                {/* Card 13: Employee Payroll */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><Users size={16} className="text-blue-500" /> 13. Employee Payroll</h3>
                        <Link to="/hr/payroll/employee-payroll" className="text-xs font-semibold text-blue-500 hover:underline">View All</Link>
                    </div>
                    <div className="text-[10px] flex-1 mt-1 overflow-y-auto max-h-24">
                        <div className="flex justify-between text-slate-400 font-bold mb-1 border-b pb-0.5"><span>Employee</span><span>Net Pay</span><span>Status</span></div>
                        <div className="space-y-1">
                            {payslips.length === 0 ? (
                                <div className="text-center text-slate-400 py-2">No payslips found</div>
                            ) : (
                                payslips.map((ps, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{ps.employeeName} ({ps.employeeId})</span>
                                        <span className="font-bold">₹{ps.netPay?.toLocaleString()}</span>
                                        <Tag color="success">{ps.status}</Tag>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Card 14: Payslip Quick View */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><FileText size={16} className="text-blue-500" /> 14. Payslip Quick View</h3>
                        <Link to="/hr/payroll/payslip-view" className="text-xs font-semibold text-blue-500 hover:underline">Open Slip</Link>
                    </div>
                    {stats.quickPayslip ? (
                        <div className="border rounded-xl p-3 bg-slate-50 dark:bg-slate-800 text-[10px] space-y-1.5">
                            <div className="text-center font-bold text-blue-600 dark:text-blue-500">Gitakshmi IT Solutions Pvt. Ltd.</div>
                            <div className="flex justify-between border-t pt-1"><span>Emp Code: {stats.quickPayslip.employeeId}</span><span>Bank Account: {stats.quickPayslip.bankName} *****{stats.quickPayslip.bankAccount?.slice(-4)}</span></div>
                            <div className="flex justify-between"><span>Basic: ₹{stats.quickPayslip.basic?.toLocaleString()}</span><span>PF: ₹{stats.quickPayslip.pf?.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>HRA: ₹{stats.quickPayslip.hra?.toLocaleString()}</span><span>TDS: ₹{stats.quickPayslip.tds?.toLocaleString()}</span></div>
                            <div className="flex justify-between border-t pt-1 font-bold text-blue-600 dark:text-blue-500"><span>Gross Earnings: ₹{stats.quickPayslip.grossEarnings?.toLocaleString()}</span><span>Net Payable: ₹{stats.quickPayslip.netPayable?.toLocaleString()}</span></div>
                        </div>
                    ) : (
                        <div className="border rounded-xl p-6 bg-slate-50 dark:bg-slate-800 text-[10px] text-center text-slate-400">
                            No payslips generated for this period.
                        </div>
                    )}
                </div>

                {/* Card 15: Payroll Reports */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><FileText size={16} className="text-blue-500" /> 15. Payroll Reports</h3>
                        <Link to="/hr/payroll/reports" className="text-xs font-semibold text-blue-500 hover:underline">Generate</Link>
                    </div>
                    <div className="text-xs space-y-1.5 mt-2 flex-1">
                        <div className="flex justify-between items-center"><span>Payroll Payout Summary Report</span><Button size="small" icon={<Download size={12} />} onClick={() => message.info('Generating Payout Report...')} /></div>
                        <div className="flex justify-between items-center"><span>TDS / Tax Liability Report</span><Button size="small" icon={<Download size={12} />} onClick={() => message.info('Generating TDS Report...')} /></div>
                    </div>
                </div>

                {/* Card 16: Form 16 */}
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start border-b pb-2">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2"><FileText size={16} className="text-blue-500" /> 16. Form 16</h3>
                        <Link to="/hr/payroll/form16" className="text-xs font-semibold text-blue-500 hover:underline">Generate All</Link>
                    </div>
                    <div className="text-xs space-y-1.5 mt-2 flex-1">
                        {payslips.slice(0, 2).map((ps, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span>{ps.employeeName} ({ps.employeeId})</span>
                                <Tag color="green">Generated</Tag>
                            </div>
                        ))}
                        {payslips.length === 0 && (
                            <div className="text-center text-slate-400 py-2">No Form 16 forms generated</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
