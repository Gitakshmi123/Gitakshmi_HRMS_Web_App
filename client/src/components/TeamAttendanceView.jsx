import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Search, MapPin, Clock, Calendar as CalendarIcon, User, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import AttendanceCalendar from './AttendanceCalendar';
import { formatDateDDMMYYYY, formatDuration } from '../utils/dateUtils';
import { DatePicker, Pagination } from 'antd';
import dayjs from 'dayjs';

export default function TeamAttendanceView() {
    const [teamAttendance, setTeamAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Register View for specific employee
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [employeeAttendance, setEmployeeAttendance] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [holidays, setHolidays] = useState([]);
    const [settings, setSettings] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        fetchTeamAttendance();
    }, [selectedDate]);

    const fetchTeamAttendance = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/attendance/team?date=${selectedDate}`);
            setTeamAttendance(res.data);
        } catch (err) {
            console.error("Failed to fetch team attendance", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewingEmployee) fetchEmployeeRegister();
    }, [viewingEmployee, currentMonth, currentYear]);

    const fetchEmployeeRegister = async () => {
        try {
            const [attRes, holidayRes, settingsRes] = await Promise.all([
                api.get(`/attendance/my?employeeId=${viewingEmployee._id}&month=${currentMonth + 1}&year=${currentYear}`),
                api.get('/holidays'),
                api.get('/attendance/settings')
            ]);
            setEmployeeAttendance(attRes.data);
            setHolidays(holidayRes.data || []);
            setSettings(settingsRes.data || {});
        } catch (err) {
            console.error(err);
        }
    };

    const changeDate = (offset) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + offset);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleExport = () => {
        if (!teamAttendance.length) return alert("No data to export");
        const headers = ["ID", "Name", "In Time", "Out Time", "Hours", "Status", "Is Late"];
        const rows = teamAttendance.map(item => [
            item.employee.employeeId,
            `${item.employee.firstName} ${item.employee.lastName}`,
            item.checkIn ? new Date(item.checkIn).toLocaleTimeString() : '-',
            item.checkOut ? new Date(item.checkOut).toLocaleTimeString() : '-',
            item.workingHours || 0,
            item.status,
            item.isLate ? "YES" : "NO"
        ]);
        const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Team_Attendance_${formatDateDDMMYYYY(selectedDate)}.csv`;
        link.click();
    };

    const filteredData = teamAttendance.filter(item => {
        const nameMatch = `${item.employee.firstName} ${item.employee.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
        const statusMatch = statusFilter === 'all' || item.status.toLowerCase() === statusFilter.toLowerCase();
        return nameMatch && statusMatch;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Team Daily Pulse</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live visibility into your team's presence</p>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"><ChevronLeft size={20} /></button>
                    <DatePicker
                        className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-300 uppercase outline-none px-2 border-none shadow-none hover:bg-transparent focus:bg-transparent"
                        format="DD-MM-YYYY"
                        placeholder="DD-MM-YYYY"
                        allowClear={false}
                        suffixIcon={null}
                        value={selectedDate ? dayjs(selectedDate) : null}
                        onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : '')}
                    />
                    <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Team</div>
                    <div className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{teamAttendance.length}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Present Today</div>
                    <div className="text-4xl font-black text-emerald-500 tracking-tighter">{teamAttendance.filter(a => a.status === 'present').length}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">Absent</div>
                    <div className="text-4xl font-black text-rose-500 tracking-tighter">{teamAttendance.filter(a => a.status === 'absent').length}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">Late In</div>
                    <div className="text-4xl font-black text-amber-500 tracking-tighter">{teamAttendance.filter(a => a.isLate).length}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search employee by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm font-bold outline-none shadow-sm focus:border-blue-500 transition"
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm font-bold uppercase outline-none shadow-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late In</option>
                    </select>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition"
                    >
                        <Clock size={16} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Team List Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">In/Out Time</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Register</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
                            <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden shadow-inner cursor-pointer" onClick={() => setViewingEmployee(item.employee)}>
                                            {item.employee.profilePic ? <img src={item.employee.profilePic} alt="" className="h-full w-full object-cover" /> : <User size={20} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">{item.employee.firstName} {item.employee.lastName}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{item.employee.employeeId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={12} className="text-emerald-500" />
                                            {item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={12} className="text-rose-500" />
                                            {item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-black text-slate-800 dark:text-white tracking-widest uppercase">
                                        {formatDuration(item.workingHours || 0)}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <StatusBadge status={item.status} />
                                        {item.isLate && <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Late Mark</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        <MapPin size={12} />
                                        {item.logs?.[0]?.location || 'Remote'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setViewingEmployee(item.employee)}
                                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 rounded-xl transition"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-sm font-bold text-slate-400 italic">No attendance records found for this date</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {filteredData.length > pageSize && (
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={filteredData.length}
                            onChange={(page) => setCurrentPage(page)}
                            showSizeChanger={false}
                        />
                    </div>
                )}
            </div>

            {/* Employee Register Modal */}
            {viewingEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingEmployee(null)}></div>
                    <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 rounded-[40px] shadow-2xl border border-white/20 p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-300 font-black text-xl shadow-lg">
                                    {viewingEmployee.firstName[0]}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                                        {viewingEmployee.firstName} {viewingEmployee.lastName}'s Register
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{viewingEmployee.employeeId}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingEmployee(null)} className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-rose-500 shadow-lg transition">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl w-fit border border-slate-100 dark:border-slate-800 shadow-sm">
                                <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"><ChevronLeft size={20} /></button>
                                <span className="text-sm font-black uppercase tracking-widest min-w-[120px] text-center">
                                    {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"><ChevronRight size={20} /></button>
                            </div>

                            <AttendanceCalendar
                                data={employeeAttendance}
                                holidays={holidays}
                                settings={settings}
                                currentMonth={currentMonth}
                                currentYear={currentYear}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }) {
    const config = {
        present: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        absent: 'bg-rose-50 text-rose-600 border-rose-100',
        leave: 'bg-blue-50 text-blue-600 border-blue-100',
        half_day: 'bg-orange-50 text-orange-600 border-orange-100',
        missed_punch: 'bg-purple-50 text-purple-600 border-purple-100',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border w-fit ${config[status.toLowerCase()] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
            {status}
        </span>
    );
}
