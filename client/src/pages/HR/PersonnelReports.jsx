import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import {
    Users, UserMinus, UserPlus, TrendingUp,
    AlertCircle, Filter, Building2, Briefcase,
    BarChart, Clock, CheckCircle2, Search,
    Download, Mail, Eye, Calendar,
    ExternalLink, Star as StarIcon,
    ArrowRight, Trophy, Target, Fingerprint,
    Inbox, Layers, Building, Network,
    UserCircle, Moon, Bell, LogOut, ChevronDown,
    Send, ShieldCheck, Lock
} from 'lucide-react';
import usePagePermissions from '../../hooks/usePagePermissions';
import api from '../../utils/api';
import {
    BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import './PersonnelReports.css';

const PersonnelReports = () => {
    const location = useLocation();
    const activeTab = useMemo(() => {
        if (location.pathname.includes('/replacements')) return 'replacement';
        if (location.pathname.includes('/trends')) return 'analytics';
        if (location.pathname.includes('/performance')) return 'performance';
        return 'existing';
    }, [location.pathname]);

    // RBAC Mapping
    const permKey = useMemo(() => {
        switch(activeTab) {
            case 'replacement': return 'reports.movements';
            case 'analytics':   return 'reports.trends';
            case 'performance': return 'reports.performance';
            default:            return 'reports.staffing';
        }
    }, [activeTab]);

    const { canView, canCreate, canEdit, canDelete, loading: permLoading } = usePagePermissions(permKey);

    const [staffFilter, setStaffFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('All Departments');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        existing: [],
        replacements: [],
        analytics: null,
        sla: [],
        performance: [],
        individualStaff: []
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'existing') {
                const res = await api.get('/reports/existing-employees');
                setData(prev => ({ ...prev, existing: Array.isArray(res.data?.data) ? res.data.data : [] }));
            } else if (activeTab === 'replacement') {
                const res = await api.get('/reports/replacements');
                setData(prev => ({ ...prev, replacements: Array.isArray(res.data?.data) ? res.data.data : [] }));
            } else if (activeTab === 'analytics') {
                const res = await api.get('/reports/analytics');
                setData(prev => ({ ...prev, analytics: res.data?.data || null }));
            } else if (activeTab === 'sla') {
                const res = await api.get('/reports/sla');
                setData(prev => ({ ...prev, sla: Array.isArray(res.data?.data) ? res.data.data : [] }));
            }

            // Always enrichment with real employees for staffing/performance
            const empRes = await api.get('/hr/employees').catch(err => {
                console.warn('PersonnelReports: Optional employee directory fetch restricted (RBAC).');
                return { data: { data: [] } };
            });
            const employees = empRes.data?.data || empRes.data || [];
            
            const mappedStaff = employees.map(e => ({
                id: e.employeeId || e._id,
                _id: e._id,
                name: `${e.firstName} ${e.lastName}`,
                role: e.designation || 'Staff',
                dept: e.department || 'General',
                status: e.isPunchedIn ? (Math.random() > 0.8 ? "Late" : "On-Time") : "Absent",
                login: e.isPunchedIn ? "09:05" : "—",
                logout: e.isPunchedIn ? "18:00" : "—"
            }));

            const mappedPerf = employees.map(e => ({
                id: e.employeeId || e._id,
                _id: e._id,
                name: `${e.firstName} ${e.lastName}`,
                dept: e.department || 'General',
                rating: (3.5 + Math.random() * 1.5).toFixed(1),
                attendance: Math.floor(80 + Math.random() * 20),
                progress: Math.floor(60 + Math.random() * 40)
            }));

            setData(prev => ({ 
                ...prev, 
                individualStaff: mappedStaff,
                performance: mappedPerf
            }));
        } catch (err) {
            console.error("Failed to fetch report data", err);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const calculateTimeline = (loginStr, logoutStr) => {
        const dayStartMin = 9 * 60; // 09:00
        const dayEndMin = 18 * 60;  // 18:00
        const totalMins = dayEndMin - dayStartMin;

        const timeToMins = (tStr) => {
            const [h, m] = tStr.split(':').map(Number);
            return (h * 60) + m;
        };

        let inMin = timeToMins(loginStr);
        let outMin = timeToMins(logoutStr);

        if (inMin < dayStartMin) inMin = dayStartMin;
        if (outMin > dayEndMin) outMin = dayEndMin;
        if (outMin < inMin) outMin = inMin;

        const leftPct = ((inMin - dayStartMin) / totalMins) * 100;
        const widthPct = ((outMin - inMin) / totalMins) * 100;

        return { left: Math.max(0, leftPct), width: Math.max(0, Math.min(widthPct, 100)) };
    };

    const getStatusClass = (status) => {
        if (status === "On-Time") return "shift-on-time";
        if (status === "Late") return "shift-late";
        if (status === "Early Exit") return "shift-early";
        return "";
    };

    const renderStaffingOverview = () => {
        const filteredStaff = data.individualStaff.filter(emp => {
            if (deptFilter !== 'All Departments' && emp.dept !== deptFilter) return false;
            if (staffFilter === 'all') return true;
            if (staffFilter === 'late') return emp.status === "Late";
            if (staffFilter === 'ontime') return emp.status === "On-Time";
            if (staffFilter === 'workhours') return true; 
            return true;
        });

        return (
            <div className="animate-in">
                <div className="smart-stats-grid">
                    <div 
                        className={`smart-stat-card ${staffFilter === 'all' ? 'active-filter' : ''}`}
                        onClick={() => setStaffFilter('all')}
                    >
                        <div className="smart-stat-icon" style={{ backgroundColor: '#f0f9ff', color: '#0ea5e9' }}>
                            <Users size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>Total Headcount</h3>
                            <div className="value">{(data.existing || []).reduce((acc, curr) => acc + (curr.active || 0), 0)}</div>
                        </div>
                    </div>
                    <div 
                        className={`smart-stat-card ${staffFilter === 'late' ? 'active-filter' : ''}`}
                        onClick={() => setStaffFilter('late')}
                    >
                        <div className="smart-stat-icon" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                            <Clock size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>Late Arrivals</h3>
                            <div className="value danger">
                                {data.individualStaff.filter(e => e.status === "Late").length}
                            </div>
                        </div>
                    </div>
                    <div 
                        className={`smart-stat-card ${staffFilter === 'ontime' ? 'active-filter' : ''}`}
                        onClick={() => setStaffFilter('ontime')}
                    >
                        <div className="smart-stat-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                            <Briefcase size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>On-Duty Currently</h3>
                            <div className="value">
                                {(data.existing || []).reduce((acc, curr) => acc + (curr.active || 0), 0)}
                            </div>
                        </div>
                    </div>
                     <div 
                        className={`smart-stat-card ${staffFilter === 'workhours' ? 'active-filter' : ''}`}
                        onClick={() => setStaffFilter('workhours')}
                    >
                        <div className="smart-stat-icon" style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
                            <Clock size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>Avg Work Hours</h3>
                            <div className="value" style={{ fontSize: '16px' }}>8h 15m</div>
                        </div>
                    </div>
                </div>

                <div className="dashboard-toolbar">
                    <div className="toolbar-left">
                        <select 
                            className="dept-select" 
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                        >
                            <option>All Departments</option>
                            {(data.existing || []).map((d, i) => <option key={i}>{d.department}</option>)}
                        </select>
                        <span style={{ fontSize: '12px', color: '#636e72', fontWeight: 600 }}>
                            Showing {filteredStaff.length} Staff
                        </span>
                    </div>
                    <div className="toolbar-right">
                        {canEdit && (
                            <button className="btn-reminder">
                                <Mail size={14} /> Send Reminder to Late Comers
                            </button>
                        )}
                    </div>
                </div>

                <div className="smart-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}><input type="checkbox" /></th>
                                <th>Employee Profile</th>
                                <th>Department</th>
                                <th>Shift Status</th>
                                <th>Visual Timeline (9 AM - 6 PM)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStaff.map((emp, idx) => {
                                const timeline = calculateTimeline(emp.login, emp.logout);
                                const barColor = emp.status === "Late" ? "#ff7675" : (emp.status === "Early Exit" ? "#f39c12" : "#00b894");
                                return (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'center' }}><input type="checkbox" /></td>
                                        <td>
                                            <div className="staff-profile-pill">
                                                <div className="staff-avatar">{getInitials(emp.name)}</div>
                                                <div>
                                                    <div className="staff-name">{emp.name}</div>
                                                    <div className="staff-role">{emp.role}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span style={{ fontWeight: 700, color: '#636e72', fontSize: '11px' }}>{emp.dept}</span></td>
                                        <td>
                                            <div className={`shift-status ${getStatusClass(emp.status)}`}>
                                                <div className="status-dot"></div>
                                                {emp.status}
                                            </div>
                                        </td>
                                        <td className="timeline-cell">
                                            <div className="timeline-header">
                                                <span>09:00</span>
                                                <span>18:00</span>
                                            </div>
                                            <div className="timeline-container">
                                                <div className="timeline-fill" style={{ left: `${timeline.left}%`, width: `${timeline.width}%`, backgroundColor: barColor }}></div>
                                            </div>
                                            <div className="timeline-time-info">{emp.login} → {emp.logout}</div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderReplacementMovements = () => (
        <div className="animate-in">
            <div className="dashboard-toolbar">
                <div className="toolbar-left">
                    <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#2d3436', margin: 0 }}>
                        REPLACEMENT MOVEMENTS <span className="badge-live-blink">LIVE</span>
                    </h3>
                    <p style={{ fontSize: '10px', color: '#a4b0be', margin: '2px 0 0 0', fontWeight: 600 }}>
                        ACTIVE AND SCHEDULED SUBSTITUTIONS
                    </p>
                </div>
                <div className="toolbar-right">
                    <select className="dept-select">
                        <option>All Statuses</option>
                        <option>Active</option>
                        <option>Pending</option>
                        <option>Completed</option>
                    </select>
                </div>
            </div>

            <div className="smart-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Original Staff</th>
                            <th>Replaced By</th>
                            <th>Movement Path</th>
                            <th>Shift Period</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data.replacements || []).map((row, idx) => (
                            <tr key={idx} className={row.replacementStatus === 'hiring' ? 'row-alert-orange' : ''}>
                                <td>
                                    <div className="staff-profile-pill">
                                        <div className="staff-avatar" style={{ backgroundColor: '#f1f2f6', color: '#636e72' }}>{getInitials(row.oldEmployeeName)}</div>
                                        <div>
                                            <div className="staff-name">{row.oldEmployeeName}</div>
                                            <div className="staff-role">Former Holder</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className="staff-profile-pill">
                                        <div className="staff-avatar" style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>RH</div>
                                        <div>
                                            <div className="staff-name">Pending Hire</div>
                                            <div className="staff-role">Replacement</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#2d3436' }}>
                                        Main Branch <ArrowRight size={10} style={{ display: 'inline', margin: '0 5px', color: '#a4b0be' }} /> City Center
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600, color: '#636e72', fontSize: '11px' }}>
                                        <Calendar size={10} style={{ display: 'inline', marginRight: '4px', color: '#b2bec3' }} /> 26 Feb, 09:00 - 18:00
                                    </div>
                                </td>
                                <td style={{ fontSize: '11px', fontWeight: 600, color: '#2d3436' }}>Resignation</td>
                                <td>
                                    <span className={`status-badge ${row.replacementStatus === 'hiring' ? 'active' : (row.replacementStatus === 'open' ? 'pending' : 'completed')}`}>
                                        {row.replacementStatus === 'hiring' ? 'Active' : (row.replacementStatus === 'open' ? 'Pending' : 'Completed')}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-view-details" onClick={() => showMovementDetails(row)} style={{ border: 'none', background: '#f1f2f6', color: '#636e72', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Eye size={14} />
                                        </button>
                                        {(canEdit || canDelete) && row.replacementStatus === 'hiring' && (
                                            <button style={{ backgroundColor: '#ff7675', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                                End
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderHiringTrends = () => {
        if (!data.analytics) return null;
        const chartData = (data.analytics?.hiringTrend || []).map(item => ({
            name: `${item._id?.month || '?'}/${item._id?.year || '?'}`,
            hires: item.hires || 0,
            exits: Math.floor((item.hires || 0) * 0.3) // Mock exits for full fidelity
        }));

        const pieData = [
            { name: 'IT', value: 40, color: '#3498db' },
            { name: 'HR', value: 10, color: '#9b59b6' },
            { name: 'Sales', value: 20, color: '#f1c40f' },
            { name: 'Product', value: 20, color: '#e67e22' },
            { name: 'Design', value: 10, color: '#1abc9c' }
        ];

        return (
            <div className="animate-in">
                <div className="smart-stats-grid">
                    <div className="smart-stat-card">
                        <div className="smart-stat-icon" style={{ backgroundColor: '#fff4e6', color: '#f39c12' }}>
                            <Briefcase size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>Open Positions</h3>
                            <div className="value">14</div>
                        </div>
                    </div>
                    <div className="smart-stat-card">
                        <div className="smart-stat-icon" style={{ backgroundColor: '#e8f9f5', color: '#00b894' }}>
                            <UserPlus size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>Joinings This Month</h3>
                            <div className="value">28</div>
                        </div>
                    </div>
                    <div className="smart-stat-card">
                        <div className="smart-stat-icon" style={{ backgroundColor: '#f0f3ff', color: '#3498db' }}>
                            <CheckCircle2 size={20} />
                        </div>
                        <div className="smart-stat-info">
                            <h3>Success Rate</h3>
                            <div className="value">86%</div>
                        </div>
                    </div>
                </div>

                <div className="charts-grid">
                    <div className="chart-card">
                        <h4>Hiring vs Attrition Trend</h4>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsBarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f6" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a4b0be', fontSize: 11, fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a4b0be', fontSize: 11, fontWeight: 600 }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="hires" name="Joinings" fill="#00b894" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Bar dataKey="exits" name="Exits" fill="#ff7675" radius={[4, 4, 0, 0]} barSize={30} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="chart-card">
                        <h4>Dept-wise Hiring</h4>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="dashboard-toolbar">
                    <div className="toolbar-left">
                        <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#2d3436' }}>ACTIVE PIPELINE</h3>
                        <p style={{ fontSize: '10px', color: '#a4b0be', marginTop: '2px' }}>PROCESS TRACKING</p>
                    </div>
                </div>

                <div className="smart-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>Candidate Name</th>
                                <th>Current Stage</th>
                                <th>Recruiter Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.pipeline || []).map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 700, fontSize: '13px' }}>{item.pos}</td>
                                    <td style={{ fontSize: '13px' }}>{item.name}</td>
                                    <td>
                                        <span className={`status-badge ${item.stage === 'Offered' ? 'active' : (item.stage === 'Final Interview' ? 'warning' : 'pending')}`}>
                                            {item.stage}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '12px', fontWeight: 600, color: '#636e72' }}>{item.recruiter}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderPerformanceReport = () => (
        <div className="animate-in">
            <div className="smart-stats-grid">
                <div className="smart-stat-card">
                    <div className="smart-stat-icon" style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}>
                        <StarIcon size={20} />
                    </div>
                    <div className="smart-stat-info">
                        <h3>Company Avg Rating</h3>
                        <div className="value">4.2 <span style={{ fontSize: '12px', color: '#64748b' }}>/ 5</span></div>
                    </div>
                </div>
                <div className="smart-stat-card">
                    <div className="smart-stat-icon" style={{ backgroundColor: '#e8f9f5', color: '#00b894' }}>
                        <Trophy size={20} />
                    </div>
                    <div className="smart-stat-info">
                        <h3>Top Performer</h3>
                        <div className="value" style={{ fontSize: '18px' }}>Neha Gupta</div>
                    </div>
                </div>
                <div className="smart-stat-card">
                    <div className="smart-stat-icon" style={{ backgroundColor: '#eff3ff', color: '#3498db' }}>
                        <Target size={20} />
                    </div>
                    <div className="smart-stat-info">
                        <h3>Goals Completed</h3>
                        <div className="value">78%</div>
                    </div>
                </div>
                <div className="smart-stat-card">
                    <div className="smart-stat-icon" style={{ backgroundColor: '#ffefef', color: '#ff7675' }}>
                        <AlertCircle size={20} />
                    </div>
                    <div className="smart-stat-info">
                        <h3>Pending Reviews</h3>
                        <div className="value danger">12</div>
                    </div>
                </div>
            </div>

            <div className="dashboard-toolbar" style={{ padding: '4px 10px', minHeight: 'auto' }}>
                <div className="toolbar-left">
                    <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#2d3436' }}>EMPLOYEE PERFORMANCE REPORT</h3>
                    <p style={{ fontSize: '8px', color: '#a4b0be', marginTop: '1px' }}>PERFORMANCE ANALYTICS</p>
                </div>
                <div className="toolbar-right">
                    <select 
                        className="dept-select" 
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                    >
                        <option>All Departments</option>
                        {(data.existing || []).map((d, i) => <option key={i}>{d.department}</option>)}
                    </select>
                    {(canCreate || canEdit) && (
                        <button className="btn-reminder" style={{ background: '#f1f2f6', color: '#2d3436', border: '1px solid #dfe4ea', padding: '4px 10px', fontSize: '10px' }}>
                            <Download size={12} /> Export
                        </button>
                    )}
                </div>
            </div>

            <div className="smart-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Department</th>
                            <th>Overall Rating</th>
                            <th>Attendance Score</th>
                            <th>Target Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.performance
                            .filter(emp => deptFilter === 'All Departments' || emp.dept === deptFilter)
                            .map((emp, idx) => {
                                const attColor = emp.attendance >= 90 ? 'good' : (emp.attendance >= 80 ? 'avg' : 'poor');
                                const progColor = emp.progress >= 85 ? '#00b894' : (emp.progress >= 70 ? '#f39c12' : '#ff7675');
                                return (
                                <tr key={idx}>
                                    <td>
                                        <div className="staff-profile-pill">
                                            <div className="staff-avatar" style={{ backgroundColor: '#f1f2f6', color: '#636e72' }}>{getInitials(emp.name)}</div>
                                            <div>
                                                <div className="staff-name">{emp.name}</div>
                                                <div className="staff-role">{emp.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '13px', fontWeight: 600, color: '#636e72' }}>{emp.dept}</td>
                                    <td>
                                        <div className="star-rating">
                                            {[...Array(5)].map((_, i) => (
                                                <StarIcon key={i} size={12} fill={i < Math.floor(emp.rating) ? "#f1c40f" : "none"} stroke="#f1c40f" />
                                            ))}
                                            <span style={{ color: '#636e72', fontSize: '11px', marginLeft: '5px' }}>({emp.rating})</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`attendance-pill ${attColor}`}>{emp.attendance}%</span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#2d3436', marginBottom: '3px' }}>{emp.progress}%</div>
                                        <div className="progress-container">
                                            <div className="progress-bar" style={{ width: `${emp.progress}%`, backgroundColor: progColor }}></div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const [selectedMovement, setSelectedMovement] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const showMovementDetails = (mov) => {
        setSelectedMovement(mov);
        setIsModalOpen(true);
    };

    const closeMovementModal = () => {
        setIsModalOpen(false);
        setSelectedMovement(null);
    };

    if (permLoading) return null;

    if (!canView) {
        return <Navigate to="/hr/dashboard" replace />;
    }

    return (
        <div className="reports-container">
            {/* Movement Details Modal */}
            {isModalOpen && selectedMovement && (
                <div className={`modal-overlay active`} onClick={closeMovementModal}>
                    <div className="details-modal" onClick={e => e.stopPropagation()} style={{
                        background: 'white',
                        width: '90%',
                        maxWidth: '500px',
                        borderRadius: '16px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        padding: '30px',
                        position: 'relative'
                    }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', color: '#2d3436', margin: 0 }}>Movement Details</h3>
                                <p style={{ fontSize: '11px', color: '#a4b0be', fontWeight: 600, margin: 0 }}>
                                    REF: {selectedMovement.id || 'MOV-000'}
                                </p>
                            </div>
                            <button className="modal-close" onClick={closeMovementModal} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#a4b0be', cursor: 'pointer' }}>
                                <AlertCircle size={20} />
                            </button>
                        </div>

                        <div className="details-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Original Staff</label>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3436' }}>{selectedMovement.oldEmployeeName}</span>
                            </div>
                            <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Replaced By</label>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3436' }}>Pending Hire</span>
                            </div>
                            <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Site From</label>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3436' }}>Main Branch</span>
                            </div>
                            <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Site To</label>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3436' }}>City Center</span>
                            </div>
                            <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Status</label>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3436' }}>{selectedMovement.replacementStatus}</span>
                            </div>
                            <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Reason</label>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3436' }}>Resignation</span>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #f1f2f6', marginBottom: '20px' }} />

                        <div className="detail-item">
                            <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#a4b0be', letterSpacing: '0.5px' }}>Approved By</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dfe6e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>M</div>
                                <span style={{ fontSize: '13px', fontWeight: 700 }}>Manager Name</span>
                            </div>
                        </div>

                        <div className="duration-badge" style={{ background: '#fff9e6', color: '#f39c12', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                            <Clock size={16} />
                            <div style={{ fontSize: '11px', fontWeight: 700 }}>
                                Currently Active for: {selectedMovement.slaDays || 0} Days
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs moved to Header */}


            <div className="reports-content-area">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-gray-100 border-t-[#00b894] rounded-full animate-spin"></div>
                        <p className="mt-4 text-[13px] font-medium text-gray-400">Loading Report Intelligence...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'existing' && renderStaffingOverview()}
                        {activeTab === 'replacement' && renderReplacementMovements()}
                        {activeTab === 'analytics' && renderHiringTrends()}
                        {activeTab === 'performance' && renderPerformanceReport()}
                    </>
                )}
            </div>
        </div>
    );
};

export default PersonnelReports;
