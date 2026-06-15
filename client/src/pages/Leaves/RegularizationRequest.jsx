import React, { useState, useEffect, useMemo } from 'react';
import { Pagination } from 'antd';
import api from '../../utils/api';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Info, AlertTriangle, RefreshCw, Activity, Layers, AlertCircle } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import dayjs from 'dayjs';

export default function RegularizationRequest() {
    const [activeTab, setActiveTab] = useState('apply'); // apply | history
    const [requests, setRequests] = useState([]);

    // Calendar & Data State
    const [attendance, setAttendance] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [settings, setSettings] = useState({});
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Toggle for Custom Selects
    const [isIssueTypeOpen, setIsIssueTypeOpen] = useState(false);
    const [isLeaveTypeOpen, setIsLeaveTypeOpen] = useState(false);

    // Toggle for Time Pickers
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);


    // Form
    const [form, setForm] = useState({
        category: 'Attendance', // Attendance | Leave
        startDate: '',
        endDate: '',
        issueType: '',
        reason: '',
        // Dynamic Fields
        checkIn: '',
        checkOut: '',
        requestedLeaveType: '',
        originalLeaveType: ''
    });

    useEffect(() => {
        if (activeTab === 'history') fetchHistory();
        if (activeTab === 'apply') fetchData();
    }, [activeTab, currentMonth, currentYear]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [attRes, holidayRes, settingsRes] = await Promise.all([
                api.get(`/attendance/my?month=${currentMonth + 1}&year=${currentYear}`),
                api.get('/holidays'),
                api.get('/attendance/settings')
            ]);
            setAttendance(attRes.data || []);
            setHolidays(holidayRes.data || []);
            setSettings(settingsRes.data || {});
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get('/employee/regularization/my');
            setRequests(res.data.data);
        } catch (err) {
            console.error(err);
        }
    };

    // Calculate Disabled Dates based on strict rules
    const disabledDates = useMemo(() => {
        const disabled = {};
        const today = dayjs().format('YYYY-MM-DD');
        const weeklyOffs = settings.weeklyOffDays || [0];

        // Helper to check range
        const startOfMonth = dayjs(`${currentYear}-${currentMonth + 1}-01`);
        const endOfMonth = startOfMonth.endOf('month');

        let current = startOfMonth;
        while (current.isBefore(endOfMonth) || current.isSame(endOfMonth)) {
            const dateStr = current.format('YYYY-MM-DD');

            // 1. Future Dates
            if (dateStr > today) {
                disabled[dateStr] = "Future date selection is blocked";
            }

            // 2. Weekly Offs
            if (weeklyOffs.includes(current.day())) {
                disabled[dateStr] = "Selection blocked on Weekly Offs";
            }

            current = current.add(1, 'day');
        }

        // 3. Company Holidays
        holidays.forEach(h => {
            const dStr = h.date.split('T')[0];
            disabled[dStr] = `Holiday: ${h.name}`;
        });

        // 4. Payroll Locked & Approved Leave Days
        attendance.forEach(att => {
            const dStr = att.date.split('T')[0];
            if (att.locked) {
                disabled[dStr] = "Attendance record is locked by Payroll";
            }
            if (att.status === 'leave') {
                disabled[dStr] = "Regularization not allowed on Approved Leave";
            }
        });

        return disabled;
    }, [currentMonth, currentYear, attendance, holidays, settings]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.startDate) return alert("Please select a date from the calendar");

        try {
            const payload = {
                category: form.category,
                startDate: form.startDate,
                endDate: form.endDate || form.startDate,
                issueType: form.issueType,
                reason: form.reason,
                requestedData: {}
            };

            if (form.category === 'Attendance') {
                if (form.checkIn) payload.requestedData.checkIn = `${form.startDate}T${form.checkIn}:00`;
                if (form.checkOut) payload.requestedData.checkOut = `${form.startDate}T${form.checkOut}:00`;
            } else {
                payload.requestedData.requestedLeaveType = form.requestedLeaveType;
                payload.requestedData.originalLeaveType = form.originalLeaveType;
            }

            await api.post('/employee/regularization', payload);
            alert('Request Submitted Successfully');
            setActiveTab('history');
            setForm({ category: 'Attendance', startDate: '', endDate: '', issueType: '', reason: '', checkIn: '', checkOut: '', requestedLeaveType: '', originalLeaveType: '' });
        } catch (err) {
            alert(err.response?.data?.error || "Submission Failed");
        }
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            Pending: "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
            Approved: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)]",
            Rejected: "bg-rose-500/10 text-rose-500 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]",
        };
        const icons = {
            Pending: <Clock size={10} className="animate-pulse" />,
            Approved: <CheckCircle size={10} className="animate-bounce-subtle" />,
            Rejected: <XCircle size={10} />
        };
        const label = status || 'Pending';
        return (
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border backdrop-blur-md transition-all duration-500 group-hover:scale-110 ${styles[label]}`}>
                <div className="relative">
                    {icons[label]}
                    {label === 'Pending' && <div className="absolute inset-0 bg-amber-500 rounded-full blur-sm opacity-50 animate-ping"></div>}
                </div>
                {label}
            </div>
        );
    };

    // Custom Time Picker Component
    function CustomTimeInput({ value, onChange, isOpen, setIsOpen, placeholder }) {
        const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
        const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
        const [selectedHour, selectedMinute] = (value || '--:--').split(':');

        const updateTime = (newH, newM) => {
            const h = newH !== undefined ? newH : (selectedHour === '--' ? '09' : selectedHour);
            const m = newM !== undefined ? newM : (selectedMinute === '--' ? '00' : selectedMinute);
            onChange(`${h}:${m}`);
        };

        return (
            <div className="relative w-full">
                {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full bg-slate-100/30 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-xs font-black text-center outline-none focus:ring-1 focus:ring-indigo-500 relative z-20 transition-all flex items-center justify-between gap-2 shadow-inner ${isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''}`}
                >
                    <span className={`tracking-widest ${value ? "text-slate-900 dark:text-white" : "text-slate-400 opacity-40"}`}>{value || placeholder}</span>
                    <Clock size={14} className="text-indigo-500" />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 z-[60] mt-3 glass-morphism border border-white/20 dark:border-white/5 rounded-3xl shadow-3xl p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex h-56 w-[200px] backdrop-blur-3xl">
                        <div className="flex-1 overflow-y-auto no-scrollbar border-r border-white/10 custom-scrollbar">
                            <div className="text-[8px] font-black text-slate-400 text-center sticky top-0 bg-slate-50 dark:bg-slate-900/90 py-2 border-b border-white/5 uppercase tracking-widest z-10">HH</div>
                            {hours.map(h => (
                                <div key={h} onClick={() => updateTime(h, undefined)}
                                    className={`text-center py-3 text-xs font-black cursor-pointer transition-all ${selectedHour === h ? 'bg-indigo-500 text-white shadow-lg scale-95 mx-2 rounded-lg' : 'text-slate-500 hover:text-indigo-500 hover:bg-white/5'}`}
                                >
                                    {h}
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar custom-scrollbar">
                            <div className="text-[8px] font-black text-slate-400 text-center sticky top-0 bg-slate-50 dark:bg-slate-900/90 py-2 border-b border-white/5 uppercase tracking-widest z-10">MM</div>
                            {minutes.map(m => (
                                <div key={m} onClick={() => updateTime(undefined, m)}
                                    className={`text-center py-3 text-xs font-black cursor-pointer transition-all ${selectedMinute === m ? 'bg-indigo-500 text-white shadow-lg scale-95 mx-2 rounded-lg' : 'text-slate-500 hover:text-indigo-500 hover:bg-white/5'}`}
                                >
                                    {m}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Custom Select Component
    function CustomSelect({ options, values, value, onChange, placeholder, isOpen, setIsOpen }) {
        if (!options) return null;
        const displayValue = values ? options[values.indexOf(value)] : value;

        return (
            <div className="relative">
                {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>}
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    className={`w-full bg-slate-100/30 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-4 text-xs font-black text-left flex items-center justify-between outline-none transition-all relative z-20 shadow-inner group/btn ${isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''}`}
                >
                    <span className={`uppercase tracking-widest ${value ? "text-slate-900 dark:text-white" : "text-slate-400 opacity-40 text-[10px]"}`}>
                        {displayValue || placeholder}
                    </span>
                    <div className="flex items-center gap-1">
                       <span className={`w-1 h-1 rounded-full transition-all duration-500 ${isOpen ? 'bg-indigo-500 animate-pulse w-3' : 'bg-slate-300 dark:bg-white/20'}`}></span>
                       <ChevronLeft size={16} className={`text-indigo-500 transition-transform duration-500 ${isOpen ? '-rotate-90' : 'rotate-0'}`} />
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 z-[60] mt-3 glass-morphism border border-white/20 dark:border-white/5 rounded-3xl shadow-3xl overflow-hidden animate-in slide-in-from-top-4 duration-300 backdrop-blur-3xl p-2 min-w-[300px]">
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                            {options.map((opt, i) => {
                                const val = values ? values[i] : opt;
                                const isSelected = value === val;
                                return (
                                    <div
                                        key={opt}
                                        onClick={() => {
                                            onChange(val);
                                            setIsOpen(false);
                                        }}
                                        className={`px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center justify-between group/item ${isSelected
                                            ? 'bg-indigo-500 text-white shadow-lg'
                                            : 'text-slate-500 hover:bg-white/10 hover:text-indigo-500'}`}
                                    >
                                        {opt}
                                        {isSelected ? (
                                            <CheckCircle size={14} className="animate-in zoom-in duration-300" />
                                        ) : (
                                            <div className="w-1 h-1 rounded-full bg-indigo-500/0 group-hover/item:bg-indigo-500 transition-all"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative min-h-[140vh] bg-transparent text-slate-900 dark:text-white transition-colors duration-700 overflow-x-hidden pb-20 w-full flex justify-center">
            {/* BACKGROUND INFRASTRUCTURE */}
            <div className="fixed inset-0 tactical-grid opacity-20 pointer-events-none"></div>
            <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none animate-pulse"></div>
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-float"></div>
            <div className="fixed top-1/2 left-0 w-1 h-[40vh] bg-gradient-to-b from-transparent via-indigo-500/40 to-transparent blur-sm animate-pulse"></div>
            <div className="fixed top-1/2 right-0 w-1 h-[40vh] bg-gradient-to-b from-transparent via-indigo-500/40 to-transparent blur-sm animate-pulse"></div>
            
            <div className="relative z-10 w-full max-w-[1280px] space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 px-4 sm:px-6 pt-4">
                
                {/* TOP COMMAND BAR - STREAMLINED */}
                <div className="relative group">
                    {/* Frame Accents */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-indigo-500"></div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-indigo-500"></div>
                    
                    <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-3 px-6 rounded-2xl border border-slate-200/50 dark:border-white/5 backdrop-blur-2xl shadow-xl">
                        <div className="flex items-center gap-4">
                           <div className="relative shrink-0">
                              <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center shadow-xl overflow-hidden relative group">
                                 <RefreshCw size={18} className="text-white dark:text-slate-900 animate-spin-slow relative z-10" />
                                 <div className="absolute inset-0 hud-scanline opacity-20"></div>
                                 <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              </div>
                              {/* Rotating Status Orbit */}
                              <div className="absolute -inset-2 border border-dashed border-indigo-500/30 rounded-full animate-scan pointer-events-none"></div>
                           </div>
                           
                           <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                 <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.3em] opacity-80">Section 04 // Ops</span>
                              </div>
                              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] glow-text-indigo leading-none">
                                 Attendance <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-indigo-500">Correction</span>
                              </h2>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                     System Status: Online <span className="opacity-30">|</span> <Activity size={10} className="text-indigo-500" /> Integrity: Optimal
                                 </p>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-1 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-white/5 backdrop-blur-md">
                            {[
                                { id: 'apply', label: 'New Request', icon: Clock },
                                { id: 'history', label: 'History Archive', icon: Layers }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2.5 px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-500 relative overflow-hidden group/tab ${activeTab === tab.id
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                                        : 'text-slate-500 hover:text-indigo-500'}`}
                                >
                                    <tab.icon size={12} className={activeTab === tab.id ? 'animate-pulse' : 'group-hover/tab:scale-110 transition-transform'} />
                                    {tab.label}
                                    {activeTab === tab.id && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent"></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {activeTab === 'apply' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-stretch">
                        
                        {/* CALENDAR SENSOR ARRAY (LEFT) */}
                        <div className="xl:col-span-8 group relative">
                            <div className="relative glass-morphism rounded-[40px] shadow-3xl border border-white/10 dark:border-white/5 p-2 transition-all duration-700 group-hover:shadow-[0_0_80px_rgba(20,184,166,0.1)]">
                                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-t-[40px]"></div>
                                
                                <div className="relative z-10 p-8 space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-white/5">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
                                                Temporal Grid
                                            </h3>
                                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest opacity-60">Specify the historical window for adjustment</p>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 backdrop-blur-xl group/nav">
                                            <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 rounded-xl transition-all duration-300 transform group-hover/nav:-translate-x-1"><ChevronLeft size={18} /></button>
                                            <div className="px-6 text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] font-mono border-x border-slate-200 dark:border-white/10">
                                                {dayjs(new Date(currentYear, currentMonth)).format('MMM YYYY')}
                                            </div>
                                            <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 rounded-xl transition-all duration-300 transform group-hover/nav:translate-x-1"><ChevronRight size={18} /></button>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        {/* Corner Brackets */}
                                        <div className="absolute -top-4 -left-4 w-12 h-12 border-t border-l border-indigo-500/30 rounded-tl-2xl"></div>
                                        <div className="absolute -top-4 -right-4 w-12 h-12 border-t border-r border-indigo-500/30 rounded-tr-2xl"></div>
                                        <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b border-l border-indigo-500/30 rounded-bl-2xl"></div>
                                        <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b border-r border-indigo-500/30 rounded-br-2xl"></div>
                                        
                                        <div className="scale-[0.99] transition-all group-hover:scale-100 overflow-visible py-4">
                                            <AttendanceCalendar
                                                data={attendance}
                                                holidays={holidays}
                                                settings={settings}
                                                currentMonth={currentMonth}
                                                currentYear={currentYear}
                                                onDateClick={(date) => setForm({ ...form, startDate: date })}
                                                selectedDate={form.startDate}
                                                selectionMode={true}
                                                disabledDates={disabledDates}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Stats Summary Line */}
                                    <div className="pt-6 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                                       {[
                                          { label: 'Active Days', val: attendance.filter(a => a.checkIn).length, col: 'text-indigo-500' },
                                          { label: 'Missing Logs', val: attendance.filter(a => !a.checkIn && !a.isHoliday && !a.isWeeklyOff).length, col: 'text-rose-500' },
                                          { label: 'Correction Cap', val: 5, col: 'text-indigo-500' },
                                          { label: 'Audit Score', val: '98%', col: 'text-emerald-500' }
                                       ].map((s, i) => (
                                          <div key={i} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 shadow-inner">
                                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</span>
                                             <span className={`text-sm font-black ${s.col} tracking-tighter`}>{s.val}</span>
                                          </div>
                                       ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SUBMISSION INTERFACE (RIGHT) */}
                        <div className="xl:col-span-4">
                            <div className="sticky top-10 space-y-10">
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/30 to-indigo-500/30 rounded-[40px] blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                                    <div className="relative bg-white/60 dark:bg-slate-900/60 rounded-[40px] shadow-3xl border border-white/20 dark:border-white/10 p-10 backdrop-blur-3xl overflow-hidden min-h-[700px]">
                                        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                           <Activity size={120} className="text-indigo-500" />
                                        </div>
                                        
                                        <form onSubmit={handleSubmit} className="relative z-10 h-full flex flex-col gap-8">
                                            {/* Top Signal Bar */}
                                            <div className="flex items-center justify-between text-[7px] font-black text-indigo-500/40 uppercase tracking-[0.3em]">
                                               <span>Stream_Type: Correction_Input</span>
                                               <div className="flex gap-1 h-2 items-end">
                                                  {[1,2,3,4,5,6].map(i => <div key={i} className={`w-0.5 bg-indigo-500/40 animate-pulse`} style={{ height: `${Math.random()*100}%` }}></div>)}
                                               </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="flex items-center gap-4">
                                                   <div className="w-1 h-10 bg-gradient-to-b from-indigo-500 to-indigo-500 rounded-full"></div>
                                                   <div>
                                                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.3em]">Adjustment Module</h4>
                                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Core Data Insertion</p>
                                                   </div>
                                                </div>

                                                {/* Category Switcher - Ultra Premium */}
                                                <div className="relative p-1.5 bg-slate-100/50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-white/10 flex gap-2">
                                                    {['Attendance', 'Leave'].map((cat) => (
                                                        <button
                                                            key={cat}
                                                            type="button"
                                                            onClick={() => setForm({ ...form, category: cat })}
                                                            className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative z-10 ${form.category === cat ? 'text-white dark:text-slate-900' : 'text-slate-500 hover:text-indigo-500'}`}
                                                        >
                                                            {cat}
                                                            {form.category === cat && (
                                                                <div className="absolute inset-0 bg-slate-900 dark:bg-white rounded-xl shadow-lg -z-10 animate-in zoom-in-95 duration-300"></div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-6 flex-1">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                                       Reason Category
                                                       <span className="text-indigo-500 font-mono">[01]</span>
                                                    </label>
                                                    <CustomSelect
                                                        options={form.category === 'Attendance'
                                                            ? ['Missed Check In', 'Missed Check Out', 'Forgot to Punch (Both)', 'Actually Present']
                                                            : ['Applied Wrong Leave Type', 'Forgot to Apply Leave', 'LOP Correction', 'Cancel Approved Leave']
                                                        }
                                                        value={form.issueType}
                                                        onChange={(val) => setForm({ ...form, issueType: val })}
                                                        placeholder="-- SELECT REASON --"
                                                        isOpen={isIssueTypeOpen}
                                                        setIsOpen={setIsIssueTypeOpen}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                                       Temporal Nodes
                                                       <span className="text-indigo-500 font-mono">[02]</span>
                                                    </label>
                                                    
                                                    {form.category === 'Attendance' ? (
                                                        <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 shadow-inner">
                                                            <div className="space-y-2">
                                                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">In_Time</span>
                                                                <CustomTimeInput
                                                                    value={form.checkIn}
                                                                    onChange={(val) => setForm({ ...form, checkIn: val })}
                                                                    isOpen={isCheckInOpen}
                                                                    setIsOpen={setIsCheckInOpen}
                                                                    placeholder="00:00"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Out_Time</span>
                                                                <CustomTimeInput
                                                                    value={form.checkOut}
                                                                    onChange={(val) => setForm({ ...form, checkOut: val })}
                                                                    isOpen={isCheckOutOpen}
                                                                    setIsOpen={setIsCheckOutOpen}
                                                                    placeholder="00:00"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4 p-5 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 shadow-inner">
                                                           <input 
                                                              type="text" 
                                                              placeholder="Current Status" 
                                                              className="w-full bg-slate-900/5 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-xs font-black text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                              value={form.originalLeaveType} onChange={e => setForm({ ...form, originalLeaveType: e.target.value })} 
                                                           />
                                                           <CustomSelect
                                                               options={['Casual Leave', 'Paid Leave', 'Sick Leave', 'Work From Home']}
                                                               values={['CL', 'PL', 'SL', 'WFH']}
                                                               value={form.requestedLeaveType}
                                                               onChange={(val) => setForm({ ...form, requestedLeaveType: val })}
                                                               placeholder="-- CONVERT TO --"
                                                               isOpen={isLeaveTypeOpen}
                                                               setIsOpen={setIsLeaveTypeOpen}
                                                           />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                                       Justification
                                                       <span className="text-indigo-500 font-mono">[03]</span>
                                                    </label>
                                                    <textarea 
                                                       required 
                                                       className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-5 text-xs font-black min-h-[120px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-none transition-all placeholder:text-slate-400 placeholder:opacity-30 shadow-inner"
                                                       placeholder="Detailed reason for this correction request..."
                                                       value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}></textarea>
                                                </div>
                                            </div>

                                            <div className="pt-6 space-y-4">
                                                <button
                                                    type="submit"
                                                    disabled={!form.startDate || !form.reason}
                                                    className={`group relative w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] overflow-hidden transition-all duration-700 ${form.startDate && form.reason
                                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl hover:scale-[1.03] active:scale-95'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'}`}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                                    <span className="relative z-10 flex items-center justify-center gap-3">
                                                       {form.startDate ? (
                                                          <>
                                                             <CheckCircle size={16} />
                                                             Commit Request
                                                          </>
                                                       ) : 'Select Record Date'}
                                                    </span>
                                                </button>
                                                
                                                <div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                                                   <span className="text-[8px] font-black text-indigo-600/60 uppercase tracking-widest">Auth_Audit: ACTIVE</span>
                                                   <div className="flex gap-1">
                                                      {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-2 rounded-full ${i < 4 ? 'bg-indigo-500 animate-pulse' : 'bg-slate-200 dark:bg-slate-800'}`}></div>)}
                                                   </div>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* HISTORY ARCHIVE - COMMAND LEDGER */
                    <div className="animate-in fade-in zoom-in-95 duration-700">
                        <div className="relative group overflow-hidden rounded-[40px] shadow-3xl border border-white/10 dark:border-white/5 bg-white/40 dark:bg-slate-900/60 backdrop-blur-3xl p-1">
                            <div className="absolute inset-0 hud-scanline opacity-[0.03] pointer-events-none"></div>
                            
                            <div className="relative z-10">
                                <div className="p-10 border-b border-white/10 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between rounded-t-[38px]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-1.5 h-10 bg-gradient-to-b from-indigo-500 to-indigo-500 rounded-full"></div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">Adjustment <span className="text-indigo-500">Archive</span></h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Operational History Ledger</p>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center gap-6">
                                       <div className="flex flex-col items-end">
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Records</span>
                                          <span className="text-sm font-black text-slate-900 dark:text-white">{requests.length}</span>
                                       </div>
                                       <div className="w-px h-10 bg-slate-200 dark:bg-white/10"></div>
                                       <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                                          <RefreshCw size={20} className="animate-spin-slow" />
                                       </div>
                                    </div>
                                </div>

                                <div className="p-10 space-y-6">
                                    {requests.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-6">
                                            {requests.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((req) => (
                                                <div
                                                    key={req._id}
                                                    className="group relative bg-white/40 dark:bg-slate-800/30 p-8 rounded-[32px] border border-slate-100 dark:border-white/5 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-slate-800/80 transition-all duration-700 flex flex-col xl:flex-row items-center gap-8 shadow-sm hover:shadow-3xl"
                                                >
                                                    <div className="absolute top-0 right-10 w-24 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent group-hover:w-48 transition-all"></div>
                                                    
                                                    {/* Enhanced Date Marker */}
                                                    <div className="relative shrink-0 group-hover:scale-110 transition-transform duration-700">
                                                        <div className="w-20 h-20 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{dayjs(req.startDate).format('MMM')}</span>
                                                            <span className="text-3xl font-black italic tracking-tighter">{dayjs(req.startDate).format('DD')}</span>
                                                            <div className="absolute bottom-0 inset-x-0 h-1 bg-indigo-500/80"></div>
                                                            <div className="absolute inset-0 hud-scanline opacity-10"></div>
                                                        </div>
                                                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 flex items-center justify-center">
                                                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                        </div>
                                                    </div>

                                                    {/* Info Cluster */}
                                                    <div className="flex-1 space-y-4 text-center xl:text-left">
                                                        <div className="flex flex-wrap items-center justify-center xl:justify-start gap-4">
                                                            <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight italic uppercase">{req.issueType}</span>
                                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border-2 shadow-sm ${req.category === 'Attendance'
                                                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'}`}>
                                                                {req.category}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="relative">
                                                           <p className="text-xs font-bold text-slate-400 italic line-clamp-2 max-w-2xl group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">
                                                               "{req.reason}"
                                                           </p>
                                                        </div>

                                                        {req.adminRemark && (
                                                            <div className="inline-flex items-center gap-3 p-3 px-5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/10 border border-rose-500/20 animate-in slide-in-from-left-4">
                                                                <AlertCircle size={14} className="text-rose-500" />
                                                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest">HR REMARK: {req.adminRemark}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status & Analytics */}
                                                    <div className="xl:min-w-[180px] flex flex-col items-center xl:items-end gap-3 justify-center">
                                                       <div className="transform scale-125 group-hover:scale-[1.35] group-hover:rotate-3 transition-all duration-500">
                                                          {getStatusBadge(req.status)}
                                                       </div>
                                                       <div className="flex flex-col items-center xl:items-end opacity-30 group-hover:opacity-100 transition-all">
                                                          <div className="flex gap-0.5 mb-1 items-end">
                                                             {[1,2,3,4].map(i => <div key={i} className={`w-1 bg-indigo-500/40 rounded-full`} style={{ height: `${i*3}px` }}></div>)}
                                                          </div>
                                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Hash_Ref: ID_{String(req._id || '').slice(-6).toUpperCase()}</span>
                                                       </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-40 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-white/5 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10 group cursor-pointer">
                                            <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 shadow-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 relative">
                                                <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping"></div>
                                                <Layers size={36} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.5em]">Ledger Empty</h4>
                                            <p className="text-[10px] text-slate-300 dark:text-slate-500 mt-2 uppercase tracking-widest">Historical logs are currently blank</p>
                                        </div>
                                    )}
                                </div>

                                {requests.length > pageSize && (
                                    <div className="px-10 py-10 border-t border-white/10 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex justify-end rounded-b-[38px]">
                                        <Pagination
                                            current={currentPage}
                                            pageSize={pageSize}
                                            total={requests.length}
                                            onChange={(page) => setCurrentPage(page)}
                                            showSizeChanger={false}
                                            className="custom-pagination"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
